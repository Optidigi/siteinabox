import type { CollectionConfig } from "payload"

export const MagicMailBudgets: CollectionConfig = {
  slug: "magic-mail-budgets",
  lockDocuments: false,
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "budgetKey", type: "text", required: true, unique: true, index: true },
    { name: "day", type: "text", required: true },
    { name: "attempts", type: "number", required: true, min: 0, validate: (value: number | null | undefined) => value == null || Number.isInteger(value) || "Attempts must be an integer" },
    { name: "lastClaimToken", type: "text" },
    { name: "lastClaimAt", type: "date" },
  ],
}
