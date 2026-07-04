import type { ContactSectionBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingContactCenteredRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_NAMESPACE = "tailwindplus.marketing.contact"
export const TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_ID = "tailwindplus.marketing.contact.centered"
export const TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_LEGACY_VARIANT = "tailwindPlusCentered"

export const tailwindPlusMarketingContactCenteredProviderBlock = defineProviderBlock<ContactSectionBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_ID,
  blockType: "contactSection",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_CONTACT_CENTERED_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-contact-centered",
  renderer: TailwindPlusMarketingContactCenteredRenderer,
  slots: {
    title: {
      kind: "richtext",
      status: "optional",
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
      status: "optional",
      exposed: true,
      sourceField: "submitLabel",
    },
    fields: {
      kind: "repeater",
      status: "required",
      exposed: true,
      sourceField: "fields",
      minItems: 1,
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
    license: "Tailwind Plus commercial component source; keep local snapshot out of runtime imports.",
  },
})
