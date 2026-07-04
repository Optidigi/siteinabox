"use client"
import * as React from "react"
import { InlineCtaButton } from "../inline/InlineCtaButton"
import { InlineImage } from "../inline/InlineImage"
import { RtSlot } from "../inline/RtSlot"
import {
  canvasSourceVariantClassName,
  canvasSourceVariantDataAttribute,
  mergeCanvasSectionProps,
  type CanvasBlockRendererProps,
} from "@/components/editor/canvas/CanvasBlockRenderer"

function generationSectionProps(
  block: any,
  isActive: boolean,
  tenantRendererKey: "amicare" | null | undefined,
  onActivate: () => void,
  className: string,
  sectionChromeProps?: CanvasBlockRendererProps["sectionChromeProps"],
) {
  return mergeCanvasSectionProps(
    {
      id: block.anchor || undefined,
      className,
      "data-source-variant": canvasSourceVariantDataAttribute(block, tenantRendererKey),
      "data-block-index": block.__index ?? undefined,
      "data-active": isActive || undefined,
      onClick: onActivate,
    },
    sectionChromeProps,
  )
}

const setField = (block: any, onUpdate: (next: any) => void) => (field: string) => (value: any) =>
  onUpdate({ ...block, [field]: value })

const setArrayItemField = (
  block: any,
  onUpdate: (next: any) => void,
  field: string,
  index: number,
  subField: string,
) => (value: any) => {
  const next = [...(block[field] ?? [])]
  next[index] = { ...(next[index] ?? {}), [subField]: value }
  onUpdate({ ...block, [field]: next })
}

export const PricingCanvas: React.FC<CanvasBlockRendererProps> = ({
  block,
  isActive,
  tenantRendererKey,
  manifest,
  onActivate,
  onUpdate,
  sectionChromeProps,
}) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const plans: any[] = block.plans ?? []
  const sectionProps = generationSectionProps(block, isActive, tenantRendererKey, onActivate, `cms-block cms-block--pricing ${canvasSourceVariantClassName(block, tenantRendererKey)}`.trim(), sectionChromeProps)

  return (
    <section {...sectionProps}>
      <RtSlot as="h2" variant="inline" manifest={manifest} value={block.title} onChange={set("title")} className="cms-block__title" placeholder="Pricing title" elementPath={{ blockIndex: idx, field: "title" }} />
      <RtSlot as="div" variant="block" manifest={manifest} value={block.intro} onChange={set("intro")} className="cms-block__intro" placeholder="Intro" elementPath={{ blockIndex: idx, field: "intro" }} />
      <div className="cms-block__pricingPlans">
        {plans.map((plan, i) => (
          <article key={plan.id ?? i} className="cms-block__pricingPlan" data-highlighted={plan.highlighted ? "true" : undefined}>
            {plan.badge ? <span className="cms-block__badge">{plan.badge}</span> : null}
            <RtSlot as="h3" variant="inline" manifest={manifest} value={plan.title} onChange={setArrayItemField(block, onUpdate, "plans", i, "title")} className="cms-block__pricingTitle" placeholder="Plan title" elementPath={{ blockIndex: idx, field: "plans", itemIndex: i, subField: "title" }} />
            <RtSlot as="div" variant="block" manifest={manifest} value={plan.description} onChange={setArrayItemField(block, onUpdate, "plans", i, "description")} className="cms-block__pricingDescription" placeholder="Plan description" elementPath={{ blockIndex: idx, field: "plans", itemIndex: i, subField: "description" }} />
            <p className="cms-block__pricingPrice">{plan.price ?? "Price"} {plan.period ? <span>{plan.period}</span> : null}</p>
            <ul className="cms-block__pricingFeatures">
              {(plan.features ?? []).map((feature: any, featureIndex: number) => (
                <li key={feature.id ?? featureIndex} data-included={feature.included === false ? "false" : "true"}>
                  <RtSlot as="span" variant="inline" manifest={manifest} value={feature.label} onChange={(value) => {
                    const nextPlans = [...plans]
                    const nextFeatures = [...(nextPlans[i]?.features ?? [])]
                    nextFeatures[featureIndex] = { ...(nextFeatures[featureIndex] ?? {}), label: value }
                    nextPlans[i] = { ...(nextPlans[i] ?? {}), features: nextFeatures }
                    onUpdate({ ...block, plans: nextPlans })
                  }} placeholder="Feature" elementPath={{ blockIndex: idx, field: "plans", itemIndex: i, subField: "features" }} />
                </li>
              ))}
            </ul>
            <InlineCtaButton value={plan.cta} onChange={setArrayItemField(block, onUpdate, "plans", i, "cta")} className="cms-block__pricingCta" emptyLabel="Plan action" elementPath={{ blockIndex: idx, field: "plans", itemIndex: i, subField: "cta" }} />
          </article>
        ))}
      </div>
    </section>
  )
}

export const StatsCanvas: React.FC<CanvasBlockRendererProps> = ({ block, isActive, tenantRendererKey, manifest, onActivate, onUpdate, sectionChromeProps }) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const items: any[] = block.items ?? []
  const sectionProps = generationSectionProps(block, isActive, tenantRendererKey, onActivate, `cms-block cms-block--stats ${canvasSourceVariantClassName(block, tenantRendererKey)}`.trim(), sectionChromeProps)

  return (
    <section {...sectionProps}>
      <RtSlot as="h2" variant="inline" manifest={manifest} value={block.title} onChange={set("title")} className="cms-block__title" placeholder="Stats title" elementPath={{ blockIndex: idx, field: "title" }} />
      <RtSlot as="div" variant="block" manifest={manifest} value={block.intro} onChange={set("intro")} className="cms-block__intro" placeholder="Intro" elementPath={{ blockIndex: idx, field: "intro" }} />
      <dl className="cms-block__statsGrid">
        {items.map((item, i) => (
          <div key={item.id ?? i} className="cms-block__stat">
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
            <RtSlot as="div" variant="block" manifest={manifest} value={item.description} onChange={setArrayItemField(block, onUpdate, "items", i, "description")} className="cms-block__statDescription" placeholder="Description" elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "description" }} />
          </div>
        ))}
      </dl>
    </section>
  )
}

export const LogoCloudCanvas: React.FC<CanvasBlockRendererProps> = ({ block, isActive, tenantRendererKey, manifest, onActivate, onUpdate, tenantId, sectionChromeProps }) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const logos: any[] = block.logos ?? []
  const sectionProps = generationSectionProps(block, isActive, tenantRendererKey, onActivate, `cms-block cms-block--logoCloud ${canvasSourceVariantClassName(block, tenantRendererKey)}`.trim(), sectionChromeProps)

  return (
    <section {...sectionProps}>
      <RtSlot as="h2" variant="inline" manifest={manifest} value={block.title} onChange={set("title")} className="cms-block__title" placeholder="Logo cloud title" elementPath={{ blockIndex: idx, field: "title" }} />
      <RtSlot as="div" variant="block" manifest={manifest} value={block.intro} onChange={set("intro")} className="cms-block__intro" placeholder="Intro" elementPath={{ blockIndex: idx, field: "intro" }} />
      <ul className="cms-block__logoCloudList">
        {logos.map((logo, i) => (
          <li key={logo.id ?? i} className="cms-block__logoCloudItem">
            <InlineImage value={logo.image} onChange={setArrayItemField(block, onUpdate, "logos", i, "image")} tenantId={tenantId ?? undefined} chrome="overlay" elementPath={{ blockIndex: idx, field: "logos", itemIndex: i, subField: "image" }} />
            <span>{logo.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export const GalleryCanvas: React.FC<CanvasBlockRendererProps> = ({ block, isActive, tenantRendererKey, manifest, onActivate, onUpdate, tenantId, sectionChromeProps }) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const images: any[] = block.images ?? []
  const sectionProps = generationSectionProps(block, isActive, tenantRendererKey, onActivate, `cms-block cms-block--gallery ${canvasSourceVariantClassName(block, tenantRendererKey)}`.trim(), sectionChromeProps)

  return (
    <section {...sectionProps}>
      <RtSlot as="h2" variant="inline" manifest={manifest} value={block.title} onChange={set("title")} className="cms-block__title" placeholder="Gallery title" elementPath={{ blockIndex: idx, field: "title" }} />
      <RtSlot as="div" variant="block" manifest={manifest} value={block.intro} onChange={set("intro")} className="cms-block__intro" placeholder="Intro" elementPath={{ blockIndex: idx, field: "intro" }} />
      <div className="cms-block__galleryGrid">
        {images.map((item, i) => (
          <figure key={item.id ?? i} className="cms-block__galleryItem">
            <InlineImage value={item.image} onChange={setArrayItemField(block, onUpdate, "images", i, "image")} tenantId={tenantId ?? undefined} chrome="overlay" elementPath={{ blockIndex: idx, field: "images", itemIndex: i, subField: "image" }} />
            <RtSlot as="figcaption" variant="block" manifest={manifest} value={item.caption} onChange={setArrayItemField(block, onUpdate, "images", i, "caption")} className="cms-block__galleryCaption" placeholder="Caption" elementPath={{ blockIndex: idx, field: "images", itemIndex: i, subField: "caption" }} />
          </figure>
        ))}
      </div>
      <InlineCtaButton value={block.cta} onChange={set("cta")} className="cms-block__galleryCta" emptyLabel="Gallery action" elementPath={{ blockIndex: idx, field: "cta" }} />
    </section>
  )
}

export const TeamCanvas: React.FC<CanvasBlockRendererProps> = ({ block, isActive, tenantRendererKey, manifest, onActivate, onUpdate, tenantId, sectionChromeProps }) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const members: any[] = block.members ?? []
  const sectionProps = generationSectionProps(block, isActive, tenantRendererKey, onActivate, `cms-block cms-block--team ${canvasSourceVariantClassName(block, tenantRendererKey)}`.trim(), sectionChromeProps)

  return (
    <section {...sectionProps}>
      <RtSlot as="h2" variant="inline" manifest={manifest} value={block.title} onChange={set("title")} className="cms-block__title" placeholder="Team title" elementPath={{ blockIndex: idx, field: "title" }} />
      <RtSlot as="div" variant="block" manifest={manifest} value={block.intro} onChange={set("intro")} className="cms-block__intro" placeholder="Intro" elementPath={{ blockIndex: idx, field: "intro" }} />
      <div className="cms-block__teamGrid">
        {members.map((member, i) => (
          <article key={member.id ?? i} className="cms-block__teamMember">
            <InlineImage value={member.image} onChange={setArrayItemField(block, onUpdate, "members", i, "image")} tenantId={tenantId ?? undefined} chrome="overlay" elementPath={{ blockIndex: idx, field: "members", itemIndex: i, subField: "image" }} />
            <h3>{member.name}</h3>
            {member.role ? <p className="cms-block__teamRole">{member.role}</p> : null}
            <RtSlot as="div" variant="block" manifest={manifest} value={member.bio} onChange={setArrayItemField(block, onUpdate, "members", i, "bio")} className="cms-block__teamBio" placeholder="Bio" elementPath={{ blockIndex: idx, field: "members", itemIndex: i, subField: "bio" }} />
          </article>
        ))}
      </div>
    </section>
  )
}

export const BlogCardsCanvas: React.FC<CanvasBlockRendererProps> = ({ block, isActive, tenantRendererKey, manifest, onActivate, onUpdate, tenantId, sectionChromeProps }) => {
  const set = setField(block, onUpdate)
  const idx = block.__index as number
  const posts: any[] = block.posts ?? []
  const sectionProps = generationSectionProps(block, isActive, tenantRendererKey, onActivate, `cms-block cms-block--blogCards ${canvasSourceVariantClassName(block, tenantRendererKey)}`.trim(), sectionChromeProps)

  return (
    <section {...sectionProps}>
      <RtSlot as="h2" variant="inline" manifest={manifest} value={block.title} onChange={set("title")} className="cms-block__title" placeholder="Posts title" elementPath={{ blockIndex: idx, field: "title" }} />
      <RtSlot as="div" variant="block" manifest={manifest} value={block.intro} onChange={set("intro")} className="cms-block__intro" placeholder="Intro" elementPath={{ blockIndex: idx, field: "intro" }} />
      <div className="cms-block__blogGrid">
        {posts.map((post, i) => (
          <article key={post.id ?? i} className="cms-block__blogCard">
            <InlineImage value={post.image} onChange={setArrayItemField(block, onUpdate, "posts", i, "image")} tenantId={tenantId ?? undefined} chrome="overlay" elementPath={{ blockIndex: idx, field: "posts", itemIndex: i, subField: "image" }} />
            <RtSlot as="h3" variant="inline" manifest={manifest} value={post.title} onChange={setArrayItemField(block, onUpdate, "posts", i, "title")} className="cms-block__blogTitle" placeholder="Post title" elementPath={{ blockIndex: idx, field: "posts", itemIndex: i, subField: "title" }} />
            <RtSlot as="div" variant="block" manifest={manifest} value={post.excerpt} onChange={setArrayItemField(block, onUpdate, "posts", i, "excerpt")} className="cms-block__blogExcerpt" placeholder="Excerpt" elementPath={{ blockIndex: idx, field: "posts", itemIndex: i, subField: "excerpt" }} />
            <InlineCtaButton value={post.cta ?? { label: "Read more", href: post.href }} onChange={setArrayItemField(block, onUpdate, "posts", i, "cta")} className="cms-block__blogCta" emptyLabel="Post action" elementPath={{ blockIndex: idx, field: "posts", itemIndex: i, subField: "cta" }} />
          </article>
        ))}
      </div>
    </section>
  )
}
