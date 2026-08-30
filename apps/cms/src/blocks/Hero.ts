import { Sparkles } from "lucide-react"
import type { ArrayFieldValidation, UploadFieldSingleValidation } from "payload"
import { HeroVariantRequirements } from "@siteinabox/contracts"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"
import { actionFields, backgroundModeField, heroHighlightsField, imageField, optionalActionField, serviceHighlightsField } from "./ownedFields"
import { adminValidationText } from "@/lib/payloadAdminI18n"
import { asRecord } from "@/lib/record"

const hasMediaReference = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isInteger(value) && value > 0
  if (!value || typeof value !== "object" || Array.isArray(value) || !("id" in value)) return false
  const id = (value as { id?: unknown }).id
  return (typeof id === "string" && id.trim().length > 0) || (typeof id === "number" && Number.isInteger(id) && id > 0)
}

const validateHeroImage: UploadFieldSingleValidation = (value, { siblingData, req }) => {
  const block = asRecord(siblingData)
  const variant = block?.variant
  const requirements = typeof variant === "string" && variant in HeroVariantRequirements
    ? HeroVariantRequirements[variant as keyof typeof HeroVariantRequirements]
    : undefined
  if (requirements?.requiresImage && !hasMediaReference(value)) {
    return adminValidationText(req?.i18n?.language, "This hero design requires a supplied image.", "Dit hero-ontwerp vereist een aangeleverde afbeelding.")
  }
  if (block?.backgroundMode === "image" && !hasMediaReference(value)) {
    return adminValidationText(req?.i18n?.language, "An image background requires a supplied image.", "Een afbeeldingsachtergrond vereist een aangeleverde afbeelding.")
  }
  return true
}

const validateHeroHighlights: ArrayFieldValidation = (value, { siblingData, req }) => {
  const block = asRecord(siblingData)
  const count = Array.isArray(value) ? value.length : 0
  if (count === 1) return adminValidationText(req?.i18n?.language, "Use two to four highlights, or leave this empty.", "Gebruik twee tot vier highlights of laat dit leeg.")
  if (block?.variant !== undefined && block.variant !== "hero-01" && count > 0) {
    return adminValidationText(req?.i18n?.language, "Only Hero 01 supports value-point highlights.", "Alleen Hero 01 ondersteunt waarde-highlights.")
  }
  return true
}

const validateServiceHighlights: ArrayFieldValidation = (value, { siblingData, req }) => {
  const block = asRecord(siblingData)
  const count = Array.isArray(value) ? value.length : 0
  if (block?.variant === "hero-02") {
    if (count < 2 || count > 4) return adminValidationText(req?.i18n?.language, "Hero 02 requires two to four service highlights.", "Hero 02 vereist twee tot vier service-highlights.")
    return true
  }
  if (count > 0) return adminValidationText(req?.i18n?.language, "Only Hero 02 supports selectable service highlights.", "Alleen Hero 02 ondersteunt selecteerbare service-highlights.")
  return true
}

const heroVariantOptions = [
  { label: "Hero 01 — lead", value: "hero-01" },
  { label: "Hero 02 — service panel", value: "hero-02" },
  { label: "Hero 03 — angled", value: "hero-03" },
  { label: "Hero 04 — framed", value: "hero-04" },
  { label: "Hero 05 — pattern split", value: "hero-05" },
]

export const Hero: BlockWithMeta = {
  slug: "hero",
  icon: Sparkles,
  description: "Lead with the business, customer need and primary next step using one approved hero design.",
  interfaceName: "HeroBlock",
  fields: [
    { name: "variant", type: "select", required: true, defaultValue: "hero-01", options: heroVariantOptions, admin: { description: "Choose the approved first-party hero design. The selected design controls layout and media requirements." } },
    { name: "heading", type: "text", required: true },
    { name: "body", type: "textarea", required: true },
    { name: "primaryAction", type: "group", required: true, fields: actionFields() },
    optionalActionField("secondaryAction"),
    backgroundModeField(),
    imageField("image", "Supplied service, project, workspace or location image. Required by Hero 02–05 and when the image background is selected.", false, validateHeroImage),
    heroHighlightsField(validateHeroHighlights),
    serviceHighlightsField(false, validateServiceHighlights),
    ...blockBaseFields("hero"),
  ],
  summary: (value) => {
    const heading = typeof value.heading === "string" ? value.heading : undefined
    return heading ? truncate(heading.trim(), 40) : undefined
  },
}
