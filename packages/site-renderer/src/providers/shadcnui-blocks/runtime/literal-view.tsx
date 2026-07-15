import * as React from "react"
import type { Block, LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../../../analytics"
import { resolveMedia } from "../../../media"
import { TooltipProvider } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { BlockRenderOptions } from "../../../blocks/types"

export type ProviderBlockViewModel = { block: Block; options: BlockRenderOptions }

type LiteralComponent = (props: Record<string, never>) => React.ReactNode
const tooltipVariants = new Set(["shadcnui-blocks.pricing-03", "shadcnui-blocks.pricing-04"])

const withTooltipProvider = (variant: string, children: React.ReactNode) =>
  tooltipVariants.has(variant) ? <TooltipProvider>{children}</TooltipProvider> : children

type SlotPath = { field: string; itemIndex?: number; subField?: string }
type TextProjection = SlotPath & { text: string; rich?: RtRoot | null; inline?: boolean }
type LinkProjection = SlotPath & { value: LinkRef }
type MediaProjection = SlotPath & { ref?: MediaRef; alt: string }
type ContactField = Extract<Block, { blockType: "contactSection" }>["fields"][number]
type Projection = {
  text: TextProjection[]
  links: LinkProjection[]
  media: MediaProjection[]
  formFields: ContactField[]
  cursor: { text: number; links: number; media: number; formFields: number; forms: number; ids: number; actions: number }
}

const rtText = (value: RtRoot | null | undefined): string => {
  if (!value?.children) return ""
  const visit = (node: unknown): string => {
    if (!node || typeof node !== "object") return ""
    const record = node as Record<string, unknown>
    if (record.t === "text") return typeof record.v === "string" ? record.v : ""
    return Array.isArray(record.children) ? record.children.map(visit).join("") : ""
  }
  return value.children.map(visit).join("\n").trim()
}

const semanticRecordKeys = new Set([
  "author", "avatar", "bio", "company", "date", "description", "designation", "excerpt",
  "features", "href", "image", "imageUrl", "link", "logo", "member", "name", "period",
  "plan", "portraitImage", "post", "price", "quote", "role", "teamMember", "testimonial", "title",
])

function carriesDemoRecord(props: Record<string, unknown>) {
  return Object.entries(props).some(([key, value]) => {
    if (key === "children" || key === "style" || !value || typeof value !== "object" || React.isValidElement(value)) return false
    const records = Array.isArray(value) ? value : [value]
    return records.some((record) => record && typeof record === "object" && Object.keys(record).some((field) => semanticRecordKeys.has(field)))
  })
}

function nodeHasText(node: React.ReactNode): boolean {
  if (typeof node === "string" || typeof node === "number") return String(node).trim().length > 0
  if (Array.isArray(node)) return node.some(nodeHasText)
  return React.isValidElement(node) && nodeHasText((node.props as { children?: React.ReactNode }).children)
}

function projectionFor(block: Block): Projection {
  const projection: Projection = { text: [], links: [], media: [], formFields: [], cursor: { text: 0, links: 0, media: 0, formFields: 0, forms: 0, ids: 0, actions: 0 } }
  const rt = (value: RtRoot | null | undefined, field: string, path: Omit<SlotPath, "field"> = {}, inline = false) => { const text = rtText(value); if (text) projection.text.push({ text, rich: value, field, ...path, inline }) }
  const text = (value: unknown, field: string, path: Omit<SlotPath, "field"> = {}) => { if (typeof value === "string" && value.trim()) projection.text.push({ text: value.trim(), field, ...path }) }
  const link = (value: LinkRef | null | undefined, field: string, path: Omit<SlotPath, "field"> = {}) => { if (value?.label?.trim() && value.href?.trim()) { projection.links.push({ value, field, ...path }); text(value.label, field, path) } }
  const media = (ref: MediaRef | undefined, alt: string, field: string, path: Omit<SlotPath, "field"> = {}) => { if (ref) projection.media.push({ ref, alt, field, ...path }) }
  if (block.blockType === "hero") {
    rt(block.eyebrow, "eyebrow", {}, true); block.pills?.forEach((item, itemIndex) => text(item.label, "pills", { itemIndex, subField: "label" })); rt(block.headline, "headline", {}, true); rt(block.subheadline, "subheadline")
    link(block.cta, "cta"); link(block.secondary, "secondary"); block.links?.forEach((item, itemIndex) => link(item, "links", { itemIndex }))
    block.stats?.forEach((item, itemIndex) => { text(item.value, "stats", { itemIndex, subField: "value" }); text(item.label, "stats", { itemIndex, subField: "label" }) }); media(block.image, rtText(block.headline), "image")
  } else if (block.blockType === "featureList") {
    rt(block.eyebrow, "eyebrow", {}, true); rt(block.title, "title", {}, true); rt(block.intro, "intro"); media(block.image, rtText(block.title), "image")
    block.features.forEach((item, itemIndex) => { rt(item.title, "features", { itemIndex, subField: "title" }, true); rt(item.description, "features", { itemIndex, subField: "description" }) })
  } else if (block.blockType === "testimonials") {
    text(block.title, "title"); media(block.logo, block.title ?? "", "logo")
    block.items.forEach((item, itemIndex) => { text(item.quote, "items", { itemIndex, subField: "quote" }); text(item.author, "items", { itemIndex, subField: "author" }); text(item.role, "items", { itemIndex, subField: "role" }); media(item.avatar, item.author, "items", { itemIndex, subField: "avatar" }) })
  } else if (block.blockType === "faq") {
    rt(block.title, "title", {}, true); block.items.forEach((item, itemIndex) => { rt(item.question, "items", { itemIndex, subField: "question" }, true); rt(item.answer, "items", { itemIndex, subField: "answer" }) })
  } else if (block.blockType === "cta") {
    rt(block.eyebrow, "eyebrow", {}, true); rt(block.headline, "headline", {}, true); rt(block.description, "description"); link(block.primary, "primary"); link(block.secondary, "secondary"); media(block.backgroundImage, rtText(block.headline), "backgroundImage")
  } else if (block.blockType === "contactSection") {
    projection.formFields = block.fields
    rt(block.title, "title", {}, true); rt(block.description, "description"); block.fields.forEach((item, itemIndex) => { text(item.label, "fields", { itemIndex, subField: "label" }); text(item.placeholder, "fields", { itemIndex, subField: "placeholder" }); item.options?.forEach((option) => text(option.label, "fields", { itemIndex, subField: "options" })) }); text(block.submitLabel, "submitLabel")
  } else if (block.blockType === "pricing") {
    rt(block.eyebrow, "eyebrow", {}, true); rt(block.title, "title", {}, true); rt(block.intro, "intro")
    block.plans.forEach((plan, itemIndex) => { text(plan.badge, "plans", { itemIndex, subField: "badge" }); rt(plan.title, "plans", { itemIndex, subField: "title" }, true); rt(plan.description, "plans", { itemIndex, subField: "description" }); text(plan.price, "plans", { itemIndex, subField: "price" }); text(plan.period, "plans", { itemIndex, subField: "period" }); plan.features?.forEach((feature) => rt(feature.label, "plans", { itemIndex, subField: "features" }, true)); link(plan.cta, "plans", { itemIndex, subField: "cta" }) })
  } else if (block.blockType === "stats") {
    rt(block.title, "title", {}, true); rt(block.intro, "intro"); block.items.forEach((item, itemIndex) => { text(item.value, "items", { itemIndex, subField: "value" }); text(item.label, "items", { itemIndex, subField: "label" }); rt(item.description, "items", { itemIndex, subField: "description" }) })
  } else if (block.blockType === "logoCloud") {
    rt(block.title, "title", {}, true); rt(block.intro, "intro"); block.logos.forEach((item, itemIndex) => { text(item.name, "logos", { itemIndex, subField: "name" }); media(item.image, item.name, "logos", { itemIndex, subField: "image" }); if (item.href) projection.links.push({ value: { label: item.name, href: item.href }, field: "logos", itemIndex, subField: "href" }) })
  } else if (block.blockType === "gallery") {
    rt(block.title, "title", {}, true); rt(block.intro, "intro"); block.images.forEach((item, itemIndex) => { media(item.image, rtText(item.caption), "images", { itemIndex, subField: "image" }); rt(item.caption, "images", { itemIndex, subField: "caption" }); if (item.link) link(item.link, "images", { itemIndex, subField: "link" }) }); link(block.cta, "cta")
  } else if (block.blockType === "team") {
    rt(block.title, "title", {}, true); rt(block.intro, "intro"); block.members.forEach((member, itemIndex) => { text(member.name, "members", { itemIndex, subField: "name" }); text(member.role, "members", { itemIndex, subField: "role" }); rt(member.bio, "members", { itemIndex, subField: "bio" }); media(member.image, member.name, "members", { itemIndex, subField: "image" }); member.links?.forEach((item) => link(item, "members", { itemIndex, subField: "links" })) })
  } else if (block.blockType === "blogCards") {
    rt(block.title, "title", {}, true); rt(block.intro, "intro"); block.posts.forEach((post, itemIndex) => { rt(post.title, "posts", { itemIndex, subField: "title" }, true); rt(post.excerpt, "posts", { itemIndex, subField: "excerpt" }); text(post.date, "posts", { itemIndex, subField: "date" }); text(post.author, "posts", { itemIndex, subField: "author" }); text(post.authorRole, "posts", { itemIndex, subField: "authorRole" }); media(post.image, rtText(post.title), "posts", { itemIndex, subField: "image" }); if (post.href) projection.links.push({ value: { label: rtText(post.title), href: post.href }, field: "posts", itemIndex, subField: "href" }); link(post.cta, "posts", { itemIndex, subField: "cta" }) })
  } else if (block.blockType === "contentSection") {
    rt(block.eyebrow, "eyebrow", {}, true); rt(block.title, "title", {}, true); rt(block.intro, "intro"); rt(block.body, "body"); block.features?.forEach((feature, itemIndex) => { rt(feature.title, "features", { itemIndex, subField: "title" }, true); rt(feature.description, "features", { itemIndex, subField: "description" }) }); rt(block.bridge, "bridge"); rt(block.secondaryTitle, "secondaryTitle", {}, true); rt(block.secondaryBody, "secondaryBody"); media(block.image, rtText(block.title), "image"); link(block.cta, "cta")
  }
  return projection
}

function collectElementIds(node: React.ReactNode, ids: Set<string>) {
  if (Array.isArray(node)) return node.forEach((child) => collectElementIds(child, ids))
  if (!React.isValidElement(node)) return
  const props = node.props as Record<string, unknown>
  if (typeof props.id === "string" && props.id) ids.add(props.id)
  collectElementIds(props.children as React.ReactNode, ids)
}

function projectNode(node: React.ReactNode, projection: Projection, model: ProviderBlockViewModel, inheritedIdScope?: Map<string, string>): React.ReactNode {
  if (Array.isArray(node)) return node.map((child) => projectNode(child, projection, model, inheritedIdScope))
  if (typeof node === "string" || typeof node === "number") {
    const original = String(node)
    if (!original.trim()) return node
    if (!projection.text.length) return "\u00a0"
    const slot = projection.text[projection.cursor.text++ % projection.text.length]!
    const elementPath = { blockIndex: model.options.index, field: slot.field, itemIndex: slot.itemIndex, subField: slot.subField }
    if (slot.rich && model.options.editSlots?.renderRichText) {
      return model.options.editSlots.renderRichText({ name: `${model.block.blockType}.${slot.field}`, value: slot.rich, variant: slot.inline ? "inline" : "block", as: "span", className: "contents", elementPath, blockMode: slot.inline ? "inline" : "text" })
    }
    if (!slot.rich && model.options.editSlots?.renderText) {
      return model.options.editSlots.renderText({ name: `${model.block.blockType}.${slot.field}`, value: slot.text, className: "contents", elementPath })
    }
    return slot.text
  }
  if (!React.isValidElement(node)) return node
  const props = node.props as Record<string, unknown>
  const componentName = typeof node.type === "function" ? node.type.name : ""
  const localCollectionName = /(?:Cards|Features|Grid|Items|List|Logo|Logos|Members|Navbar|NavigationSheet|NavMenu|Plans|Posts|StatsCard|Testimonials)/.test(componentName)
  if (typeof node.type === "function" && (carriesDemoRecord(props) || localCollectionName) && !(node.type.prototype as { isReactComponent?: boolean } | undefined)?.isReactComponent) {
    const Component = node.type as (componentProps: Record<string, unknown>) => React.ReactNode
    return projectNode(Component(props), projection, model, inheritedIdScope)
  }
  const next: Record<string, unknown> = {}
  const elementType = typeof node.type === "string" ? node.type : undefined
  const idScope = elementType === "svg" ? new Map<string, string>() : inheritedIdScope
  if (elementType === "svg") {
    const ids = new Set<string>()
    collectElementIds(node, ids)
    for (const id of ids) idScope!.set(id, `${id}-siab-${model.options.index}-${projection.cursor.ids++}`)
  }
  if (idScope) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "children" || typeof value !== "string") continue
      if (key === "id" && idScope.has(value)) next.id = idScope.get(value)
      else {
        const replaced = value
          .replace(/url\(#([^)]+)\)/g, (match, id) => idScope.has(id) ? `url(#${idScope.get(id)})` : match)
          .replace(/^#(.+)$/, (match, id) => idScope.has(id) ? `#${idScope.get(id)}` : match)
        if (replaced !== value) next[key] = replaced
      }
    }
  }
  const isFormControl = elementType === "input" || elementType === "textarea" || elementType === "select" || ["Checkbox", "Input", "Select", "Textarea"].includes(componentName)
  if (componentName === "SelectTrigger" && !("aria-label" in props)) next["aria-label"] = "Content filter"
  if (componentName === "TooltipTrigger" && !("aria-label" in props) && !nodeHasText(props.children as React.ReactNode)) next["aria-label"] = "More information"
  if (componentName === "PopoverTrigger" && !("aria-label" in props) && !nodeHasText(props.children as React.ReactNode)) next["aria-label"] = "Open menu"
  if (componentName === "Button" && !("aria-label" in props) && !nodeHasText(props.children as React.ReactNode)) next["aria-label"] = "Open navigation menu"
  if (elementType === "button" && !("aria-label" in props) && !nodeHasText(props.children as React.ReactNode)) next["aria-label"] = `Select item ${++projection.cursor.actions}`
  if (elementType === "form") {
    projection.cursor.forms += 1
    next.action = model.options.formAction
    next.method = "post"
    next.noValidate = false
  }
  if (isFormControl) {
    const field = projection.formFields[projection.cursor.formFields++]
    if (field) {
      next.name = field.name
      next.required = field.required || undefined
      next.placeholder = field.placeholder || undefined
      next.maxLength = field.maxLength || undefined
      next["data-provider-field"] = field.name
      if (elementType === "input" || componentName === "Input") next.type = field.type === "textarea" || field.type === "select" ? "text" : field.type
      if (componentName === "Checkbox") next["aria-label"] = field.label
    } else if (projection.formFields.length) {
      next.name = undefined
      next.disabled = true
      next["aria-hidden"] = true
      next.tabIndex = -1
    }
  }
  if ("href" in props) {
    const slot = projection.links.length ? projection.links[projection.cursor.links++ % projection.links.length] : undefined
    if (!slot) return null
    next.href = slot.value.href
    if (slot && !("aria-label" in props) && !nodeHasText(props.children as React.ReactNode)) next["aria-label"] = slot.value.label
    if (slot && model.options.editSlots?.renderCta) {
      return model.options.editSlots.renderCta({
        name: `${model.block.blockType}.${slot.field}`,
        value: slot.value,
        className: typeof props.className === "string" ? props.className : undefined,
        elementPath: { blockIndex: model.options.index, field: slot.field, itemIndex: slot.itemIndex, subField: slot.subField },
      })
    }
  }
  if ("src" in props) {
    const media = projection.media.length
      ? projection.media[projection.cursor.media++ % projection.media.length]
      : undefined
    const resolved = resolveMedia(media?.ref ?? null, model.options.mediaResolver)
    if (media && model.options.editSlots?.renderImage) {
      return model.options.editSlots.renderImage({
        name: `${model.block.blockType}.${media.field}`,
        value: media.ref,
        alt: media.alt,
        className: typeof props.className === "string" ? props.className : undefined,
        loading: props.loading === "eager" ? "eager" : "lazy",
        elementPath: { blockIndex: model.options.index, field: media.field, itemIndex: media.itemIndex, subField: media.subField },
      })
    }
    next.src = resolved?.src ?? "data:image/gif;base64,R0lGODlhAQABAAAAACw="
    next.alt = media?.alt || resolved?.alt || ""
    if (media?.ref && typeof media.ref === "object") {
      next.width = media.ref.width ?? props.width
      next.height = media.ref.height ?? props.height
    }
  }
  if ("children" in props) {
    const children = props.children as React.ReactNode
    const formFieldStart = projection.cursor.formFields
    const projectedChildren = React.Children.count(children) === 1
      ? projectNode(children, projection, model, idScope)
      : React.Children.map(children, (child) => projectNode(child, projection, model, idScope))
    if (elementType === "form" && model.block.blockType === "contactSection") {
      const consumed = Math.min(projection.cursor.formFields - formFieldStart, projection.formFields.length)
      const remaining = projection.formFields.slice(consumed)
      next.children = [
        <input key="__siab-form-name" type="hidden" name="formName" value={model.block.formName} />,
        projectedChildren,
        ...remaining.map((field) => (
          <label key={field.name} className="mt-4 grid gap-2 text-sm font-medium">
            {field.label}
            {field.type === "textarea" ? (
              <textarea className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2" name={field.name} required={field.required} placeholder={field.placeholder ?? undefined} maxLength={field.maxLength ?? undefined} />
            ) : field.type === "select" ? (
              <select className="h-9 w-full rounded-lg border border-input bg-background px-3" name={field.name} required={field.required}>
                {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : field.type === "checkbox" ? (
              <input className="size-4" type="checkbox" name={field.name} required={field.required} />
            ) : (
              <input className="h-9 w-full rounded-lg border border-input bg-background px-3" type={field.type} name={field.name} required={field.required} placeholder={field.placeholder ?? undefined} maxLength={field.maxLength ?? undefined} />
            )}
          </label>
        )),
      ]
    } else {
      next.children = projectedChildren
    }
    if (componentName === "Button" && model.block.blockType === "contactSection" && !props.asChild) {
      next.type = "submit"
      next.children = model.block.submitLabel || "Submit"
    }
  }
  return React.cloneElement(node as React.ReactElement<Record<string, unknown>>, next)
}

export function LiteralProviderVariantView({ Literal, model, variant }: { Literal: LiteralComponent; model: ProviderBlockViewModel; variant: string }) {
  const projection = projectionFor(model.block)
  const literalTree = Literal({})
  let projected = projectNode(literalTree, projection, model)
  if (!React.isValidElement(projected)) throw new Error(`Literal provider variant "${variant}" did not return a React element.`)
  if (model.block.blockType === "contactSection" && projection.cursor.forms === 0) {
    const block = model.block
    projected = React.cloneElement(projected as React.ReactElement<Record<string, unknown>>, {
      className: `${String((projected.props as Record<string, unknown>).className ?? "")} flex-col gap-10 px-6`,
      children: [
        <React.Fragment key="__siab-literal-content">{(projected.props as Record<string, unknown>).children as React.ReactNode}</React.Fragment>,
        <form key="__siab-structured-form" action={model.options.formAction} method="post" className="mx-auto grid w-full max-w-xl gap-4 rounded-xl border bg-background p-6 shadow-sm">
          <input type="hidden" name="formName" value={block.formName} />
          {block.fields.map((field) => (
            <label key={field.name} className="grid gap-2 text-sm font-medium">
              {field.label}
              {field.type === "textarea" ? (
                <textarea className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2" name={field.name} required={field.required} placeholder={field.placeholder ?? undefined} maxLength={field.maxLength ?? undefined} />
              ) : field.type === "select" ? (
                <select className="h-9 w-full rounded-lg border border-input bg-background px-3" name={field.name} required={field.required}>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : field.type === "checkbox" ? (
                <input className="size-4" type="checkbox" name={field.name} required={field.required} />
              ) : (
                <input className="h-9 w-full rounded-lg border border-input bg-background px-3" type={field.type} name={field.name} required={field.required} placeholder={field.placeholder ?? undefined} maxLength={field.maxLength ?? undefined} />
              )}
            </label>
          ))}
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground">{block.submitLabel || "Submit"}</button>
        </form>,
      ],
    })
  }
  const attrs = {
    ...model.options.sectionAttributes,
    ...sectionAnalyticsAttrs(model.block.analytics, model.block.blockType, model.options.index),
    "data-block-index": model.options.index,
    "data-provider-block": "shadcnui-blocks",
    "data-provider-token-mode": "reference",
    "data-provider-variant": variant,
    "data-source-variant": variant,
    id: model.block.anchor || undefined,
  }
  return withTooltipProvider(variant, React.cloneElement(projected as React.ReactElement<Record<string, unknown>>, attrs))
}

export function LiteralProviderReferenceView({ Literal, variant }: { Literal: LiteralComponent; variant: string }) {
  const tree = Literal({})
  if (!React.isValidElement(tree)) throw new Error(`Literal provider reference "${variant}" did not return a React element.`)
  return withTooltipProvider(variant, React.cloneElement(tree as React.ReactElement<Record<string, unknown>>, { "data-provider-reference": variant }))
}
