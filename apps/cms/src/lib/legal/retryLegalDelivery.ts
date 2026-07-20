import crypto from "node:crypto"
import type { Payload } from "payload"
import { relationshipId } from "@/lib/relationshipId"

export async function retryLegalDelivery(input: {
  payload: Payload
  deliveryId: string | number
  actorUserId: string | number
  actorEmail: string
  reason: string
  requestId?: string | null
  now?: Date
}) {
  const reason = input.reason.trim()
  if (reason.length < 8) throw new Error("Geef een concrete reden van minimaal 8 tekens.")
  const occurredAt = (input.now ?? new Date()).toISOString()
  const requestId = input.requestId || crypto.randomUUID()
  const transactionID = await input.payload.db.beginTransaction()
  if (!transactionID) throw new Error("De hersteltransactie kon niet worden gestart.")
  const req = { transactionID }
  try {
    const delivery = await input.payload.findByID({ collection: "legal-notification-deliveries", id: input.deliveryId, depth: 0, overrideAccess: true, req })
    if (delivery.status !== "failed") throw new Error("Alleen een mislukte verzending kan handmatig opnieuw worden geprobeerd.")
    if (delivery.retryState === "permanent") throw new Error("Een definitieve providerweigering kan niet automatisch opnieuw worden geprobeerd.")
    const result = await input.payload.update({
      collection: "legal-notification-deliveries",
      where: { and: [{ id: { equals: delivery.id } }, { status: { equals: "failed" } }, { retryState: { not_equals: "permanent" } }] },
      data: { status: "queued", nextAttemptAt: occurredAt, leaseUntil: null, retryState: "none", lastError: null },
      depth: 0, overrideAccess: true, req,
    })
    const updated = Array.isArray((result).docs) ? (result).docs[0] : null
    if (!updated) throw new Error("De verzending is al door een andere beheeractie gewijzigd.")
    await input.payload.create({
      collection: "legal-operator-events",
      data: {
        eventKey: `delivery-retry:${delivery.id}:${requestId}`, action: "delivery_retry_requested",
        targetCollection: "legal-notification-deliveries", targetId: String(delivery.id), actorUser: Number(input.actorUserId),
        actorEmail: input.actorEmail, reason, occurredAt, requestId,
        metadata: { notificationKey: delivery.notificationKey, previousStatus: delivery.status, previousAttemptCount: delivery.attemptCount },
      },
      depth: 0, overrideAccess: true, req,
    })
    const requirementId = relationshipId(delivery.requirement)
    if (requirementId) {
      const requirement = await input.payload.findByID({ collection: "legal-requirements", id: requirementId, depth: 0, overrideAccess: true, req })
      if (requirement.status !== "satisfied" && requirement.status !== "waived") {
        await input.payload.update({ collection: "legal-requirements", id: requirement.id, data: { status: "pending", lastError: null }, depth: 0, overrideAccess: true, req })
      }
    }
    await input.payload.db.commitTransaction(transactionID)
    return updated
  } catch (error) {
    await input.payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
