import type { CollectionAfterChangeHook } from "payload"

type ProjectionCollection = "pages" | "site-settings"
export type CustomerProjectionTask = {
  collection: ProjectionCollection
  documentId: string | number
  run: () => Promise<void>
}
const isScheduler = (value: unknown): value is (task: CustomerProjectionTask) => void =>
  typeof value === "function"

/** Hook-owned projection runs only after the authority transaction commits. */
export function deferCustomerProjection(
  args: Parameters<CollectionAfterChangeHook>[0],
  collection: ProjectionCollection,
  project: CollectionAfterChangeHook,
): boolean {
  const schedule = args.req.context?.customerProjectionQueue
  if (!isScheduler(schedule)) return false
  schedule({ collection, documentId: args.doc.id, run: async () => {
    // Re-read committed authority-owned data; never replay a rolled-back or
    // subsequently superseded document captured by the transaction's hook.
    const doc = await args.req.payload.findByID({ collection, id: args.doc.id, depth: 0, overrideAccess: true })
    const req = { ...args.req, transactionID: undefined,
      context: { ...args.req.context, customerProjectionQueue: undefined } }
    await project({ ...args, doc, req, context: req.context })
  } })
  return true
}

export class CustomerProjectionError extends Error {
  readonly code = "E_CUSTOMER_PROJECTION_PENDING"
  readonly committed = true
  constructor() { super("Changes were saved, but the preview could not refresh."); this.name = "CustomerProjectionError" }
}
