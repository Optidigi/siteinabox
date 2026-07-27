import type { TaskConfig } from "payload"

import { queueOrderFulfillment } from "@/lib/jobs/fulfillOrderTask"
import { queueDomainRenewal } from "@/lib/jobs/renewDomainTask"
import { queueMolliePaymentSync } from "@/lib/jobs/syncMolliePaymentTask"
import { relationshipId } from "@/lib/relationshipId"

export const reconcileCommerceTask: TaskConfig<{
  input: Record<string, never>
  output: { examined: number; queued: number }
}> = {
  slug: "reconcile-commerce",
  label: "Reconcile commerce provider state",
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
      { recordCommerceAdminException },
    ] = await Promise.all([
      import("@/lib/billing/billingLifecycle"),
      import("@/lib/commerce/notifications"),
      import("@/lib/commerce/alerts"),
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
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    let queued = 0
    for (const attempt of paymentResult.docs) {
      if (!attempt.providerPaymentId) continue
      await queueMolliePaymentSync(req.payload, attempt.providerPaymentId)
      queued += 1
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
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
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
      queued += 1
    }
    const billingResult = await req.payload.find({
      collection: "billing-agreements",
      where: {
        state: {
          in: ["active", "past_due", "cancellation_scheduled"],
        },
      },
      limit: 100,
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
    const renewalDomains = await req.payload.find({
      collection: "managed-domains",
      where: {
        and: [
          { provider: { equals: "openprovider" } },
          { tld: { equals: "nl" } },
          { providerDomainId: { exists: true } },
          { state: { in: ["active", "renewal_pending", "manual_review"] } },
          {
            or: [
              { expiresAt: { exists: false } },
              { expiresAt: { less_than_equal: renewalHorizon } },
              { reconciliationRequired: { equals: true } },
            ],
          },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    for (const domain of renewalDomains.docs) {
      await queueDomainRenewal(req.payload, domain.id)
      queued += 1
    }
    queued += await queueDueCommerceNotifications(req.payload, now)
    return {
      output: {
        examined:
          paymentResult.docs.length +
          domainResult.docs.length +
          billingResult.docs.length +
          renewalDomains.docs.length,
        queued,
      },
    }
  },
}
