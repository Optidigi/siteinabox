import { HelpCircle } from "lucide-react"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"

export const Faq: BlockWithMeta = {
  slug: "faq",
  icon: HelpCircle,
  description: "Answer practical visitor questions without inventing promises.",
  interfaceName: "FaqBlock",
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "intro", type: "textarea" },
    { name: "items", type: "array", required: true, minRows: 2, maxRows: 10, fields: [
      { name: "question", type: "text", required: true },
      { name: "answer", type: "textarea", required: true },
    ] },
    ...blockBaseFields("faq"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
