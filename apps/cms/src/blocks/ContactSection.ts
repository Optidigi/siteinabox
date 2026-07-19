import { Mail } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"
import { richBlockField, richInlineField } from "./richTextFields"

export const ContactSection: BlockWithMeta = {
  slug: "contactSection",
  icon: Mail,
  description: "Contact form or details",
  interfaceName: "ContactSectionBlock",
  fields: [
    richInlineField("title", "Section heading for the contact section."),
    richBlockField("description", "Supporting text above the contact form."),
    { name: "formName", type: "text", required: true, defaultValue: "Contact form",
      admin: { description: "Used as Forms.formName when storing submissions" } },
    { name: "submitLabel", type: "text", required: true, defaultValue: "Send",
      admin: { description: "Label shown on the form's submit button." } },
    { name: "fields", type: "array", required: true, fields: [
      { name: "name", type: "text", required: true },
      { name: "label", type: "text", required: true },
      { name: "type", type: "select", required: true, defaultValue: "text",
        options: [
          { label: "Text", value: "text" },
          { label: "Email", value: "email" },
          { label: "Tel", value: "tel" },
          { label: "Textarea", value: "textarea" },
          { label: "Select", value: "select" },
          { label: "Checkbox", value: "checkbox" }
        ]},
      { name: "required", type: "checkbox", defaultValue: false },
      { name: "placeholder", type: "text" },
      { name: "maxLength", type: "number", min: 1 },
      { name: "options", type: "array", fields: [
        { name: "label", type: "text", required: true },
        { name: "value", type: "text", required: true },
      ]},
    ]},
    { name: "provider", type: "group", fields: [
      { name: "provider", type: "select", options: [
        { label: "SIAB", value: "siab" },
        { label: "Web3Forms", value: "web3forms" },
        { label: "Custom", value: "custom" },
        { label: "Mailto", value: "mailto" }
      ]},
      { name: "action", type: "text", validate: validateSafeHref },
      { name: "method", type: "select", options: [
        { label: "GET", value: "GET" },
        { label: "POST", value: "POST" }
      ]},
      { name: "hiddenFields", type: "array", fields: [
        { name: "name", type: "text", required: true },
        { name: "value", type: "text" }
      ]},
      { name: "honeypotField", type: "text" },
      { name: "fallbackHref", type: "text", validate: validateSafeHref },
      { name: "successMessage", type: "text" },
      { name: "errorMessage", type: "text" },
      { name: "requiresConsent", type: "checkbox", defaultValue: false },
      { name: "analyticsEnabled", type: "checkbox", defaultValue: false }
    ]},
    ...blockBaseFields("contact"),
  ],
  summary: (v) => {
    const text = firstRichText(v.title)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
