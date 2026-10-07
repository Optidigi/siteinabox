import type { Payload, RunTaskFunctions, TaskConfig, TaskHandlerArgs } from "payload"
import { createTestRequest } from "./testPayload"

const unexpectedTask = async (): Promise<never> => { throw new Error("Unexpected nested task in unit fixture") }
const tasks: RunTaskFunctions = {
  "purge-stale-form-submissions": unexpectedTask,
  "purge-expired-checkout-progress-drafts": unexpectedTask,
  "send-legal-requirement-notifications": unexpectedTask,
  "process-appointment-notifications": unexpectedTask,
  "process-appointment-calendar-events": unexpectedTask,
  "purge-stale-appointments": unexpectedTask,
  "sync-mollie-payment": unexpectedTask,
  "fulfill-order": unexpectedTask,
  "prepare-domain-migration": unexpectedTask,
  "prepare-domain-transfer-out": unexpectedTask,
  "renew-domain": unexpectedTask,
  "reconcile-commerce": unexpectedTask,
  "deliver-commerce-notification": unexpectedTask,
  "request-mollie-refund": unexpectedTask,
  inline: unexpectedTask,
}

/** Invoke the installed handler contract with a complete request/job fixture. */
export function createTaskRunner<T extends { input: object; output: object }>(config: TaskConfig<T>) {
  return async ({ input, req }: { input: TaskHandlerArgs<T>["input"]; req: { payload: Payload } }) => {
    const handler = config.handler
    if (typeof handler !== "function") throw new Error("Expected an inline task handler")
    const timestamp = "2026-08-01T00:00:00.000Z"
    const args: TaskHandlerArgs<T> = {
      input,
      req: await createTestRequest(req.payload),
      inlineTask: unexpectedTask,
      tasks,
      job: {
        id: 1, input: "unit-fixture", createdAt: timestamp, updatedAt: timestamp, totalTried: 0,
        taskStatus: {
          "purge-stale-form-submissions": {}, "purge-expired-checkout-progress-drafts": {},
          "send-legal-requirement-notifications": {}, "process-appointment-notifications": {},
          "process-appointment-calendar-events": {}, "purge-stale-appointments": {},
          "sync-mollie-payment": {}, "fulfill-order": {}, "prepare-domain-migration": {},
          "prepare-domain-transfer-out": {}, "renew-domain": {}, "reconcile-commerce": {},
          "deliver-commerce-notification": {}, "request-mollie-refund": {}, inline: {},
        },
      },
    }
    const result = await handler(args)
    if (!("output" in result)) throw new Error(`Task fixture returned failure: ${result.errorMessage ?? "unknown"}`)
    return result
  }
}
