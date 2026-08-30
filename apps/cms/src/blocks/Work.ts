import { Images } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"
import { imageField } from "./ownedFields"

export const Work: BlockWithMeta = {
  slug: "work",
  icon: Images,
  description: "Present real projects and outcomes.",
  interfaceName: "WorkBlock",
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "intro", type: "textarea" },
    { name: "projects", type: "array", required: true, minRows: 1, maxRows: 6, fields: [
      { name: "sourceId", type: "text", required: true, admin: { description: "Stable ID for a real supplied project." } },
      { name: "title", type: "text", required: true },
      { name: "summary", type: "textarea" },
      { name: "media", type: "array", maxRows: 8, fields: [imageField("image")] },
      { name: "action", type: "group", fields: [
        { name: "label", type: "text" },
        { name: "href", type: "text", validate: validateSafeHref },
      ] },
    ] },
    ...blockBaseFields("work"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
