import type { Payload } from "payload"

export const queueCommerceReconciliation = (payload: Payload) =>
  payload.jobs.queue({
    task: "reconcile-commerce",
    input: {},
    queue: "default",
    overrideAccess: true,
  })
