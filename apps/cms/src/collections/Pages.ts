import type { CollectionConfig } from "payload"
import { canRead, canWrite } from "@/access/roleHelpers"
import { ALL_BLOCKS } from "@/blocks/registry"
import { projectPageToDisk } from "@/hooks/projectToDisk"
import { deletePageFile } from "@/hooks/deleteFileFromDisk"
import { validateTenantExists } from "@/hooks/validateTenantExists"
import { ensureUniqueTenantSlug } from "@/hooks/ensureUniqueTenantSlug"
import { validateRichTextOnSave } from "@/hooks/validateRichTextOnSave"
import { enforceTenantBlockMenu } from "@/hooks/enforceTenantBlockMenu"
import { enforceTenantBlockVariantScope } from "@/hooks/enforceTenantBlockVariantScope"
import { adminValidationText } from "@/lib/payloadAdminI18n"

// FN-2026-0004 — same client-server validation gap as Tenants.slug. Direct
// PATCH /api/pages/:id bypassed the form's zod regex; persisted "BAD SLUG!"
// in the audit. Mirror of `src/components/forms/PageForm.tsx` + `TenantForm`.
const PAGE_SLUG_REGEX = /^[a-z0-9-]+$/
const validatePageSlug = (val: unknown, { req }: any) => {
  if (val == null || val === "") return adminValidationText(req?.i18n?.language, "Slug is required", "Slug is verplicht")
  if (typeof val !== "string" || !PAGE_SLUG_REGEX.test(val)) {
    return adminValidationText(req?.i18n?.language, "Use lowercase letters, digits, and hyphens only", "Gebruik alleen kleine letters, cijfers en koppeltekens")
  }
  return true
}

export const Pages: CollectionConfig = {
  slug: "pages",
  labels: { singular: { en: "Page", nl: "Pagina" }, plural: { en: "Pages", nl: "Pagina's" } },
  access: { read: canRead, create: canWrite, update: canWrite, delete: canWrite },
  admin: { useAsTitle: "title", defaultColumns: ["title", "slug", "status", "updatedAt"] },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, validate: validatePageSlug,
      admin: { description: { en: "URL slug. Unique per tenant. Use 'index' for the root page.", nl: "URL-slug. Uniek per klantomgeving. Gebruik 'index' voor de hoofdpagina." } } },
    { name: "status", type: "select", required: true, defaultValue: "draft",
      options: [
        { label: { en: "Draft", nl: "Concept" }, value: "draft" },
        { label: { en: "Published", nl: "Gepubliceerd" }, value: "published" }
      ]},
    { name: "blocks", type: "blocks", blocks: [...ALL_BLOCKS] },
    { name: "seo", type: "group", fields: [
      { name: "title", type: "text" },
      { name: "description", type: "textarea" },
      { name: "ogImage", type: "upload", relationTo: "media" }
    ]},
    { name: "updatedBy", type: "relationship", relationTo: "users",
      admin: { readOnly: true, hidden: false } }
  ],
  hooks: {
    beforeValidate: [validateTenantExists, ensureUniqueTenantSlug, validateRichTextOnSave, enforceTenantBlockMenu, enforceTenantBlockVariantScope],
    beforeChange: [({ data, req }) => {
      if (req.user) data.updatedBy = req.user.id
      return data
    }],
    afterChange: [projectPageToDisk],
    afterDelete: [deletePageFile]
  }
}
