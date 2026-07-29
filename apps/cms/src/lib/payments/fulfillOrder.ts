import "server-only"

import type { Payload } from "payload"
import type { ManagedDomain, Order, PaymentAttempt, SiteGenerationRun } from "@/payload-types"

import {
  activateManagedDomainEntitlement,
  provisionPaidDomainOrder,
} from "@/lib/domains/provisioning"
import {
  createDomainMigration,
  isSupportedDomainMigrationOrder,
} from "@/lib/domains/migration"
import { queueDomainMigrationPreparation } from "@/lib/jobs/prepareDomainMigrationTask"
import {
  mollieApiKeyMode,
  mollieDomainProvisioningEnabled,
} from "@/lib/payments/mollieAdapter"
import {
  normalizeGenerationRunPaymentState,
  recordGenerationRunPostPaymentAutomationState,
} from "@/lib/payments/generationRunPayment"
import { publishAndActivateAfterCompletedPayment } from "@/lib/payments/postPaymentActivation"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"

export type FulfillOrderResult = {
  status: "fulfilled" | "waiting" | "failed"
  orderId: string | number
  message?: string
}

export async function fulfillPaidOrder(
  payload: Payload,
  input: { orderId: string | number; paymentAttemptId: string | number },
): Promise<FulfillOrderResult> {
  const [order, paymentAttempt] = await Promise.all([
    payload.findByID({
      collection: "orders",
      id: input.orderId,
      depth: 0,
      overrideAccess: true,
    }) as Promise<Order>,
    payload.findByID({
      collection: "payment-attempts",
      id: input.paymentAttemptId,
      depth: 0,
      overrideAccess: true,
    }) as Promise<PaymentAttempt>,
  ])
  if (!sameRelationshipId(paymentAttempt.order, order.id)) {
    throw new Error("Payment attempt does not belong to the fulfillment order.")
  }
  if (paymentAttempt.state !== "paid") {
    return {
      status: "waiting",
      orderId: order.id,
      message: "Order fulfillment is waiting for a paid payment attempt.",
    }
  }
  const generationRunId = relationshipId(order.generationRun)
  if (!generationRunId) {
    return {
      status: "waiting",
      orderId: order.id,
      message: "The paid order has no Phase 4 fulfillment projection.",
    }
  }

  let run = await payload.findByID({
    collection: "site-generation-runs",
    id: generationRunId,
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun
  if (!sameRelationshipId(run.tenant, order.tenant)) {
    throw new Error("Fulfillment order tenant does not match its generation run.")
  }
  const payment = normalizeGenerationRunPaymentState(run.payment)
  if (payment.status !== "completed" || payment.externalReference !== paymentAttempt.providerPaymentId) {
    return {
      status: "waiting",
      orderId: order.id,
      message: "The compatibility payment projection is not ready for fulfillment.",
    }
  }

  try {
    if (isSupportedDomainMigrationOrder(order)) {
      const migration = await createDomainMigration(payload, order.id)
      if (migration.state !== "awaiting_customer") {
        await queueDomainMigrationPreparation(payload, migration.id)
      }
      return {
        status: "waiting",
        orderId: order.id,
        message: migration.state === "awaiting_customer"
          ? "Automatic migration is waiting for the complete zone export and transfer code."
          : "Automatic migration preparation is queued.",
      }
    }
    let managedDomain: ManagedDomain | null = null
    if (payment.selectedDomain && mollieDomainProvisioningEnabled()) {
      const provisioned = await provisionPaidDomainOrder(payload, run, {
        order,
        selectedDomain: payment.selectedDomain,
      })
      run = provisioned.run
      managedDomain = provisioned.managedDomain
      if (provisioned.status === "waiting") {
        return {
          status: "waiting",
          orderId: order.id,
          message: provisioned.message,
        }
      }
      if (provisioned.status === "unfulfillable") {
        await payload.jobs.queue({
          task: "request-mollie-refund",
          input: {
            paymentAttemptId: String(paymentAttempt.id),
            scenario: "unfulfillable_before_provider_commit",
          },
          queue: "default",
          overrideAccess: true,
        })
        if (order.state === "fulfillment_pending") {
          await payload.update({
            collection: "orders",
            id: order.id,
            data: { state: "exception" },
            depth: 0,
            overrideAccess: true,
            context: { legalOrderLifecycleMutation: true },
          })
        }
        return {
          status: "failed",
          orderId: order.id,
          message: `${provisioned.message ?? "Domain fulfillment became unavailable."} A governed refund was queued.`,
        }
      }
    } else if (payment.selectedDomain && mollieApiKeyMode() === "live") {
      return {
        status: "waiting",
        orderId: order.id,
        message: "Paid domain fulfillment is blocked by the staged commerce release gate.",
      }
    } else if (payment.selectedDomain) {
      run = await payload.update({
        collection: "site-generation-runs",
        id: run.id,
        data: {
          payment: {
            ...payment,
            note: "Mollie payment completed in non-live mode; domain provisioning was skipped.",
            updatedAt: new Date().toISOString(),
          },
        },
        depth: 0,
        overrideAccess: true,
      }) as SiteGenerationRun
    }
    const activation = await publishAndActivateAfterCompletedPayment(payload, run)
    if (activation.status !== "activated") {
      return {
        status: "waiting",
        orderId: order.id,
        message: activation.message,
      }
    }
    if (managedDomain && managedDomain.entitlementStatus !== "active") {
      managedDomain = await activateManagedDomainEntitlement(payload, managedDomain)
    }
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { state: "fulfilled" },
      depth: 0,
      overrideAccess: true,
      context: { legalOrderLifecycleMutation: true },
    })
    return { status: "fulfilled", orderId: order.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order fulfillment failed."
    await recordGenerationRunPostPaymentAutomationState(payload, run, {
      status: "failed",
      step: "domain_provisioning",
      at: new Date().toISOString(),
      message,
    })
    if (order.state === "fulfillment_pending") {
      await payload.update({
        collection: "orders",
        id: order.id,
        data: { state: "exception" },
        depth: 0,
        overrideAccess: true,
        context: { legalOrderLifecycleMutation: true },
      })
    }
    return { status: "failed", orderId: order.id, message }
  }
}
