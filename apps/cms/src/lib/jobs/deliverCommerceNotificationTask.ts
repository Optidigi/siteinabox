import type { Payload, TaskConfig } from "payload"

export const queueCommerceNotificationDelivery = (
  payload: Payload,
  deliveryId: string | number,
) => payload.jobs.queue({
  task: "deliver-commerce-notification",
  input: { deliveryId: String(deliveryId) },
  queue: "default",
  overrideAccess: true,
})

export const deliverCommerceNotificationTask: TaskConfig<{
  input: { deliveryId: string }
  output: { status: string; deliveryId: string }
}> = {
  slug: "deliver-commerce-notification",
  label: "Deliver a commerce notification",
  concurrency: {
    key: ({ input }) => `commerce-notification:${input.deliveryId}`,
    exclusive: true,
    supersedes: true,
  },
  retries: { attempts: 1 },
  inputSchema: [{ name: "deliveryId", type: "text", required: true }],
  outputSchema: [
    { name: "status", type: "text", required: true },
    { name: "deliveryId", type: "text", required: true },
  ],
  handler: async ({ input, req }) => {
    const { deliverCommerceNotification } = await import("@/lib/commerce/notifications")
    const status = await deliverCommerceNotification({
      payload: req.payload,
      deliveryId: input.deliveryId,
    })
    return { output: { status, deliveryId: input.deliveryId } }
  },
}
