import type { Block, Page, SiteSettings } from "@siteinabox/contracts"
import {
  BlockSchema,
  CanvasPageSchema,
  SHADCNUI_BLOCK_VARIANTS,
  SHADCNUI_SYSTEM_BLOCK_VARIANTS,
  SITE_BLOCK_CATALOG,
  SiteSettingsSchema,
} from "@siteinabox/contracts"
import { v1FixturePage } from "@siteinabox/site-renderer"
import { asRecord } from "@/lib/record"

const SLUG_RE = /^[a-z0-9-]+$/

const ANALYTICS_KEYS = [
  "sectionId",
  "sectionType",
  "sectionPosition",
  "sectionAnchor",
  "providerVariant",
  "blockPresetId",
  "contentSignature",
] as const

function asIsoTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString()
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.valueOf())) return date.toISOString()
  }
  return new Date(0).toISOString()
}

function sanitizeCanvasWireAnalytics(value: unknown): Record<string, unknown> | null | undefined {
  if (value == null) return value === null ? null : undefined
  const record = asRecord(value)
  if (!record) return undefined
  const out: Record<string, unknown> = {}
  for (const key of ANALYTICS_KEYS) {
    if (key in record) out[key] = record[key]
  }
  return out
}

const PROVIDER_BLOCK_VARIANTS = [
  ...SHADCNUI_BLOCK_VARIANTS,
  ...SHADCNUI_SYSTEM_BLOCK_VARIANTS,
]

const PREVIEW_BLOCK_FIXTURES = new Map<string, Block>()
for (const block of v1FixturePage.blocks) {
  if (!PREVIEW_BLOCK_FIXTURES.has(block.blockType)) {
    PREVIEW_BLOCK_FIXTURES.set(block.blockType, block)
  }
}

function reportCanvasFallback(scope: string, issues: Array<{ path: PropertyKey[]; message: string }>): void {
  if (process.env.NODE_ENV === "production") return
  console.warn(`[canvas-wire] ${scope} used a renderer-safe preview fallback`, issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  })))
}

function sanitizeCanvasWireBlockRecord(block: unknown): Record<string, unknown> | null {
  const record = asRecord(block)
  if (!record || typeof record.blockType !== "string") return null

  const { blockName: _blockName, ...withoutName } = record
  const next: Record<string, unknown> = { ...withoutName }
  if ("analytics" in next) {
    const analytics = sanitizeCanvasWireAnalytics(next.analytics)
    if (analytics === undefined) delete next.analytics
    else next.analytics = analytics
  }

  const designVariant = typeof next.designVariant === "string" ? next.designVariant.trim() : ""
  const variant = PROVIDER_BLOCK_VARIANTS.find((candidate) =>
    candidate.blockType === next.blockType && candidate.id === designVariant,
  )
  if (variant) {
    for (const [field, slot] of Object.entries(variant.slots)) {
      if (slot.status === "inactive") delete next[field]
    }
  }

  return next
}

function previewFallbackBlock(block: unknown): Block {
  const record = asRecord(block)
  const requestedType = typeof record?.blockType === "string" ? record.blockType : "hero"
  const requestedFixture = PREVIEW_BLOCK_FIXTURES.get(requestedType)
  const heroFixture = PREVIEW_BLOCK_FIXTURES.get("hero")
  if (!heroFixture) throw new Error("Canvas preview fixture for hero is missing.")

  const id = typeof record?.id === "string" && record.id.trim()
    ? record.id.trim()
    : typeof record?.id === "number" && Number.isFinite(record.id)
      ? String(record.id)
      : undefined
  const analytics = sanitizeCanvasWireAnalytics(record?.analytics)

  const fixtures = requestedFixture && requestedFixture.blockType !== heroFixture.blockType
    ? [requestedFixture, heroFixture]
    : [heroFixture]
  for (const fixture of fixtures) {
    const catalog = SITE_BLOCK_CATALOG.find((entry) => entry.slug === fixture.blockType)
    const requestedVariant = fixture === requestedFixture
      && typeof record?.designVariant === "string"
      && PROVIDER_BLOCK_VARIANTS.some((variant) =>
        variant.blockType === fixture.blockType && variant.id === record.designVariant)
      ? record.designVariant
      : null
    const variants = [
      requestedVariant,
      ...(catalog?.variants.map((variant) => variant.providerVariantId ?? variant.variant) ?? []),
    ].filter((variant, index, all): variant is string =>
      typeof variant === "string" && variant.length > 0 && all.indexOf(variant) === index,
    )

    for (const designVariant of variants) {
      const candidate = sanitizeCanvasWireBlockRecord({
        ...fixture,
        ...(id ? { id } : {}),
        designVariant,
        ...(analytics !== undefined ? { analytics } : {}),
      })
      const parsed = BlockSchema.safeParse(candidate)
      if (parsed.success) return parsed.data
    }
  }

  throw new Error("Canvas preview fixture for hero has no valid provider variant.")
}

/**
 * Parse a strict contract block. Incomplete active rows keep their type, index,
 * and stable id; unsupported legacy rows still keep their index and id.
 */
export function sanitizeCanvasWireBlock(block: unknown): Block {
  const candidate = sanitizeCanvasWireBlockRecord(block)
  const parsed = BlockSchema.safeParse(candidate)
  if (parsed.success) return parsed.data

  reportCanvasFallback("block", parsed.error.issues)
  return previewFallbackBlock(block)
}

/**
 * Settings projection for the page-editor / preview canvas must satisfy
 * `SiteSettingsSchema` on every `render.snapshot`. UI settings contracts may
 * omit `language` from the form, but the wire schema still requires it.
 */
export function ensureCanvasWireSettings(settings: unknown): SiteSettings {
  const record = asRecord(settings) ?? {}
  const language = typeof record.language === "string" && record.language.trim()
    ? record.language.trim()
    : "nl"

  const chrome = asRecord(record.chrome)
  const banner = asRecord(chrome?.banner)
  const message = typeof banner?.message === "string" ? banner.message.trim() : ""
  const candidate = {
    ...record,
    language,
    ...(chrome
      ? {
          chrome: {
            ...chrome,
            ...(banner && message ? { banner: { ...banner, message } } : {}),
          },
        }
      : {}),
  }
  if (chrome && banner && !message && candidate.chrome) {
    delete candidate.chrome.banner
  }

  const parsed = SiteSettingsSchema.safeParse(candidate)
  if (parsed.success) return parsed.data
  reportCanvasFallback("settings", parsed.error.issues)

  const { chrome: _chrome, ...withoutChrome } = candidate
  const withoutChromeParsed = SiteSettingsSchema.safeParse(withoutChrome)
  if (withoutChromeParsed.success) return withoutChromeParsed.data

  return SiteSettingsSchema.parse({
    siteName: typeof record.siteName === "string" && record.siteName.trim()
      ? record.siteName.trim()
      : "Preview",
    siteUrl: typeof record.siteUrl === "string" && URL.canParse(record.siteUrl)
      ? record.siteUrl
      : "https://preview.invalid",
    language,
  })
}

/**
 * Page projection for live canvas snapshots is genuinely parsed. The canvas
 * schema permits an explicit empty page; save/publish PageSchema remains strict.
 */
export function ensureCanvasWirePage(page: unknown): Page {
  const record = asRecord(page) ?? {}
  const title = typeof record.title === "string" && record.title.trim()
    ? record.title
    : "—"
  const slug = typeof record.slug === "string" && SLUG_RE.test(record.slug)
    ? record.slug
    : "draft"
  const blocks = (Array.isArray(record.blocks) ? record.blocks : [])
    .map(sanitizeCanvasWireBlock)

  const candidate = {
    ...(typeof record.id === "string" && record.id.trim() ? { id: record.id.trim() } : {}),
    title,
    slug,
    ...(record.status === "draft" || record.status === "published" ? { status: record.status } : {}),
    ...(record.analytics === null || asRecord(record.analytics) ? { analytics: record.analytics } : {}),
    blocks,
    ...(asRecord(record.seo) ? { seo: record.seo } : {}),
    updatedAt: asIsoTimestamp(record.updatedAt),
  }
  const parsed = CanvasPageSchema.safeParse(candidate)
  if (parsed.success) return parsed.data

  reportCanvasFallback("page", parsed.error.issues)
  const { seo: _seo, ...withoutSeo } = candidate
  return CanvasPageSchema.parse(withoutSeo)
}
