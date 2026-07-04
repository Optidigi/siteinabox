import * as React from "react"
import type { CTABlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import { mergeRendererSectionAttributes } from "./section-attributes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, resolveBlockVariant, runtimeVariantDataAttribute } from "./variants"

function fallbackPresentationVariantFor(href: string | null | undefined): "contact" | "quote" {
  if (href?.startsWith("mailto:") || href?.startsWith("tel:")) return "contact"
  return "quote"
}

function presentationVariantFor(block: CTABlock, href: string | null | undefined): "contact" | "quote" {
  const variant = resolveBlockVariant(block).variant
  if (variant === "quote" || variant === "tailblocksCtaA" || variant === "amicareQuoteContact") return "quote"
  return fallbackPresentationVariantFor(href)
}

export function CTABlockRenderer({ block, options }: { block: CTABlock; options: BlockRenderOptions }) {
  const primaryLabel = block.primary?.label?.trim()
  const primaryHref = block.primary?.href?.trim()
  const secondaryLabel = block.secondary?.label?.trim()
  const secondaryHref = block.secondary?.href?.trim()
  const variant = presentationVariantFor(block, primaryHref)
  const background = resolveMedia(block.backgroundImage ?? null, options.mediaResolver)
  const sourceVariant = rendererVariantClassName(block)
  const slots = options.editSlots
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: cx("cms-block cms-block--cta", `cms-block--cta-${variant}`, sourceVariant, nativeBlockClassName(block, "section")),
      "data-source-variant": runtimeVariantDataAttribute(block),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "cta", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      {(block.eyebrow || slots?.renderRichText) && (
        <div className={cx("cms-block__eyebrow", nativeBlockClassName(block, "eyebrow"))} style={{ fontFamily: "var(--font-script)" }}>
          {slots?.renderRichText
            ? slots.renderRichText({
              name: "cta.eyebrow",
              value: block.eyebrow,
              variant: "block",
              elementPath: { blockIndex: options.index, field: "eyebrow" },
            })
            : <RichTextRenderer value={block.eyebrow} />}
        </div>
      )}
      <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
        {slots?.renderRichText
          ? slots.renderRichText({
            name: "cta.headline",
            value: block.headline,
            variant: "inline",
            elementPath: { blockIndex: options.index, field: "headline" },
          })
          : <RichTextRenderer value={block.headline} />}
      </h2>
      {(block.description || slots?.renderRichText) && (
        <div className={cx("cms-block__description", nativeBlockClassName(block, "description"))} style={{ fontFamily: "var(--font-text)" }}>
          {slots?.renderRichText
            ? slots.renderRichText({
              name: "cta.description",
              value: block.description,
              variant: "block",
              elementPath: { blockIndex: options.index, field: "description" },
            })
            : <RichTextRenderer value={block.description} />}
        </div>
      )}
      {(background || slots?.renderImage) && (
        slots?.renderImage
          ? slots.renderImage({
            name: "cta.backgroundImage",
            value: block.backgroundImage,
            alt: "",
            className: "cms-block__background-image",
            loading: "lazy",
            decoding: "async",
            chrome: "overlay",
            elementPath: { blockIndex: options.index, field: "backgroundImage" },
          })
          : <img
            aria-hidden="true"
            className="cms-block__background-image"
            src={background!.src}
            alt=""
            loading="lazy"
            decoding="async"
          />
      )}
      <div className={cx("cms-block__cta-actions", nativeBlockClassName(block, "actions"))}>
        {((primaryLabel && primaryHref) || slots?.renderCta) && (
          slots?.renderCta
            ? slots.renderCta({
              name: "cta.primary",
              value: block.primary,
              className: cx("cms-block__cta cms-block__cta--primary", nativeBlockClassName(block, "ctaPrimary"), nativeBlockClassName(block, "cta")),
              style: { borderRadius: "var(--radius-md)" },
              actionAttributes: actionAnalyticsAttrs("primary", primaryLabel),
              elementPath: { blockIndex: options.index, field: "primary" },
            })
            : (
              <a
                className={cx("cms-block__cta cms-block__cta--primary", nativeBlockClassName(block, "ctaPrimary"), nativeBlockClassName(block, "cta"))}
                href={primaryHref}
                style={{ borderRadius: "var(--radius-md)" }}
                {...actionAnalyticsAttrs("primary", primaryLabel)}
              >
                {primaryLabel}
              </a>
            )
        )}
        {((secondaryLabel && secondaryHref) || slots?.renderCta) && (
          slots?.renderCta
            ? slots.renderCta({
              name: "cta.secondary",
              value: block.secondary,
              className: cx("cms-block__cta cms-block__cta--secondary", nativeBlockClassName(block, "ctaSecondary")),
              style: { borderRadius: "var(--radius-md)" },
              actionAttributes: actionAnalyticsAttrs("secondary", secondaryLabel),
              elementPath: { blockIndex: options.index, field: "secondary" },
            })
            : (
              <a
                className={cx("cms-block__cta cms-block__cta--secondary", nativeBlockClassName(block, "ctaSecondary"))}
                href={secondaryHref}
                style={{ borderRadius: "var(--radius-md)" }}
                {...actionAnalyticsAttrs("secondary", secondaryLabel)}
              >
                {secondaryLabel}
              </a>
            )
        )}
      </div>
    </section>
  )
}
