import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const PreviewAccessGrants: CollectionConfig = {
  slug: "preview-access-grants",
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  admin: {
    useAsTitle: "customerEmail",
    defaultColumns: ["customerEmail", "clientSlug", "tenant", "generationRun", "expiresAt", "revokedAt", "lastSentAt"],
    description: "Better Auth preview access grants scoped to one customer email, tenant, generation run, and preview slug.",
  },
  fields: [
    { name: "customerEmail", type: "email", required: true, index: true },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
      index: true,
    },
    {
      name: "generationRun",
      type: "relationship",
      relationTo: "site-generation-runs",
      required: true,
      index: true,
    },
    {
      name: "clientSlug",
      type: "text",
      required: true,
      index: true,
      admin: { description: "Preview URL slug, derived from the requested/reserved customer domain before purchase." },
    },
    {
      name: "pages",
      type: "relationship",
      relationTo: "pages",
      hasMany: true,
      admin: { description: "Pages this grant can preview. Empty means all pages linked to the generation run." },
    },
    { name: "expiresAt", type: "date", required: true, index: true },
    { name: "revokedAt", type: "date", index: true },
    { name: "lastSentAt", type: "date" },
    { name: "sentCount", type: "number", defaultValue: 0 },
  ],
}
