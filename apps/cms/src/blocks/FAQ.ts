import { HelpCircle } from "lucide-react"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const FAQ: BlockWithMeta = {
  slug: "faq",
  icon: HelpCircle,
  description: "Question/answer accordion",
  interfaceName: "FAQBlock",
  fields: [
    { name: "title", type: "json",
      admin: {
        editor: "richTextInline",
        description: "Section heading for the FAQ."
      } as any
    },
    { name: "items", type: "array", required: true, fields: [
      { name: "question", type: "json",
        admin: {
          editor: "richTextInline",
          description: "The FAQ question."
        } as any
      },
      { name: "answer", type: "json",
        admin: {
          editor: "richTextBlock",
          description: "The answer to the question."
        } as any
      }
    ]},
    ...blockBaseFields("faq"),
  ],
  summary: (v) => {
    const titleText = firstRichText(v.title)
    if (titleText) return truncate(titleText.trim(), 40)
    const items = Array.isArray(v.items) ? v.items : []
    const firstQ = items[0] ? firstRichText((items[0] as Record<string, unknown>).question) : undefined
    return firstQ ? truncate(firstQ.trim(), 40) : undefined
  },
}
