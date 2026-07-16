import {
  BadgeDollarSign,
  BarChart3,
  FileText,
  GalleryHorizontalEnd,
  Images,
  LayoutGrid,
  Mail,
  MapPin,
  Newspaper,
  ListTree,
  Users,
} from "lucide-react"
import { validateSafeHref } from "@/lib/security/safeHref"
import { firstRichText, truncate, type BlockWithMeta } from "./_summary"
import { blockBaseFields } from "./baseFields"

const richInline = (name: string, description: string) => ({
  name,
  type: "json" as const,
  admin: { editor: "richTextInline", description } as any,
})

const richBlock = (name: string, description: string) => ({
  name,
  type: "json" as const,
  admin: { editor: "richTextBlock", description } as any,
})

const linkFields = () => [
  { name: "label", type: "text" as const },
  { name: "href", type: "text" as const, validate: validateSafeHref },
]

const titleSummary = (field = "title") => (v: Record<string, unknown>) => {
  const text = firstRichText(v[field])
  return text ? truncate(text.trim(), 40) : undefined
}

export const Pricing: BlockWithMeta = {
  slug: "pricing",
  icon: BadgeDollarSign,
  description: "Structured pricing plans",
  interfaceName: "PricingBlock",
  fields: [
    richInline("eyebrow", "Small label above the pricing heading."),
    richInline("title", "Section heading for the pricing plans."),
    richBlock("intro", "Introductory text above the pricing plans."),
    { name: "plans", type: "array", required: true, fields: [
      richInline("title", "Plan name."),
      richBlock("description", "Short plan description."),
      { name: "price", type: "text" },
      { name: "period", type: "text" },
      { name: "features", type: "array", fields: [
        richInline("label", "Feature label."),
        { name: "included", type: "checkbox", defaultValue: true },
      ]},
      { name: "cta", type: "group", fields: linkFields() },
      { name: "badge", type: "text" },
      { name: "highlighted", type: "checkbox", defaultValue: false },
    ]},
    ...blockBaseFields("pricing"),
  ],
  summary: titleSummary(),
}

export const Stats: BlockWithMeta = {
  slug: "stats",
  icon: BarChart3,
  description: "Metric row",
  interfaceName: "StatsBlock",
  fields: [
    richInline("title", "Section heading for metrics."),
    richBlock("intro", "Introductory text above metrics."),
    { name: "items", type: "array", required: true, fields: [
      { name: "value", type: "text", required: true },
      { name: "label", type: "text", required: true },
      richBlock("description", "Optional metric explanation."),
    ]},
    ...blockBaseFields("stats"),
  ],
  summary: titleSummary(),
}

export const LogoCloud: BlockWithMeta = {
  slug: "logoCloud",
  icon: GalleryHorizontalEnd,
  description: "Partner or customer logos",
  interfaceName: "LogoCloudBlock",
  fields: [
    richInline("title", "Section heading for logos."),
    richBlock("intro", "Introductory text above logos."),
    { name: "logos", type: "array", required: true, fields: [
      { name: "name", type: "text", required: true },
      { name: "description", type: "textarea" },
      { name: "image", type: "upload", relationTo: "media" },
      { name: "href", type: "text", validate: validateSafeHref },
    ]},
    { name: "cta", type: "group", fields: linkFields() },
    ...blockBaseFields("partners"),
  ],
  summary: titleSummary(),
}

export const Gallery: BlockWithMeta = {
  slug: "gallery",
  icon: Images,
  description: "Image gallery grid",
  interfaceName: "GalleryBlock",
  fields: [
    richInline("title", "Section heading for the gallery."),
    richBlock("intro", "Introductory text above gallery images."),
    { name: "images", type: "array", required: true, fields: [
      { name: "image", type: "upload", relationTo: "media", required: true },
      richBlock("caption", "Optional image caption."),
      { name: "link", type: "group", fields: linkFields() },
    ]},
    { name: "cta", type: "group", fields: linkFields() },
    ...blockBaseFields("gallery"),
  ],
  summary: titleSummary(),
}

export const Newsletter: BlockWithMeta = {
  slug: "newsletter",
  icon: Mail,
  description: "Newsletter signup section",
  interfaceName: "NewsletterBlock",
  fields: [
    richInline("title", "Section heading for the newsletter signup."),
    richBlock("description", "Supporting text for the newsletter signup."),
    { name: "emailLabel", type: "text" },
    { name: "emailPlaceholder", type: "text" },
    { name: "submitLabel", type: "text" },
    { name: "benefits", type: "array", fields: [
      richInline("title", "Benefit title."),
      richBlock("description", "Benefit description."),
    ]},
    { name: "provider", type: "group", fields: [
      { name: "provider", type: "text" },
      { name: "action", type: "text", validate: validateSafeHref },
      { name: "method", type: "select", options: [
        { label: "POST", value: "POST" },
        { label: "GET", value: "GET" },
      ]},
      { name: "analyticsEnabled", type: "checkbox", defaultValue: true },
    ]},
    ...blockBaseFields("newsletter"),
  ],
  summary: titleSummary(),
}

export const BentoGrid: BlockWithMeta = {
  slug: "bentoGrid",
  icon: LayoutGrid,
  description: "Structured bento grid",
  interfaceName: "BentoGridBlock",
  fields: [
    richInline("title", "Section heading for the bento grid."),
    richBlock("intro", "Introductory text above the bento grid."),
    { name: "items", type: "array", required: true, fields: [
      richInline("title", "Item title."),
      richBlock("description", "Item description."),
      { name: "image", type: "upload", relationTo: "media" },
    ]},
    ...blockBaseFields("bento"),
  ],
  summary: titleSummary(),
}

export const ContentSection: BlockWithMeta = {
  slug: "contentSection",
  icon: FileText,
  description: "Content section with optional media",
  interfaceName: "ContentSectionBlock",
  fields: [
    richInline("eyebrow", "Small label above the heading."),
    richInline("title", "Section heading."),
    richBlock("intro", "Introductory text below the heading."),
    richBlock("body", "Structured body content."),
    { name: "features", type: "array", fields: [
      richInline("title", "Feature title."),
      richBlock("description", "Feature description."),
    ]},
    richBlock("bridge", "Bridge paragraph between the feature list and secondary heading."),
    richInline("secondaryTitle", "Secondary heading."),
    richBlock("secondaryBody", "Secondary body content."),
    { name: "image", type: "upload", relationTo: "media" },
    ...blockBaseFields("content"),
  ],
  summary: titleSummary(),
}

export const ContactDetails: BlockWithMeta = {
  slug: "contactDetails",
  icon: MapPin,
  description: "Contact methods and locations",
  interfaceName: "ContactDetailsBlock",
  fields: [
    richInline("title", "Section heading for contact details."),
    richBlock("description", "Supporting contact text."),
    { name: "items", type: "array", required: true, fields: [
      { name: "title", type: "text", required: true },
      { name: "description", type: "text" },
      { name: "value", type: "text", required: true },
      { name: "href", type: "text", validate: validateSafeHref },
      { name: "icon", type: "text" },
    ]},
    ...blockBaseFields("contact-details"),
  ],
  summary: titleSummary(),
}

export const Timeline: BlockWithMeta = {
  slug: "timeline",
  icon: ListTree,
  description: "Chronological events or milestones",
  interfaceName: "TimelineBlock",
  fields: [
    richInline("title", "Timeline heading."),
    richBlock("intro", "Timeline introduction."),
    { name: "items", type: "array", required: true, fields: [
      { name: "title", type: "text", required: true },
      { name: "description", type: "text" },
      { name: "label", type: "text" },
      { name: "date", type: "text" },
      { name: "tags", type: "array", fields: [{ name: "value", type: "text", required: true }] },
    ]},
    ...blockBaseFields("timeline"),
  ],
  summary: titleSummary(),
}

export const Team: BlockWithMeta = {
  slug: "team",
  icon: Users,
  description: "Team member cards",
  interfaceName: "TeamBlock",
  fields: [
    richInline("title", "Section heading for the team."),
    richBlock("intro", "Introductory text above team members."),
    { name: "members", type: "array", required: true, fields: [
      { name: "name", type: "text", required: true },
      { name: "role", type: "text" },
      richBlock("bio", "Short team member biography."),
      { name: "image", type: "upload", relationTo: "media" },
      { name: "links", type: "array", fields: linkFields() },
    ]},
    ...blockBaseFields("team"),
  ],
  summary: titleSummary(),
}

export const BlogCards: BlockWithMeta = {
  slug: "blogCards",
  icon: Newspaper,
  description: "Article or update cards",
  interfaceName: "BlogCardsBlock",
  fields: [
    richInline("title", "Section heading for posts."),
    richBlock("intro", "Introductory text above post cards."),
    { name: "posts", type: "array", required: true, fields: [
      richInline("title", "Post title."),
      richBlock("excerpt", "Short post excerpt."),
      { name: "image", type: "upload", relationTo: "media" },
      { name: "href", type: "text", validate: validateSafeHref },
      { name: "date", type: "text" },
      { name: "author", type: "text" },
      { name: "authorRole", type: "text" },
      { name: "cta", type: "group", fields: linkFields() },
    ]},
    { name: "cta", type: "group", fields: linkFields() },
    { name: "secondary", type: "group", fields: linkFields() },
    ...blockBaseFields("updates"),
  ],
  summary: titleSummary(),
}
