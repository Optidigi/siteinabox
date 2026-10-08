import type { CollectionConfig } from "payload"
export const PreviewSessionRevocations: CollectionConfig = {
  slug: "preview-session-revocations",
  lockDocuments: false,
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "betterAuthSessionId", type: "text", required: true, unique: true, index: true },
    { name: "email", type: "email", required: true, index: true },
    { name: "revokedAt", type: "date", required: true },
  ],
}
