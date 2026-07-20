import * as React from "react"
import type { Block, LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../blocks/types"
import { resolveMedia } from "../../../media"
import { extractRichText, RichTextRenderer } from "../../../rich-text"
import { Building2, Clock3, Globe2, Mail, MapPin, MessageCircle, Phone } from "lucide-react"
import { resolveIcon } from "../../../blocks/icons"

export type ProviderBlockModel = { block: Block; options: BlockRenderOptions }

const BlockContext = React.createContext<ProviderBlockModel | null>(null)
const isExternalHref = (href: string) => /^(?:https?:)?\/\//i.test(href)

export function ProviderBlockContent({ model, children }: { model: ProviderBlockModel; children: React.ReactNode }) {
  return <BlockContext value={model}>{children}</BlockContext>
}

export function ProviderDemoOnly({ fallback }: { fallback: React.ReactNode }) {
  return useProviderBlockModel() ? null : <>{fallback}</>
}

function withBoundHref(node: React.ReactNode, value: LinkRef & { href: string }): React.ReactNode {
  if (!React.isValidElement<{ children?: React.ReactNode; href?: string; target?: string; rel?: string }>(node)) return node
  const props = node.props
  const children = props.children == null
    ? props.children
    : React.Children.count(props.children) === 1
      ? withBoundHref(React.Children.toArray(props.children)[0], value)
      : React.Children.map(props.children, (child) => withBoundHref(child, value))
  if ("href" in props) return React.cloneElement(node, {
    href: value.href,
    target: value.external ? "_blank" : undefined,
    rel: value.external ? "noreferrer" : undefined,
  }, children)
  return React.cloneElement(node, undefined, children)
}

export function ProviderItemLink({ value, fallback }: { value?: LinkRef | null; fallback: React.ReactNode }) {
  const model = useProviderBlockModel()
  if (!model) return <>{fallback}</>
  const href = value?.href?.trim()
  if (!value || !href) return null
  return <>{withBoundHref(fallback, { ...value, href, external: value.external ?? isExternalHref(href) })}</>
}

type ProviderImageFallbackProps = { alt?: string; className?: string; src?: unknown }

export function ProviderImage({ field, fallback }: { field: string; fallback: React.ReactElement<ProviderImageFallbackProps> }) {
  const model = useProviderBlockModel()
  if (!model) return fallback
  const value = fieldValue(model.block, field) as MediaRef | undefined
  if (!value) return null
  const resolved = resolveMedia(value, model.options.mediaResolver)
  if (model.options.editSlots?.renderImage) return model.options.editSlots.renderImage({
    name: `${model.block.blockType}.${field}`,
    value,
    alt: resolved?.alt ?? fallback.props.alt ?? "",
    className: fallback.props.className,
    elementPath: path(model, field),
  })
  if (!resolved?.src) return null
  if (fallback.type === "div") {
    return <img
      alt={resolved.alt ?? fallback.props.alt ?? ""}
      className={[fallback.props.className, "object-cover"].filter(Boolean).join(" ")}
      decoding="async"
      loading="lazy"
      src={resolved.src}
    />
  }
  return React.cloneElement(fallback, { src: resolved.src, alt: resolved.alt ?? fallback.props.alt ?? "" })
}

export const useProviderBlockModel = () => React.use(BlockContext)

const path = (model: ProviderBlockModel, field: string, itemIndex?: number, subField?: string) => ({
  blockIndex: model.options.index,
  field,
  itemIndex,
  subField,
})

function fieldValue(block: Block, field: string): unknown {
  return (block as unknown as Record<string, unknown>)[field]
}

export function ProviderField({ field, fallback, inline = false }: { field: string; fallback: React.ReactNode; inline?: boolean }) {
  const model = useProviderBlockModel()
  if (!model) return <>{fallback}</>
  const value = fieldValue(model.block, field)
  if (typeof value === "string") {
    return model.options.editSlots?.renderText
      ? model.options.editSlots.renderText({ name: `${model.block.blockType}.${field}`, value, className: "contents", elementPath: path(model, field) })
      : <>{value}</>
  }
  if (value && typeof value === "object" && "variant" in value) {
    const rich = value as RtRoot
    return model.options.editSlots?.renderRichText
      ? model.options.editSlots.renderRichText({ name: `${model.block.blockType}.${field}`, value: rich, variant: inline ? "inline" : "block", as: "span", className: "contents", elementPath: path(model, field), blockMode: inline ? "inline" : "text" })
      : <RichTextRenderer value={rich} blockMode={inline ? "inline" : "text"} />
  }
  return null
}

export function ProviderAction({
  field,
  fallback,
  children,
  decoration = "after",
  ...props
}: {
  field: string
  fallback: React.ReactNode
  children?: React.ReactNode
  decoration?: "before" | "after"
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const model = useProviderBlockModel()
  const content = (label: React.ReactNode) => decoration === "before" ? <>{children}{label}</> : <>{label}{children}</>
  if (!model) return <button {...props as React.ButtonHTMLAttributes<HTMLButtonElement>} type="button">{content(fallback)}</button>
  const value = fieldValue(model.block, field) as LinkRef | null | undefined
  if (!value?.label || !value.href) return null
  if (model.options.editSlots?.renderCta) return model.options.editSlots.renderCta({
    name: `${model.block.blockType}.${field}`,
    value,
    className: props.className,
    style: props.style,
    actionAttributes: Object.fromEntries(Object.entries(props).filter(([name, value]) => (name.startsWith("data-") || name.startsWith("aria-")) && typeof value === "string")) as Record<string, string>,
    elementPath: path(model, field),
  })
  const external = value.external ?? isExternalHref(value.href)
  const classes = typeof props.className === "string" ? props.className.split(/\s+/) : []
  const preserveButtonWidth = classes.includes("flex") && !classes.includes("w-full") && !classes.includes("flex-1")
  return <a {...props} style={{ ...(preserveButtonWidth ? { width: "fit-content" } : {}), ...props.style }} href={value.href} target={external ? "_blank" : props.target} rel={external ? "noreferrer" : props.rel}>{content(withBoundLabel(fallback, value.label))}</a>
}

function withBoundLabel(node: React.ReactNode, label: string): React.ReactNode {
  if (typeof node === "string") return label
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return node
  const children = node.props.children
  return React.cloneElement(node, undefined, React.Children.map(children, (child) => withBoundLabel(child, label)))
}

const text = (value: unknown) => typeof value === "string" ? value : extractRichText(value)
const link = (value: unknown): LinkRef | undefined => value && typeof value === "object" ? value as LinkRef : undefined
const media = (value: MediaRef | undefined, model: ProviderBlockModel) => resolveMedia(value ?? null, model.options.mediaResolver)?.src
const transparentSquare = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E"
const mediaSlot = (value: MediaRef | undefined, model: ProviderBlockModel, field: string, itemIndex: number, subField: string, alt: string) => {
  const resolved = resolveMedia(value ?? null, model.options.mediaResolver)
  return {
    src: resolved?.src ?? transparentSquare,
    __providerMedia: { value, field, itemIndex, subField, alt: resolved?.alt ?? alt },
  }
}

function overlay(template: unknown, values: Record<string, unknown>) {
  return { ...(template && typeof template === "object" ? template as Record<string, unknown> : {}), ...values }
}

function bindItems(model: ProviderBlockModel, field: string, templates: readonly unknown[]) {
  const block = model.block
  const source = fieldValue(block, field)
  if (!Array.isArray(source)) return []
  return source.map((item, index) => {
    const record = item as Record<string, unknown>
    const template = templates[index % Math.max(templates.length, 1)]
    if (block.blockType === "featureList" || (block.blockType === "contentSection" && field === "features")) {
      const cta = link(record.cta)
      const image = mediaSlot(record.image as MediaRef, model, field, index, "image", text(record.title))
      const icon = resolveIcon(typeof record.icon === "string" ? record.icon : null)
      return overlay(template, { title: text(record.title), name: text(record.title), description: text(record.description), details: text(record.description), content: text(record.description), ...(icon ? { icon } : {}), image, imageUrl: image, src: image, metricValue: record.metricValue, metricLabel: record.metricLabel, value: record.metricValue, cta, href: cta?.href, tutorialLink: cta?.href, buttonText: cta?.label })
    }
    if (block.blockType === "faq") {
      return overlay(template, { question: text(record.question), title: text(record.question), answer: text(record.answer), content: text(record.answer), description: text(record.answer) })
    }
    if (block.blockType === "testimonials") {
      return overlay(template, { quote: record.quote, content: record.quote, testimonial: record.quote, author: record.author, name: record.author, role: record.role, designation: record.role, avatar: media(record.avatar as MediaRef, model), image: media(record.avatar as MediaRef, model), imageUrl: media(record.avatar as MediaRef, model) })
    }
    if (block.blockType === "pricing") {
      const cta = link(record.cta)
      const templateFeatures = template && typeof template === "object" && Array.isArray((template as Record<string, unknown>).features)
        ? (template as Record<string, unknown>).features as unknown[]
        : []
      const features = Array.isArray(record.features) ? record.features.map((feature, featureIndex) => {
        const label = text((feature as Record<string, unknown>).label)
        const featureTemplate = templateFeatures[featureIndex % Math.max(templateFeatures.length, 1)]
        return featureTemplate && typeof featureTemplate === "object"
          ? { ...featureTemplate as Record<string, unknown>, title: label, name: label, label }
          : label
      }) : []
      return overlay(template, { name: text(record.title), title: text(record.title), description: text(record.description), price: record.price, period: record.period, badge: record.badge, features, buttonText: cta?.label, href: cta?.href, link: cta?.href })
    }
    if (block.blockType === "stats") return overlay(template, { value: record.value, number: record.value, label: record.label, title: record.label, description: text(record.description) })
    if (block.blockType === "logoCloud") {
      const src = media(record.image as MediaRef, model)
      const BoundLogo = () => src ? <img src={src} alt={String(record.name ?? "")} /> : <span>{String(record.name ?? "")}</span>
      if (typeof template === "function") return BoundLogo
      const templateRecord = template && typeof template === "object" ? template as Record<string, unknown> : {}
      return overlay(template, {
        name: record.name,
        title: record.name,
        description: record.description,
        href: record.href,
        link: record.href,
        logo: typeof templateRecord.logo === "function" ? BoundLogo : src,
        image: typeof templateRecord.image === "function" ? BoundLogo : src,
        imageUrl: src,
        src,
      })
    }
    if (block.blockType === "gallery") {
      const itemLink = link(record.link)
      const caption = text(record.caption)
      const image = mediaSlot(record.image as MediaRef, model, "images", index, "image", caption)
      if (typeof template === "string") return image
      return overlay(template, { title: caption, caption, description: caption, href: itemLink?.href, link: itemLink?.href, image, imageUrl: image, src: image })
    }
    if (block.blockType === "team") {
      const image = mediaSlot(record.image as MediaRef, model, "members", index, "image", String(record.name ?? ""))
      return overlay(template, { name: record.name, title: record.role, role: record.role, designation: record.role, bio: text(record.bio), description: text(record.bio), image, imageUrl: image, avatar: image, links: record.links })
    }
    if (block.blockType === "blogCards") {
      const cta = link(record.cta)
      const title = text(record.title)
      return overlay(template, { title, name: title, excerpt: text(record.excerpt), description: text(record.excerpt), date: record.date, author: record.author, role: record.authorRole, authorRole: record.authorRole, href: record.href ?? cta?.href, link: record.href ?? cta?.href, buttonText: cta?.label, image: media(record.image as MediaRef, model), imageUrl: media(record.image as MediaRef, model), src: media(record.image as MediaRef, model) })
    }
    if (block.blockType === "timeline") return overlay(template, {
      title: record.title,
      name: record.title,
      role: record.title,
      description: record.description,
      content: record.description,
      company: record.label,
      label: record.label,
      version: record.label,
      period: record.date,
      date: record.date,
      technologies: Array.isArray(record.tags) ? record.tags.map((tag) => typeof tag === "string" ? tag : String((tag as Record<string, unknown>).value ?? "")) : [],
      tags: Array.isArray(record.tags) ? record.tags.map((tag) => typeof tag === "string" ? tag : String((tag as Record<string, unknown>).value ?? "")) : [],
    })
    return overlay(template, record)
  })
}

export function ProviderItems({ field, templates, children }: { field: string; templates: readonly unknown[]; children: (items: unknown[]) => React.ReactNode }) {
  const model = useProviderBlockModel()
  return <>{children(model ? bindItems(model, field, templates) : [...templates])}</>
}

export function ProviderItemField({ field, index, subField, fallback }: { field: string; index: number; subField: string; fallback: React.ReactNode }) {
  const model = useProviderBlockModel()
  if (!model) return <>{fallback}</>
  const items = fieldValue(model.block, field)
  if (!Array.isArray(items) || !items[index]) return null
  const value = (items[index] as Record<string, unknown>)[subField]
  if (typeof value === "string") return model.options.editSlots?.renderText
    ? model.options.editSlots.renderText({ name: `${model.block.blockType}.${field}.${subField}`, value, className: "contents", elementPath: path(model, field, index, subField) })
    : <>{value}</>
  if (value && typeof value === "object" && "variant" in value) return model.options.editSlots?.renderRichText
    ? model.options.editSlots.renderRichText({ name: `${model.block.blockType}.${field}.${subField}`, value: value as RtRoot, variant: "inline", as: "span", className: "contents", elementPath: path(model, field, index, subField), blockMode: "inline" })
    : <RichTextRenderer value={value as RtRoot} blockMode="inline" />
  return null
}

export function ProviderContactLink({ field, index, fallback, ...props }: { field: string; index: number; fallback: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href">) {
  const model = useProviderBlockModel()
  if (!model) return <a {...props} href="#">{fallback}</a>
  const items = fieldValue(model.block, field)
  if (!Array.isArray(items) || !items[index]) return null
  const item = items[index] as Record<string, unknown>
  const href = typeof item.href === "string" ? item.href : ""
  const value = typeof item.value === "string" ? item.value : ""
  const content = model.options.editSlots?.renderText
    ? model.options.editSlots.renderText({ name: `${model.block.blockType}.${field}.value`, value, className: "contents", elementPath: path(model, field, index, "value") })
    : value
  return <a {...props} href={href || undefined}>{content}</a>
}

const contactIcons = {
  "building-2": Building2,
  building: Building2,
  clock: Clock3,
  globe: Globe2,
  mail: Mail,
  "map-pin": MapPin,
  message: MessageCircle,
  phone: Phone,
} as const

export function ProviderContactIcon({ field, index, fallback }: { field: string; index: number; fallback: React.ReactNode }) {
  const model = useProviderBlockModel()
  if (!model) return <>{fallback}</>
  const items = fieldValue(model.block, field)
  if (!Array.isArray(items) || !items[index]) return null
  const icon = String((items[index] as Record<string, unknown>).icon ?? "").trim().toLowerCase() as keyof typeof contactIcons
  const Icon = contactIcons[icon]
  return Icon ? <Icon aria-hidden="true" /> : <>{fallback}</>
}

export function ProviderLogo({ field, index, fallback }: { field: string; index: number; fallback: React.ReactNode }) {
  const model = useProviderBlockModel()
  if (!model) return <>{fallback}</>
  const items = fieldValue(model.block, field)
  if (!Array.isArray(items) || !items[index]) return null
  const item = items[index] as Record<string, unknown>
  const name = String(item.name ?? "")
  const value = item.image as MediaRef | undefined
  const resolved = resolveMedia(value ?? null, model.options.mediaResolver)
  const className = React.isValidElement<{ className?: string }>(fallback) ? fallback.props.className : undefined
  const content = model.options.editSlots?.renderImage
    ? model.options.editSlots.renderImage({ name: `${model.block.blockType}.${field}.image`, value, alt: name, className, elementPath: path(model, field, index, "image") })
    : resolved?.src ? <img className={className} src={resolved.src} alt={name} /> : null
  const href = typeof item.href === "string" ? item.href.trim() : ""
  const external = /^(?:https?:)?\/\//.test(href)
  return href ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{content}</a> : content
}
