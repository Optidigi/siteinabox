import { ListChecks } from "lucide-react"
import { DEFAULT_SERVICES_VARIANT, SERVICES_VARIANTS, SERVICE_ICON_NAMES } from "@siteinabox/contracts"
import { validateSafeHref } from "@/lib/security/safeHref"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"

const serviceVariantOptions = [
  { label: "Services 01 — icon feature grid", value: SERVICES_VARIANTS[0] },
  { label: "Services 02 — centered icon links", value: SERVICES_VARIANTS[1] },
]

const serviceIconOptions = SERVICE_ICON_NAMES.map((value) => ({
  label: value.replace(/(^|-)([a-z])/g, (_match: string, separator: string, letter: string) => `${separator ? " " : ""}${letter.toUpperCase()}`),
  value,
}))

export const Services: BlockWithMeta = {
  slug: "services",
  icon: ListChecks,
  description: "Explain the services a visitor can choose.",
  interfaceName: "ServicesBlock",
  fields: [
    { name: "variant", type: "select", required: true, defaultValue: DEFAULT_SERVICES_VARIANT, options: serviceVariantOptions, admin: { description: "Choose the approved first-party services design." } },
    { name: "heading", type: "text", required: true },
    { name: "intro", type: "textarea" },
    { name: "items", type: "array", required: true, minRows: 2, maxRows: 6, fields: [
      { name: "title", type: "text", required: true },
      { name: "body", type: "textarea", required: true },
      { name: "icon", type: "select", options: serviceIconOptions, admin: { description: "Optional owned icon; the renderer chooses a consistent icon when empty." } },
      { name: "action", type: "group", fields: [
        { name: "label", type: "text" },
        { name: "href", type: "text", validate: validateSafeHref },
      ] },
    ] },
    ...blockBaseFields("services"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
