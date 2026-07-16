import { ListChecks } from "lucide-react"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"
import { validateSafeHref } from "@/lib/security/safeHref"

export const FeatureList: BlockWithMeta = {
  slug: "featureList",
  icon: ListChecks,
  description: "Feature highlights with icons",
  interfaceName: "FeatureListBlock",
  fields: [
    { name: "eyebrow", type: "json",
      admin: {
        editor: "richTextInline",
        description: "Optional short provider-backed eyebrow text."
      } as any
    },
    { name: "title", type: "json",
      admin: {
        editor: "richTextInline",
        description: "Section heading for the feature list."
      } as any
    },
    { name: "intro", type: "json",
      admin: {
        editor: "richTextBlock",
        description: "Introductory text above the feature items."
      } as any
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Optional provider-backed product screenshot or feature image.",
      },
    },
    { name: "features", type: "array", required: true, fields: [
      { name: "title", type: "json",
        admin: {
          editor: "richTextInline",
          description: "Feature heading."
        } as any
      },
      { name: "description", type: "json",
        admin: {
          editor: "richTextBlock",
          description: "Feature description."
        } as any
      },
      { name: "icon", type: "text", admin: { description: "Approved icon name." } },
      { name: "image", type: "upload", relationTo: "media" },
      { name: "cta", type: "group", fields: [
        { name: "label", type: "text" },
        { name: "href", type: "text", validate: validateSafeHref },
      ]},
      { name: "metricValue", type: "text" },
      { name: "metricLabel", type: "text" },
    ]},
    ...blockBaseFields("services"),
  ],
  summary: (v) => {
    const text = firstRichText(v.title)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
