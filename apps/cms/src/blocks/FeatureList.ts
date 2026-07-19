import { ListChecks } from "lucide-react"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"
import { richBlockField, richInlineField } from "./richTextFields"
import { validateSafeHref } from "@/lib/security/safeHref"

export const FeatureList: BlockWithMeta = {
  slug: "featureList",
  icon: ListChecks,
  description: "Feature highlights with icons",
  interfaceName: "FeatureListBlock",
  fields: [
    richInlineField("eyebrow", "Optional short provider-backed eyebrow text."),
    richInlineField("title", "Section heading for the feature list."),
    richBlockField("intro", "Introductory text above the feature items."),
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Optional provider-backed product screenshot or feature image.",
      },
    },
    { name: "features", type: "array", required: true, fields: [
      richInlineField("title", "Feature heading."),
      richBlockField("description", "Feature description."),
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
