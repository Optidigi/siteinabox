import { MousePointerClick } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"
import { richBlockField, richInlineField } from "./richTextFields"

export const CTA: BlockWithMeta = {
  slug: "cta",
  icon: MousePointerClick,
  description: "Call-to-action with button",
  interfaceName: "CTABlock",
  fields: [
    richInlineField("eyebrow", "Short script-font label above the headline."),
    richInlineField("headline", "Primary CTA heading."),
    richBlockField("description", "Supporting text below the headline."),
    { name: "primary", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text", validate: validateSafeHref }
    ]},
    { name: "secondary", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text", validate: validateSafeHref }
    ]},
    {
      name: "backgroundImage",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Optional decorative background image for quote-style CTA sections.",
      },
    },
    ...blockBaseFields("contact"),
  ],
  summary: (v) => {
    const text = firstRichText(v.headline)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
