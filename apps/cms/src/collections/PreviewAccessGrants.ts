import type { CollectionConfig } from "payload"
import { adminText } from "@/lib/payloadAdminI18n"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { fenceBuilderAuthority, fenceBuilderAuthorityDeletion } from "./builderAuthorityFence"

export const PreviewAccessGrants: CollectionConfig = {
  slug: "preview-access-grants",
  hooks: { beforeValidate: [fenceBuilderAuthority], beforeDelete: [fenceBuilderAuthorityDeletion] },
  labels: { singular: { en: "Preview access grant", nl: "Previewtoegang" }, plural: { en: "Preview access grants", nl: "Previewtoegangen" } },
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  admin: {
    useAsTitle: "customerEmail",
    defaultColumns: ["customerEmail", "clientSlug", "tenant", "generationRun", "expiresAt", "revokedAt", "lastSentAt"],
    description: adminText("Better Auth preview access grants scoped to one customer email, tenant, generation run, and preview slug.", "Better Auth-previewtoegang beperkt tot één klant-e-mailadres, klantomgeving, generatieronde en previewslug."),
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
      admin: { description: adminText("Preview URL slug, derived from the requested/reserved customer domain before purchase.", "Preview-URL-slug, vóór aankoop afgeleid van het aangevraagde of gereserveerde klantdomein.") },
    },
    {
      name: "pages",
      type: "relationship",
      relationTo: "pages",
      hasMany: true,
      admin: { description: adminText("Pages this grant can preview. Empty means all pages linked to the generation run.", "Pagina's die met deze toegang bekeken kunnen worden. Leeg betekent alle pagina's van de generatieronde.") },
    },
    { name: "expiresAt", type: "date", required: true, index: true },
    { name: "revokedAt", type: "date", index: true },
    { name: "lastSentAt", type: "date" },
    { name: "sentCount", type: "number", defaultValue: 0 },
    { name: "inactiveNoticeState", type: "select", options: ["sending", "sent", "unknown"] },
    { name: "inactiveNoticeClaimedAt", type: "date" },
    { name: "inactiveNoticeSentAt", type: "date" },
    { name: "inactiveNoticeActivityAt", type: "date" },
    { name: "inactiveExpiresAt", type: "date", index: true },
    { name: "inactiveExpiredAt", type: "date", index: true },
  ],
}
