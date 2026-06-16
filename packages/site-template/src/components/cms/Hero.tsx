import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import SmoothImage from "./SmoothImage"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, RtRoot } from "../../lib/types"

/**
 * Hero block renderer (Preact). Structure-only — no Tailwind decoration.
 * Themes layer all visual styling via tenant-theme.css.
 *
 * Props mirror siab-payload/src/blocks/Hero.ts. Image upload is resolved
 * to a URL by the dispatcher (PreviewIsland today; Blocks.astro after
 * CMS-ification) — renderer receives imageUrl, not an upload ref.
 */
export type HeroProps = {
  anchor?: string | null
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  pills?: Array<{ label: string; id?: string | null }>
  cta?: { label?: string | null; href?: string | null } | null
  imageUrl?: string | null
  imageAlt?: string | null
  dataBlockIndex?: number  // PreviewIsland-only; absent in production
  analytics?: AnalyticsBlockMetadata | null
}

export default function Hero(props: HeroProps) {
  const { anchor, eyebrow, headline, subheadline, pills, cta, imageUrl, imageAlt, dataBlockIndex, analytics } = props
  const ctaLabel = cta?.label?.trim()
  const ctaHref = cta?.href?.trim()
  const showCta = ctaLabel && ctaHref
  return (
    <BlockErrorBoundary blockType="hero">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--hero"
        data-block-index={dataBlockIndex}
        {...sectionAnalyticsAttrs(analytics, "hero", dataBlockIndex)}
      >
        {eyebrow && (
          <div class="cms-block__eyebrow">
            <RtNodeRenderer node={eyebrow} />
          </div>
        )}
        <h1 class="cms-block__title" style={{ fontFamily: "var(--font-title)" }}>
          <RtNodeRenderer node={headline} />
        </h1>
        {subheadline && (
          <div class="cms-block__subheadline" style={{ fontFamily: "var(--font-text)" }}>
            <RtNodeRenderer node={subheadline} />
          </div>
        )}
        {pills && pills.length > 0 && (
          <ul class="cms-block__pills">
            {pills.map((p, i) => (
              <li
                key={p.id ?? i}
                class="cms-block__pill"
                style={{ borderRadius: "var(--radius-sm)" }}
              >
                {p.label}
              </li>
            ))}
          </ul>
        )}
        {showCta && (
          <a
            class="cms-block__cta"
            href={ctaHref}
            style={{ borderRadius: "var(--radius-md)" }}
            {...actionAnalyticsAttrs("primary", ctaLabel)}
          >
            {ctaLabel}
          </a>
        )}
        {imageUrl && (
          <figure class="cms-block__image" style={{ borderRadius: "var(--radius-lg)" }}>
            <SmoothImage src={imageUrl} alt={imageAlt ?? ""} />
          </figure>
        )}
      </section>
    </BlockErrorBoundary>
  )
}
