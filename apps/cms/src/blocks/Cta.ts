import { MousePointerClick } from "lucide-react"
import type { UploadFieldSingleValidation } from "payload"
import { CTA_VARIANTS, DEFAULT_CTA_VARIANT } from "@siteinabox/contracts"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"
import { actionFields, backgroundModeField, imageField, optionalActionField } from "./ownedFields"
import { adminValidationText } from "@/lib/payloadAdminI18n"
import { asRecord } from "@/lib/record"

const hasMediaReference = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isInteger(value) && value > 0
  if (!value || typeof value !== "object" || Array.isArray(value) || !("id" in value)) return false
  const id = (value as { id?: unknown }).id
  return (typeof id === "string" && id.trim().length > 0) || (typeof id === "number" && Number.isInteger(id) && id > 0)
}

const validateCtaImage: UploadFieldSingleValidation = (value, { siblingData, req }) => {
  if (asRecord(siblingData)?.backgroundMode === "image" && !hasMediaReference(value)) {
    return adminValidationText(req?.i18n?.language, "An image background requires a supplied image.", "Een afbeeldingsachtergrond vereist een aangeleverde afbeelding.")
  }
  return true
}

const ctaVariantOptions = [
  { label: "CTA 01 — dithering panel", value: CTA_VARIANTS[0] },
  { label: "CTA 02 — simple centered", value: CTA_VARIANTS[1] },
]

export const Cta: BlockWithMeta = {
  slug: "cta",
  icon: MousePointerClick,
  description: "Give visitors one clear next step.",
  interfaceName: "CtaBlock",
  fields: [
    {
      name: "variant",
      type: "select",
      required: true,
      defaultValue: DEFAULT_CTA_VARIANT,
      options: ctaVariantOptions,
      admin: { description: "Owned CTA presentation; the site theme controls its background effect unless overridden below." },
    },
    { name: "heading", type: "text", required: true },
    { name: "body", type: "textarea" },
    { name: "primaryAction", type: "group", required: true, fields: actionFields() },
    optionalActionField("secondaryAction"),
    backgroundModeField(),
    imageField("image", undefined, false, validateCtaImage),
    ...blockBaseFields("cta"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
