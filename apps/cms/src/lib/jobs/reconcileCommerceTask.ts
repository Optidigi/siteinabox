import type { TaskConfig } from "payload"

import { queueOrderFulfillment } from "@/lib/jobs/fulfillOrderTask"
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
    return {
      output: {
        examined: paymentResult.docs.length + domainResult.docs.length,
        queued,
      },
    }
  },
}
