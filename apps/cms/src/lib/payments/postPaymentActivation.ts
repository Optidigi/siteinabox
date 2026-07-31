import "server-only"
import type { Payload, PayloadRequest } from "payload"
import type {
  Order,
  PaymentAttempt,
  PublishedSiteSnapshot,
  SiteGenerationRun,
  Tenant,
} from "@/payload-types"
import { provisionPaidDomainOrder } from "@/lib/domains/provisioning"
import {
  mollieDomainProvisioningEnabled,
} from "@/lib/payments/mollieAdapter"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import {
  activatePublishedSnapshot,
  canActivatePublishedSnapshot,
  publishSiteSnapshot,
} from "@/lib/publish/siteSnapshots"
import { queueLiveHandoffAfterActivation } from "@/lib/publish/liveHandoffEmail"
import { payloadRequestArgs } from "@/lib/payloadRequestArgs"
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

type PostPaymentActivationOptions = {
  deferLiveHandoff?: boolean
  req?: PayloadRequest
}

async function loadTenant(
  payload: Payload,
  run: SiteGenerationRun,
  req?: PayloadRequest,
): Promise<Tenant> {
  const tenantId = relationshipId(run.tenant)
  if (!tenantId) throw new Error("Generation run is missing a tenant.")
  return payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    ...payloadRequestArgs(req),
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

async function latestRunSnapshot(
  payload: Payload,
  run: SiteGenerationRun,
  req?: PayloadRequest,
): Promise<PublishedSiteSnapshot | null> {
  const result = await payload.find({
    collection: "published-site-snapshots",
    where: { sourceGenerationRun: { equals: run.id } },
    sort: "-publishedAt",
    limit: 10,
    depth: 0,
    overrideAccess: true,
    ...payloadRequestArgs(req),
  })
  const docs = result.docs as PublishedSiteSnapshot[]
  return docs.find((doc) => {
    const status = (doc as { status?: string }).status
    return status === "active" || status === "drafted"
  }) ?? null
}

export async function publishAndActivateAfterCompletedPayment(
  payload: Payload,
  run: SiteGenerationRun,
  options: PostPaymentActivationOptions = {},
): Promise<PostPaymentActivationResult> {
  let tenant: Tenant
  try {
    tenant = await loadTenant(payload, run, options.req)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Post-payment tenant lookup failed."
    await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "failed",
      step: "refresh_provisioning",
      message,
    }), { req: options.req })
    return { status: "failed", message }
  }

  const gate = canActivatePublishedSnapshot(run, { tenant })
  if (!gate.ok) {
    await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "blocked",
      step: "activation_gate",
      message: gate.reason,
    }), { req: options.req })
    return { status: "blocked", message: gate.reason }
  }

  try {
    const existingSnapshot = await latestRunSnapshot(payload, run, options.req)
    let snapshotId: string | number | null = existingSnapshot?.id ?? null
    if (existingSnapshot?.status === "active") {
      await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
        status: "activated",
        step: "publish_activate",
        message: "Generation run already has an active published snapshot.",
        snapshotId,
      }), { req: options.req })
      return { status: "activated", snapshotId }
    }
    if (existingSnapshot) {
      const activated = await activatePublishedSnapshot(payload, {
        snapshotId: existingSnapshot.id,
        activationReason: "automatic activation after completed payment and provisioning",
        deferLiveHandoff: options.deferLiveHandoff,
        req: options.req,
      })
      snapshotId = activated?.id ?? existingSnapshot.id
    } else {
      const result = await publishSiteSnapshot(payload, {
        tenantId: tenant.id,
        generationRunId: run.id,
        activate: true,
        activationReason: "automatic activation after completed payment and provisioning",
        deferLiveHandoff: options.deferLiveHandoff,
        req: options.req,
      })
      snapshotId = result.snapshot?.id ?? null
    }
    await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "activated",
      step: "publish_activate",
      message: "Published and activated automatically after completed payment and provisioning.",
      snapshotId,
    }), { req: options.req })
    return { status: "activated", snapshotId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automatic publish and activation failed."
    await recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
      status: "failed",
      step: "publish_activate",
      message,
    }), { req: options.req })
    return { status: "failed", message }
  }
}

export async function queueDeferredPostPaymentLiveHandoff(
  payload: Payload,
  run: SiteGenerationRun,
  snapshotId: string | number,
  eventAt: string,
): Promise<"queued" | "sent" | "skipped" | "failed"> {
  const [tenant, snapshotDoc] = await Promise.all([
    loadTenant(payload, run),
    payload.findByID({
      collection: "published-site-snapshots",
      id: snapshotId,
      depth: 0,
      overrideAccess: true,
    }) as Promise<PublishedSiteSnapshot>,
  ])
  return queueLiveHandoffAfterActivation(payload, {
    tenant,
    run,
    snapshotDoc,
    eventAt,
  })
}

async function retryMollieSubscription(payload: Payload, run: SiteGenerationRun): Promise<SiteGenerationRun> {
  return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
    status: "blocked",
    step: "mollie_subscription",
    message: "Long-lived Mollie subscription creation is disabled.",
  }))
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
    const orders = await payload.find({
      collection: "orders",
      where: {
        and: [
          { generationRun: { equals: run.id } },
          { state: { in: ["fulfillment_pending", "exception"] } },
        ],
      },
      sort: "-createdAt",
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    const order = orders.docs[0] as Order | undefined
    if (!order || orders.docs.length !== 1) {
      return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
        status: "blocked",
        step: "domain_provisioning",
        message: "Domain provisioning retry requires one authoritative fulfillment order.",
      }))
    }
    if (order.paymentStatus !== "paid") {
      return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
        status: "blocked",
        step: "domain_provisioning",
        message: "Domain provisioning retry requires a financially secured order.",
      }))
    }
    const paymentAttempts = await payload.find({
      collection: "payment-attempts",
      where: {
        and: [
          { order: { equals: order.id } },
          { purpose: { equals: "first_payment" } },
        ],
      },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    const securedAttempts = paymentAttempts.docs.filter(
      (attempt) => (attempt as PaymentAttempt).state === "paid",
    ) as PaymentAttempt[]
    const securedAttempt = securedAttempts[0]
    if (
      securedAttempts.length !== 1 ||
      !securedAttempt ||
      !sameRelationshipId(securedAttempt.order, order.id) ||
      !securedAttempt.providerPaymentId ||
      payment.status !== "completed" ||
      payment.externalReference !== securedAttempt.providerPaymentId
    ) {
      return recordGenerationRunPostPaymentAutomationState(payload, run, automationState({
        status: "blocked",
        step: "domain_provisioning",
        message:
          "Domain provisioning retry requires one paid order-bound payment attempt.",
      }))
    }
    const result = await provisionPaidDomainOrder(payload, run, {
      order,
      paymentAttemptId: securedAttempt.id,
      selectedDomain: payment.selectedDomain,
    })
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
