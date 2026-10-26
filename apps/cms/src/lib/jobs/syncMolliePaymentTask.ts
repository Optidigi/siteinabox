import { recordCommerceAdminException } from "@/lib/commerce/alerts"
import { relationshipId } from "@/lib/relationshipId"
import type { Payload, TaskConfig } from "payload"
import { queueOrderFulfillment } from "@/lib/jobs/fulfillOrderTask"

export const queueMolliePaymentSync = (
  payload: Payload,
  paymentId: string,
) => payload.jobs.queue({
  task: "sync-mollie-payment",
  input: { paymentId },
  queue: "default",
  overrideAccess: true,
})

export const syncMolliePaymentTask: TaskConfig<{
  input: { paymentId: string }
  output: {
    status: string
    paymentAttemptId: string
    orderId: string
    fulfillmentQueued: boolean
  }
}> = {
  slug: "sync-mollie-payment",
  label: "Synchronize Mollie payment",
  concurrency: {
    key: ({ input }) => `mollie-payment:${input.paymentId}`,
    exclusive: true,
    supersedes: true,
  },
  retries: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
  },
  inputSchema: [
    { name: "paymentId", type: "text", required: true },
  ],
  outputSchema: [
    { name: "status", type: "text", required: true },
    { name: "paymentAttemptId", type: "text", required: true },
    { name: "orderId", type: "text", required: true },
    { name: "fulfillmentQueued", type: "checkbox", required: true },
  ],
  handler: async ({ input, req }) => {
    const {
      isIgnorableMollieWebhookError,
      synchronizeMolliePayment,
    } = await import("@/lib/payments/molliePayments")
    try {
      const result = await synchronizeMolliePayment(req.payload, input.paymentId)
      if (["refund_pending", "partially_refunded", "refunded", "chargeback"].includes(result.state)) {
        const order = await req.payload.findByID({ collection: "orders", id: result.orderId, depth: 0, overrideAccess: true })
        if (["microsoft_mail_initial", "microsoft_mail_seats", "microsoft_mail_renewal"].includes(order.orderKind ?? "")) await recordCommerceAdminException({ payload: req.payload, source: "payments", code: "microsoft_mail_payment_adjustment_requires_review",
          message: "An email payment was reversed or adjusted. Reconcile the supplier commitment and paid coverage before changing service; no supplier cancellation is inferred from a refund.",
          tenant: Number(relationshipId(order.tenant)), subjectId: order.id, now: new Date().toISOString() })
      }
      if (result.fulfillmentRequired) {
        await queueOrderFulfillment(req.payload, result)
      }
      return {
        output: {
          status: result.state,
          paymentAttemptId: String(result.paymentAttemptId),
          orderId: String(result.orderId),
          fulfillmentQueued: result.fulfillmentRequired,
        },
      }
    } catch (error) {
      if (isIgnorableMollieWebhookError(error)) {
        req.payload.logger.warn(
          `[mollie-sync] ignored payment ${input.paymentId}: ${
            error instanceof Error ? error.message : "unknown provider reference"
          }`,
        )
        return {
          output: {
            status: "ignored",
            paymentAttemptId: "",
            orderId: "",
            fulfillmentQueued: false,
          },
        }
      }
      throw error
    }
  },
}
