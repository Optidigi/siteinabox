import * as React from "react"
import type { CTABlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, resolveBlockVariant, runtimeVariantDataAttribute, type BlockVariantResolveContext } from "./variants"

function fallbackPresentationVariantFor(href: string | null | undefined): "contact" | "quote" {
  if (href?.startsWith("mailto:") || href?.startsWith("tel:")) return "contact"
  return "quote"
}

function presentationVariantFor(block: CTABlock, href: string | null | undefined, context?: BlockVariantResolveContext): "contact" | "quote" {
  const variant = resolveBlockVariant(block, context).variant
  if (variant === "quote" || variant === "tailblocksCtaA") return "quote"
  return fallbackPresentationVariantFor(href)
}

export function CTABlockRenderer({ block, options }: { block: CTABlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  const primaryLabel = block.primary?.label?.trim()
  const primaryHref = block.primary?.href?.trim()
  const secondaryLabel = block.secondary?.label?.trim()
  const secondaryHref = block.secondary?.href?.trim()
  const variant = presentationVariantFor(block, primaryHref, options.variantContext)
  const background = resolveMedia(block.backgroundImage ?? null, options.mediaResolver)
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const sectionId = renderSlot
    ? resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface })
    : block.anchor || undefined
  const sectionProps = mergeRendererSectionProps(
    {
      id: sectionId,
      className: cx("cms-block cms-block--cta", `cms-block--cta-${variant}`, sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "cta", options.index),
    },
    options.sectionProps,
  )
  const eyebrow = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.eyebrow,
      path: { blockIndex: options.index, field: "eyebrow" },
      variant: "inline",
      as: "div",
      className: cx("cms-block__eyebrow", nativeBlockClassName(block, "eyebrow", options.variantContext)),
      placeholder: "Eyebrow",
      blockMode: "inline",
      style: { fontFamily: "var(--font-script)" },
    })
    : block.eyebrow ? (
      <div className={cx("cms-block__eyebrow", nativeBlockClassName(block, "eyebrow", options.variantContext))} style={{ fontFamily: "var(--font-script)" }}>
        <RichTextRenderer value={block.eyebrow} />
      </div>
    ) : null
  const headline = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.headline,
      path: { blockIndex: options.index, field: "headline" },
      variant: "inline",
      as: "h2",
      className: cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext)),
      placeholder: "Headline",
      blockMode: "inline",
      style: { fontFamily: "var(--font-heading)" },
    })
    : (
      <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext))} style={{ fontFamily: "var(--font-heading)" }}>
        <RichTextRenderer value={block.headline} />
      </h2>
    )
  const description = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.description,
      path: { blockIndex: options.index, field: "description" },
      variant: "block",
      as: "div",
      className: cx("cms-block__description", nativeBlockClassName(block, "description", options.variantContext)),
      placeholder: "Description",
      style: { fontFamily: "var(--font-text)" },
    })
    : block.description ? (
      <div className={cx("cms-block__description", nativeBlockClassName(block, "description", options.variantContext))} style={{ fontFamily: "var(--font-text)" }}>
        <RichTextRenderer value={block.description} />
      </div>
    ) : null
  const backgroundImage = renderSlot
    ? renderSlot({
      kind: "image",
      value: block.backgroundImage,
      path: { blockIndex: options.index, field: "backgroundImage" },
      className: "cms-block__background-image",
      alt: "",
      loading: "lazy",
    })
    : background ? (
      <img
        aria-hidden="true"
        className="cms-block__background-image"
        src={background.src}
        alt=""
        loading="lazy"
        decoding="async"
      />
    ) : null
  const primaryCta = renderSlot
    ? renderSlot({
      kind: "cta",
      value: block.primary,
      path: { blockIndex: options.index, field: "primary" },
      className: cx("cms-block__cta cms-block__cta--primary", nativeBlockClassName(block, "ctaPrimary", options.variantContext), nativeBlockClassName(block, "cta", options.variantContext)),
      emptyLabel: variant === "contact" ? "Add contact link" : "Add primary CTA",
      actionName: "primary",
      style: { borderRadius: "var(--radius-md)" },
    })
    : primaryLabel && primaryHref ? (
      <a
        className={cx("cms-block__cta cms-block__cta--primary", nativeBlockClassName(block, "ctaPrimary", options.variantContext), nativeBlockClassName(block, "cta", options.variantContext))}
        href={primaryHref}
        style={{ borderRadius: "var(--radius-md)" }}
        {...actionAnalyticsAttrs("primary", primaryLabel)}
      >
        {primaryLabel}
      </a>
    ) : null
  const secondaryCta = renderSlot
    ? renderSlot({
      kind: "cta",
      value: block.secondary,
      path: { blockIndex: options.index, field: "secondary" },
      className: cx("cms-block__cta cms-block__cta--secondary", nativeBlockClassName(block, "ctaSecondary", options.variantContext)),
      emptyLabel: "Add secondary CTA",
      actionName: "secondary",
      style: { borderRadius: "var(--radius-md)" },
    })
    : secondaryLabel && secondaryHref ? (
      <a
        className={cx("cms-block__cta cms-block__cta--secondary", nativeBlockClassName(block, "ctaSecondary", options.variantContext))}
        href={secondaryHref}
        style={{ borderRadius: "var(--radius-md)" }}
        {...actionAnalyticsAttrs("secondary", secondaryLabel)}
      >
        {secondaryLabel}
      </a>
    ) : null

  return (
    <section {...sectionProps}>
      {eyebrow}
      {headline}
      {description}
      {backgroundImage}
      <div className={cx("cms-block__cta-actions", nativeBlockClassName(block, "actions", options.variantContext))}>
        {primaryCta}
        {secondaryCta}
      </div>
    </section>
  )
}
