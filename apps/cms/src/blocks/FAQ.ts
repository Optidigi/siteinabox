import { HelpCircle } from "lucide-react"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"
import { richBlockField, richInlineField } from "./richTextFields"

export const FAQ: BlockWithMeta = {
  slug: "faq",
  icon: HelpCircle,
  description: "Question/answer accordion",
  interfaceName: "FAQBlock",
  fields: [
    richInlineField("title", "Section heading for the FAQ."),
    richBlockField("intro", "Supporting text below the FAQ heading."),
    { name: "items", type: "array", required: true, fields: [
      richInlineField("question", "The FAQ question."),
      richBlockField("answer", "The answer to the question."),
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
