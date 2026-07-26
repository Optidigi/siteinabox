import type { TaskConfig } from "payload"

import { queueMolliePaymentSync } from "@/lib/jobs/syncMolliePaymentTask"

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
    const result = await req.payload.find({
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
    for (const attempt of result.docs) {
      if (!attempt.providerPaymentId) continue
      await queueMolliePaymentSync(req.payload, attempt.providerPaymentId)
      queued += 1
    }
    return { output: { examined: result.docs.length, queued } }
  },
}
