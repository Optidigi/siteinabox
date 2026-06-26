import { Contact } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const ContactDetails: BlockWithMeta = {
  slug: "contactDetails",
  icon: Contact,
  description: "Contact details and legal business information",
  interfaceName: "ContactDetailsBlock",
  fields: [
    { name: "title", type: "json", admin: { editor: "richTextInline", description: "Section heading." } as any },
    { name: "intro", type: "json", admin: { editor: "richTextBlock", description: "Introductory text above contact details." } as any },
    { name: "layout", type: "select", options: [
      { label: "Cards", value: "cards" },
      { label: "Split", value: "split" },
      { label: "List", value: "list" },
    ]},
    { name: "items", type: "array", required: true, fields: [
      { name: "kind", type: "select", options: [
        { label: "Phone", value: "phone" },
        { label: "Email", value: "email" },
        { label: "Address", value: "address" },
        { label: "Hours", value: "hours" },
        { label: "Legal", value: "legal" },
        { label: "Custom", value: "custom" },
      ]},
      { name: "label", type: "text", required: true },
      { name: "value", type: "json", required: true, admin: { editor: "richTextBlock", description: "Displayed contact value." } as any },
      { name: "href", type: "text", validate: validateSafeHref },
      { name: "icon", type: "text" },
      { name: "image", type: "upload", relationTo: "media" },
    ]},
    { name: "legal", type: "group", fields: [
      { name: "kvkNumber", type: "text" },
      { name: "btwId", type: "text" },
      { name: "iban", type: "text" },
      { name: "bic", type: "text" },
    ]},
    ...blockBaseFields("contact"),
  ],
  summary: (v) => {
    const text = firstRichText(v.title)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
