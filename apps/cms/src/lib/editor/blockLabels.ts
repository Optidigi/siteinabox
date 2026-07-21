import type { RtManifest } from "@/lib/richText/manifest"
import { blockBySlug } from "@/blocks/registry"

const titleCaseSlug = (slug: string): string =>
  slug
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())

/**
 * Merchant-facing block label for lists and inspector chrome.
 * Prefer tenant manifest labels; never leak raw Payload slug when a better
 * label exists.
 */
export function resolveBlockLabel(
  blockType: string | undefined,
  manifest?: RtManifest | null,
  localeLabel?: (slug: string) => string | undefined,
): string {
  if (!blockType) return "?"
  const fromManifest = manifest?.blocks?.find((block) => block.slug === blockType)?.label
  if (typeof fromManifest === "string" && fromManifest.trim()) return fromManifest.trim()

  const fromLocale = localeLabel?.(blockType)
  if (typeof fromLocale === "string" && fromLocale.trim()) return fromLocale.trim()

  const cfg = blockBySlug[blockType]
  const raw = cfg?.labels?.singular
  if (typeof raw === "string" && raw.trim() && raw !== cfg.slug) return raw.trim()
  if (raw != null && typeof raw === "object") {
    const localized = (raw as Record<string, string>).nl
      ?? (raw as Record<string, string>).en
      ?? Object.values(raw as Record<string, string>)[0]
    if (typeof localized === "string" && localized.trim()) return localized.trim()
  }

  return titleCaseSlug(blockType)
}
