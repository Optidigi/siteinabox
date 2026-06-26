import "server-only"
import type { Payload } from "payload"
import type { SiteGenerationRun, Tenant } from "@/payload-types"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import {
  normalizeGenerationRunPaymentState,
  type GenerationRunPaymentState,
  type GenerationRunPaymentStatus,
} from "@/lib/payments/generationRunPayment"
import { PREVIEW_HOST } from "@/lib/preview/previewHost"
import { previewClientSlugFromDomain } from "@/lib/preview/previewAccess"
import {
  MollieApiError,
  createMolliePayment,
  mollieAmountFromEnv,
  publicCmsOrigin,
  retrieveMolliePayment,
  type MolliePayment,
} from "@/lib/payments/mollieAdapter"

type CreateCheckoutInput = {
  runId: string | number
  customerEmail: string
  clientSlug?: string | null
  actor?: string | number | null
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

const isApproved = (run: SiteGenerationRun): boolean =>
  (run.clientApproval as { status?: unknown } | null | undefined)?.status === "approved"

const loadRunAndTenant = async (payload: Payload, runId: string | number): Promise<{ run: SiteGenerationRun; tenant: Tenant }> => {
  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: runId as any,
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun
  if (!run || run.status !== "preview_ready") throw new Error("Generation run is not preview-ready.")

  const tenantId = relationshipId(run.tenant)
  if (!tenantId) throw new Error("Generation run is missing a tenant.")
  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId as any,
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
  amount?: string | null
  currency?: string | null
  actor?: string | number | null
  note?: string | null
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
    amount: input.amount ?? current.amount,
    currency: input.currency ?? current.currency,
    providerStatus: input.providerStatus,
    webhookProcessedAt: input.now ? now : current.webhookProcessedAt,
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

  const clientSlug = input.clientSlug || previewClientSlugFromDomain(tenant.domain, String(tenant.slug ?? tenant.name ?? ""))
  if (!clientSlug) throw new Error("Client preview slug is required for Mollie checkout.")

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
    current.clientSlug === clientSlug
  ) {
    return { payment: current, checkoutUrl: current.checkoutUrl, reused: true }
  }

  const amount = mollieAmountFromEnv()
  const origin = publicCmsOrigin()
  const redirectUrl = `https://${PREVIEW_HOST}/${clientSlug}?payment=return`
  const webhookUrl = `${origin}/api/payments/mollie/webhook`
  const idempotencyKey = `siab-run-${run.id}-customer-${email}`
  const molliePayment = await createMolliePayment({
    amount,
    description: `Site in a Box website ${clientSlug}`,
    redirectUrl,
    webhookUrl,
    idempotencyKey,
    metadata: {
      generationRunId: run.id,
      tenantId: tenant.id,
      customerEmail: email,
      clientSlug,
      idempotencyKey,
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
    amount: amount.value,
    currency: amount.currency,
    actor: input.actor ?? email,
    note: "Mollie checkout created. Payment completion is confirmed by webhook.",
  })
  await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { payment } as any,
    depth: 0,
    overrideAccess: true,
    user: input.actor ? ({ id: input.actor } as any) : undefined,
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
  if (typeof runId !== "string" && typeof runId !== "number") {
    throw new IgnorableMollieWebhookError("Mollie payment is missing generation run metadata.")
  }
  if (typeof tenantId !== "string" && typeof tenantId !== "number") {
    throw new IgnorableMollieWebhookError("Mollie payment is missing tenant metadata.")
  }

  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: runId as any,
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
    amount: molliePayment.amount?.value ?? current.amount,
    currency: molliePayment.amount?.currency ?? current.currency,
    note: nextStatus === "completed" ? "Mollie payment completed." : `Mollie payment status: ${molliePayment.status}.`,
    now,
  })
  const duplicate =
    current.status === next.status &&
    current.providerStatus === next.providerStatus &&
    current.externalReference === next.externalReference

  await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { payment: next } as any,
    depth: 0,
    overrideAccess: true,
  })
  return { ok: true, runId: run.id, status: next.status, duplicate }
}
