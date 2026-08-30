import { Quote } from "lucide-react"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"
import { sourceIdRows } from "./ownedFields"

export const Reviews: BlockWithMeta = {
  slug: "reviews",
  icon: Quote,
  description: "Share authentic supplied customer reviews.",
  interfaceName: "ReviewsBlock",
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "intro", type: "textarea" },
    sourceIdRows("reviewSourceIds", "Select stable IDs for supplied reviews."),
    { name: "items", type: "array", required: true, minRows: 1, maxRows: 6, fields: [
      { name: "sourceId", type: "text", required: true },
      { name: "quote", type: "textarea", required: true },
      { name: "name", type: "text", required: true },
      { name: "context", type: "text" },
    ] },
    ...blockBaseFields("reviews"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
