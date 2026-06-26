import { Mail } from "lucide-react"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const ContactSection: BlockWithMeta = {
  slug: "contactSection",
  icon: Mail,
  description: "Contact form or details",
  interfaceName: "ContactSectionBlock",
  fields: [
    { name: "title", type: "json",
      admin: {
        editor: "richTextInline",
        description: "Section heading for the contact section."
      } as any
    },
    { name: "description", type: "json",
      admin: {
        editor: "richTextBlock",
        description: "Supporting text above the contact form."
      } as any
    },
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
          { label: "Textarea", value: "textarea" }
        ]},
      { name: "required", type: "checkbox", defaultValue: false }
    ]},
    ...blockBaseFields("contact"),
  ],
  summary: (v) => {
    const text = firstRichText(v.title)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
