import type { ArrayField, ArrayFieldValidation, Field, UploadField, UploadFieldSingleValidation } from "payload"
import { BACKGROUND_MODE_IDS } from "@siteinabox/contracts"
import { validateSafeHref } from "@/lib/security/safeHref"

export const actionFields = (): Field[] => [
  { name: "label", type: "text", required: true },
  { name: "href", type: "text", required: true, validate: validateSafeHref },
]

export const optionalActionField = (name: string, description?: string): Field => ({
  name,
  type: "group",
  admin: description ? { description } : undefined,
  fields: actionFields().map((field) => ({ ...field, required: false })),
})

export const imageField = (name = "image", description?: string, required = false, validate?: UploadFieldSingleValidation): UploadField => ({
  name,
  type: "upload",
  required,
  relationTo: "media",
  admin: description ? { description } : undefined,
  ...(validate ? { validate } : {}),
})

export const backgroundModeField = (defaultValue?: (typeof BACKGROUND_MODE_IDS)[number]): Field => ({
  name: "backgroundMode",
  type: "select",
  required: false,
  options: BACKGROUND_MODE_IDS.map((value) => ({ label: value, value })),
  admin: { description: "Optional section-specific background. Leave empty to inherit the site theme setting." },
  ...(defaultValue ? { defaultValue } : {}),
})

export const sourceIdRows = (name: string, description: string): Field => ({
  name,
  type: "array",
  required: true,
  admin: { description },
  fields: [{ name: "sourceId", type: "text", required: true }],
})

export const serviceHighlightsField = (required = true, validate?: ArrayFieldValidation): ArrayField => ({
  name: "serviceHighlights",
  type: "array",
  required,
  ...(required ? { minRows: 2 } : {}),
  maxRows: 4,
  admin: { description: "Two to four real service highlights; do not add fabricated proof or statistics." },
  ...(validate ? { validate } : {}),
  fields: [
    { name: "title", type: "text", required: true },
    { name: "body", type: "textarea", required: true },
    { name: "heroHeading", type: "text", required: false, admin: { description: "The heading shown in the hero when this service is selected." } },
    { name: "heroBody", type: "textarea", required: false, admin: { description: "The supporting copy shown in the hero when this service is selected." } },
    optionalActionField("primaryAction", "Optional service-specific primary action; the hero action is used when this is empty."),
    optionalActionField("secondaryAction", "Optional service-specific secondary action."),
    imageField("image", "Optional supplied image shown when this service is selected."),
  ],
})

export const heroHighlightsField = (validate?: ArrayFieldValidation): ArrayField => ({
  name: "highlights",
  type: "array",
  required: false,
  maxRows: 4,
  admin: { description: "Optional: two to four factual reasons to choose this business; leave empty for a clean hero." },
  validate: (value) => {
    if (Array.isArray(value) && value.length === 1) return "Use two to four highlights, or leave this empty."
    return true
  },
  ...(validate ? { validate } : {}),
  fields: [
    { name: "title", type: "text", required: true },
    { name: "body", type: "textarea", required: true },
  ],
})
