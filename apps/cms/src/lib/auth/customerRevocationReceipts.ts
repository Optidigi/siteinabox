import type { Payload, PayloadRequest } from "payload"
import type { CustomerRevocationReceipt } from "./customerSessionBridge"

const pending = new WeakMap<Payload, Map<string, CustomerRevocationReceipt[]>>()
const installed = new WeakSet<Payload>()

export function queueCustomerRevocationReceipt(payload: Payload, req: Partial<PayloadRequest>, receipt: CustomerRevocationReceipt): void {
  const id = req.transactionID
  if (typeof id !== "string" && typeof id !== "number" || !payload.db.sessions?.[String(id)]) throw new Error("Revocation receipt requires a live transaction")
  let transactions = pending.get(payload)
  if (!transactions) { transactions = new Map(); pending.set(payload, transactions) }
  const key = String(id)
  transactions.set(key, [...(transactions.get(key) ?? []), receipt])
}

// Native logout has no after-commit hook. Decorate only the public adapter
// callbacks and only transactions carrying an owned revocation receipt.
export function installCustomerRevocationReceipts(payload: Payload): void {
  if (installed.has(payload)) throw new Error("Revocation receipt installer already registered")
  installed.add(payload)
  const nativeCommit = payload.db.commitTransaction.bind(payload.db)
  const nativeRollback = payload.db.rollbackTransaction.bind(payload.db)
  payload.db.commitTransaction = async (id) => {
    const receipts = pending.get(payload)?.get(String(id)) ?? []
    pending.get(payload)?.delete(String(id))
    await nativeCommit(id)
    if (!receipts.length) return
    // The SDK must release its session/connection before any root readback.
    if (payload.db.sessions?.[String(id)]) throw new Error("Revocation commit did not release its transaction")
    const { verifyCommittedCustomerRevocation } = await import("./customerSessionBridge")
    for (const receipt of receipts) await verifyCommittedCustomerRevocation(payload, receipt)
  }
  payload.db.rollbackTransaction = async (id) => {
    pending.get(payload)?.delete(String(id))
    await nativeRollback(id)
  }
}
