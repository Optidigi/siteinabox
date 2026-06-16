import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, MediaRef, RtRoot } from "../../lib/types"

/**
 * CTA block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/CTA.ts.
 *
 * Variant dispatch on primary.href prefix:
 *   - mailto: / tel: → cms-block--cta-contact
 *   - anything else → cms-block--cta-quote
 * Both share the cms-block--cta base class for shared styling.
 */
export type CTAProps = {
  anchor?: string | null
  eyebrow?: RtRoot | null
  headline: RtRoot
  description?: RtRoot | null
  primary?: { label?: string | null; href?: string | null } | null
  secondary?: { label?: string | null; href?: string | null } | null
  backgroundImage?: MediaRef
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

const mediaUrl = (value: MediaRef | undefined): string | null => {
  if (!value) return null
  if (typeof value === "string") return value
  if (typeof value === "number") return null
  if (value.filename) return `/media/${value.filename}`
  if (value.url) return value.url
  return null
}

function variantFor(href: string | null | undefined): "contact" | "quote" {
  if (href?.startsWith("mailto:") || href?.startsWith("tel:")) return "contact"
  return "quote"
}

export default function CTA(props: CTAProps) {
  const { anchor, eyebrow, headline, description, primary, secondary, backgroundImage, dataBlockIndex, analytics } = props
  const primaryLabel = primary?.label?.trim()
  const primaryHref = primary?.href?.trim()
  const showPrimary = primaryLabel && primaryHref
  const variant = variantFor(primaryHref)
  const secondaryLabel = secondary?.label?.trim()
  const secondaryHref = secondary?.href?.trim()
  const showSecondary = secondaryLabel && secondaryHref
  const backgroundImageUrl = mediaUrl(backgroundImage)
  return (
    <BlockErrorBoundary blockType="cta">
      <section
        id={anchor || undefined}
        class={`cms-block cms-block--cta cms-block--cta-${variant}`}
        data-block-index={dataBlockIndex}
        {...sectionAnalyticsAttrs(analytics, "cta", dataBlockIndex)}
      >
        {eyebrow && (
          <div class="cms-block__eyebrow" style={{ fontFamily: "var(--font-script)" }}>
            <RtNodeRenderer node={eyebrow} />
          </div>
        )}
        <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
          <RtNodeRenderer node={headline} />
        </h2>
        {description && (
          <div class="cms-block__description" style={{ fontFamily: "var(--font-text)" }}>
            <RtNodeRenderer node={description} />
          </div>
        )}
        {backgroundImageUrl && (
          <img
            aria-hidden="true"
            class="cms-block__background-image"
            src={backgroundImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
        <div class="cms-block__cta-actions">
          {showPrimary && (
            <a
              class="cms-block__cta cms-block__cta--primary"
              href={primaryHref}
              style={{ borderRadius: "var(--radius-md)" }}
              {...actionAnalyticsAttrs("primary", primaryLabel)}
            >
              {primaryLabel}
            </a>
          )}
          {showSecondary && (
            <a
              class="cms-block__cta cms-block__cta--secondary"
              href={secondaryHref}
              style={{ borderRadius: "var(--radius-md)" }}
              {...actionAnalyticsAttrs("secondary", secondaryLabel)}
            >
              {secondaryLabel}
            </a>
          )}
        </div>
      </section>
    </BlockErrorBoundary>
  )
}
