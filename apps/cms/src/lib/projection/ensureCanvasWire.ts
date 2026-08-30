import type { Block, Page, SiteSettings } from "@siteinabox/contracts"
import { BlockSchema, CanvasPageSchema, SiteSettingsSchema } from "@siteinabox/contracts"
import { v1FixturePage } from "@siteinabox/site-renderer"
import { asRecord } from "@/lib/record"

const SLUG_RE = /^[a-z0-9-]+$/
const PREVIEW_BLOCK_FIXTURES = new Map<string, Block>(v1FixturePage.blocks.map((block) => [block.blockType === "hero" ? block.variant : block.blockType, block]))

const asIsoTimestamp = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) return value
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString()
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.valueOf())) return date.toISOString()
  }
  return new Date(0).toISOString()
}

const sanitizeBlockRecord = (block: unknown): Record<string, unknown> | null => {
  const record = asRecord(block)
  if (!record || typeof record.blockType !== "string") return null
  const { blockName: _blockName, ...withoutName } = record
  return withoutName
}

const previewFallbackBlock = (block: unknown): Block => {
  const type = asRecord(block)?.blockType
  const variant = asRecord(block)?.variant
  const requestedKey = type === "hero" && typeof variant === "string"
    ? variant
    : type
  const requested = typeof requestedKey === "string" ? PREVIEW_BLOCK_FIXTURES.get(requestedKey) : undefined
  const fallback = requested ?? PREVIEW_BLOCK_FIXTURES.get("hero-01")
  if (!fallback) throw new Error("Canvas preview fixture for hero is missing.")
  const id = asRecord(block)?.id
  return id === undefined ? fallback : { ...fallback, id: String(id) }
}

export function sanitizeCanvasWireBlock(block: unknown): Block {
  const candidate = sanitizeBlockRecord(block)
  const parsed = BlockSchema.safeParse(candidate)
  if (parsed.success) return parsed.data
  if (process.env.NODE_ENV !== "production") console.warn("[canvas-wire] invalid block replaced with an owned preview fixture", parsed.error.issues)
  return previewFallbackBlock(block)
}

export function ensureCanvasWireSettings(settings: unknown): SiteSettings {
  const record = asRecord(settings) ?? {}
  const candidate = {
    ...record,
    language: typeof record.language === "string" && record.language.trim() ? record.language.trim() : "nl",
  }
  const parsed = SiteSettingsSchema.safeParse(candidate)
  if (parsed.success) return parsed.data
  if (process.env.NODE_ENV !== "production") console.warn("[canvas-wire] invalid settings replaced with a minimal owned preview", parsed.error.issues)
  return SiteSettingsSchema.parse({
    siteName: typeof record.siteName === "string" && record.siteName.trim() ? record.siteName.trim() : "Preview",
    siteUrl: typeof record.siteUrl === "string" && URL.canParse(record.siteUrl) ? record.siteUrl : "https://preview.invalid",
    language: candidate.language,
  })
}

export function ensureCanvasWirePage(page: unknown): Page {
  const record = asRecord(page) ?? {}
  const title = typeof record.title === "string" && record.title.trim() ? record.title : "—"
  const slug = typeof record.slug === "string" && SLUG_RE.test(record.slug) ? record.slug : "draft"
  const candidate = {
    ...(typeof record.id === "string" && record.id.trim() ? { id: record.id.trim() } : {}),
    title,
    slug,
    ...(record.status === "draft" || record.status === "published" ? { status: record.status } : {}),
    blocks: (Array.isArray(record.blocks) ? record.blocks : []).map(sanitizeCanvasWireBlock),
    ...(asRecord(record.seo) ? { seo: record.seo } : {}),
    updatedAt: asIsoTimestamp(record.updatedAt),
  }
  const parsed = CanvasPageSchema.safeParse(candidate)
  if (parsed.success) return parsed.data
  if (process.env.NODE_ENV !== "production") console.warn("[canvas-wire] invalid page replaced with a safe page projection", parsed.error.issues)
  const { seo: _seo, ...withoutSeo } = candidate
  return CanvasPageSchema.parse(withoutSeo)
}
