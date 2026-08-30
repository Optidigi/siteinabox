import { Mail } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"
import { actionFields, imageField } from "./ownedFields"

export const Contact: BlockWithMeta = {
  slug: "contact",
  icon: Mail,
  description: "Make contact methods, service area and booking clear.",
  interfaceName: "ContactBlock",
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "body", type: "textarea" },
    { name: "contactMethods", type: "array", required: true, minRows: 1, maxRows: 4, fields: [
      { name: "kind", type: "select", required: true, options: ["email", "phone", "whatsapp", "address", "other"] },
      { name: "label", type: "text", required: true },
      { name: "value", type: "text", required: true },
      { name: "href", type: "text", validate: validateSafeHref },
    ] },
    { name: "serviceArea", type: "array", maxRows: 8, fields: [{ name: "value", type: "text", required: true }] },
    { name: "openingHours", type: "textarea" },
    { name: "bookingAction", type: "group", fields: actionFields().map((field) => ({ ...field, required: false })) },
    { name: "form", type: "group", fields: [
      { name: "formName", type: "text", required: true },
      { name: "submitLabel", type: "text", required: true },
      { name: "fields", type: "array", required: true, minRows: 1, maxRows: 12, fields: [
        { name: "name", type: "text", required: true },
        { name: "label", type: "text", required: true },
        { name: "type", type: "select", required: true, options: ["text", "email", "tel", "textarea", "select", "checkbox"] },
        { name: "required", type: "checkbox", defaultValue: false },
        { name: "placeholder", type: "text" },
        { name: "options", type: "array", maxRows: 12, fields: [
          { name: "label", type: "text", required: true },
          { name: "value", type: "text", required: true },
        ] },
      ] },
    ] },
    imageField(),
    ...blockBaseFields("contact"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
