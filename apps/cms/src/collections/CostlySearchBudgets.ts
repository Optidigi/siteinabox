import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const CostlySearchBudgets: CollectionConfig = {
  slug: "costly-search-budgets", lockDocuments: false,
  access: { create: () => false, read: isSuperAdmin, update: () => false, delete: () => false },
  fields: [
    { name: "key", type: "text", required: true, unique: true },
    { name: "day", type: "text", required: true },
    { name: "attempts", type: "number", required: true, min: 0, defaultValue: 0 },
    { name: "activeClaims", type: "json", required: true },
  ],
}
