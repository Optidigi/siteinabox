import { Image } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const MediaHero: BlockWithMeta = {
  slug: "mediaHero",
  icon: Image,
  description: "Hero section with background and foreground media",
  interfaceName: "MediaHeroBlock",
  fields: [
    { name: "eyebrow", type: "json", admin: { editor: "richTextInline", description: "Short label displayed above the headline." } as any },
    { name: "headline", type: "json", required: true, admin: { editor: "richTextInline", description: "Primary heading text." } as any },
    { name: "subheadline", type: "json", admin: { editor: "richTextBlock", description: "Supporting text below the headline." } as any },
    { name: "cta", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text", validate: validateSafeHref },
    ]},
    { name: "secondary", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text", validate: validateSafeHref },
    ]},
    { name: "backgroundImage", type: "upload", relationTo: "media", required: true },
    { name: "foregroundImage", type: "upload", relationTo: "media" },
    { name: "overlay", type: "group", fields: [
      { name: "color", type: "text" },
      { name: "opacity", type: "number", min: 0, max: 1 },
    ]},
    { name: "minHeight", type: "select", options: [
      { label: "Compact", value: "compact" },
      { label: "Standard", value: "standard" },
      { label: "Tall", value: "tall" },
      { label: "Viewport", value: "viewport" },
    ]},
    { name: "contentAlign", type: "select", options: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ]},
    { name: "contentWidth", type: "select", options: [
      { label: "Narrow", value: "narrow" },
      { label: "Wide", value: "wide" },
    ]},
    { name: "shapeDividers", type: "group", fields: [
      { name: "top", type: "select", options: [
        { label: "None", value: "none" },
        { label: "Mountains", value: "mountains" },
        { label: "Wave brush", value: "wave-brush" },
      ]},
      { name: "bottom", type: "select", options: [
        { label: "None", value: "none" },
        { label: "Mountains", value: "mountains" },
        { label: "Wave brush", value: "wave-brush" },
      ]},
    ]},
    { name: "priority", type: "checkbox", defaultValue: false },
    ...blockBaseFields("top"),
  ],
  summary: (v) => {
    const text = firstRichText(v.headline)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
