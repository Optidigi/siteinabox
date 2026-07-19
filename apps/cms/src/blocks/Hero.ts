import { Sparkles } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"
import { richBlockField, richInlineField } from "./richTextFields"

export const Hero: BlockWithMeta = {
  slug: "hero",
  icon: Sparkles,
  description: "Large headline section with optional image",
  interfaceName: "HeroBlock",
  fields: [
    richInlineField("eyebrow", "Short label displayed above the headline."),
    richInlineField("headline", "Primary heading text."),
    richBlockField("subheadline", "Supporting text below the headline."),
    { name: "pills", type: "array",
      admin: { description: "Small rounded badge labels shown under the subheadline." },
      defaultValue: [],
      fields: [
        { name: "label", type: "text", required: true }
      ]
    },
    { name: "links", type: "array",
      admin: { description: "Fixed provider-backed hero text links for source variants that include a link row." },
      fields: [
        { name: "label", type: "text", required: true },
        { name: "href", type: "text", validate: validateSafeHref, required: true },
      ]
    },
    { name: "cta", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text", validate: validateSafeHref }
    ]},
    { name: "secondary", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text", validate: validateSafeHref }
    ]},
    { name: "image", type: "upload", relationTo: "media" },
    { name: "stats", type: "array",
      admin: { description: "Fixed hero metric slots for provider variants that include stats." },
      fields: [
        { name: "value", type: "text", required: true },
        { name: "label", type: "text", required: true },
      ]
    },
    { name: "trustLabel", type: "text" },
    { name: "logos", type: "array", fields: [
      { name: "name", type: "text", required: true },
      { name: "image", type: "upload", relationTo: "media" },
      { name: "href", type: "text", validate: validateSafeHref },
    ]},
    ...blockBaseFields("services"),
  ],
  summary: (v) => {
    const text = firstRichText(v.headline)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
