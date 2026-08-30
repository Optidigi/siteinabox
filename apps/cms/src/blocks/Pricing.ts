import { BadgeEuro } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"
import { sourceIdRows } from "./ownedFields"

export const Pricing: BlockWithMeta = {
  slug: "pricing",
  icon: BadgeEuro,
  description: "Explain real prices or starting rates clearly.",
  interfaceName: "PricingBlock",
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "intro", type: "textarea" },
    sourceIdRows("pricingSourceIds", "Select stable IDs for supplied prices."),
    { name: "offers", type: "array", required: true, minRows: 1, maxRows: 4, fields: [
      { name: "sourceId", type: "text", required: true },
      { name: "title", type: "text", required: true },
      { name: "description", type: "textarea" },
      { name: "price", type: "text", required: true },
      { name: "period", type: "text" },
      { name: "features", type: "array", maxRows: 12, fields: [{ name: "value", type: "text", required: true }] },
      { name: "action", type: "group", fields: [
        { name: "label", type: "text" },
        { name: "href", type: "text", validate: validateSafeHref },
      ] },
      { name: "badge", type: "text" },
    ] },
    ...blockBaseFields("pricing"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
