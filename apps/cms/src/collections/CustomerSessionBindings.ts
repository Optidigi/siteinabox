import type { CollectionConfig } from "payload"

// Internal authority only. Keep revoked rows: removing a tombstone permits replay.
export const CustomerSessionBindings: CollectionConfig = {
  slug: "customer-session-bindings",
  lockDocuments: false,
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "betterAuthSessionId", type: "text", required: true, unique: true, index: true },
    { name: "user", type: "relationship", relationTo: "users", required: true, index: true },
    { name: "payloadSessionId", type: "text", unique: true, index: true },
    { name: "state", type: "select", required: true, defaultValue: "issuing", options: ["issuing", "active", "revoked"] },
    { name: "revokedAt", type: "date" },
    { name: "handoffKey", type: "text", unique: true, index: true },
    { name: "paidOrder", type: "relationship", relationTo: "orders" },
    { name: "paidAttempt", type: "relationship", relationTo: "payment-attempts" },
    { name: "previewSessionId", type: "text" },
  ],
}
