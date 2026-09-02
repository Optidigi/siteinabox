import { createHash } from "node:crypto"
import { copyFile, mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Payload, Where } from "payload"
import {
  BlockSchema,
  SITE_BLOCK_SLUGS,
  type Page as ContractPage,
} from "@siteinabox/contracts"
import type {
  CmsApplyResult,
  GeneratedPageSpec,
  GeneratedSiteSettings,
  SiteGenerationSpec,
  ThemeTokenSpec,
  ValidationIssue,
} from "@siteinabox/contracts/generation"
import { contractValidationReport, SiteGenerationSpecSchema } from "@siteinabox/contracts/generation"
import type { Media, Page, SiteSetting, Tenant } from "@/payload-types"
import { asRecord } from "@/lib/record"
import { isHeroBlockType } from "@siteinabox/contracts"
import { DEFAULT_FONT_FAMILIES, manifestSchema, type RtManifest } from "@/lib/richText/manifest"
import { DEFAULT_CLIENT_SETTINGS_CONTRACT } from "@/lib/settingsContract"
import { buildDefaultTenantEmailSending } from "@/lib/tenants/emailSending"
import { materializeTenantPrivacyDisclosure } from "@/lib/legal/tenantPrivacyPage"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { themeSchema, type ThemeTokens } from "@/lib/theme/schema"
import { approvedPublicAnalyticsConsent } from "@/lib/analytics/config"

type ApplyOperation = "created" | "updated"
type RetainedPage = { id: string | number; slug: string; status?: string }
type CmsSiteGenerationSpec = SiteGenerationSpec

export type CmsGenerationApplyResult = CmsApplyResult & {
  idempotencyKey?: string
  operations?: {
    tenant?: ApplyOperation
    settings?: ApplyOperation
    pages?: Array<{ id: string | number; slug: string; operation: ApplyOperation }>
    retainedPages?: RetainedPage[]
    retiredPages?: RetainedPage[]
  }
}

type NavEntry = {
  type: "page" | "section" | "custom" | "group"
  page?: string | number
  anchor?: string
  url?: string
  label?: string
  external?: boolean
  description?: string | null
  children?: Array<{ label: string; href?: string | null; external?: boolean; description?: string | null; icon?: string | null }>
}

type ExistingPage = { id: string | number; slug: string; title?: string; status?: string }
type GeneratedNavEntries = NonNullable<GeneratedSiteSettings["navigation"]>["primary"]

const DRAFT_IMPORT_CONTEXT = { skipProjection: true, source: "site-generation-import" } as const
const PAGE_REPLACEMENT_CONTEXT = { source: "site-generation-replacement" } as const
const TENANT_SLUG_REGEX = /^[a-z0-9-]+$/
const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const SITEGEN_TYPES = new Set<string>(SITE_BLOCK_SLUGS)
const REPEATABLE_SECTION_TYPES = new Set(["services", "cta"])

export type SiteGenerationValidationOptions = {
  variantScope?: "tenant-aware" | "self-serve"
  allowSystemPages?: boolean
}

export type SiteGenerationValidationResult =
  | { valid: false; issues: ValidationIssue[] }
  | { valid: true; issues: ValidationIssue[]; data: SiteGenerationSpec }

export type SiteGenerationApplyOptions = SiteGenerationValidationOptions & {
  mediaMode?: "skip-generated-placeholders" | "upload-generated-media"
  mediaAssets?: readonly SiteGenerationMediaAsset[]
  /** Move unspecified published pages to draft during an explicit replacement cutover. */
  retireUnspecifiedPages?: boolean
}

/** A local, operator-supplied asset that can be uploaded during a seed/import. */
export type SiteGenerationMediaAsset = {
  key: string
  filename: string
  alt?: string | null
  filePath: string
}

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, sortValue(entry)]))
}

export const siteGenerationSpecHash = (spec: unknown): string =>
  createHash("sha256").update(JSON.stringify(sortValue(spec))).digest("hex")

const issue = (code: string, message: string, path?: Array<string | number>, severity: ValidationIssue["severity"] = "error"): ValidationIssue => ({
  severity,
  code,
  message,
  ...(path ? { path } : {}),
})

const clonePlain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** Canonical specs already carry semantic blocks; this hook is intentionally a no-op clone. */
export const canonicalizeSiteGenerationSpecForCms = (spec: CmsSiteGenerationSpec): CmsSiteGenerationSpec => clonePlain(spec)

export const validateSiteGenerationSpecForCms = (
  spec: CmsSiteGenerationSpec,
  options: SiteGenerationValidationOptions = {},
): SiteGenerationValidationResult => {
  const candidate = spec as unknown
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { valid: false, issues: [issue("invalid_spec_shape", "SiteGenerationSpec must be an object.")] }
  }

  const parsed = SiteGenerationSpecSchema.safeParse(candidate)
  const issues: ValidationIssue[] = parsed.success
    ? []
    : contractValidationReport(parsed.error).issues
  const value = candidate as Partial<SiteGenerationSpec> & Record<string, unknown>
  const tenant = value.tenant
  const intake = value.intake
  const pages = Array.isArray(value.pages) ? value.pages : []

  if (value.schemaVersion !== 1) issues.push(issue("unsupported_schema_version", "Only SiteGenerationSpec schemaVersion 1 is supported.", ["schemaVersion"]))
  if (!tenant || typeof tenant !== "object" || Array.isArray(tenant)) issues.push(issue("missing_tenant", "SiteGenerationSpec.tenant is required.", ["tenant"]))
  if (!intake || typeof intake !== "object" || Array.isArray(intake)) issues.push(issue("missing_intake", "SiteGenerationSpec.intake is required.", ["intake"]))
  if (pages.length === 0) issues.push(issue("missing_pages", "SiteGenerationSpec.pages must contain at least one page.", ["pages"]))

  const tenantRecord = tenant && typeof tenant === "object" && !Array.isArray(tenant) ? tenant as Record<string, unknown> : null
  const intakeRecord = intake && typeof intake === "object" && !Array.isArray(intake) ? intake as Record<string, unknown> : null
  const tenantSlug = typeof tenantRecord?.slug === "string" ? tenantRecord.slug : ""
  const tenantDomain = typeof tenantRecord?.domain === "string" ? tenantRecord.domain.toLowerCase() : ""
  if (!TENANT_SLUG_REGEX.test(tenantSlug)) issues.push(issue("invalid_tenant_slug", "Tenant slug must contain only lowercase letters, digits, and hyphens.", ["tenant", "slug"]))
  if (!tenantDomain || !DOMAIN_REGEX.test(tenantDomain)) issues.push(issue("invalid_tenant_domain", "Tenant domain must be a lowercase hostname with an alphabetic TLD.", ["tenant", "domain"]))
  if (typeof intakeRecord?.tenantSlug === "string" && intakeRecord.tenantSlug !== tenantSlug) issues.push(issue("tenant_slug_mismatch", "intake.tenantSlug must match tenant.slug.", ["intake", "tenantSlug"]))
  if (typeof intakeRecord?.primaryDomain === "string" && intakeRecord.primaryDomain.toLowerCase() !== tenantDomain) issues.push(issue("tenant_domain_mismatch", "intake.primaryDomain must match tenant.domain.", ["intake", "primaryDomain"]))

  const pageSlugs = new Set<string>()
  let appointmentBlockPath: Array<string | number> | null = null
  pages.forEach((page, pageIndex) => {
    if (!page || typeof page !== "object" || Array.isArray(page)) {
      issues.push(issue("invalid_page_shape", "Page entries must be objects.", ["pages", pageIndex]))
      return
    }
    const pageRecord = page as Record<string, unknown>
    const slug = typeof pageRecord.slug === "string" ? pageRecord.slug : ""
    if (!TENANT_SLUG_REGEX.test(slug)) issues.push(issue("invalid_page_slug", "Page slug must contain only lowercase letters, digits, and hyphens.", ["pages", pageIndex, "slug"]))
    if (pageSlugs.has(slug)) issues.push(issue("duplicate_page_slug", `Duplicate page slug "${slug}" in generation spec.`, ["pages", pageIndex, "slug"]))
    pageSlugs.add(slug)
    const blocks = Array.isArray(pageRecord.blocks) ? pageRecord.blocks : []
    if (blocks.length === 0) issues.push(issue("missing_page_blocks", "Generated pages must contain at least one block.", ["pages", pageIndex, "blocks"]))
    const seen = new Set<string>()
    const seenAnchors = new Set<string>()
    blocks.forEach((block, blockIndex) => {
      const parsedBlock = BlockSchema.safeParse(block)
      if (!parsedBlock.success) {
        issues.push(...parsedBlock.error.issues.map((entry) => issue("invalid_block", entry.message, ["pages", pageIndex, "blocks", blockIndex, ...entry.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number")])))
        return
      }
      const blockType = parsedBlock.data.blockType
      if (blockType === "appointments" && appointmentBlockPath === null) {
        appointmentBlockPath = ["pages", pageIndex, "blocks", blockIndex]
      }
      if (!SITEGEN_TYPES.has(blockType)) issues.push(issue("unsupported_block_type", `Generated block type "${blockType}" is not a Sitegen section.`, ["pages", pageIndex, "blocks", blockIndex, "blockType"]))
      const anchor = typeof parsedBlock.data.anchor === "string" ? parsedBlock.data.anchor : ""
      if (seen.has(blockType) && !REPEATABLE_SECTION_TYPES.has(blockType)) {
        issues.push(issue("duplicate_singleton_section", `Section "${blockType}" may occur only once per page.`, ["pages", pageIndex, "blocks", blockIndex, "blockType"]))
      }
      if (seen.has(blockType) && REPEATABLE_SECTION_TYPES.has(blockType) && !anchor) {
        issues.push(issue("repeatable_section_requires_anchor", `Repeated "${blockType}" sections need a unique anchor.`, ["pages", pageIndex, "blocks", blockIndex, "anchor"]))
      }
      if (anchor && seenAnchors.has(anchor)) issues.push(issue("duplicate_section_anchor", `Section anchor "${anchor}" must be unique within a page.`, ["pages", pageIndex, "blocks", blockIndex, "anchor"]))
      seen.add(blockType)
      if (anchor) seenAnchors.add(anchor)
      if (slug === "index" && blockIndex === 0 && !isHeroBlockType(blockType)) issues.push(issue("hero_not_first", "The homepage hero must be the first block.", ["pages", pageIndex, "blocks", blockIndex]))
      if (slug === "index" && isHeroBlockType(blockType) && blocks.filter((entry) => isHeroBlockType(String(asRecord(entry)?.blockType ?? ""))).length !== 1) issues.push(issue("hero_not_singleton", "The homepage must contain exactly one hero.", ["pages", pageIndex, "blocks"]))
      if (blockType === "contact" && blockIndex !== blocks.length - 1) issues.push(issue("contact_not_last", "Contact should be the final page section.", ["pages", pageIndex, "blocks", blockIndex]))
    })
  })
  if (!pageSlugs.has("index")) issues.push(issue("missing_root_page", "Generated specs must include an index page.", ["pages"]))

  // A provider result may already contain a canonical spec and therefore skip
  // the shallow Sitegen output validator. Keep the appointment capability gate
  // at the canonical CMS boundary as well, but only when the normalized intake
  // actually contains contact capability facts. Thin/operator specs without
  // those facts remain valid and can be configured manually in the CMS.
  if (options.variantScope === "self-serve" && appointmentBlockPath && intakeRecord) {
    const intakeBrief = asRecord(intakeRecord.intakeBrief)
    const briefContact = asRecord(intakeBrief?.contactPreferences)
    const rawIntake = asRecord(intakeRecord.raw)
    const rawContact = asRecord(rawIntake?.contact)
    const hasCapabilityFacts = briefContact !== null || rawContact !== null
    const appointmentRequested =
      briefContact?.availabilityMode === "appointment_only" ||
      briefContact?.formType === "appointment" ||
      (Array.isArray(briefContact?.formOptions) && briefContact.formOptions.includes("appointment")) ||
      rawContact?.availabilityMode === "appointment_only" ||
      rawContact?.formType === "appointment" ||
      (Array.isArray(rawContact?.formOptions) && rawContact.formOptions.includes("appointment"))
    if (hasCapabilityFacts && !appointmentRequested) {
      issues.push(issue(
        "appointment_capability_not_requested",
        "Appointment sections require appointment capability to be requested by the intake before they can be generated.",
        appointmentBlockPath,
      ))
    }
  }

  const manifest = Array.isArray(value.blocks) ? value.blocks : []
  manifest.forEach((entry, index) => {
    const slug = asRecord(entry)?.slug
    if (typeof slug !== "string" || !SITE_BLOCK_SLUGS.includes(slug as (typeof SITE_BLOCK_SLUGS)[number])) issues.push(issue("unsupported_manifest_block_slug", `Generated manifest block slug "${String(slug)}" is not an owned block.`, ["blocks", index, "slug"]))
  })

  const settings = asRecord(value.settings)
  const disclosure = asRecord(settings?.privacyDisclosure)
  if (Array.isArray(disclosure?.marketingTechnologies) && disclosure.marketingTechnologies.length > 0) {
    issues.push(issue("unsupported_optional_tracking_without_consent_ui", "Optional marketing technologies are not enabled by generated sites.", ["settings", "privacyDisclosure", "marketingTechnologies"]))
  }

  if (issues.some((entry) => entry.severity === "error") || !parsed.success) return { valid: false, issues }
  return { valid: true, issues, data: parsed.data }
}

const relationshipId = (value: unknown): string | number | undefined => {
  if (typeof value === "string" || typeof value === "number") return value
  if (value && typeof value === "object" && !Array.isArray(value) && "id" in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === "string" || typeof id === "number" ? id : undefined
  }
  return undefined
}

const themeToCmsTokens = (theme: ThemeTokenSpec): ThemeTokens | null => {
  const parsed = themeSchema.safeParse(theme)
  if (!parsed.success) throw new Error(`Invalid CMS theme tokens: ${parsed.error.issues.map((entry) => entry.message).join("; ")}`)
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

const scanRichTextCapabilities = (value: unknown, result = { blockquote: false, bulletList: false, orderedList: false, divider: false, themedNodeIds: new Set<string>() }) => {
  if (!value || typeof value !== "object") return result
  if (Array.isArray(value)) {
    for (const item of value) scanRichTextCapabilities(item, result)
    return result
  }
  const record = value as Record<string, unknown>
  if (record.t === "blockquote") result.blockquote = true
  if (record.t === "list" && record.ordered === false) result.bulletList = true
  if (record.t === "list" && record.ordered === true) result.orderedList = true
  if (record.t === "divider") result.divider = true
  if (record.t === "themed" && typeof record.id === "string") result.themedNodeIds.add(record.id)
  for (const entry of Object.values(record)) scanRichTextCapabilities(entry, result)
  return result
}

const siteManifestForSpec = (spec: SiteGenerationSpec, idempotencyKey: string): RtManifest & Record<string, unknown> => {
  const capabilities = scanRichTextCapabilities(spec.pages)
  const manifest = {
    ...DEFAULT_GENERATION_MANIFEST,
    blockTypes: {
      ...DEFAULT_GENERATION_MANIFEST.blockTypes,
      ...(capabilities.blockquote ? { blockquote: true } : {}),
      ...(capabilities.bulletList ? { bulletList: true } : {}),
      ...(capabilities.orderedList ? { orderedList: true } : {}),
      ...(capabilities.divider ? { divider: true } : {}),
    },
    blocks: spec.blocks?.map((block) => ({ slug: block.slug, ...(block.label ? { label: block.label } : {}) })) ?? SITE_BLOCK_SLUGS.map((slug) => ({ slug, label: slug })),
    generation: { source: "site-generation-spec", hash: idempotencyKey, generatedAt: spec.generatedAt ?? null, generator: spec.generator ?? null },
    settings: {
      ...DEFAULT_CLIENT_SETTINGS_CONTRACT,
      general: { ...DEFAULT_CLIENT_SETTINGS_CONTRACT.general, contactEmail: true },
    },
    analyticsConsent: approvedPublicAnalyticsConsent() ?? undefined,
    ...(capabilities.themedNodeIds.size > 0 ? { themedNodes: Array.from(capabilities.themedNodeIds).sort().map((id) => ({ id, label: id, fields: [{ name: "text", type: "text", required: true }] })) } : {}),
  }
  const parsed = manifestSchema.safeParse(manifest)
  if (!parsed.success) throw new Error(`Generated siteManifest is invalid: ${parsed.error.issues.map((entry) => entry.message).join("; ")}`)
  return manifest as RtManifest & Record<string, unknown>
}

type MediaIdMap = Map<string, string | number>

const normalizeMediaRef = (value: unknown, mediaIds?: MediaIdMap): unknown => {
  const lookupKeys = [
    ...(typeof value === "string" ? [value] : []),
    ...(value && typeof value === "object" && !Array.isArray(value) && "filename" in value && typeof (value as { filename?: unknown }).filename === "string"
      ? [(value as { filename: string }).filename]
      : []),
  ]
  for (const key of lookupKeys) {
    const mapped = mediaIds?.get(key)
    if (mapped !== undefined) return mapped
  }
  const direct = relationshipId(value)
  if (direct !== undefined) {
    const mapped = mediaIds?.get(String(direct))
    return mapped ?? direct
  }
  return undefined
}

const omitNullish = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(omitNullish)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => entry == null ? [] : [[key, omitNullish(entry)]]))
}

const MEDIA_KEYS = new Set(["image", "portrait", "logo", "favicon", "ogImage"])
const normalizeMediaFields = (value: unknown, mediaIds?: MediaIdMap, key?: string): unknown => {
  if (Array.isArray(value)) return value.map((entry) => normalizeMediaFields(entry, mediaIds, key))
  if (!value || typeof value !== "object") return value
  if (key && MEDIA_KEYS.has(key)) return normalizeMediaRef(value, mediaIds)
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entry]) => [entryKey, normalizeMediaFields(entry, mediaIds, entryKey)]))
}

const sourceIdRows = (value: unknown): unknown =>
  Array.isArray(value) ? value.map((sourceId) => ({ sourceId })) : value

const normalizeWorkMediaRows = (projects: unknown, mediaIds?: MediaIdMap): unknown => {
  if (!Array.isArray(projects)) return projects
  return projects.map((project) => {
    if (!project || typeof project !== "object" || Array.isArray(project)) return project
    const record = project as Record<string, unknown>
    const media = Array.isArray(record.media)
      ? record.media
        .map((value) => ({ image: normalizeMediaRef(value, mediaIds) }))
        .filter((value): value is { image: string | number } => value.image !== undefined)
      : record.media
    return { ...record, media }
  })
}

const normalizeContactForm = (form: unknown): unknown => {
  if (!form || typeof form !== "object" || Array.isArray(form)) return form
  const record = form as Record<string, unknown>
  const fields = Array.isArray(record.fields)
    ? record.fields.map((field) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) return field
      return { ...(field as Record<string, unknown>) }
    })
    : record.fields
  return { ...record, fields }
}

const normalizeBlock = (block: GeneratedPageSpec["blocks"][number], mediaIds?: MediaIdMap): Record<string, unknown> => {
  const { id: _id, ...rest } = block
  const normalized = normalizeMediaFields(rest, mediaIds) as Record<string, unknown>
  if (normalized.blockType === "hero") {
    // Payload block-array updates are partial at the nested-row level. Send
    // explicit empty arrays for variant-owned fields that are not accepted by
    // the selected hero so a variant change also clears stale editor rows.
    if (normalized.variant !== "hero-01") normalized.highlights = []
    if (normalized.variant !== "hero-02") normalized.serviceHighlights = []
  }
  if (normalized.blockType === "reviews") normalized.reviewSourceIds = sourceIdRows(normalized.reviewSourceIds)
  if (normalized.blockType === "pricing") {
    normalized.pricingSourceIds = sourceIdRows(normalized.pricingSourceIds)
    if (Array.isArray(normalized.offers)) {
      normalized.offers = normalized.offers.map((offer) => {
        if (!offer || typeof offer !== "object" || Array.isArray(offer)) return offer
        const record = offer as Record<string, unknown>
        return {
          ...record,
          features: Array.isArray(record.features)
            ? record.features.map((value) => ({ value }))
            : record.features,
        }
      })
    }
  }
  if (normalized.blockType === "work") normalized.projects = normalizeWorkMediaRows(normalized.projects, mediaIds)
  if (normalized.blockType === "contact") normalized.form = normalizeContactForm(normalized.form)
  if (normalized.blockType === "contact" && Array.isArray(normalized.serviceArea)) {
    normalized.serviceArea = normalized.serviceArea.map((value) => ({ value }))
  }
  return omitNullish(normalized) as Record<string, unknown>
}

const normalizePageData = (tenantId: string | number, page: GeneratedPageSpec, mediaIds?: MediaIdMap): Partial<Page> => omitNullish({
  tenant: Number(tenantId),
  title: page.title,
  slug: page.slug,
  status: "draft",
  blocks: page.blocks.map((block) => normalizeBlock(block, mediaIds)),
  seo: page.seo ? { ...page.seo, ogImage: normalizeMediaRef(page.seo.ogImage, mediaIds) } : undefined,
}) as Partial<Page>

const hrefToNavEntry = (href: string, label: string | null | undefined, external: boolean | undefined, pageBySlug: Map<string, ExistingPage>): NavEntry => {
  const section = href.match(/^\/?([a-z0-9-]+)?#([A-Za-z0-9_-]+)$/)
  if (section) {
    const page = pageBySlug.get(section[1] || "index")
    return { type: "section", ...(page ? { page: page.id } : {}), anchor: section[2], label: label ?? section[2] }
  }
  const page = pageBySlug.get(href.replace(/^\//, "").replace(/\/$/, "") || "index")
  if (page) return { type: "page", page: page.id, ...(label ? { label } : {}) }
  return { type: "custom", url: href, label: label ?? href, external: Boolean(external) }
}

const normalizeNav = (entries: GeneratedNavEntries, pageBySlug: Map<string, ExistingPage>): NavEntry[] | undefined => {
  if (!entries) return undefined
  return entries.map((entry) => entry.children?.length
    ? { type: "group", label: entry.label, description: entry.description, children: entry.children.map((child) => ({ label: child.label, href: child.href, external: child.external, description: child.description, icon: child.icon })) }
    : hrefToNavEntry(entry.href ?? "", entry.label, entry.external, pageBySlug))
}

const normalizeSettingsData = (tenantId: string | number, settings: GeneratedSiteSettings, pageBySlug: Map<string, ExistingPage>, mediaIds?: MediaIdMap): Partial<SiteSetting> => {
  const normalizedBranding = settings.branding ? normalizeMediaFields(settings.branding, mediaIds) : undefined
  const normalizedChrome = settings.chrome ? normalizeMediaFields(settings.chrome, mediaIds) : undefined
  const brandingLogo = asRecord(normalizedBranding)?.logo ?? null
  const sourceChrome = asRecord(settings.chrome)
  const chrome = asRecord(normalizedChrome)

  // Payload updates nested groups as partial updates. Materialize the
  // documented branding-logo fallback into both chrome branches so a stale
  // navbar/footer-specific override cannot survive a Sitegen import.
  const chromeWithLogoFallback = chrome
    ? (["navbar", "footer"] as const).reduce<Record<string, unknown>>((result, key) => {
      const section = asRecord(chrome[key])
      if (!section) return result
      const sourceSection = asRecord(sourceChrome?.[key])
      const hasExplicitLogo = sourceSection != null && Object.prototype.hasOwnProperty.call(sourceSection, "logo")
      result[key] = {
        ...section,
        logo: hasExplicitLogo
          ? normalizeMediaRef(sourceSection?.logo, mediaIds) ?? null
          : brandingLogo,
      }
      return result
    }, { ...chrome })
    : normalizedChrome

  return omitNullish({
    tenant: Number(tenantId),
    siteName: settings.siteName,
    siteUrl: settings.siteUrl,
    description: settings.description,
    language: settings.language || "nl",
    aliases: settings.aliases,
    contactEmail: settings.contactEmail,
    branding: normalizedBranding,
    chrome: chromeWithLogoFallback,
    consent: settings.consent,
    systemTemplates: settings.systemTemplates,
    maintenance: settings.maintenance,
    privacyDisclosure: settings.privacyDisclosure,
    contact: settings.contact,
    nap: settings.nap,
    hours: settings.hours,
    serviceArea: settings.serviceArea,
    navigation: settings.navigation ? {
      primary: normalizeNav(settings.navigation.primary, pageBySlug),
      footer: normalizeNav(settings.navigation.footer, pageBySlug),
    } : undefined,
  }) as Partial<SiteSetting>
}

const findOne = async <T>(payload: Payload, collection: "tenants" | "pages" | "site-settings" | "media", where: Where): Promise<T | undefined> => {
  const found = await payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true })
  return found.docs[0] as T | undefined
}

type PreparedMediaAsset = SiteGenerationMediaAsset
type PreparedMediaAssets = {
  assets: PreparedMediaAsset[]
  cleanup: () => Promise<void>
}

const MEDIA_FILENAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

const prepareMediaAssets = async (assets: readonly SiteGenerationMediaAsset[] | undefined): Promise<PreparedMediaAssets | undefined> => {
  if (!assets || assets.length === 0) return undefined

  const keys = new Set<string>()
  const filenames = new Set<string>()
  for (const asset of assets) {
    if (!asset.key.trim() || keys.has(asset.key)) throw new Error(`Duplicate or empty Sitegen media asset key "${asset.key}".`)
    if (!MEDIA_FILENAME_REGEX.test(asset.filename) || filenames.has(asset.filename)) throw new Error(`Invalid or duplicate Sitegen media filename "${asset.filename}".`)
    if (!asset.filePath.trim()) throw new Error(`Sitegen media asset "${asset.key}" is missing a local file path.`)
    keys.add(asset.key)
    filenames.add(asset.filename)
    const source = await stat(asset.filePath)
    if (!source.isFile()) throw new Error(`Sitegen media asset "${asset.key}" is not a file: ${asset.filePath}`)
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "siab-sitegen-media-"))
  try {
    const prepared = []
    for (const asset of assets) {
      const filePath = join(temporaryDirectory, asset.filename)
      await copyFile(asset.filePath, filePath)
      prepared.push({ ...asset, filePath })
    }
    return {
      assets: prepared,
      cleanup: () => rm(temporaryDirectory, { recursive: true, force: true }),
    }
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true })
    throw error
  }
}

const upsertMediaAssets = async (payload: Payload, tenantId: string | number, assets: readonly PreparedMediaAsset[]): Promise<MediaIdMap> => {
  const mediaIds: MediaIdMap = new Map()
  for (const asset of assets) {
    const existing = await findOne<Media>(payload, "media", {
      and: [{ tenant: { equals: tenantId } }, { filename: { equals: asset.filename } }],
    })
    const data = {
      tenant: Number(tenantId),
      filename: asset.filename,
      ...(asset.alt !== undefined ? { alt: asset.alt } : {}),
    }
    const document = existing
      ? await payload.update({
        collection: "media",
        id: existing.id,
        data: data as unknown as Partial<Media>,
        filePath: asset.filePath,
        overwriteExistingFiles: true,
        depth: 0,
        overrideAccess: true,
        context: DRAFT_IMPORT_CONTEXT,
      })
      : await payload.create({
        collection: "media",
        data: data as unknown as Media,
        filePath: asset.filePath,
        overwriteExistingFiles: true,
        depth: 0,
        overrideAccess: true,
        context: DRAFT_IMPORT_CONTEXT,
      })
    const id = (document as Media).id
    mediaIds.set(asset.key, id)
    mediaIds.set(asset.filename, id)
  }
  return mediaIds
}

const upsertTenant = async (payload: Payload, spec: SiteGenerationSpec, siteManifest: Record<string, unknown>, theme: ThemeTokens | null) => {
  const bySlug = await findOne<Tenant>(payload, "tenants", { slug: { equals: spec.tenant.slug } })
  const byDomain = await findOne<Tenant>(payload, "tenants", { domain: { equals: spec.tenant.domain } })
  if (bySlug && byDomain && String(bySlug.id) !== String(byDomain.id)) throw new Error(`Generation spec conflicts with existing tenants: slug "${spec.tenant.slug}" and domain "${spec.tenant.domain}" belong to different tenants.`)
  const existing = bySlug ?? byDomain
  const data = { name: spec.tenant.name, slug: spec.tenant.slug, domain: spec.tenant.domain, status: existing?.status ?? "provisioning", emailSending: existing?.emailSending ?? buildDefaultTenantEmailSending(spec.tenant.domain), siteManifest, theme }
  if (existing) return { doc: await payload.update({ collection: "tenants", id: existing.id, data, depth: 0, overrideAccess: true, context: DRAFT_IMPORT_CONTEXT }), operation: "updated" as const }
  return { doc: await payload.create({ collection: "tenants", data, depth: 0, overrideAccess: true, context: DRAFT_IMPORT_CONTEXT }), operation: "created" as const }
}

const upsertPages = async (payload: Payload, tenantId: string | number, pages: GeneratedPageSpec[], mediaIds?: MediaIdMap) => {
  const results: Array<{ doc: ExistingPage; operation: ApplyOperation }> = []
  for (const page of pages) {
    const data = normalizePageData(tenantId, page, mediaIds)
    const existing = await findOne<Page>(payload, "pages", { and: [{ tenant: { equals: tenantId } }, { slug: { equals: page.slug } }] })
    if (existing) {
      const updated = await payload.update({ collection: "pages", id: existing.id, data, depth: 0, overrideAccess: true, context: DRAFT_IMPORT_CONTEXT })
      results.push({ doc: updated as ExistingPage, operation: "updated" })
    } else {
      const created = await payload.create({ collection: "pages", data: data as unknown as Page, depth: 0, overrideAccess: true, context: DRAFT_IMPORT_CONTEXT })
      results.push({ doc: created as ExistingPage, operation: "created" })
    }
  }
  return results
}

const upsertSettings = async (payload: Payload, tenantId: string | number, settings: GeneratedSiteSettings, pageBySlug: Map<string, ExistingPage>, mediaIds?: MediaIdMap) => {
  const data = normalizeSettingsData(tenantId, settings, pageBySlug, mediaIds)
  const existing = await findOne<SiteSetting>(payload, "site-settings", { tenant: { equals: tenantId } })
  if (existing) return { doc: await payload.update({ collection: "site-settings", id: existing.id, data, depth: 0, overrideAccess: true, context: DRAFT_IMPORT_CONTEXT }), operation: "updated" as const }
  return { doc: await payload.create({ collection: "site-settings", data: data as unknown as SiteSetting, depth: 0, overrideAccess: true, context: DRAFT_IMPORT_CONTEXT }), operation: "created" as const }
}

const retainedPagesForTenant = async (payload: Payload, tenantId: string | number, appliedSlugs: Set<string>): Promise<RetainedPage[]> => {
  const result = await payload.find({ collection: "pages", where: { tenant: { equals: tenantId } }, limit: 1000, depth: 0, overrideAccess: true })
  return (result.docs as ExistingPage[]).filter((page) => !appliedSlugs.has(page.slug)).map((page) => ({ id: page.id, slug: page.slug, ...(page.status ? { status: page.status } : {}) }))
}

export const retireUnspecifiedPagesForTenant = async (
  payload: Payload,
  tenantId: string | number,
  appliedSlugs: Set<string>,
): Promise<{ retainedPages: RetainedPage[]; retiredPages: RetainedPage[] }> => {
  const retainedPages = await retainedPagesForTenant(payload, tenantId, appliedSlugs)
  const retiredPages = retainedPages.filter((page) => page.status === "published")
  await Promise.all(retiredPages.map((page) => payload.update({
    collection: "pages",
    id: page.id,
    data: { status: "draft" },
    depth: 0,
    overrideAccess: true,
    context: PAGE_REPLACEMENT_CONTEXT,
  })))
  return { retainedPages, retiredPages }
}

export async function applySiteGenerationSpec(payload: Payload, spec: CmsSiteGenerationSpec, options: SiteGenerationApplyOptions = {}): Promise<CmsGenerationApplyResult> {
  const sourceValidation = validateSiteGenerationSpecForCms(spec, options)
  if (!sourceValidation.valid) return { ok: false, validation: sourceValidation }
  const canonicalSpec = materializeTenantPrivacyDisclosure(canonicalizeSiteGenerationSpecForCms(sourceValidation.data))
  const transformedValidation = validateSiteGenerationSpecForCms(canonicalSpec, options)
  if (!transformedValidation.valid) return { ok: false, validation: transformedValidation }
  const { data: parsedSpec, ...validation } = transformedValidation
  const idempotencyKey = siteGenerationSpecHash(parsedSpec)
  const theme = themeToCmsTokens(parsedSpec.theme)
  const siteManifest = siteManifestForSpec(parsedSpec, idempotencyKey)
  const preparedMedia = await prepareMediaAssets(options.mediaAssets)
  try {
    const tenant = await upsertTenant(payload, parsedSpec, siteManifest, theme)
    const tenantId = tenant.doc.id as string | number
    const mediaIds = preparedMedia ? await upsertMediaAssets(payload, tenantId, preparedMedia.assets) : new Map<string, string | number>()
    const pages = await upsertPages(payload, tenantId, parsedSpec.pages, mediaIds)
    const pageBySlug = new Map(pages.map(({ doc }) => [doc.slug, doc]))
    const settings = await upsertSettings(payload, tenantId, parsedSpec.settings, pageBySlug, mediaIds)
    const pageState = options.retireUnspecifiedPages
      ? await retireUnspecifiedPagesForTenant(payload, tenantId, new Set(parsedSpec.pages.map((page) => page.slug)))
      : {
        retainedPages: await retainedPagesForTenant(payload, tenantId, new Set(parsedSpec.pages.map((page) => page.slug))),
        retiredPages: [],
      }
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
        retainedPages: pageState.retainedPages,
        retiredPages: pageState.retiredPages,
      },
    }
  } finally {
    await preparedMedia?.cleanup()
  }
}
