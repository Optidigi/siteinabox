import type { Page, SiteSettings } from "@siteinabox/contracts"
import { asRecord } from "@/lib/record"

const SLUG_RE = /^[a-z0-9-]+$/

function asIsoTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString()
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.valueOf())) return date.toISOString()
  }
  return new Date(0).toISOString()
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
 * Page projection for live canvas snapshots must satisfy `PageSchema` fields
 * that the editor form may leave empty mid-edit (`updatedAt`, title, slug).
 * Does not invent blocks — empty drafts still fail until the operator adds one.
 */
export function ensureCanvasWirePage(page: Page): Page {
  const title = typeof page.title === "string" && page.title.trim()
    ? page.title
    : "—"
  const slug = typeof page.slug === "string" && SLUG_RE.test(page.slug)
    ? page.slug
    : "draft"
  return {
    ...page,
    title,
    slug,
    updatedAt: asIsoTimestamp(page.updatedAt),
    blocks: Array.isArray(page.blocks) ? page.blocks : [],
  }
}
