import type { CollectionBeforeChangeHook, CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

const rejectMutation: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation === "update") throw new Error("Legal operator events are immutable.")
  return data
}

export const LegalOperatorEvents: CollectionConfig = {
  slug: "legal-operator-events",
  access: { create: () => false, read: isSuperAdmin, update: () => false, delete: () => false },
  hooks: { beforeChange: [rejectMutation] },
  admin: {
    useAsTitle: "eventKey",
    defaultColumns: ["action", "targetCollection", "targetId", "actorEmail", "occurredAt"],
    description: "Append-only audit events for privileged legal operations.",
  },
  fields: [
    { name: "eventKey", type: "text", required: true, unique: true, index: true },
    { name: "action", type: "select", required: true, options: [{ label: "Delivery retry requested", value: "delivery_retry_requested" }], index: true },
    { name: "targetCollection", type: "text", required: true, index: true },
    { name: "targetId", type: "text", required: true, index: true },
    { name: "actorUser", type: "relationship", relationTo: "users", index: true },
    { name: "actorEmail", type: "email", required: true, index: true },
    { name: "reason", type: "textarea", required: true },
    { name: "occurredAt", type: "date", required: true, index: true },
    { name: "requestId", type: "text", required: true, index: true },
    { name: "metadata", type: "json" },
  ],
}
