import type { Block, Page, SiteSettings } from "@siteinabox/contracts"
import { getProviderBlockVariant } from "@siteinabox/contracts"
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

/**
 * Strip editor/Payload artifacts that fail strict `BlockSchema` on live canvas
 * snapshots: `blockName`, analytics extras, and inactive provider slots.
 */
export function sanitizeCanvasWireBlock(block: unknown): Block | null {
  const record = asRecord(block)
  if (!record || typeof record.blockType !== "string") return null

  const { blockName: _blockName, ...withoutName } = record
  const next: Record<string, unknown> = { ...withoutName }
  if ("analytics" in next) {
    const analytics = sanitizeCanvasWireAnalytics(next.analytics)
    if (analytics === undefined) delete next.analytics
    else next.analytics = analytics
  }

  const variant = getProviderBlockVariant({
    blockType: next.blockType as Block["blockType"],
    designVariant: typeof next.designVariant === "string" ? next.designVariant : null,
  })
  if (variant) {
    for (const [field, slot] of Object.entries(variant.slots)) {
      if (slot.status === "inactive") delete next[field]
    }
  }

  return next as Block
}

/**
 * Settings projection for the page-editor / preview canvas must satisfy
 * `SiteSettingsSchema` on every `render.snapshot`. UI settings contracts may
 * omit `language` from the form, but the wire schema still requires it.
 */
export function ensureCanvasWireSettings(settings: SiteSettings): SiteSettings {
  const record = settings as SiteSettings & Record<string, unknown>
  const language = typeof record.language === "string" && record.language.trim()
    ? record.language.trim()
    : "nl"

  const chrome = asRecord(record.chrome)
  if (!chrome) return { ...record, language }

  const banner = asRecord(chrome.banner)
  if (!banner) return { ...record, language }

  const message = typeof banner.message === "string" ? banner.message.trim() : ""
  if (message) {
    return {
      ...record,
      language,
      chrome: {
        ...chrome,
        banner: { ...banner, message },
      },
    } as SiteSettings
  }

  // Banner present without a message fails `message.min(1)` even when hidden.
  const { banner: _banner, ...chromeWithoutBanner } = chrome
  return {
    ...record,
    language,
    chrome: chromeWithoutBanner,
  } as SiteSettings
}

/**
 * Page projection for live canvas snapshots must satisfy `PageSchema`.
 * Fills mid-edit gaps and strips editor artifacts that reject strict blocks.
 * Does not invent blocks — empty drafts still fail until the operator adds one.
 */
export function ensureCanvasWirePage(page: Page): Page {
  const title = typeof page.title === "string" && page.title.trim()
    ? page.title
    : "—"
  const slug = typeof page.slug === "string" && SLUG_RE.test(page.slug)
    ? page.slug
    : "draft"
  const blocks = (Array.isArray(page.blocks) ? page.blocks : [])
    .map((block) => sanitizeCanvasWireBlock(block))
    .filter((block): block is Block => block != null)

  return {
    ...page,
    title,
    slug,
    updatedAt: asIsoTimestamp(page.updatedAt),
    blocks,
  }
}
