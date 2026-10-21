import type { CollectionBeforeChangeHook, CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { relationshipId } from "@/lib/relationshipId"

const protectBinding: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (!data) return data
  if (typeof data.email === "string") data.email = data.email.trim().toLowerCase()
  if (operation === "update" && originalDoc) {
    for (const name of ["email", "previewUserId", "verifiedAt"] as const) {
      if (name in data && data[name] !== originalDoc[name]) throw new Error("Verified identity is immutable.")
    }
    for (const name of ["tenant", "payloadUser"] as const) {
      const bound = relationshipId(originalDoc[name])
      if (bound && name in data && relationshipId(data[name]) !== bound) {
        throw new Error("An existing customer binding cannot be replaced.")
      }
    }
  }
  return data
}

/** Permanent identity/anchor; renewable preview access is a separate record. */
export const CustomerAccounts: CollectionConfig = {
  slug: "customer-accounts",
  lockDocuments: false,
  access: { create: () => false, read: isSuperAdmin, update: isSuperAdmin, delete: () => false },
  admin: { useAsTitle: "email", defaultColumns: ["email", "verifiedAt", "tenant", "revokedAt"] },
  hooks: { beforeChange: [protectBinding] },
  fields: [
    { name: "email", type: "email", required: true, unique: true, index: true, access: { update: () => false } },
    { name: "previewUserId", type: "text", required: true, unique: true, access: { update: () => false } },
    { name: "verifiedAt", type: "date", required: true, access: { update: () => false } },
    { name: "tenant", type: "relationship", relationTo: "tenants", access: { update: () => false } },
    { name: "payloadUser", type: "relationship", relationTo: "users", unique: true, access: { update: () => false } },
    { name: "revokedAt", type: "date" },
  ],
}
