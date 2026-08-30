import { UserRound } from "lucide-react"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"
import { imageField } from "./ownedFields"

export const About: BlockWithMeta = {
  slug: "about",
  icon: UserRound,
  description: "Build personal trust with a concise story and strengths.",
  interfaceName: "AboutBlock",
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "body", type: "textarea", required: true },
    imageField("portrait", "Use a real portrait when the person is central to trust."),
    { name: "highlights", type: "array", maxRows: 4, fields: [
      { name: "title", type: "text", required: true },
      { name: "text", type: "textarea" },
    ] },
    ...blockBaseFields("about"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
