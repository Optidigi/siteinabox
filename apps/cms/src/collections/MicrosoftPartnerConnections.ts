import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const MicrosoftPartnerConnections: CollectionConfig = {
  slug: "microsoft-partner-connections",
  admin: { hidden: true },
  access: { read: isSuperAdmin, create: () => false, update: () => false, delete: () => false },
  hooks: { beforeChange: [({ req }) => {
    if (req.context?.microsoftPartnerConnectionMutation !== true) throw new Error("Partner connections are system managed.")
  }] },
  fields: [
    { name: "partnerTenantId", type: "text", required: true, unique: true },
    { name: "clientId", type: "text", required: true },
    { name: "userPrincipalName", type: "text", required: true },
    { name: "userObjectId", type: "text", required: true },
    { name: "encryptedRefreshToken", type: "text", required: true, access: { read: () => false }, admin: { hidden: true } },
    { name: "status", type: "select", required: true, options: ["connected", "reauthorization_required"] },
    { name: "connectedAt", type: "date", required: true },
    { name: "refreshedAt", type: "date", required: true },
    { name: "connectedBy", type: "relationship", relationTo: "users", required: true },
  ],
}
