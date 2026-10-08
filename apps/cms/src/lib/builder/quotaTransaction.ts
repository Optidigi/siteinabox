import type { Payload, PayloadRequest } from "payload"

// getTransaction in the pinned adapter falls back outside the transaction if
// this session is absent. The guard is required before every owned DB call.
export function assertLiveBuilderTransaction(payload: Pick<Payload, "db">, req: Partial<PayloadRequest>): void {
  const transactionID = req.transactionID
  if (payload.db.name !== "postgres" || typeof transactionID !== "string" && typeof transactionID !== "number" || !payload.db.sessions?.[String(transactionID)]) throw new Error("builder_transaction_lost")
}
