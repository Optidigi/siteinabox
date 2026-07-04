import type { ContactSectionBlock } from "@siteinabox/contracts"
import type { RtBlockRoot, RtInlineRoot } from "@siteinabox/contracts/rich-text"

const inlineRt = (text: string): RtInlineRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const blockRt = (text: string): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

export const tailwindPlusMarketingContactCenteredDemoSlots = {
  blockType: "contactSection",
  designVariant: "tailwindPlusCentered",
  title: inlineRt("Contact sales"),
  description: blockRt("Aute magna irure deserunt veniam aliqua magna enim voluptate."),
  formName: "contact-sales",
  submitLabel: "Let's talk",
  fields: [
    {
      name: "first-name",
      label: "First name",
      type: "text",
      required: true,
    },
    {
      name: "last-name",
      label: "Last name",
      type: "text",
      required: true,
    },
    {
      name: "company",
      label: "Company",
      type: "text",
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
    },
    {
      name: "phone-number",
      label: "Phone number",
      type: "tel",
      placeholder: "123-456-7890",
    },
    {
      name: "message",
      label: "Message",
      type: "textarea",
      required: true,
    },
  ],
  provider: {
    provider: "siab",
    action: "/api/forms",
    method: "POST",
    requiresConsent: true,
    successMessage: "Thanks, we will get back to you.",
    errorMessage: "Something went wrong. Please try again.",
  },
} satisfies ContactSectionBlock
