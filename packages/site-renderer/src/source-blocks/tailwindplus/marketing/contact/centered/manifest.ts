import type { ContactSectionBlock } from "@siteinabox/contracts"
import { defineProviderBlock, type ProviderBlockValidationIssue } from "../../../../registry"
import { TailwindPlusMarketingContactCenteredRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_NAMESPACE = "tailwindplus.marketing.contact"
export const TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_ID = "tailwindplus.marketing.contact.centered"
export const TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_LEGACY_VARIANT = "tailwindPlusCentered"

const sourceFieldOrder = ["first-name", "last-name", "company", "email", "phone-number", "message"] as const
const sourceFieldTypes: Record<typeof sourceFieldOrder[number], ContactSectionBlock["fields"][number]["type"]> = {
  "first-name": "text",
  "last-name": "text",
  company: "text",
  email: "email",
  "phone-number": "tel",
  message: "textarea",
}
const reservedFormFieldNames = new Set(["formName", "country", "agree-to-policies", ...sourceFieldOrder])

function validateContactCentered(block: ContactSectionBlock): ProviderBlockValidationIssue[] {
  const issues: ProviderBlockValidationIssue[] = []
  const seen = new Set<string>()
  const fieldNames = block.fields.map((field) => field.name)

  sourceFieldOrder.forEach((name, index) => {
    const field = block.fields[index]
    if (!field || field.name !== name) {
      issues.push({
        code: "invalid_source_slot",
        message: `Tailwind Plus centered contact requires field ${index + 1} to be "${name}".`,
        path: ["fields", String(index), "name"],
      })
      return
    }
    if (field.type !== sourceFieldTypes[name]) {
      issues.push({
        code: "invalid_source_slot",
        message: `Tailwind Plus centered contact field "${name}" must use type "${sourceFieldTypes[name]}".`,
        path: ["fields", String(index), "type"],
      })
    }
  })

  fieldNames.forEach((name, index) => {
    if (seen.has(name)) {
      issues.push({
        code: "invalid_source_slot",
        message: `Tailwind Plus centered contact field "${name}" must be unique.`,
        path: ["fields", String(index), "name"],
      })
    }
    seen.add(name)
  })

  block.provider?.hiddenFields?.forEach((field, index) => {
    if (reservedFormFieldNames.has(field.name)) {
      issues.push({
        code: "invalid_source_slot",
        message: `Hidden field "${field.name}" collides with a Tailwind Plus centered contact source field.`,
        path: ["provider", "hiddenFields", String(index), "name"],
      })
    }
  })
  const honeypot = block.provider?.honeypotField?.trim()
  if (honeypot && reservedFormFieldNames.has(honeypot)) {
    issues.push({
      code: "invalid_source_slot",
      message: `Honeypot field "${honeypot}" collides with a Tailwind Plus centered contact source field.`,
      path: ["provider", "honeypotField"],
    })
  }
  if (block.provider?.requiresConsent === false) {
    issues.push({
      code: "invalid_source_slot",
      message: "Tailwind Plus centered contact exact variant requires the source consent layout.",
      path: ["provider", "requiresConsent"],
    })
  }

  return issues
}

export const tailwindPlusMarketingContactCenteredProviderBlock = defineProviderBlock<ContactSectionBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_ID,
  blockType: "contactSection",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-contact-centered",
  renderer: TailwindPlusMarketingContactCenteredRenderer,
  validate: validateContactCentered,
  slots: {
    title: {
      kind: "richtext",
      status: "required",
      exposed: true,
      sourceField: "title",
    },
    description: {
      kind: "richtext",
      status: "optional",
      exposed: true,
      sourceField: "description",
    },
    formName: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "formName",
    },
    submitLabel: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "submitLabel",
    },
    fields: {
      kind: "repeater",
      status: "required",
      exposed: true,
      sourceField: "fields",
      minItems: 6,
      maxItems: 6,
    },
    fieldName: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "fields.name",
    },
    fieldLabel: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "fields.label",
    },
    fieldType: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "fields.type",
    },
    fieldPlaceholder: {
      kind: "text",
      status: "optional",
      exposed: true,
      sourceField: "fields.placeholder",
    },
    provider: {
      kind: "text",
      status: "optional",
      exposed: true,
      sourceField: "provider",
    },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/contact-sections",
    sourceComponent: "Marketing / Page Sections / Contact Sections / Centered",
    sourceHash: "sha256:6ca277a074929b3dac1276cb3b6e80d4847f02dc5b67b720a7c270c5d322b5e7",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus local source-backed component source; keep local snapshot out of runtime imports.",
    sourceAvailability: "free-public",
    licenseCompatibility: "compatible",
    approvalStatus: "approved",
    implementation: "exact-source",
    visualExactnessStatus: "reviewed-exact-source",
  },
})
