import { Sparkles } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const Hero: BlockWithMeta = {
  slug: "hero",
  icon: Sparkles,
  description: "Large headline section with optional image",
  interfaceName: "HeroBlock",
  fields: [
    { name: "eyebrow", type: "json",
      admin: {
        editor: "richTextInline",
        description: "Short label displayed above the headline."
      } as any
    },
    { name: "headline", type: "json",
      admin: {
        editor: "richTextInline",
        description: "Primary heading text."
      } as any
    },
    { name: "subheadline", type: "json",
      admin: {
        editor: "richTextBlock",
        description: "Supporting text below the headline."
      } as any
    },
    { name: "pills", type: "array",
      admin: { description: "Small rounded badge labels shown under the subheadline." },
      defaultValue: [],
      fields: [
        { name: "label", type: "text", required: true }
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
    ...blockBaseFields("services"),
  ],
  summary: (v) => {
    const text = firstRichText(v.headline)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
