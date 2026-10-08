import type { CollectionConfig } from "payload"

export const CustomerAuthAccounts: CollectionConfig = {
  slug: "customer-auth-accounts",
  lockDocuments: false,
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "user", type: "relationship", relationTo: "users", required: true, unique: true, index: true },
    { name: "authEpoch", type: "date", required: true },
  ],
}
