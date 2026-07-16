import { Quote } from "lucide-react"
import { truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const Testimonials: BlockWithMeta = {
  slug: "testimonials",
  icon: Quote,
  description: "Customer testimonials",
  interfaceName: "TestimonialsBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "intro", type: "textarea" },
    {
      name: "logo",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Optional provider-backed customer or company logo.",
      },
    },
    { name: "items", type: "array", required: true, fields: [
      { name: "quote", type: "textarea", required: true },
      { name: "author", type: "text", required: true },
      { name: "role", type: "text" },
      { name: "avatar", type: "upload", relationTo: "media" }
    ]},
    ...blockBaseFields("reviews"),
  ],
  summary: (v) => {
    const title = typeof v.title === "string" ? v.title.trim() : ""
    return title ? truncate(title, 40) : undefined
  },
}
