import { getPayload } from "payload"
import config from "@/payload.config"
import { relationshipId } from "@/lib/relationshipId"

const identifier = process.argv[2]?.trim()
if (!identifier) throw new Error("Usage: retry-legal-notification <delivery-id-or-notification-key>")

const payload = await getPayload({ config })
const byId = /^\d+$/.test(identifier)
const result = byId
  ? { docs: [await payload.findByID({ collection: "legal-notification-deliveries", id: identifier, depth: 0, overrideAccess: true })] }
  : await payload.find({
      collection: "legal-notification-deliveries",
      where: { notificationKey: { equals: identifier } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
const delivery = result.docs[0]
if (!delivery) throw new Error(`Legal notification delivery not found: ${identifier}`)
if (delivery.status === "sent" || delivery.status === "cancelled") {
  throw new Error(`Delivery ${delivery.id} is ${delivery.status} and cannot be retried.`)
}

const now = new Date().toISOString()
await payload.update({
  collection: "legal-notification-deliveries",
  id: delivery.id,
  data: { status: "queued", nextAttemptAt: now, leaseUntil: null, retryState: "none", lastError: null },
  depth: 0,
  overrideAccess: true,
})
const requirementId = relationshipId(delivery.requirement)
if (requirementId) {
  const requirement = await payload.findByID({ collection: "legal-requirements", id: requirementId, depth: 0, overrideAccess: true })
  if (requirement.status !== "satisfied" && requirement.status !== "waived") {
    await payload.update({
      collection: "legal-requirements",
      id: requirement.id,
      data: { status: "pending", lastError: null },
      depth: 0,
      overrideAccess: true,
    })
  }
}
payload.logger.info(`[legal-notifications] requeued delivery ${delivery.id} (${delivery.notificationKey})`)
await payload.db.destroy?.()
