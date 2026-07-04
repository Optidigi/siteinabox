import type { CollectionBeforeValidateHook } from "payload"
import { ValidationError } from "payload"
import {
  SITE_GENERATION_BLOCK_CATALOG_BY_SLUG,
  SITE_GENERATION_BLOCK_SLUGS,
  type SiteBlockCatalogVariant,
  type SiteGenerationBlockSlug,
} from "@siteinabox/contracts"
import { validateProviderBlockInstance } from "@siteinabox/site-renderer/source-blocks"
import { isOfficialTenant } from "@/lib/officialTenants"
import { relationshipId } from "@/lib/relationshipId"

const generationBlockSlugs = new Set<string>(SITE_GENERATION_BLOCK_SLUGS)

const findTenant = async (
  req: Parameters<CollectionBeforeValidateHook>[0]["req"],
  tenant: unknown,
): Promise<{ slug?: string | null; domain?: string | null } | null> => {
  const tenantId = relationshipId(tenant as Parameters<typeof relationshipId>[0])
  if (tenantId == null) return null
  const doc = await req.payload.findByID({
    collection: "tenants",
    id: tenantId as any,
    depth: 0,
    overrideAccess: true,
  })
  return {
    slug: typeof (doc as any)?.slug === "string" ? (doc as any).slug : null,
    domain: typeof (doc as any)?.domain === "string" ? (doc as any).domain : null,
  }
}

const variantAllowedForTenant = (
  variant: SiteBlockCatalogVariant,
  tenant: { slug?: string | null; domain?: string | null } | null,
) => {
  if (variant.scope.kind === "global") return true
  if (isOfficialTenant(tenant)) return true
  return tenant?.slug ? variant.scope.tenantSlugs.includes(tenant.slug) : false
}

const scopedVariantIssue = (
  blockType: string,
  field: "designVariant",
  value: string,
  tenant: { slug?: string | null; domain?: string | null } | null,
) => {
  if (!generationBlockSlugs.has(blockType)) return null
  const catalog = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[blockType as SiteGenerationBlockSlug]
  const variant = (catalog.variants as readonly SiteBlockCatalogVariant[]).find((entry) =>
    entry.variant === value,
  )
  if (!variant || variantAllowedForTenant(variant, tenant)) return null
  if (variant.scope.kind !== "tenant-exclusive") return null
  return {
    message: `${value} is available only to ${variant.scope.tenantSlugs.join(", ")} tenants.`,
  }
}

export const enforceTenantBlockVariantScope: CollectionBeforeValidateHook = async ({
  collection,
  data,
  originalDoc,
  req,
}) => {
  const blocks = Array.isArray((data as any)?.blocks) ? (data as any).blocks : []
  if (blocks.length === 0) return data

  const tenant = await findTenant(req, (data as any)?.tenant ?? (originalDoc as any)?.tenant)
  const errors = blocks.flatMap((block: unknown, index: number) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return []
    const record = block as Record<string, unknown>
    const blockType = typeof record.blockType === "string" ? record.blockType : ""
    const designVariant = typeof record.designVariant === "string" ? record.designVariant.trim() : ""
    const violations: Array<{ path: string; message: string }> = []

    if (designVariant) {
      const issue = scopedVariantIssue(blockType, "designVariant", designVariant, tenant)
      if (issue) violations.push({ path: `blocks.${index}.designVariant`, message: issue.message })
    }
    for (const issue of validateProviderBlockInstance(record as any)) {
      violations.push({
        path: `blocks.${index}.${issue.path.join(".")}`,
        message: issue.message,
      })
    }
    return violations
  })

  if (errors.length > 0) {
    throw new ValidationError({
      collection: collection?.slug ?? "pages",
      errors,
    })
  }

  return data
}
