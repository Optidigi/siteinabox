import { SITEGEN_SECTIONS, type SitegenCatalogVariant, type SitegenEligibleSection, type SitegenRequirement } from "./catalog"
import type { SitegenMediaFacts } from "./mediaEligibility"

export type SitegenEligibilityInput = {
  mediaById?: Readonly<Record<string, SitegenMediaFacts>>
  hasImage?: boolean
  serviceImageCount?: number
  hasWideImage?: boolean
  hasPortrait?: boolean
  projectCount?: number
  projectImageCount?: number
  projectSummaryCount?: number
  reviewCount?: number
  pricingCount?: number
  comparablePricing?: boolean
  serviceAreaCount?: number
  hasBooking?: boolean
  hasAppointmentSchedule?: boolean
  hasForm?: boolean
  contactMethodCount?: number
  serviceCount?: number
}

const requirementSatisfied = (requirement: SitegenRequirement, input: SitegenEligibilityInput): boolean => {
  switch (requirement) {
    case "image": return input.hasImage === true
    case "severalImages": return (input.serviceImageCount ?? 0) >= 2
    case "wideImage": return input.hasWideImage === true
    case "portrait": return input.hasPortrait === true
    case "projects": return (input.projectCount ?? 0) > 0
    case "severalProjectImages": return (input.projectImageCount ?? 0) >= 2
    case "projectSummaries": return (input.projectSummaryCount ?? 0) > 0
    case "reviews": return (input.reviewCount ?? 0) > 0
    case "severalReviews": return (input.reviewCount ?? 0) >= 2
    case "pricing": return (input.pricingCount ?? 0) > 0
    case "comparablePricing": return input.comparablePricing === true && (input.pricingCount ?? 0) >= 2
    case "serviceArea": return (input.serviceAreaCount ?? 0) > 0
    case "booking": return input.hasBooking === true
    case "appointmentSchedule": return input.hasAppointmentSchedule === true
    case "form": return input.hasForm === true
    case "contactMethods": return (input.contactMethodCount ?? 0) > 0
    case "services": return (input.serviceCount ?? 0) >= 2
  }
}

export const isSitegenSectionEligible = (
  section: Pick<SitegenCatalogVariant, "requires">,
  input: SitegenEligibilityInput,
): boolean => section.requires.every((requirement) => requirementSatisfied(requirement, input))

export const eligibleSitegenSections = (
  input: SitegenEligibilityInput,
): SitegenEligibleSection[] => SITEGEN_SECTIONS.flatMap((section) => {
  const { variants, ...sectionMeta } = section
  return variants
    .filter((variant) => isSitegenSectionEligible(variant, input))
    .map((variant) => ({
      ...sectionMeta,
      variant: variant.id,
      useWhen: variant.useWhen,
      requires: variant.requires,
    }))
})
