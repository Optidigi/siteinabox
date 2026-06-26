import { LayoutGrid } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const InfoCardList: BlockWithMeta = {
  slug: "infoCardList",
  icon: LayoutGrid,
  description: "Information cards with icons or images",
  interfaceName: "InfoCardListBlock",
  fields: [
    { name: "title", type: "json", admin: { editor: "richTextInline", description: "Section heading." } as any },
    { name: "intro", type: "json", admin: { editor: "richTextBlock", description: "Introductory text above the cards." } as any },
    { name: "layout", type: "select", options: [
      { label: "Row", value: "row" },
      { label: "Grid", value: "grid" },
      { label: "Stack", value: "stack" },
    ]},
    { name: "iconPosition", type: "select", options: [
      { label: "Top", value: "top" },
      { label: "Left", value: "left" },
    ]},
    { name: "items", type: "array", required: true, fields: [
      { name: "title", type: "json", required: true, admin: { editor: "richTextInline", description: "Card heading." } as any },
      { name: "description", type: "json", admin: { editor: "richTextBlock", description: "Card description." } as any },
      { name: "icon", type: "text" },
      { name: "image", type: "upload", relationTo: "media" },
      { name: "link", type: "group", fields: [
        { name: "label", type: "text" },
        { name: "href", type: "text", validate: validateSafeHref },
      ]},
      { name: "animation", type: "select", options: [
        { label: "None", value: "none" },
        { label: "Fade in up", value: "fadeInUp" },
        { label: "Fade in down", value: "fadeInDown" },
        { label: "Float", value: "float" },
        { label: "Grow", value: "grow" },
      ]},
    ]},
    ...blockBaseFields("cards"),
  ],
  summary: (v) => {
    const text = firstRichText(v.title)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
