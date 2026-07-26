import type { Payload, TaskConfig } from "payload"

export const queueOrderFulfillment = (
  payload: Payload,
  input: { orderId: string | number; paymentAttemptId: string | number },
) => payload.jobs.queue({
  task: "fulfill-order",
  input: {
    orderId: String(input.orderId),
    paymentAttemptId: String(input.paymentAttemptId),
  },
  queue: "default",
  overrideAccess: true,
})

export const fulfillOrderTask: TaskConfig<{
  input: { orderId: string; paymentAttemptId: string }
  output: { status: string; orderId: string; message: string }
}> = {
  slug: "fulfill-order",
  label: "Fulfill a paid order",
  concurrency: {
    key: ({ input }) => `fulfill-order:${input.orderId}`,
    exclusive: true,
    supersedes: true,
  },
  retries: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  },
  inputSchema: [
    { name: "orderId", type: "text", required: true },
    { name: "paymentAttemptId", type: "text", required: true },
  ],
  outputSchema: [
    { name: "status", type: "text", required: true },
    { name: "orderId", type: "text", required: true },
    { name: "message", type: "text", required: true },
  ],
  handler: async ({ input, req }) => {
    const { fulfillPaidOrder } = await import("@/lib/payments/fulfillOrder")
    const result = await fulfillPaidOrder(req.payload, input)
    return {
      output: {
        status: result.status,
        orderId: String(result.orderId),
        message: result.message ?? "",
      },
    }
  },
}
