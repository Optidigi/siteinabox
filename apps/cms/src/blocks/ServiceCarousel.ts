import { PanelsTopLeft } from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

export const ServiceCarousel: BlockWithMeta = {
  slug: "serviceCarousel",
  icon: PanelsTopLeft,
  description: "Service cards in carousel or grid layout",
  interfaceName: "ServiceCarouselBlock",
  fields: [
    { name: "title", type: "json", admin: { editor: "richTextInline", description: "Section heading." } as any },
    { name: "intro", type: "json", admin: { editor: "richTextBlock", description: "Introductory text above the services." } as any },
    { name: "layout", type: "select", options: [
      { label: "Carousel", value: "carousel" },
      { label: "Grid", value: "grid" },
    ]},
    { name: "items", type: "array", required: true, fields: [
      { name: "title", type: "json", required: true, admin: { editor: "richTextInline", description: "Service heading." } as any },
      { name: "description", type: "json", admin: { editor: "richTextBlock", description: "Service description." } as any },
      { name: "image", type: "upload", relationTo: "media" },
      { name: "cta", type: "group", fields: [
        { name: "label", type: "text" },
        { name: "href", type: "text", validate: validateSafeHref },
      ]},
    ]},
    { name: "carousel", type: "group", fields: [
      { name: "slidesPerView", type: "number", min: 1, max: 6 },
      { name: "slidesPerViewTablet", type: "number", min: 1, max: 6 },
      { name: "slidesPerViewMobile", type: "number", min: 1, max: 6 },
      { name: "spaceBetween", type: "number", min: 0, max: 128 },
      { name: "autoplay", type: "checkbox", defaultValue: false },
      { name: "autoplayDelayMs", type: "number", min: 500, max: 30000 },
      { name: "loop", type: "checkbox", defaultValue: false },
      { name: "pagination", type: "select", options: [
        { label: "None", value: "none" },
        { label: "Bullets", value: "bullets" },
        { label: "Fraction", value: "fraction" },
      ]},
      { name: "pauseOnInteraction", type: "checkbox", defaultValue: false },
    ]},
    ...blockBaseFields("services"),
  ],
  summary: (v) => {
    const text = firstRichText(v.title)
    return text ? truncate(text.trim(), 40) : undefined
  },
}
