import { ListOrdered } from "lucide-react"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"

export const Process: BlockWithMeta = {
  slug: "process",
  icon: ListOrdered,
  description: "Show what happens from first contact to completion.",
  interfaceName: "ProcessBlock",
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "intro", type: "textarea" },
    { name: "steps", type: "array", required: true, minRows: 2, maxRows: 6, fields: [
      { name: "title", type: "text", required: true },
      { name: "body", type: "textarea", required: true },
    ] },
    ...blockBaseFields("process"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
