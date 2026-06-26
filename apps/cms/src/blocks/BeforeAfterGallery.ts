import { Images } from "lucide-react"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const BeforeAfterGallery: BlockWithMeta = {
  slug: "beforeAfterGallery",
  icon: Images,
  description: "Before and after image comparison gallery",
  interfaceName: "BeforeAfterGalleryBlock",
  fields: [
    { name: "title", type: "json", admin: { editor: "richTextInline", description: "Section heading." } as any },
    { name: "intro", type: "json", admin: { editor: "richTextBlock", description: "Introductory text above the gallery." } as any },
    { name: "pairs", type: "array", required: true, fields: [
      { name: "before", type: "upload", relationTo: "media", required: true },
      { name: "after", type: "upload", relationTo: "media", required: true },
      { name: "beforeLabel", type: "text" },
      { name: "afterLabel", type: "text" },
      { name: "caption", type: "json", admin: { editor: "richTextBlock", description: "Optional comparison caption." } as any },
      { name: "initialRatio", type: "number", min: 0, max: 1 },
      { name: "orientation", type: "select", options: [
        { label: "Horizontal", value: "horizontal" },
        { label: "Vertical", value: "vertical" },
      ]},
    ]},
    ...blockBaseFields("before-after"),
  ],
  summary: (v) => {
    const text = firstRichText(v.title)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
