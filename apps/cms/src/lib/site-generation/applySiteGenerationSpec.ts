import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type {
  CmsApplyResult,
  GeneratedPageSpec,
  GeneratedSiteSettings,
  SiteGenerationSpec,
  ThemeTokenSpec,
  ValidationIssue,
  ValidationReport,
} from "@siteinabox/contracts/generation"
import {
  contractValidationReport,
  isSupportedOfficialTenantBlockVariant,
  OfficialTenantSiteGenerationSpecSchema,
  SiteGenerationSpecSchema,
} from "@siteinabox/contracts/generation"
import {
  SITE_CHROME_CATALOG,
  SITE_GENERATION_BLOCK_CATALOG_BY_SLUG,
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS,
} from "@siteinabox/contracts/block-catalog"
import { SITE_GENERATION_BLOCK_SLUGS } from "@siteinabox/contracts/site"
import type { MediaRef } from "@siteinabox/contracts/site"
import type { Payload } from "payload"
import { assertSafeMediaFilename } from "@/lib/mediaFilename"
import { DEFAULT_FONT_FAMILIES, manifestSchema, type RtManifest } from "@/lib/richText/manifest"
import { buildDefaultTenantEmailSending } from "@/lib/tenants/emailSending"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { themeSchema, type ThemeTokens } from "@/lib/theme/schema"

type ApplyOperation = "created" | "updated"
type RetainedPage = { id: string | number; slug: string; status?: string }

export type CmsGenerationApplyResult = CmsApplyResult & {
  idempotencyKey?: string
  operations?: {
    tenant?: ApplyOperation
    settings?: ApplyOperation
    pages?: Array<{ id: string | number; slug: string; operation: ApplyOperation }>
    retainedPages?: RetainedPage[]
  }
}

type NavEntry = {
  type: "page" | "section" | "custom"
  page?: string | number
  anchor?: string
  url?: string
  label?: string
  external?: boolean
}

type ExistingPage = {
  id: string | number
  slug: string
  title?: string
  status?: string
}

const DRAFT_IMPORT_CONTEXT = {
  skipProjection: true,
  source: "site-generation-import",
} as const

const TENANT_SLUG_REGEX = /^[a-z0-9-]+$/
const DOMAIN_REGEX =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const SUPPORTED_BLOCK_SLUGS = new Set<string>(SITE_GENERATION_BLOCK_SLUGS)
const SELF_SERVE_SOURCE_BACKED_BLOCK_SLUGS = new Set<string>(
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => variant.slug),
)
const SELF_SERVE_SOURCE_BACKED_VARIANTS_BY_BLOCK = new Map<string, Set<string>>()

for (const variant of SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS) {
  const variants = SELF_SERVE_SOURCE_BACKED_VARIANTS_BY_BLOCK.get(variant.slug) ?? new Set<string>()
  variants.add(variant.variant)
  SELF_SERVE_SOURCE_BACKED_VARIANTS_BY_BLOCK.set(variant.slug, variants)
}

export type SiteGenerationValidationOptions = {
  variantScope?: "tenant-aware" | "self-serve"
}

export type SiteGenerationApplyOptions = SiteGenerationValidationOptions & {
  mediaMode?: "skip-generated-placeholders" | "upload-generated-media"
}

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortValue(entry)]),
  )
}

export const siteGenerationSpecHash = (spec: unknown): string =>
  createHash("sha256").update(JSON.stringify(sortValue(spec))).digest("hex")

const issue = (
  code: string,
  message: string,
  path?: Array<string | number>,
  severity: ValidationIssue["severity"] = "error",
): ValidationIssue => ({
  severity,
  code,
  message,
  ...(path ? { path } : {}),
})

const variantAllowedForTenant = (
  scope: { kind: "global" } | { kind: "tenant-exclusive"; tenantSlugs: string[] },
  tenantSlug: string | null,
  validationScope: SiteGenerationValidationOptions["variantScope"],
): boolean => {
  if (scope.kind === "global") return true
  if (validationScope === "self-serve") return false
  return tenantSlug ? scope.tenantSlugs.includes(tenantSlug) : false
}

const blockVariantScopeIssue = (
  blockType: string,
  value: string,
  tenantSlug: string | null,
  validationScope: SiteGenerationValidationOptions["variantScope"],
): string | null => {
  if (!SITE_GENERATION_BLOCK_SLUGS.includes(blockType as any)) return null
  const catalog = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[blockType as keyof typeof SITE_GENERATION_BLOCK_CATALOG_BY_SLUG]
  const variant = catalog?.variants.find((entry) => entry.variant === value)
  if (!variant || variantAllowedForTenant(variant.scope, tenantSlug, validationScope)) return null
  return `Generated block designVariant "${value}" is tenant-exclusive and cannot be used for tenant "${tenantSlug ?? "unknown"}".`
}

const clonePlain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const canonicalizeGeneratedBlock = (
  block: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...block }
  const designVariant = typeof next.designVariant === "string" && next.designVariant.trim()
    ? next.designVariant.trim()
    : null

  if (designVariant) {
    next.designVariant = designVariant
  } else {
    if (Object.prototype.hasOwnProperty.call(next, "designVariant")) {
      next.designVariant = null
    }
  }

  return next
}

export const canonicalizeSiteGenerationSpecForCms = (
  spec: SiteGenerationSpec,
): SiteGenerationSpec => {
  const next = clonePlain(spec) as SiteGenerationSpec
  if (Array.isArray(next.pages)) {
    next.pages = next.pages.map((page) => ({
      ...page,
      blocks: Array.isArray(page.blocks)
        ? page.blocks.map((block) =>
            canonicalizeGeneratedBlock(block as Record<string, unknown>) as typeof block,
          )
        : page.blocks,
    }))
  }
  return next
}

const chromeVariantScopeIssue = (
  area: "header" | "footer" | "banner",
  value: unknown,
  tenantSlug: string | null,
  validationScope: SiteGenerationValidationOptions["variantScope"],
): string | null => {
  if (typeof value !== "string" || !value) return null
  const variant = SITE_CHROME_CATALOG.find((entry) => entry.area === area && entry.variant === value)
  if (!variant || variantAllowedForTenant(variant.scope, tenantSlug, validationScope)) return null
  return `Generated ${area} chrome variant "${value}" is tenant-exclusive and cannot be used for tenant "${tenantSlug ?? "unknown"}".`
}

const isSupportedSelfServeSourceBackedBlockVariant = (
  blockType: string,
  variant: string | null | undefined,
): boolean => typeof variant === "string" && (SELF_SERVE_SOURCE_BACKED_VARIANTS_BY_BLOCK.get(blockType)?.has(variant) ?? false)

export const validateSiteGenerationSpecForCms = (
  spec: SiteGenerationSpec,
  options: SiteGenerationValidationOptions = {},
): ValidationReport => {
  const issues: ValidationIssue[] = []
  const validationScope = options.variantScope ?? "tenant-aware"
  const supportsBlockVariant = validationScope === "tenant-aware"
    ? isSupportedOfficialTenantBlockVariant
    : isSupportedSelfServeSourceBackedBlockVariant
  const candidate = spec as unknown

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {
      valid: false,
      issues: [issue("invalid_spec_shape", "SiteGenerationSpec must be an object.")],
    }
  }

  const originalValue = candidate as Partial<SiteGenerationSpec> & Record<string, unknown>
  const canonicalValue = canonicalizeSiteGenerationSpecForCms(
    originalValue as SiteGenerationSpec,
  ) as Partial<SiteGenerationSpec> & Record<string, unknown>
  const value = canonicalValue
  const contractSchema = validationScope === "tenant-aware"
    ? OfficialTenantSiteGenerationSpecSchema
    : SiteGenerationSpecSchema
  const parsedContract = contractSchema.safeParse(value)
  if (!parsedContract.success) {
    issues.push(...contractValidationReport(parsedContract.error).issues)
  }

  const tenant = value.tenant as SiteGenerationSpec["tenant"] | undefined
  const intake = value.intake as SiteGenerationSpec["intake"] | undefined
  const settings = value.settings as SiteGenerationSpec["settings"] | undefined
  const pages = canonicalValue.pages as SiteGenerationSpec["pages"] | undefined
  const blocks = value.blocks as SiteGenerationSpec["blocks"] | undefined
  const pagesArray = Array.isArray(pages) ? pages : undefined
  const blocksArray = Array.isArray(blocks) ? blocks : undefined
  const tenantSlug = typeof tenant?.slug === "string" && tenant.slug ? tenant.slug : null

  if (value.schemaVersion !== 1) {
    issues.push(issue("unsupported_schema_version", "Only SiteGenerationSpec schemaVersion 1 is supported.", ["schemaVersion"]))
  }

  if (!tenant || typeof tenant !== "object") {
    issues.push(issue("missing_tenant", "SiteGenerationSpec.tenant is required.", ["tenant"]))
  }

  if (!intake || typeof intake !== "object") {
    issues.push(issue("missing_intake", "SiteGenerationSpec.intake is required.", ["intake"]))
  }

  if (!settings || typeof settings !== "object") {
    issues.push(issue("missing_settings", "SiteGenerationSpec.settings is required.", ["settings"]))
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    issues.push(issue("missing_pages", "SiteGenerationSpec.pages must contain at least one page.", ["pages"]))
  }

  if (tenant && typeof tenant.slug !== "string") {
    issues.push(issue("missing_tenant_slug", "Tenant slug is required.", ["tenant", "slug"]))
  } else if (tenant && !TENANT_SLUG_REGEX.test(tenant.slug)) {
    issues.push(issue("invalid_tenant_slug", "Tenant slug must contain only lowercase letters, digits, and hyphens.", ["tenant", "slug"]))
  }

  const domain = typeof tenant?.domain === "string" ? tenant.domain.trim().toLowerCase() : ""
  if (!domain) {
    issues.push(issue("missing_tenant_domain", "Tenant domain is required.", ["tenant", "domain"]))
  } else if (domain.length > 253 || !DOMAIN_REGEX.test(domain) || !/[a-z]/.test(domain.split(".").pop() ?? "")) {
    issues.push(issue("invalid_tenant_domain", "Tenant domain must be a lowercase hostname with an alphabetic TLD.", ["tenant", "domain"]))
  }

  if (intake?.tenantSlug && tenant?.slug && intake.tenantSlug !== tenant.slug) {
    issues.push(issue("tenant_slug_mismatch", "intake.tenantSlug must match tenant.slug.", ["intake", "tenantSlug"]))
  }

  if (intake?.primaryDomain && domain && intake.primaryDomain.toLowerCase() !== domain) {
    issues.push(issue("tenant_domain_mismatch", "intake.primaryDomain must match tenant.domain.", ["intake", "primaryDomain"]))
  }

  const pageSlugs = new Set<string>()
  pagesArray?.forEach((page, index) => {
    if (!page || typeof page !== "object") {
      issues.push(issue("invalid_page_shape", "Page entries must be objects.", ["pages", index]))
      return
    }
    if (typeof page.slug !== "string" || !TENANT_SLUG_REGEX.test(page.slug)) {
      issues.push(issue("invalid_page_slug", "Page slug must contain only lowercase letters, digits, and hyphens.", ["pages", index, "slug"]))
    }
    if (typeof page.slug === "string" && pageSlugs.has(page.slug)) {
      issues.push(issue("duplicate_page_slug", `Duplicate page slug "${page.slug}" in generation spec.`, ["pages", index, "slug"]))
    }
    if (typeof page.slug === "string") pageSlugs.add(page.slug)
    if (!Array.isArray(page.blocks) || page.blocks.length === 0) {
      issues.push(issue("missing_page_blocks", "Generated pages must contain at least one block.", ["pages", index, "blocks"]))
      return
    }
    page.blocks.forEach((block, blockIndex) => {
      if (!block || typeof block !== "object" || Array.isArray(block)) {
        issues.push(issue("invalid_block_shape", "Generated blocks must be objects.", ["pages", index, "blocks", blockIndex]))
        return
      }
      const blockType = (block as Record<string, unknown>).blockType
      if (typeof blockType !== "string" || !SUPPORTED_BLOCK_SLUGS.has(blockType)) {
        issues.push(issue(
          "unsupported_block_type",
          `Generated block type "${String(blockType)}" is not supported.`,
          ["pages", index, "blocks", blockIndex, "blockType"],
        ))
        return
      }
      if (validationScope === "self-serve" && !SELF_SERVE_SOURCE_BACKED_BLOCK_SLUGS.has(blockType)) {
        issues.push(issue(
          "unsupported_self_serve_block_type",
          `Generated block type "${blockType}" does not have an approved self-serve source-backed design variant.`,
          ["pages", index, "blocks", blockIndex, "blockType"],
        ))
      }
      const originalBlock = Array.isArray((originalValue.pages as SiteGenerationSpec["pages"] | undefined)?.[index]?.blocks)
        ? ((originalValue.pages as SiteGenerationSpec["pages"])[index]!.blocks[blockIndex] as Record<string, unknown> | undefined)
        : undefined
      const designVariant = typeof originalBlock?.designVariant === "string" ? originalBlock.designVariant.trim() : ""
      if (validationScope === "self-serve" && !designVariant) {
        issues.push(issue(
          "missing_approved_design_variant",
          `Generated block type "${blockType}" must include an approved source-backed designVariant.`,
          ["pages", index, "blocks", blockIndex, "designVariant"],
        ))
      }
      if (Object.prototype.hasOwnProperty.call(block as Record<string, unknown>, "tokens")) {
        issues.push(issue(
          "generated_block_visual_tokens",
          "Generated blocks must not include block-level tokens.",
          ["pages", index, "blocks", blockIndex, "tokens"],
        ))
      }
      if (Object.prototype.hasOwnProperty.call(block as Record<string, unknown>, "style")) {
        issues.push(issue(
          "generated_block_visual_style",
          "Generated blocks must not include block-level style data.",
          ["pages", index, "blocks", blockIndex, "style"],
        ))
      }
      const variant = (block as Record<string, unknown>).designVariant
      if (typeof variant === "string" && variant && !supportsBlockVariant(blockType, variant)) {
        issues.push(issue(
          "unsupported_block_variant",
          `Generated block designVariant "${variant}" is not approved for block type "${blockType}".`,
          ["pages", index, "blocks", blockIndex, "designVariant"],
        ))
      }
      if (typeof variant === "string" && variant) {
        const message = blockVariantScopeIssue(blockType, variant, tenantSlug, validationScope)
        if (message) {
          issues.push(issue(
            "tenant_exclusive_block_variant",
            message,
            ["pages", index, "blocks", blockIndex, "designVariant"],
          ))
        }
      }
    })
  })
  if (pagesArray && !pagesArray.some((page) => page?.slug === "index")) {
    issues.push(issue("missing_root_page", "Generated specs must include an index page for the root route.", ["pages"]))
  }

  const chrome = settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as Record<string, unknown>).chrome
    : null
  if (chrome && typeof chrome === "object" && !Array.isArray(chrome)) {
    for (const area of ["header", "footer", "banner"] as const) {
      const areaSettings = (chrome as Record<string, unknown>)[area]
      const variant = areaSettings && typeof areaSettings === "object" && !Array.isArray(areaSettings)
        ? (areaSettings as Record<string, unknown>).variant
        : null
      const message = chromeVariantScopeIssue(area, variant, tenantSlug, validationScope)
      if (message) {
        issues.push(issue("tenant_exclusive_chrome_variant", message, ["settings", "chrome", area, "variant"]))
      }
    }
  }

  blocksArray?.forEach((block, index) => {
    if (!block || typeof block !== "object") {
      issues.push(issue("invalid_manifest_block_shape", "Manifest block entries must be objects.", ["blocks", index]))
      return
    }
    if (!SUPPORTED_BLOCK_SLUGS.has(block.slug)) {
      issues.push(issue("unsupported_manifest_block_slug", `Generated manifest block slug "${String(block.slug)}" is not supported.`, ["blocks", index, "slug"]))
    }
    if (validationScope === "self-serve" && !SELF_SERVE_SOURCE_BACKED_BLOCK_SLUGS.has(block.slug)) {
      issues.push(issue(
        "unsupported_self_serve_manifest_block_slug",
        `Generated manifest block slug "${String(block.slug)}" does not have an approved self-serve source-backed design variant.`,
        ["blocks", index, "slug"],
      ))
    }
  })

  return {
    valid: !issues.some((entry) => entry.severity === "error"),
    issues,
  }
}

const findOne = async (
  payload: Payload,
  collection: "tenants" | "pages" | "site-settings" | "media",
  where: Record<string, unknown>,
) => {
  const found = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  return found.docs[0] as any | undefined
}

const relationshipId = (value: unknown): string | number | undefined => {
  if (value == null) return undefined
  if (typeof value === "string" || typeof value === "number") return value
  if (typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === "string" || typeof id === "number") return id
  }
  return undefined
}

const themeToCmsTokens = (theme: ThemeTokenSpec): ThemeTokens | null => {
  const candidate: ThemeTokens = {
    palette: theme.colors
      ? {
          accent: theme.colors.accent,
          bg: theme.colors.bg,
          ink: theme.colors.ink,
          muted: theme.colors.muted,
        }
      : undefined,
    darkPalette: theme.darkColors
      ? {
          accent: theme.darkColors.accent,
          bg: theme.darkColors.bg,
          ink: theme.darkColors.ink,
          muted: theme.darkColors.muted,
        }
      : undefined,
    fonts: theme.fonts
      ? {
          title: theme.fonts.title,
          heading: theme.fonts.heading,
          text: theme.fonts.text,
        }
      : undefined,
    radius: theme.radius,
    density: theme.density,
    stylePreset: theme.stylePreset,
    borderStyle: theme.borderStyle,
    mode: theme.mode,
  }
  const parsed = themeSchema.safeParse(normalizeThemeForSave(candidate) ?? {})
  if (!parsed.success) {
    throw new Error(`Invalid CMS theme tokens: ${parsed.error.issues.map((entry) => entry.message).join("; ")}`)
  }
  return normalizeThemeForSave(parsed.data)
}

const DEFAULT_GENERATION_MANIFEST: RtManifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
  colorTokens: [],
  fontFamilies: [...DEFAULT_FONT_FAMILIES],
  typeStyles: [],
}

const scanRichTextCapabilities = (value: unknown, result = { blockquote: false, themedNodeIds: new Set<string>() }) => {
  if (!value || typeof value !== "object") return result
  if (Array.isArray(value)) {
    for (const item of value) scanRichTextCapabilities(item, result)
    return result
  }

  const record = value as Record<string, unknown>
  if (record.t === "blockquote") result.blockquote = true
  if (record.t === "themed" && typeof record.id === "string") result.themedNodeIds.add(record.id)

  for (const entry of Object.values(record)) scanRichTextCapabilities(entry, result)
  return result
}

const manifestCapabilitiesForSpec = (spec: SiteGenerationSpec): Pick<RtManifest, "blockTypes" | "themedNodes"> => {
  const capabilities = scanRichTextCapabilities(spec.pages)
  return {
    blockTypes: {
      ...DEFAULT_GENERATION_MANIFEST.blockTypes,
      ...(capabilities.blockquote ? { blockquote: true } : {}),
    },
    ...(capabilities.themedNodeIds.size > 0
      ? {
          themedNodes: Array.from(capabilities.themedNodeIds).sort().map((id) => ({
            id,
            label: id === "eyebrow" ? "Eyebrow" : id,
            fields: [{ name: "text", type: "text", required: true }],
          })),
        }
      : {}),
  }
}

const siteManifestForSpec = (spec: SiteGenerationSpec, idempotencyKey: string): RtManifest & Record<string, unknown> => {
  const capabilities = manifestCapabilitiesForSpec(spec)
  const manifest = {
    ...DEFAULT_GENERATION_MANIFEST,
    ...capabilities,
    blocks: spec.blocks?.map((block) => ({
      slug: block.slug,
      ...(block.label ? { label: block.label } : {}),
      ...(block.defaultAnchor ? { defaultAnchor: block.defaultAnchor } : {}),
      ...(block.fields ? { fields: block.fields } : {}),
    })),
    generation: {
      source: "site-generation-spec",
      hash: idempotencyKey,
      generatedAt: spec.generatedAt ?? null,
      generator: spec.generator ?? null,
    },
  }

  const parsed = manifestSchema.safeParse(manifest)
  if (!parsed.success) {
    throw new Error(`Generated siteManifest is invalid: ${parsed.error.issues.map((entry) => entry.message).join("; ")}`)
  }
  return manifest
}

const isPayloadMediaId = (value: unknown): value is string | number =>
  typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))

type GeneratedMediaObject = Exclude<MediaRef, string | number | null>
type MediaIdMap = Map<string, string | number>

const mediaFilename = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const filename = (value as { filename?: unknown }).filename
  if (typeof filename !== "string" || filename.length === 0) return undefined
  return assertSafeMediaFilename(filename)
}

const collectGeneratedMediaRefs = (
  value: unknown,
  refs = new Map<string, GeneratedMediaObject>(),
): Map<string, GeneratedMediaObject> => {
  if (!value || typeof value !== "object") return refs
  if (Array.isArray(value)) {
    for (const item of value) collectGeneratedMediaRefs(item, refs)
    return refs
  }

  const filename = mediaFilename(value)
  if (filename && !refs.has(filename)) refs.set(filename, value as GeneratedMediaObject)

  for (const entry of Object.values(value as Record<string, unknown>)) {
    collectGeneratedMediaRefs(entry, refs)
  }
  return refs
}

const mimeTypeForFilename = (filename: string): string | undefined => {
  const extension = filename.split(".").pop()?.toLowerCase()
  if (!extension) return undefined
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg"
  if (extension === "png") return "image/png"
  if (extension === "webp") return "image/webp"
  if (extension === "gif") return "image/gif"
  if (extension === "svg") return "image/svg+xml"
  return undefined
}

const absoluteMediaUrl = (ref: GeneratedMediaObject): string | undefined => {
  if (typeof ref.url !== "string" || ref.url.length === 0) return undefined
  if (!/^https?:\/\//i.test(ref.url)) return undefined
  return ref.url
}

const isMissingUploadFileError = (error: unknown): boolean => {
  const value = error as { name?: unknown; message?: unknown; status?: unknown } | null
  return (
    value?.name === "MissingFile" ||
    value?.message === "No files were uploaded." ||
    (value?.status === 400 && typeof value?.message === "string" && value.message.includes("No files were uploaded"))
  )
}

const withDownloadedMediaFile = async <T>(
  ref: GeneratedMediaObject,
  filename: string,
  action: (filePath: string) => Promise<T>,
): Promise<T> => {
  const url = absoluteMediaUrl(ref)
  if (!url) {
    throw new Error(`Generated media ref "${filename}" must include an absolute URL before CMS import can upload it.`)
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download generated media "${filename}" from ${url}: ${response.status} ${response.statusText}`)
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "siab-generated-media-"))
  const filePath = path.join(tempDir, filename)
  try {
    const data = Buffer.from(await response.arrayBuffer())
    await writeFile(filePath, data)
    return await action(filePath)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

const upsertGeneratedMediaRefs = async (
  payload: Payload,
  tenantId: string | number,
  spec: SiteGenerationSpec,
  options: Pick<SiteGenerationApplyOptions, "mediaMode"> = {},
): Promise<MediaIdMap> => {
  if (options.mediaMode === "skip-generated-placeholders") return new Map()

  const refs = collectGeneratedMediaRefs({
    assets: spec.assets,
    settings: spec.settings,
    pages: spec.pages,
  })
  const ids: MediaIdMap = new Map()

  for (const [filename, ref] of refs) {
    const mimeType = mimeTypeForFilename(filename)
    const data = {
      tenant: tenantId,
      filename,
      ...(typeof ref.alt === "string" ? { alt: ref.alt } : {}),
      ...(typeof ref.width === "number" ? { width: ref.width } : {}),
      ...(typeof ref.height === "number" ? { height: ref.height } : {}),
      ...(mimeType ? { mimeType } : {}),
    }
    const existing = await findOne(payload, "media", {
      and: [{ tenant: { equals: tenantId } }, { filename: { equals: filename } }],
    })
    if (existing) {
      const updated = await payload.update({
        collection: "media",
        id: existing.id,
        data,
        depth: 0,
        overrideAccess: true,
        context: DRAFT_IMPORT_CONTEXT,
      } as any)
      ids.set(filename, (updated as any).id)
    } else {
      const createArgs = {
        collection: "media",
        data,
        depth: 0,
        overrideAccess: true,
        context: DRAFT_IMPORT_CONTEXT,
      } as const
      let created: unknown
      try {
        created = await payload.create(createArgs as any)
      } catch (error) {
        if (!isMissingUploadFileError(error)) throw error
        created = await withDownloadedMediaFile(ref, filename, (filePath) =>
          payload.create({
            ...createArgs,
            filePath,
            overwriteExistingFiles: true,
          } as any),
        )
      }
      ids.set(filename, (created as any).id)
    }
  }

  return ids
}

const normalizeMediaRef = (value: unknown, mediaIds?: MediaIdMap): unknown => {
  if (value && typeof value === "object" && "id" in value) {
    const id = relationshipId(value)
    if (isPayloadMediaId(id)) return id
  }
  const filename = mediaFilename(value)
  if (filename && mediaIds?.has(filename)) return mediaIds.get(filename)
  return isPayloadMediaId(value) ? value : undefined
}

const omitNullishCmsValues = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(omitNullishCmsValues)
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .flatMap(([key, entry]) => entry == null ? [] : [[key, omitNullishCmsValues(entry)]]),
  )
}

const normalizeBlock = (block: Record<string, unknown>, mediaIds?: MediaIdMap): Record<string, unknown> => {
  const { id: _id, source: _source, ...rest } = block
  const normalized: Record<string, unknown> = { ...rest }
  for (const key of ["image", "avatar", "backgroundImage", "foregroundImage", "before", "after"]) {
    if (key in normalized) normalized[key] = normalizeMediaRef(normalized[key], mediaIds)
  }
  if (Array.isArray(normalized.items)) {
    normalized.items = normalized.items.map((item) =>
      item && typeof item === "object"
        ? {
            ...(item as Record<string, unknown>),
            image: normalizeMediaRef((item as Record<string, unknown>).image, mediaIds),
            avatar: normalizeMediaRef((item as Record<string, unknown>).avatar, mediaIds),
          }
        : item,
    )
  }
  if (Array.isArray(normalized.pairs)) {
    normalized.pairs = normalized.pairs.map((pair) =>
      pair && typeof pair === "object"
        ? {
            ...(pair as Record<string, unknown>),
            before: normalizeMediaRef((pair as Record<string, unknown>).before, mediaIds),
            after: normalizeMediaRef((pair as Record<string, unknown>).after, mediaIds),
          }
      : pair,
    )
  }
  return omitNullishCmsValues(normalized) as Record<string, unknown>
}

const normalizePageData = (tenantId: string | number, page: GeneratedPageSpec, mediaIds?: MediaIdMap) => omitNullishCmsValues({
  tenant: tenantId,
  title: page.title,
  slug: page.slug,
  status: "draft",
  blocks: page.blocks.map((block) => normalizeBlock(block as Record<string, unknown>, mediaIds)),
  seo: page.seo
    ? {
        ...page.seo,
        ogImage: normalizeMediaRef(page.seo.ogImage, mediaIds),
      }
    : undefined,
}) as Record<string, unknown>

const hrefToNavEntry = (href: string, label: string | null | undefined, external: boolean | undefined, pageBySlug: Map<string, ExistingPage>): NavEntry => {
  const sectionMatch = href.match(/^\/?([a-z0-9-]+)?#([A-Za-z0-9_-]+)$/)
  if (sectionMatch) {
    const slug = sectionMatch[1] || "index"
    const anchor = sectionMatch[2]
    const page = pageBySlug.get(slug)
    return {
      type: "section",
      ...(page ? { page: page.id } : {}),
      anchor,
      label: label ?? anchor,
    }
  }

  const pageSlug = href.replace(/^\//, "").replace(/\/$/, "") || "index"
  const page = pageBySlug.get(pageSlug)
  if (page) {
    return {
      type: "page",
      page: page.id,
      ...(label ? { label } : {}),
    }
  }

  return {
    type: "custom",
    url: href,
    label: label ?? href,
    external: Boolean(external),
  }
}

const normalizeNav = (
  entries: GeneratedSiteSettings["navHeader"] | GeneratedSiteSettings["navFooter"],
  pageBySlug: Map<string, ExistingPage>,
): NavEntry[] | undefined => {
  if (!entries) return undefined
  return entries.map((entry) => hrefToNavEntry(entry.href, entry.label, entry.external, pageBySlug))
}

const normalizeSettingsData = (
  tenantId: string | number,
  settings: GeneratedSiteSettings,
  pageBySlug: Map<string, ExistingPage>,
  mediaIds?: MediaIdMap,
) => omitNullishCmsValues({
  tenant: tenantId,
  siteName: settings.siteName,
  siteUrl: settings.siteUrl,
  description: settings.description,
  language: settings.language || "nl",
  aliases: settings.aliases,
  contactEmail: settings.contactEmail,
  branding: settings.branding
    ? {
        ...settings.branding,
        logo: normalizeMediaRef(settings.branding.logo, mediaIds),
        favicon: normalizeMediaRef(settings.branding.favicon, mediaIds),
      }
    : undefined,
  chrome: settings.chrome
    ? {
        ...settings.chrome,
        header: settings.chrome.header
          ? {
              ...settings.chrome.header,
              logo: normalizeMediaRef(settings.chrome.header.logo, mediaIds),
            }
          : undefined,
        footer: settings.chrome.footer
          ? {
              ...settings.chrome.footer,
              logo: normalizeMediaRef(settings.chrome.footer.logo, mediaIds),
            }
          : undefined,
      }
    : undefined,
  maintenance: settings.maintenance,
  contact: settings.contact,
  nap: settings.nap,
  hours: settings.hours,
  serviceArea: settings.serviceArea,
  navHeader: normalizeNav(settings.navHeader, pageBySlug),
  navFooter: normalizeNav(settings.navFooter, pageBySlug),
}) as GeneratedSiteSettings & Record<string, unknown>

const upsertTenant = async (
  payload: Payload,
  spec: SiteGenerationSpec,
  siteManifest: Record<string, unknown>,
  theme: ThemeTokens | null,
) => {
  const bySlug = await findOne(payload, "tenants", { slug: { equals: spec.tenant.slug } })
  const byDomain = await findOne(payload, "tenants", { domain: { equals: spec.tenant.domain } })

  if (bySlug && byDomain && String(bySlug.id) !== String(byDomain.id)) {
    throw new Error(`Generation spec conflicts with existing tenants: slug "${spec.tenant.slug}" and domain "${spec.tenant.domain}" belong to different tenants.`)
  }
  const existing = bySlug ?? byDomain
  const data = {
    name: spec.tenant.name,
    slug: spec.tenant.slug,
    domain: spec.tenant.domain,
    status: existing?.status ?? "provisioning",
    emailSending: existing?.emailSending ?? buildDefaultTenantEmailSending(spec.tenant.domain),
    siteManifest,
    theme,
  }
  if (existing) {
    const updated = await payload.update({
      collection: "tenants",
      id: existing.id,
      data,
      depth: 0,
      overrideAccess: true,
      context: DRAFT_IMPORT_CONTEXT,
    } as any)
    return { doc: updated as any, operation: "updated" as const }
  }
  const created = await payload.create({
    collection: "tenants",
    data,
    depth: 0,
    overrideAccess: true,
    context: DRAFT_IMPORT_CONTEXT,
  } as any)
  return { doc: created as any, operation: "created" as const }
}

const upsertPages = async (payload: Payload, tenantId: string | number, pages: GeneratedPageSpec[], mediaIds?: MediaIdMap) => {
  const results: Array<{ doc: ExistingPage; operation: ApplyOperation }> = []

  for (const page of pages) {
    const data = normalizePageData(tenantId, page, mediaIds)
    const existing = await findOne(payload, "pages", {
      and: [{ tenant: { equals: tenantId } }, { slug: { equals: page.slug } }],
    })
    if (existing) {
      const updated = await payload.update({
        collection: "pages",
        id: existing.id,
        data,
        depth: 0,
        overrideAccess: true,
        context: DRAFT_IMPORT_CONTEXT,
      } as any)
      results.push({ doc: updated as unknown as ExistingPage, operation: "updated" })
    } else {
      const created = await payload.create({
        collection: "pages",
        data,
        depth: 0,
        overrideAccess: true,
        context: DRAFT_IMPORT_CONTEXT,
      } as any)
      results.push({ doc: created as unknown as ExistingPage, operation: "created" })
    }
  }

  return results
}

const upsertSettings = async (
  payload: Payload,
  tenantId: string | number,
  settings: GeneratedSiteSettings,
  pageBySlug: Map<string, ExistingPage>,
  mediaIds?: MediaIdMap,
) => {
  const data = normalizeSettingsData(tenantId, settings, pageBySlug, mediaIds)
  const existing = await findOne(payload, "site-settings", { tenant: { equals: tenantId } })
  if (existing) {
    const updated = await payload.update({
      collection: "site-settings",
      id: existing.id,
      data,
      depth: 0,
      overrideAccess: true,
      context: DRAFT_IMPORT_CONTEXT,
    } as any)
    return { doc: updated as any, operation: "updated" as const }
  }
  const created = await payload.create({
    collection: "site-settings",
    data,
    depth: 0,
    overrideAccess: true,
    context: DRAFT_IMPORT_CONTEXT,
  } as any)
  return { doc: created as any, operation: "created" as const }
}

const retainedPagesForTenant = async (
  payload: Payload,
  tenantId: string | number,
  appliedSlugs: Set<string>,
): Promise<RetainedPage[]> => {
  const result = await payload.find({
    collection: "pages",
    where: { tenant: { equals: tenantId } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  } as any)

  return (result.docs as ExistingPage[])
    .filter((page) => !appliedSlugs.has(page.slug))
    .map((page) => ({
      id: page.id,
      slug: page.slug,
      ...(page.status ? { status: page.status } : {}),
    }))
}

export async function applySiteGenerationSpec(
  payload: Payload,
  spec: SiteGenerationSpec,
  options: SiteGenerationApplyOptions = {},
): Promise<CmsGenerationApplyResult> {
  const validation = validateSiteGenerationSpecForCms(spec, options)
  if (!validation.valid) {
    return { ok: false, validation }
  }
  const canonicalSpec = canonicalizeSiteGenerationSpecForCms(spec)
  const parsedContractSpec = (options.variantScope === "self-serve"
    ? SiteGenerationSpecSchema
    : OfficialTenantSiteGenerationSpecSchema).parse(canonicalSpec)
  const parsedSpec = parsedContractSpec as SiteGenerationSpec

  const idempotencyKey = siteGenerationSpecHash(parsedContractSpec)
  const theme = themeToCmsTokens(parsedContractSpec.theme)
  const siteManifest = siteManifestForSpec(parsedContractSpec, idempotencyKey)
  const tenant = await upsertTenant(payload, parsedSpec, siteManifest, theme)
  const tenantId = tenant.doc.id as string | number
  const mediaIds = await upsertGeneratedMediaRefs(payload, tenantId, parsedSpec, {
    mediaMode: options.mediaMode ?? (options.variantScope === "self-serve" ? "skip-generated-placeholders" : "upload-generated-media"),
  })
  const pages = await upsertPages(payload, tenantId, parsedSpec.pages, mediaIds)
  const pageBySlug = new Map(pages.map(({ doc }) => [doc.slug, doc]))
  const settings = await upsertSettings(payload, tenantId, parsedSpec.settings, pageBySlug, mediaIds)
  const retainedPages = await retainedPagesForTenant(
    payload,
    tenantId,
    new Set(parsedSpec.pages.map((page) => page.slug)),
  )

  return {
    ok: true,
    tenantId,
    tenantSlug: tenant.doc.slug,
    pageIds: pages.map(({ doc }) => doc.id),
    settingsId: settings.doc.id,
    validation,
    idempotencyKey,
    operations: {
      tenant: tenant.operation,
      settings: settings.operation,
      pages: pages.map(({ doc, operation }) => ({ id: doc.id, slug: doc.slug, operation })),
      retainedPages,
    },
  }
}
