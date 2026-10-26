import type { TaskConfig } from "payload"
import { queueOrderFulfillment } from "./fulfillOrderTask"
import { relationshipId } from "../relationshipId"

export const reconcileMicrosoftMailTask: TaskConfig<{ input: Record<string, never>; output: { queued: number } }> = {
  slug: "reconcile-microsoft-mail", label: "Continue paid Microsoft email orders",
  schedule: [{ cron: "0 * * * * *", queue: "default" }],
  concurrency: { key: () => "reconcile-microsoft-mail", exclusive: true, supersedes: true }, retries: 0,
  inputSchema: [], outputSchema: [{ name: "queued", type: "number", required: true }],
  handler: async ({ req }) => {
    let queued = 0, cursor = 0
    while (true) {
    const runs = await req.payload.find({ collection: "microsoft-mail-provisioning-runs", where: { and: [
      { id: { greater_than: cursor } },
      { mode: { equals: "live" } }, { commerceOrder: { exists: true } },
      { state: { in: ["prepared", "tenant_pending", "consent_pending", "subscription_pending", "domain_pending", "dns_pending", "mailboxes_pending", "exchange_pending", "setup_mail_pending"] } },
    ] }, limit: 100, sort: "id", depth: 0, overrideAccess: true })
    if (!runs.docs.length) break
    for (const run of runs.docs) {
      const data = run.data && typeof run.data === "object" && !Array.isArray(run.data) ? run.data as Record<string, unknown> : {}
      if (typeof data.nextCheckAt === "string" && Date.parse(data.nextCheckAt) > Date.now()) continue
      const orderId = relationshipId(run.commerceOrder)
      if (!orderId) continue
      const order = await req.payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
      if (order.paymentStatus !== "paid" || order.state !== "fulfillment_pending") continue
      const attempts = await req.payload.find({ collection: "payment-attempts", where: { and: [{ order: { equals: order.id } }, { state: { in: ["paid", "refund_failed"] } }, { purpose: { equals: "first_payment" } }] }, sort: "-attemptNumber", limit: 1, overrideAccess: true })
      if (!attempts.docs[0] || attempts.docs[0].provider === "mollie" && attempts.docs[0].providerMode !== "live") continue
      await queueOrderFulfillment(req.payload, { orderId: order.id, paymentAttemptId: attempts.docs[0].id })
      queued++
    }
    cursor = runs.docs.at(-1)!.id
    if (runs.docs.length < 100) break
    }
    return { output: { queued } }
  },
}
