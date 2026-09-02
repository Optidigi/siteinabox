import { HeroVariantRequirements } from "@siteinabox/contracts"
import { sitegenFooterFor, sitegenNavbarFor, sitegenVariantFor } from "./catalog"
import { SitegenOutputSchema, type SitegenOutput } from "./output-schema"
import { eligibleSitegenSections, type SitegenEligibilityInput } from "./eligibility"
import { sitegenMediaMeetsRequirement, sitegenMediaRequirementFromTags } from "./mediaEligibility"

export type SitegenValidationIssue = {
  path: Array<string | number>
  message: string
}

export const validateSitegenOutput = (
  value: unknown,
  eligibility: SitegenEligibilityInput,
): { success: true; data: SitegenOutput; issues: [] } | { success: false; issues: SitegenValidationIssue[] } => {
  const parsed = SitegenOutputSchema.safeParse(value)
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((entry) => ({ path: entry.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number"), message: entry.message })),
    }
  }

  const eligible = new Map(
    eligibleSitegenSections(eligibility).map((section) => [`${section.blockType}:${section.variant ?? ""}`, section]),
  )
  const issues: SitegenValidationIssue[] = []
  // Navbar is settings-owned and has no media/evidence prerequisites. Zod
  // performs the closed-variant validation; the catalog check keeps the AI
  // projection tied to the currently enabled first-party designs.
  if (parsed.data.navbar && !sitegenNavbarFor(parsed.data.navbar.variant)) {
    issues.push({ path: ["navbar", "variant"], message: `The navbar variant "${parsed.data.navbar.variant}" is not currently enabled.` })
  }
  if (parsed.data.footer && !sitegenFooterFor(parsed.data.footer.variant)) {
    issues.push({ path: ["footer", "variant"], message: `The footer variant "${parsed.data.footer.variant}" is not currently enabled.` })
  }
  for (const [pageIndex, page] of parsed.data.pages.entries()) {
    const heroes = page.sections.filter((section) => section.blockType === "hero")
    if (page.slug === "index" && (heroes.length !== 1 || page.sections[0]?.blockType !== "hero")) {
      issues.push({ path: ["pages", pageIndex, "sections"], message: "The homepage must contain exactly one hero first." })
    }
    const counts = new Map<string, number>()
    for (const [sectionIndex, section] of page.sections.entries()) {
      counts.set(section.blockType, (counts.get(section.blockType) ?? 0) + 1)
      const sectionKey = `${section.blockType}:${"variant" in section ? section.variant : ""}`
      const catalogEntry = eligible.get(sectionKey)
      const catalogDefinition = "variant" in section
        ? sitegenVariantFor(section.blockType, section.variant)
        : undefined
      if (!catalogEntry) {
        issues.push({ path: ["pages", pageIndex, "sections", sectionIndex], message: `The block "${section.blockType}" is not currently enabled for Sitegen.` })
      }
      if (section.blockType === "hero") {
        const requirements = HeroVariantRequirements[section.variant]
        const mediaId = "mediaId" in section ? section.mediaId : null
        const imageRequired = requirements.requiresImage
        if (imageRequired && !mediaId) {
          issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "mediaId"], message: `The ${section.variant} hero requires a supplied media ID.` })
        }
        if (section.backgroundMode === "image" && !mediaId) {
          issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "mediaId"], message: "An image background override requires a supplied media ID." })
        }
        if (mediaId && eligibility.mediaById) {
          const mediaFacts = eligibility.mediaById[mediaId]
          if (!mediaFacts) {
            issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "mediaId"], message: `Unknown supplied media ID "${mediaId}".` })
          } else {
            const mediaRequirement = sitegenMediaRequirementFromTags(catalogDefinition?.requires ?? [])
            if (mediaRequirement && !sitegenMediaMeetsRequirement(mediaFacts, mediaRequirement)) {
              const description = mediaRequirement === "portrait" ? "portrait" : mediaRequirement === "wideImage" ? "wide" : "image"
              issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "mediaId"], message: `The ${section.variant} hero requires a supplied ${description} media ID.` })
            }
          }
        }
        if (section.variant === "hero-02" && (!section.serviceHighlights || section.serviceHighlights.length < 2)) {
          issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "serviceHighlights"], message: "hero-02 requires two to four concrete service highlights." })
        }
        if (section.variant === "hero-02") {
          const selectedMediaIds = new Set<string>()
          for (const [highlightIndex, highlight] of (section.serviceHighlights ?? []).entries()) {
            if (!highlight.mediaId) {
              issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "serviceHighlights", highlightIndex, "mediaId"], message: "hero-02 requires one supplied media ID per service highlight." })
              continue
            }
            selectedMediaIds.add(highlight.mediaId)
            if (eligibility.mediaById && !eligibility.mediaById[highlight.mediaId]) {
              issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "serviceHighlights", highlightIndex, "mediaId"], message: `Unknown supplied media ID "${highlight.mediaId}".` })
            }
          }
          const serviceCopy = (section.serviceHighlights ?? []).map((highlight) => `${highlight.heroHeading}\u0000${highlight.heroBody}`)
          if (new Set(serviceCopy).size !== serviceCopy.length && serviceCopy.length >= 2) {
            issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "serviceHighlights"], message: "hero-02 requires distinct central hero copy for each selected service." })
          }
          if (selectedMediaIds.size < 2 && (section.serviceHighlights?.length ?? 0) >= 2) {
            issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "serviceHighlights"], message: "hero-02 requires at least two distinct supplied media IDs so selecting a service changes the hero image." })
          }
        }
        if (section.variant !== "hero-01" && section.highlights) {
          issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "highlights"], message: `The ${section.variant} hero cannot use value-point highlights.` })
        }
      }
      if (section.blockType === "cta" && section.backgroundMode === "image") {
        if (!section.mediaId) {
          issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "mediaId"], message: "An image background override requires a supplied media ID." })
        } else if (eligibility.mediaById && !eligibility.mediaById[section.mediaId]) {
          issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "mediaId"], message: `Unknown supplied media ID "${section.mediaId}".` })
        }
      }
      if (section.blockType === "appointments") {
        if (section.backgroundMode === "image" && !section.mediaId) {
          issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "mediaId"], message: "An image background override requires a supplied media ID." })
        }
        if (section.mediaId && eligibility.mediaById && !eligibility.mediaById[section.mediaId]) {
          issues.push({ path: ["pages", pageIndex, "sections", sectionIndex, "mediaId"], message: `Unknown supplied media ID "${section.mediaId}".` })
        }
      }
      if (section.blockType === "contact" && sectionIndex !== page.sections.length - 1) {
        issues.push({ path: ["pages", pageIndex, "sections", sectionIndex], message: "Contact should be the final homepage section." })
      }
    }
    for (const [blockType, count] of counts) {
      if (count > 1) issues.push({ path: ["pages", pageIndex, "sections"], message: `Section "${blockType}" may occur only once per page.` })
    }
    if (heroes.length > 1) {
      issues.push({ path: ["pages", pageIndex, "sections"], message: "A page may contain only one hero block." })
    }
  }

  return issues.length > 0 ? { success: false, issues } : { success: true, data: parsed.data, issues: [] }
}
