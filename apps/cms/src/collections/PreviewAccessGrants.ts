import type { CollectionBeforeValidateHook, CollectionConfig } from "payload"
import type { PreviewAccessGrant } from "@/payload-types"
import { adminText } from "@/lib/payloadAdminI18n"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { fenceBuilderAuthority, fenceBuilderAuthorityDeletion } from "./builderAuthorityFence"

// Missing policy retains the existing fixed-expiry contract; automatic customer
// grant issuance opts into inactivity explicitly. Partial updates use the source
// document rather than treating an omitted date as permission to remove it.
export const validatePreviewGrantExpiry: CollectionBeforeValidateHook<PreviewAccessGrant> = ({ data, originalDoc }) => {
  const expiryPolicy = data?.expiryPolicy ?? originalDoc?.expiryPolicy ?? "fixed"
  if (expiryPolicy !== "fixed" && expiryPolicy !== "inactivity") throw new Error("Invalid preview expiry policy")
  const expiresAt = data && "expiresAt" in data ? data.expiresAt : originalDoc?.expiresAt
  if (expiryPolicy === "fixed" && (typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt)))) throw new Error("Fixed preview grants require an expiry date")
  return { ...data, expiryPolicy }
}

export const PreviewAccessGrants: CollectionConfig = {
  slug: "preview-access-grants",
  hooks: { beforeValidate: [fenceBuilderAuthority, validatePreviewGrantExpiry], beforeDelete: [fenceBuilderAuthorityDeletion] },
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
    { name: "expiryPolicy", type: "select", options: ["fixed", "inactivity"], required: true, defaultValue: "fixed", index: true, admin: { description: adminText("Fixed expiry preserves explicit and legacy deadlines. Inactivity expires only through the approved notice lifecycle.", "Vaste vervaldatum behoudt expliciete en bestaande termijnen. Inactiviteit verloopt alleen via de goedgekeurde kennisgevingscyclus.") } },
    { name: "expiresAt", type: "date", index: true },
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
