import * as React from "react"
import type { CTABlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
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

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--cta", `cms-block--cta-${variant}`, sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "cta", options.index)}
    >
      {block.eyebrow && (
        <div className={cx("cms-block__eyebrow", nativeBlockClassName(block, "eyebrow"))} style={{ fontFamily: "var(--font-script)" }}>
          <RichTextRenderer value={block.eyebrow} />
        </div>
      )}
      <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
        <RichTextRenderer value={block.headline} />
      </h2>
      {block.description && (
        <div className={cx("cms-block__description", nativeBlockClassName(block, "description"))} style={{ fontFamily: "var(--font-text)" }}>
          <RichTextRenderer value={block.description} />
        </div>
      )}
      {background && (
        <img
          aria-hidden="true"
          className="cms-block__background-image"
          src={background.src}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      <div className={cx("cms-block__cta-actions", nativeBlockClassName(block, "actions"))}>
        {primaryLabel && primaryHref && (
          <a
            className={cx("cms-block__cta cms-block__cta--primary", nativeBlockClassName(block, "ctaPrimary"), nativeBlockClassName(block, "cta"))}
            href={primaryHref}
            style={{ borderRadius: "var(--radius-md)" }}
            {...actionAnalyticsAttrs("primary", primaryLabel)}
          >
            {primaryLabel}
          </a>
        )}
        {secondaryLabel && secondaryHref && (
          <a
            className={cx("cms-block__cta cms-block__cta--secondary", nativeBlockClassName(block, "ctaSecondary"))}
            href={secondaryHref}
            style={{ borderRadius: "var(--radius-md)" }}
            {...actionAnalyticsAttrs("secondary", secondaryLabel)}
          >
            {secondaryLabel}
          </a>
        )}
      </div>
    </section>
  )
}
