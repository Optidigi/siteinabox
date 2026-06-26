import * as React from "react"
import type { CTABlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"

function variantFor(href: string | null | undefined): "contact" | "quote" {
  if (href?.startsWith("mailto:") || href?.startsWith("tel:")) return "contact"
  return "quote"
}

export function CTABlockRenderer({ block, options }: { block: CTABlock; options: BlockRenderOptions }) {
  const primaryLabel = block.primary?.label?.trim()
  const primaryHref = block.primary?.href?.trim()
  const secondaryLabel = block.secondary?.label?.trim()
  const secondaryHref = block.secondary?.href?.trim()
  const variant = variantFor(primaryHref)
  const background = resolveMedia(block.backgroundImage ?? null, options.mediaResolver)
  const sourceVariant = block.analytics?.sectionVariant === "tailblocks-cta-a" ? "cms-block--source-tailblocks-cta-a" : ""

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--cta cms-block--cta-${variant} ${sourceVariant}`.trim()}
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "cta", options.index)}
    >
      {block.eyebrow && (
        <div className="cms-block__eyebrow" style={{ fontFamily: "var(--font-script)" }}>
          <RichTextRenderer value={block.eyebrow} />
        </div>
      )}
      <h2 className="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
        <RichTextRenderer value={block.headline} />
      </h2>
      {block.description && (
        <div className="cms-block__description" style={{ fontFamily: "var(--font-text)" }}>
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
      <div className="cms-block__cta-actions">
        {primaryLabel && primaryHref && (
          <a
            className="cms-block__cta cms-block__cta--primary"
            href={primaryHref}
            style={{ borderRadius: "var(--radius-md)" }}
            {...actionAnalyticsAttrs("primary", primaryLabel)}
          >
            {primaryLabel}
          </a>
        )}
        {secondaryLabel && secondaryHref && (
          <a
            className="cms-block__cta cms-block__cta--secondary"
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
