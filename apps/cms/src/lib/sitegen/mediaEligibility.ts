import type { MediaRef } from "@siteinabox/contracts"

export type SitegenMediaRequirement = "image" | "portrait" | "wideImage"

export const sitegenMediaRequirementFromTags = (
  requirements: readonly string[],
): SitegenMediaRequirement | null => {
  for (const requirement of requirements) {
    if (requirement === "image" || requirement === "portrait" || requirement === "wideImage") return requirement
  }
  return null
}

export type SitegenMediaFacts = {
  isPortrait: boolean
  isWide: boolean
}

const positiveNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null

/**
 * Returns the stable key the model may select. Object media without an ID is
 * intentionally omitted: a URL or filename alone is not a safe evidence key.
 */
export const sitegenMediaKey = (media: MediaRef): string | null => {
  if (typeof media === "string") return media.trim() || null
  if (typeof media === "number" && Number.isInteger(media) && media > 0) return String(media)
  if (!media || typeof media !== "object") return null
  if (media.id === undefined || media.id === null) return null
  const key = String(media.id).trim()
  return key || null
}

export const sitegenMediaFacts = (media: MediaRef): SitegenMediaFacts => {
  if (!media || typeof media !== "object") return { isPortrait: false, isWide: false }

  const width = positiveNumber(media.width)
  const height = positiveNumber(media.height)
  const ratio = width !== null && height !== null ? width / height : null
  const descriptiveText = `${media.alt ?? ""} ${media.filename ?? ""}`

  return {
    isWide: ratio !== null && ratio >= 1.4,
    isPortrait: /portrait|person|professional|owner/i.test(descriptiveText) || (width !== null && height !== null && height / width >= 1.1),
  }
}

export const sitegenMediaInventory = (
  assets: readonly MediaRef[],
): Record<string, SitegenMediaFacts> => {
  const inventory: Record<string, SitegenMediaFacts> = {}
  for (const asset of assets) {
    const key = sitegenMediaKey(asset)
    if (key) inventory[key] = sitegenMediaFacts(asset)
  }
  return inventory
}

export const sitegenMediaMeetsRequirement = (
  facts: SitegenMediaFacts,
  requirement: SitegenMediaRequirement,
): boolean => {
  if (requirement === "portrait") return facts.isPortrait
  if (requirement === "wideImage") return facts.isWide
  return true
}
