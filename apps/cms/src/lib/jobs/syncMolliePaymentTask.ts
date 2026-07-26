import type { Payload, TaskConfig } from "payload"

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
      if (result.fulfillmentRequired) {
        await req.payload.jobs.queue({
          task: "fulfill-order",
          input: {
            orderId: String(result.orderId),
            paymentAttemptId: String(result.paymentAttemptId),
          },
          queue: "default",
          overrideAccess: true,
        })
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
