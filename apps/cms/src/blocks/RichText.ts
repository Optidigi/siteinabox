import { Type } from "lucide-react"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const RichText: BlockWithMeta = {
  slug: "richText",
  icon: Type,
  description: "Long-form text content",
  interfaceName: "RichTextBlock",
  fields: [
    { name: "body", type: "json",
      admin: {
        editor: "richTextBlock",
        description: "Rich text content rendered by the site theme."
      } as any
    },
    ...blockBaseFields("overview"),
  ],
  summary: (v) => {
    const text = firstRichText(v.body)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
