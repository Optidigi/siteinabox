import type { TaskConfig } from "payload"

import { queueOrderFulfillment } from "@/lib/jobs/fulfillOrderTask"
import { commerceProviderWritesAllowed } from "@/lib/commerce/releaseGateCore"
import { queueDomainMigrationPreparation } from "@/lib/jobs/prepareDomainMigrationTask"
import { queueDomainTransferOutPreparation } from "@/lib/jobs/prepareDomainTransferOutTask"
import { queueDomainRenewal } from "@/lib/jobs/renewDomainTask"
import { queueMolliePaymentSync } from "@/lib/jobs/syncMolliePaymentTask"
import { queueMollieRefund } from "@/lib/jobs/requestMollieRefundTask"
import { relationshipId } from "@/lib/relationshipId"

export const reconcileCommerceTask: TaskConfig<{
  input: Record<string, never>
  output: { examined: number; queued: number }
}> = {
  slug: "reconcile-commerce",
  label: "Reconcile commerce provider state",
  concurrency: {
    key: () => "reconcile-commerce",
    exclusive: true,
    supersedes: true,
  },
  schedule: [{ cron: "0 */15 * * * *", queue: "default" }],
  inputSchema: [],
  outputSchema: [
    { name: "examined", type: "number", required: true },
    { name: "queued", type: "number", required: true },
  ],
  handler: async ({ req }) => {
    const [
      { processBillingAgreement },
      { queueDueCommerceNotifications },
      { recordCommerceAdminException, resolveCommerceAdminException },
      {
        alertOnStaleMollieSynchronization,
        recoverMissingMolliePaymentReferences,
        reconcileDomainExpiryAlerts,
        reconcileOpenProviderBalanceAlert,
        reconcilePendingTransferOuts,
        recoverMissingMollieCustomerReferences,
        resolveHealthyMollieSynchronizationAlerts,
      },
    ] = await Promise.all([
      import("@/lib/billing/billingLifecycle"),
      import("@/lib/commerce/notifications"),
      import("@/lib/commerce/alerts"),
      import("@/lib/commerce/reconciliation"),
    ])
    const now = new Date()
    const paymentResult = await req.payload.find({
      collection: "payment-attempts",
      where: {
        and: [
          { provider: { equals: "mollie" } },
          { providerPaymentId: { exists: true } },
          {
            or: [
              { reconciliationRequired: { equals: true } },
              {
                state: {
                  in: [
                    "pending_provider",
                    "authorized",
                    "refund_pending",
                    "partially_refunded",
                    "refund_failed",
                  ],
                },
              },
            ],
          },
        ],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    let queued = 0
    await alertOnStaleMollieSynchronization(
      req.payload,
      paymentResult.docs,
      now,
    )
    await resolveHealthyMollieSynchronizationAlerts(
      req.payload,
      now.toISOString(),
    )
    for (const attempt of paymentResult.docs) {
      if (!attempt.providerPaymentId) continue
      await queueMolliePaymentSync(req.payload, attempt.providerPaymentId)
      queued += 1
    }
    const missingPaymentRecovery = await recoverMissingMolliePaymentReferences(
      req.payload,
      {},
      now,
    )
    const missingCustomerRecovery = await recoverMissingMollieCustomerReferences(
      req.payload,
      {},
      now.toISOString(),
    )
    for (const paymentId of missingPaymentRecovery.recoveredPaymentIds) {
      await queueMolliePaymentSync(req.payload, paymentId)
      queued += 1
    }
    const pendingRefundResult = await req.payload.find({
      collection: "accounting-documents",
      where: {
        and: [
          { documentType: { equals: "credit_note" } },
          { state: { equals: "pending_provider" } },
          { refundScenario: { exists: true } },
          { providerOperationId: { exists: false } },
          { reconciliationRequired: { equals: false } },
        ],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    if (commerceProviderWritesAllowed()) {
      for (const document of pendingRefundResult.docs) {
        await resolveCommerceAdminException({
          payload: req.payload,
          source: "payments",
          code: "release_gate_blocked_pending_refund",
          subjectId: document.id,
          now: now.toISOString(),
        })
        const paymentAttemptId = relationshipId(document.paymentAttempt)
        if (!paymentAttemptId || !document.refundScenario) continue
        await queueMollieRefund(req.payload, {
          paymentAttemptId,
          scenario: document.refundScenario,
        })
        queued += 1
      }
    } else {
      for (const document of pendingRefundResult.docs) {
        await recordCommerceAdminException({
          payload: req.payload,
          source: "payments",
          code: "release_gate_blocked_pending_refund",
          message: "A governed pending refund is paused by the staged release gate.",
          tenant: document.tenant,
          subjectId: document.id,
          severity: "critical",
          now: now.toISOString(),
        })
      }
    }
    const domainResult = await req.payload.find({
      collection: "managed-domains",
      where: {
        and: [
          { initialOperation: { equals: "registration" } },
          { state: { in: ["registration_pending", "manual_review"] } },
          {
            or: [
              { reconciliationRequired: { equals: true } },
              { customerStatus: { equals: "provisioning" } },
              { customerStatus: { equals: "verification_required" } },
            ],
          },
        ],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    const queuedFulfillmentOrders = new Set<string>()
    for (const managedDomain of domainResult.docs) {
      const orderId = relationshipId(managedDomain.originatingOrder)
      if (!orderId) continue
      const attempts = await req.payload.find({
        collection: "payment-attempts",
        where: {
          and: [
            { order: { equals: orderId } },
            { state: { in: ["paid", "refund_pending", "partially_refunded"] } },
          ],
        },
        sort: "-paidAt",
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const attempt = attempts.docs[0]
      if (!attempt) continue
      await queueOrderFulfillment(req.payload, {
        orderId,
        paymentAttemptId: attempt.id,
      })
      queuedFulfillmentOrders.add(orderId)
      queued += 1
    }
    const fulfillmentOrderResult = await req.payload.find({
      collection: "orders",
      where: {
        and: [
          { state: { equals: "fulfillment_pending" } },
          { orderKind: { equals: "initial_subscription" } },
        ],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    for (const order of fulfillmentOrderResult.docs) {
      if (queuedFulfillmentOrders.has(String(order.id))) continue
      const attempts = await req.payload.find({
        collection: "payment-attempts",
        where: {
          and: [
            { order: { equals: order.id } },
            { state: { in: ["paid", "refund_pending", "partially_refunded"] } },
          ],
        },
        sort: "-paidAt",
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const attempt = attempts.docs[0]
      if (!attempt) continue
      await queueOrderFulfillment(req.payload, {
        orderId: order.id,
        paymentAttemptId: attempt.id,
      })
      queued += 1
    }
    const migrationResult = await req.payload.find({
      collection: "domain-migrations",
      where: {
        state: {
          in: [
            "ready_to_prepare",
            "preparing",
            "awaiting_provider",
            "ready_for_cutover",
            "cutover_in_progress",
            "verifying",
          ],
        },
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    for (const migration of migrationResult.docs) {
      await queueDomainMigrationPreparation(req.payload, migration.id)
      queued += 1
    }
    const billingResult = await req.payload.find({
      collection: "billing-agreements",
      where: {
        state: {
          in: ["active", "past_due", "cancellation_scheduled"],
        },
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    for (const agreement of billingResult.docs) {
      try {
        await processBillingAgreement({
          payload: req.payload,
          agreement,
          now,
        })
      } catch (error) {
        await recordCommerceAdminException({
          payload: req.payload,
          source: "payments",
          code: "billing_reconciliation_failed",
          message: "Billing agreement reconciliation failed and will be retried.",
          tenant: agreement.tenant,
          subjectId: agreement.id,
          metadata: {
            error: error instanceof Error ? error.message : "unknown_error",
          },
          now: now.toISOString(),
        })
      }
    }
    const renewalHorizon = new Date(now.getTime() + 61 * 24 * 60 * 60_000).toISOString()
    const staleProviderRenewalCheck = new Date(
      now.getTime() - 24 * 60 * 60_000,
    ).toISOString()
    const renewalDomains = await req.payload.find({
      collection: "managed-domains",
      where: {
        and: [
          { provider: { equals: "openprovider" } },
          { providerDomainId: { exists: true } },
          { state: { in: ["active", "renewal_pending", "manual_review"] } },
          { custodyStatus: { not_in: ["transferred_out"] } },
          {
            or: [
              { expiresAt: { exists: false } },
              { expiresAt: { less_than_equal: renewalHorizon } },
              { reconciliationRequired: { equals: true } },
              { providerAutorenewCheckedAt: { exists: false } },
              {
                providerAutorenewCheckedAt: {
                  less_than_equal: staleProviderRenewalCheck,
                },
              },
            ],
          },
        ],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    for (const domain of renewalDomains.docs) {
      await queueDomainRenewal(req.payload, domain.id)
      queued += 1
    }
    const transferPreparationResult = await req.payload.find({
      collection: "managed-domains",
      where: { custodyStatus: { equals: "offboarding_requested" } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    for (const domain of transferPreparationResult.docs) {
      await queueDomainTransferOutPreparation(req.payload, domain.id)
      queued += 1
    }
    const expiryResult = await reconcileDomainExpiryAlerts(req.payload, now)
    const transferOutResult = await reconcilePendingTransferOuts(
      req.payload,
      {},
      now,
    )
    await reconcileOpenProviderBalanceAlert(
      req.payload,
      {},
      process.env,
      now.toISOString(),
    )
    queued += await queueDueCommerceNotifications(req.payload, now)
    return {
      output: {
        examined:
          paymentResult.docs.length +
          domainResult.docs.length +
          fulfillmentOrderResult.docs.length +
          migrationResult.docs.length +
          billingResult.docs.length +
          renewalDomains.docs.length +
          transferPreparationResult.docs.length +
          missingPaymentRecovery.examined +
          missingCustomerRecovery.examined +
          pendingRefundResult.docs.length +
          expiryResult.examined +
          transferOutResult.examined,
        queued,
      },
    }
  },
}
