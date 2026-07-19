import "server-only"
import type { Payload } from "payload"
import type { SiteGenerationRun, Tenant } from "@/payload-types"
import { provisionPaidDomainOrder } from "@/lib/domains/provisioning"
import {
  createMollieSubscription,
  mollieDomainProvisioningEnabled,
  mollieRenewalAmountFromEnv,
  publicCmsOrigin,
} from "@/lib/payments/mollieAdapter"
import { relationshipId } from "@/lib/relationshipId"
import {
  activatePublishedSnapshot,
  canActivatePublishedSnapshot,
  publishSiteSnapshot,
} from "@/lib/publish/siteSnapshots"
import { refreshTenantEmailSendingFromCloudflare } from "@/lib/tenants/emailSendingRefresh"
import {
  normalizeGenerationRunPaymentState,
  recordGenerationRunPostPaymentAutomationState,
  type GenerationRunPostPaymentAutomationState,
} from "@/lib/payments/generationRunPayment"

export type PostPaymentActivationResult =
  | { status: "activated"; snapshotId: string | number | null }
  | { status: "blocked" | "failed"; message: string }

export type PostPaymentAutomationRetryStep =
  | "mollie_subscription"
  | "domain_provisioning"
  | "refresh_provisioning"
  | "activation_gate"
  | "publish_activate"

const nowIso = (): string => new Date().toISOString()

const automationState = (
  input: Omit<GenerationRunPostPaymentAutomationState, "at">,
): GenerationRunPostPaymentAutomationState => ({
  ...input,
  at: nowIso(),
})

async function loadTenant(payload: Payload, run: SiteGenerationRun): Promise<Tenant> {
  const tenantId = relationshipId(run.tenant)
  if (!tenantId) throw new Error("Generation run is missing a tenant.")
  return payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }) as Promise<Tenant>
}

async function loadRun(payload: Payload, runId: string | number): Promise<SiteGenerationRun> {
  return payload.findByID({
    collection: "site-generation-runs",
    id: runId,
    depth: 0,
    overrideAccess: true,
  }) as Promise<SiteGenerationRun>
}

const oneYearFromNowDate = (now = new Date()): string => {
  const date = new Date(now)
  date.setUTCFullYear(date.getUTCFullYear() + 1)
  return date.toISOString().slice(0, 10)
}

const mollieSubscriptionInterval = (env: NodeJS.ProcessEnv = process.env): string =>
  env.MOLLIE_SITE_SUBSCRIPTION_INTERVAL?.trim() || "1 month"

const automationResultFromRun = (run: SiteGenerationRun): PostPaymentActivationResult => {
  const errors = run.errors && typeof run.errors === "object" && !Array.isArray(run.errors)
    ? run.errors as Record<string, unknown>
    : {}
  const state = errors.postPaymentAutomation && typeof errors.postPaymentAutomation === "object"
    ? errors.postPaymentAutomation as { status?: unknown; message?: unknown; snapshotId?: unknown }
    : null
  if (state?.status === "activated") {
    return {
      status: "activated",
      snapshotId: typeof state.snapshotId === "string" || typeof state.snapshotId === "number" ? state.snapshotId : null,
    }
  }
  if (state?.status === "blocked" || state?.status === "failed") {
    return {
      status: state.status,
      message: typeof state.message === "string" ? state.message : "Post-payment automation did not complete.",
    }
  }
  return { status: "failed", message: "Post-payment automation did not complete." }
}

async function latestRunSnapshot(payload: Payload, run: SiteGenerationRun): Promise<any | null> {
  const result = await payload.find({
    collection: "published-site-snapshots",
    where: { sourceGenerationRun: { equals: run.id } },
    sort: "-publishedAt",
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  const docs = result.docs as unknown[]
  return docs.find((doc) => {
    const status = (doc as { status?: string }).status
    return status === "active" || status === "drafted"
  }) ?? null
}

export async function publishAndActivateAfterCompletedPayment(
  payload: Payload,
  run: SiteGenerationRun,
): Promise<PostPaymentActivationResult> {
  let tenant: Tenant
  try {
    tenant = await loadTenant(payload, run)
    tenant = await refreshTenantEmailSendingFromCloudflare(payload, tenant)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Post-payment provisioning status refresh failed."
    await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "failed",
      step: "refresh_provisioning",
      message,
    }))
    return { status: "failed", message }
  }

  const gate = canActivatePublishedSnapshot(run, { tenant })
  if (!gate.ok) {
    await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "blocked",
      step: "activation_gate",
      message: gate.reason,
    }))
    return { status: "blocked", message: gate.reason }
  }

  try {
    const existingSnapshot = await latestRunSnapshot(payload, run)
    let snapshotId: string | number | null = existingSnapshot?.id ?? null
    if (existingSnapshot?.status === "active") {
      await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
        status: "activated",
        step: "publish_activate",
        message: "Generation run already has an active published snapshot.",
        snapshotId,
      }))
      return { status: "activated", snapshotId }
    }
    if (existingSnapshot) {
      const activated = await activatePublishedSnapshot(payload, {
        snapshotId: existingSnapshot.id,
        activationReason: "automatic activation after completed payment and provisioning",
      })
      snapshotId = activated?.id ?? existingSnapshot.id
    } else {
      const result = await publishSiteSnapshot(payload, {
        tenantId: tenant.id,
        generationRunId: run.id,
        activate: true,
        activationReason: "automatic activation after completed payment and provisioning",
      })
      snapshotId = result.snapshot?.id ?? null
    }
    await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "activated",
      step: "publish_activate",
      message: "Published and activated automatically after completed payment and provisioning.",
      snapshotId,
    }))
    return { status: "activated", snapshotId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automatic publish and activation failed."
    await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "failed",
      step: "publish_activate",
      message,
    }))
    return { status: "failed", message }
  }
}

async function retryMollieSubscription(payload: Payload, run: SiteGenerationRun): Promise<SiteGenerationRun> {
  const payment = normalizeGenerationRunPaymentState(run.payment)
  if (payment.status !== "completed") {
    return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "blocked",
      step: "mollie_subscription",
      message: "Subscription retry requires completed payment.",
    }))
  }
  if (!payment.mollieCustomerId) {
    return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "blocked",
      step: "mollie_subscription",
      message: "Subscription retry requires a Mollie customer id.",
    }))
  }
  if (payment.mollieSubscriptionId) {
    return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "blocked",
      step: "mollie_subscription",
      message: "Generation run already has a Mollie subscription id.",
    }))
  }

  try {
    const subscription = await createMollieSubscription({
      customerId: payment.mollieCustomerId,
      amount: mollieRenewalAmountFromEnv(),
      interval: mollieSubscriptionInterval(),
      startDate: oneYearFromNowDate(),
      description: `Site in a Box monthly renewal ${payment.selectedDomain ?? ""}`.trim(),
      webhookUrl: `${publicCmsOrigin()}/api/payments/mollie/webhook`,
      idempotencyKey: `siab-run-${run.id}-subscription`,
      metadata: {
        generationRunId: run.id,
        tenantId: relationshipId(run.tenant),
        customerEmail: payment.customerEmail,
        clientSlug: payment.clientSlug,
        selectedDomain: payment.selectedDomain,
        renewalInterval: mollieSubscriptionInterval(),
      },
    })
    return payload.update({
      collection: "site-generation-runs",
      id: run.id,
      data: {
        payment: {
          ...payment,
          mollieSubscriptionId: subscription.id,
          renewalInterval: mollieSubscriptionInterval(),
          note: "Mollie payment completed and monthly renewal subscription created by operator retry.",
          updatedAt: nowIso(),
        },
      },
      depth: 0,
      overrideAccess: true,
    }) as Promise<SiteGenerationRun>
  } catch (error) {
    return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "failed",
      step: "mollie_subscription",
      message: error instanceof Error ? error.message : String(error),
    }))
  }
}

async function retryDomainProvisioning(payload: Payload, run: SiteGenerationRun): Promise<SiteGenerationRun> {
  const payment = normalizeGenerationRunPaymentState(run.payment)
  if (!payment.selectedDomain) {
    return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "blocked",
      step: "domain_provisioning",
      message: "Domain provisioning retry requires a selected domain.",
    }))
  }
  if (!mollieDomainProvisioningEnabled()) {
    return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "blocked",
      step: "domain_provisioning",
      message: "Domain provisioning is disabled for the current Mollie/API environment.",
    }))
  }

  try {
    const result = await provisionPaidDomainOrder(payload, run, { selectedDomain: payment.selectedDomain })
    return result.run
  } catch (error) {
    const failedRun = error && typeof error === "object" && "run" in error ? (error as { run?: SiteGenerationRun }).run : null
    return recordGenerationRunPostPaymentAutomationState(payload, failedRun ?? run, automationState({
      status: "failed",
      step: "domain_provisioning",
      message: error instanceof Error ? error.message : String(error),
    }))
  }
}

export async function retryPostPaymentAutomation(
  payload: Payload,
  runId: string | number,
  step: PostPaymentAutomationRetryStep,
): Promise<PostPaymentActivationResult> {
  let run = await loadRun(payload, runId)

  if (step === "mollie_subscription") {
    run = await retryMollieSubscription(payload, run)
    if (!normalizeGenerationRunPaymentState(run.payment).mollieSubscriptionId) {
      return automationResultFromRun(run)
    }
  }

  if (step === "domain_provisioning") {
    run = await retryDomainProvisioning(payload, run)
    const domainOrder = run.domainOrder && typeof run.domainOrder === "object" && !Array.isArray(run.domainOrder)
      ? run.domainOrder as { status?: unknown }
      : null
    if (domainOrder?.status !== "registered") {
      return automationResultFromRun(run)
    }
  }

  return publishAndActivateAfterCompletedPayment(payload, run)
}
