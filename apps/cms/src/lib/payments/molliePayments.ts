import "server-only"
import type { Payload } from "payload"
import type { Order, SiteGenerationRun, Tenant } from "@/payload-types"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import { provisionPaidDomainOrder } from "@/lib/domains/provisioning"
import { domainCheckoutPrice, fixedDomainOrderPriceFromEnv, maxDomainProviderPriceFromEnv, normalizeDomainOrderState } from "@/lib/domains/orderState"
import {
  normalizeGenerationRunPaymentState,
  recordGenerationRunPostPaymentAutomationState,
  type GenerationRunPaymentState,
  type GenerationRunPaymentStatus,
} from "@/lib/payments/generationRunPayment"
import { publishAndActivateAfterCompletedPayment } from "@/lib/payments/postPaymentActivation"
import { PREVIEW_HOST } from "@/lib/preview/previewHost"
import { previewClientSlugFromDomain } from "@/lib/preview/previewAccess"
import { verifyCheckoutEvidence } from "@/lib/legal/checkoutEvidence"
import {
  MollieApiError,
  createMollieCustomer,
  createMolliePayment,
  createMollieSubscription,
  mollieDomainProvisioningEnabled,
  mollieRenewalAmountFromEnv,
  publicCmsOrigin,
  retrieveMolliePayment,
  type MolliePayment,
} from "@/lib/payments/mollieAdapter"

type CreateCheckoutInput = {
  runId: string | number
  customerEmail: string
  clientSlug?: string | null
  selectedDomain?: string | null
  actor?: string | number | null
  orderId?: string | number | null
}

type CheckoutResult = {
  payment: GenerationRunPaymentState
  checkoutUrl: string
  reused: boolean
}

export class IgnorableMollieWebhookError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IgnorableMollieWebhookError"
  }
}

export const isIgnorableMollieWebhookError = (error: unknown): boolean =>
  error instanceof IgnorableMollieWebhookError ||
  (error instanceof MollieApiError && error.status === 404)

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const cleanDomain = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
  return normalized && normalized.includes(".") ? normalized : null
}

const selectedDomainFromOrder = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  return cleanDomain(source.selectedDomain ?? source.domain)
}

const mollieSubscriptionInterval = (env: NodeJS.ProcessEnv = process.env): string =>
  env.MOLLIE_SITE_SUBSCRIPTION_INTERVAL?.trim() || "1 month"

const oneYearFromNowDate = (now = new Date()): string => {
  const date = new Date(now)
  date.setUTCFullYear(date.getUTCFullYear() + 1)
  return date.toISOString().slice(0, 10)
}

const isApproved = (run: SiteGenerationRun): boolean =>
  (run.clientApproval as { status?: unknown } | null | undefined)?.status === "approved"

const loadRunAndTenant = async (payload: Payload, runId: string | number): Promise<{ run: SiteGenerationRun; tenant: Tenant }> => {
  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: runId,
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun
  if (!run || run.status !== "preview_ready") throw new Error("Generation run is not preview-ready.")

  const tenantId = relationshipId(run.tenant)
  if (!tenantId) throw new Error("Generation run is missing a tenant.")
  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  if (!tenant || tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Tenant is not available for payment.")
  }
  return { run, tenant }
}

const molliePaymentState = (input: {
  current?: unknown
  status: GenerationRunPaymentStatus
  providerStatus: string
  externalReference: string
  checkoutUrl?: string | null
  customerEmail?: string | null
  clientSlug?: string | null
  selectedDomain?: string | null
  amount?: string | null
  currency?: string | null
  actor?: string | number | null
  note?: string | null
  mollieCustomerId?: string | null
  mollieSequenceType?: string | null
  mollieSubscriptionId?: string | null
  renewalInterval?: string | null
  now?: string
}): GenerationRunPaymentState => {
  const current = normalizeGenerationRunPaymentState(input.current)
  const now = input.now ?? new Date().toISOString()
  return {
    ...current,
    status: input.status,
    provider: "mollie",
    externalReference: input.externalReference,
    actor: input.actor ?? current.actor,
    completedAt: input.status === "completed" ? (current.completedAt ?? now) : current.completedAt,
    waivedAt: current.waivedAt,
    updatedAt: now,
    note: input.note ?? current.note,
    checkoutUrl: input.checkoutUrl ?? current.checkoutUrl,
    customerEmail: input.customerEmail ?? current.customerEmail,
    clientSlug: input.clientSlug ?? current.clientSlug,
    selectedDomain: input.selectedDomain ?? current.selectedDomain,
    amount: input.amount ?? current.amount,
    currency: input.currency ?? current.currency,
    providerStatus: input.providerStatus,
    webhookProcessedAt: input.now ? now : current.webhookProcessedAt,
    mollieCustomerId: input.mollieCustomerId ?? current.mollieCustomerId,
    mollieSequenceType: input.mollieSequenceType ?? current.mollieSequenceType,
    mollieSubscriptionId: input.mollieSubscriptionId ?? current.mollieSubscriptionId,
    renewalInterval: input.renewalInterval ?? current.renewalInterval,
  }
}

export async function createMollieCheckoutForGenerationRun(
  payload: Payload,
  input: CreateCheckoutInput,
): Promise<CheckoutResult> {
  const email = normalizeEmail(input.customerEmail)
  if (!email) throw new Error("Customer email is required for Mollie checkout.")

  const { run, tenant } = await loadRunAndTenant(payload, input.runId)
  if (!isApproved(run)) throw new Error("Mollie checkout requires approved preview.")
  if (input.orderId == null) throw new Error("Mollie checkout requires a frozen legal order.")
  const { order } = await verifyCheckoutEvidence(payload, {
    runId: run.id,
    orderId: input.orderId,
    customerEmail: email,
  })

  const clientSlug = input.clientSlug || previewClientSlugFromDomain(tenant.domain, String(tenant.slug ?? tenant.name ?? ""))
  if (!clientSlug) throw new Error("Client preview slug is required for Mollie checkout.")
  const selectedDomain = cleanDomain(input.selectedDomain) ?? selectedDomainFromOrder(run.domainOrder) ?? cleanDomain(tenant.domain)
  if (!selectedDomain) throw new Error("Selected domain is required for checkout.")
  if (cleanDomain(order.domain) !== selectedDomain) throw new Error("Frozen order domain does not match checkout domain.")

  const current = normalizeGenerationRunPaymentState(run.payment)
  if (current.status === "completed" || current.status === "waived") {
    throw new Error("Payment gate is already satisfied.")
  }
  if (
    current.provider === "mollie" &&
    current.externalReference &&
    current.checkoutUrl &&
    current.status === "pending_provider" &&
    current.customerEmail === email &&
    current.clientSlug === clientSlug &&
    (current.selectedDomain ?? selectedDomain) === selectedDomain
  ) {
    return { payment: current, checkoutUrl: current.checkoutUrl, reused: true }
  }

  const domainOrder = normalizeDomainOrderState(run.domainOrder)
  const providerPrice = domainOrder.domain === selectedDomain && domainOrder.providerPriceAmount && domainOrder.providerPriceCurrency
    ? { amount: domainOrder.providerPriceAmount, currency: domainOrder.providerPriceCurrency }
    : null
  const includedProviderPrice = domainOrder.maxProviderPriceAmount && domainOrder.maxProviderPriceCurrency
    ? { amount: domainOrder.maxProviderPriceAmount, currency: domainOrder.maxProviderPriceCurrency }
    : maxDomainProviderPriceFromEnv()
  const basePaymentAmount = fixedDomainOrderPriceFromEnv()
  const checkoutAmount = domainCheckoutPrice({
    basePrice: basePaymentAmount,
    providerPrice,
    includedProviderPrice,
  })
  const amount = { value: checkoutAmount.amount, currency: checkoutAmount.currency }
  if (Number(order.totalGross).toFixed(2) !== amount.value || order.currency !== amount.currency) {
    throw new Error("Frozen order amount does not match the Mollie checkout amount.")
  }
  const origin = publicCmsOrigin()
  const redirectUrl = `https://${PREVIEW_HOST}/${clientSlug}/checkout?payment=return`
  const webhookUrl = `${origin}/api/payments/mollie/webhook`
  const idempotencyBaseKey = `siab-run-${run.id}-customer-${email}`
  const idempotencyKey = `${idempotencyBaseKey}-payment-v2-${selectedDomain}`
  const mollieCustomerId = current.mollieCustomerId ?? (await createMollieCustomer({
    name: String(tenant.name ?? tenant.slug ?? email),
    email,
    idempotencyKey: `${idempotencyBaseKey}-mollie-customer`,
    metadata: {
      generationRunId: run.id,
      tenantId: tenant.id,
      customerEmail: email,
      clientSlug,
      orderId: order.id,
    },
  })).id
  const molliePayment = await createMolliePayment({
    amount,
    customerId: mollieCustomerId,
    sequenceType: "first",
    description: `Site in a Box website ${selectedDomain}`,
    redirectUrl,
    webhookUrl,
    idempotencyKey,
    metadata: {
      generationRunId: run.id,
      tenantId: tenant.id,
      customerEmail: email,
      clientSlug,
      selectedDomain,
      idempotencyKey,
      mollieCustomerId,
      sequenceType: "first",
      renewalInterval: "1 month",
      orderId: order.id,
    },
  })
  const checkoutUrl = molliePayment._links?.checkout?.href
  if (!molliePayment.id || !checkoutUrl) throw new Error("Mollie did not return a checkout URL.")

  const payment = molliePaymentState({
    current: run.payment,
    status: "pending_provider",
    providerStatus: molliePayment.status,
    externalReference: molliePayment.id,
    checkoutUrl,
    customerEmail: email,
    clientSlug,
    selectedDomain,
    amount: amount.value,
    currency: amount.currency,
    actor: input.actor ?? email,
    note: "Mollie checkout created. Payment completion is confirmed by webhook.",
    mollieCustomerId,
    mollieSequenceType: "first",
    renewalInterval: "1 month",
  })
  await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { payment },
    depth: 0,
    overrideAccess: true,
    user: input.actor ? ({ id: input.actor }) : undefined,
  })
  await payload.update({
    collection: "orders",
    id: order.id,
    data: { paymentStatus: "open", providerPaymentId: molliePayment.id },
    depth: 0,
    overrideAccess: true,
    context: { legalOrderLifecycleMutation: true },
  })
  return { payment, checkoutUrl, reused: false }
}

const statusFromMollie = (status: string): GenerationRunPaymentStatus => {
  if (status === "paid") return "completed"
  if (status === "canceled") return "canceled"
  if (status === "expired") return "expired"
  if (status === "failed") return "failed"
  return "pending_provider"
}

export async function applyMollieWebhookPayment(
  payload: Payload,
  paymentId: string,
  fetchPayment: (id: string) => Promise<MolliePayment> = retrieveMolliePayment,
): Promise<{ ok: true; runId: string | number; status: GenerationRunPaymentStatus; duplicate: boolean }> {
  const molliePayment = await fetchPayment(paymentId)
  const metadata = molliePayment.metadata ?? {}
  const runId = metadata.generationRunId
  const tenantId = metadata.tenantId
  const orderId = metadata.orderId
  if (typeof runId !== "string" && typeof runId !== "number") {
    throw new IgnorableMollieWebhookError("Mollie payment is missing generation run metadata.")
  }
  if (typeof tenantId !== "string" && typeof tenantId !== "number") {
    throw new IgnorableMollieWebhookError("Mollie payment is missing tenant metadata.")
  }
  if (typeof orderId !== "string" && typeof orderId !== "number") {
    throw new IgnorableMollieWebhookError("Mollie payment is missing frozen order metadata.")
  }

  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: runId,
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun
  if (!run || !sameRelationshipId(run.tenant, tenantId)) {
    throw new IgnorableMollieWebhookError("Mollie payment metadata does not match a generation run.")
  }

  const current = normalizeGenerationRunPaymentState(run.payment)
  if (current.provider === "mollie" && current.externalReference && current.externalReference !== molliePayment.id) {
    throw new IgnorableMollieWebhookError("Mollie payment id does not match the generation run payment.")
  }

  const mappedStatus = statusFromMollie(molliePayment.status)
  const nextStatus = current.status === "completed" && mappedStatus !== "completed"
    ? "completed"
    : mappedStatus
  const now = new Date().toISOString()
  const next = molliePaymentState({
    current,
    status: nextStatus,
    providerStatus: molliePayment.status,
    externalReference: molliePayment.id,
    checkoutUrl: current.checkoutUrl,
    customerEmail: typeof metadata.customerEmail === "string" ? normalizeEmail(metadata.customerEmail) : current.customerEmail,
    clientSlug: typeof metadata.clientSlug === "string" ? metadata.clientSlug : current.clientSlug,
    selectedDomain: typeof metadata.selectedDomain === "string" ? cleanDomain(metadata.selectedDomain) : current.selectedDomain,
    amount: molliePayment.amount?.value ?? current.amount,
    currency: molliePayment.amount?.currency ?? current.currency,
    note: nextStatus === "completed" ? "Mollie payment completed." : `Mollie payment status: ${molliePayment.status}.`,
    mollieCustomerId: typeof metadata.mollieCustomerId === "string" ? metadata.mollieCustomerId : current.mollieCustomerId,
    mollieSequenceType: typeof metadata.sequenceType === "string" ? metadata.sequenceType : current.mollieSequenceType,
    renewalInterval: typeof metadata.renewalInterval === "string" ? metadata.renewalInterval : current.renewalInterval,
    now,
  })
  const duplicate =
    current.status === next.status &&
    current.providerStatus === next.providerStatus &&
    current.externalReference === next.externalReference

  let updatedRun = await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { payment: next },
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  })
  if (!sameRelationshipId(order.generationRun, run.id) || !sameRelationshipId(order.tenant, tenantId)) {
    throw new IgnorableMollieWebhookError("Mollie order metadata does not match the generation run.")
  }
  const orderPaymentStatus = nextStatus === "completed"
    ? "paid"
    : nextStatus === "canceled"
      ? "cancelled"
      : nextStatus === "pending_provider"
        ? "open"
        : nextStatus
  await payload.update({
    collection: "orders",
    id: order.id,
    data: {
      paymentStatus: orderPaymentStatus as Order["paymentStatus"],
      providerPaymentId: molliePayment.id,
      paidAt: nextStatus === "completed" ? now : undefined,
      cancelledAt: nextStatus === "canceled" ? now : undefined,
    },
    depth: 0,
    overrideAccess: true,
    context: { legalOrderLifecycleMutation: true },
  })
  let canAttemptActivation = next.status === "completed"
  if (next.status === "completed" && next.mollieCustomerId && !next.mollieSubscriptionId) {
    try {
      const renewalAmount = mollieRenewalAmountFromEnv()
      const subscription = await createMollieSubscription({
        customerId: next.mollieCustomerId,
        amount: renewalAmount,
        interval: mollieSubscriptionInterval(),
        startDate: oneYearFromNowDate(),
        description: `Site in a Box monthly renewal ${next.selectedDomain ?? ""}`.trim(),
        webhookUrl: `${publicCmsOrigin()}/api/payments/mollie/webhook`,
        idempotencyKey: `siab-run-${run.id}-subscription`,
        metadata: {
          generationRunId: run.id,
          tenantId,
          customerEmail: next.customerEmail,
          clientSlug: next.clientSlug,
          selectedDomain: next.selectedDomain,
          renewalInterval: mollieSubscriptionInterval(),
        },
      })
      const subscribedPayment = {
        ...next,
        mollieSubscriptionId: subscription.id,
        renewalInterval: mollieSubscriptionInterval(),
        note: "Mollie payment completed and monthly renewal subscription created.",
        updatedAt: new Date().toISOString(),
      }
      updatedRun = await payload.update({
        collection: "site-generation-runs",
        id: run.id,
        data: { payment: subscribedPayment },
        depth: 0,
        overrideAccess: true,
      }) as SiteGenerationRun
    } catch (error) {
      canAttemptActivation = false
      updatedRun = await recordGenerationRunPostPaymentAutomationState(payload, updatedRun, {
        status: "failed",
        step: "mollie_subscription",
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  if (next.status === "completed" && next.selectedDomain && mollieDomainProvisioningEnabled()) {
    try {
      const provisioned = await provisionPaidDomainOrder(payload, updatedRun, { selectedDomain: next.selectedDomain })
      updatedRun = provisioned.run
    } catch (error) {
      canAttemptActivation = false
      const failedRun = error && typeof error === "object" && "run" in error ? (error as { run?: SiteGenerationRun }).run : null
      updatedRun = await recordGenerationRunPostPaymentAutomationState(payload, failedRun ?? updatedRun, {
        status: "failed",
        step: "domain_provisioning",
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  } else if (next.status === "completed" && next.selectedDomain) {
    const skippedProvisioningPayment = {
      ...normalizeGenerationRunPaymentState(updatedRun.payment),
      note: "Mollie payment completed in non-live mode; domain provisioning was skipped.",
      updatedAt: new Date().toISOString(),
    }
    updatedRun = await payload.update({
      collection: "site-generation-runs",
      id: run.id,
      data: { payment: skippedProvisioningPayment },
      depth: 0,
      overrideAccess: true,
    }) as SiteGenerationRun
  }
  if (canAttemptActivation) {
    await publishAndActivateAfterCompletedPayment(payload, updatedRun)
  }
  return { ok: true, runId: run.id, status: next.status, duplicate }
}
