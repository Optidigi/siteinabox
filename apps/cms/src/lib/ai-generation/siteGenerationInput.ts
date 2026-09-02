import type { GenerationInput, NormalizedIntake } from "@siteinabox/contracts/generation"
import { buildGenerationInput } from "@/lib/intake/normalizeIntake"
import { eligibleSitegenSections, type SitegenEligibilityInput } from "@/lib/sitegen/eligibility"
import { SITEGEN_FOOTERS, SITEGEN_NAVBARS, SITEGEN_SECTIONS } from "@/lib/sitegen/catalog"
import { sitegenMediaInventory } from "@/lib/sitegen/mediaEligibility"
import { SUPPORTED_SITE_GENERATION_BLOCKS } from "./prompts/siteGenerationPrompt"

export type SiteGenerationModelInput = {
  promptContract: "sitegen-owned-sections"
  schemaVersion: 1
  intake: NormalizedIntake
  generationInput: GenerationInput
  eligibleSections: ReturnType<typeof eligibleSitegenSections>
  eligibleNavbars: typeof SITEGEN_NAVBARS
  eligibleFooters: typeof SITEGEN_FOOTERS
  supportedBlocks: string[]
  requirements: string[]
}

const hasExplicitBookingAction = (intake: NormalizedIntake): boolean => {
  const raw = intake.raw && typeof intake.raw === "object" ? intake.raw : null
  const contact = raw?.contact && typeof raw.contact === "object" && !Array.isArray(raw.contact) ? raw.contact as Record<string, unknown> : null
  return [raw?.bookingAction, contact?.bookingAction, raw?.bookingUrl, contact?.bookingUrl].some((value) => {
    if (typeof value === "string") return value.trim().length > 0
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const href = (value as Record<string, unknown>).href
    return typeof href === "string" && href.trim().length > 0
  })
}

export const sitegenEligibilityFromIntake = (intake: NormalizedIntake): SitegenEligibilityInput => {
  const mediaById = sitegenMediaInventory(intake.brandSignals?.assets ?? [])
  const media = Object.values(mediaById)
  const contactPreferences = intake.intakeBrief?.contactPreferences
  // This is an intake capability request at generation time. Real schedule
  // windows remain tenant-owned SiteSettings and must be configured before
  // publishing; Sitegen never invents availability here.
  const hasAppointmentSchedule = contactPreferences?.availabilityMode === "appointment_only"
    || contactPreferences?.formType === "appointment"
    || contactPreferences?.formOptions?.includes("appointment") === true

  return {
    mediaById,
    hasImage: media.length > 0,
    serviceImageCount: media.length,
    hasWideImage: media.some((asset) => asset.isWide),
    hasPortrait: media.some((asset) => asset.isPortrait),
    serviceAreaCount: intake.serviceArea.length,
    hasBooking: hasExplicitBookingAction(intake),
    hasAppointmentSchedule,
    hasForm: Boolean(intake.intakeBrief?.contactPreferences.formType && intake.intakeBrief.contactPreferences.formType !== "none"),
    serviceCount: (intake.intakeBrief?.services ?? intake.goals).length,
    contactMethodCount: [
      intake.contact?.email,
      intake.contact?.phone,
      intake.intakeBrief?.contactPreferences.whatsappNumber,
      intake.intakeBrief?.contactPreferences.publicAddress,
    ].filter((value): value is string => Boolean(value?.trim())).length,
  }
}

export const buildSiteGenerationModelInput = (
  intake: NormalizedIntake,
  generationInput: GenerationInput = buildGenerationInput(intake),
): SiteGenerationModelInput => ({
  promptContract: "sitegen-owned-sections",
  schemaVersion: 1,
  intake,
  generationInput,
  eligibleSections: eligibleSitegenSections(sitegenEligibilityFromIntake(intake)),
  eligibleNavbars: SITEGEN_NAVBARS,
  eligibleFooters: SITEGEN_FOOTERS,
  supportedBlocks: [...SUPPORTED_SITE_GENERATION_BLOCKS],
  requirements: [
    "Return one JSON object with pages and shallow semantic sections.",
    "Use only eligible block types, media IDs, and evidence IDs.",
    "Do not generate authoritative review, pricing, or project facts; select their source IDs.",
    "Keep rich text out of the AI response; the application normalizes any longer copy deterministically.",
    `The complete application catalog contains ${SUPPORTED_SITE_GENERATION_BLOCKS.length} explicit section design choices across ${SITEGEN_SECTIONS.length} enabled section families, ${SITEGEN_NAVBARS.length} navbar designs and ${SITEGEN_FOOTERS.length} footer design; this request contains only eligible choices.`,
  ],
})
