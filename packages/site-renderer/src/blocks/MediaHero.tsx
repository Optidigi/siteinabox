import * as React from "react"
import type { MediaHeroBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"

const minHeightClassNames: Record<NonNullable<MediaHeroBlock["minHeight"]>, string> = {
  compact: "cms-block--mediaHero-compact",
  standard: "cms-block--mediaHero-standard",
  tall: "cms-block--mediaHero-tall",
  viewport: "cms-block--mediaHero-viewport",
}

export function MediaHeroBlockRenderer({ block, options }: { block: MediaHeroBlock; options: BlockRenderOptions }) {
  const background = resolveMedia(block.backgroundImage, options.mediaResolver)
  const foreground = resolveMedia(block.foregroundImage ?? null, options.mediaResolver)
  const overlayOpacity = Math.max(0, Math.min(1, block.overlay?.opacity ?? 0.48))
  const minHeight = block.minHeight ? minHeightClassNames[block.minHeight] : minHeightClassNames.standard
  const align = block.contentAlign ?? "left"
  const width = block.contentWidth ?? "narrow"

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--mediaHero ${minHeight} cms-block--mediaHero-align-${align} cms-block--mediaHero-width-${width}`.trim()}
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      data-shape-top={block.shapeDividers?.top || undefined}
      data-shape-bottom={block.shapeDividers?.bottom || undefined}
      style={{
        "--media-hero-overlay": block.overlay?.color ?? "#111827",
        "--media-hero-overlay-opacity": overlayOpacity,
      } as React.CSSProperties}
      {...sectionAnalyticsAttrs(block.analytics, "mediaHero", options.index)}
    >
      {background && (
        <img
          className="cms-block__mediaHero-bg"
          src={background.src}
          alt=""
          loading={block.priority ? "eager" : "lazy"}
          decoding="async"
        />
      )}
      <div className="cms-block__mediaHero-scrim" aria-hidden="true" />
      <div className="cms-block__mediaHero-content">
        {block.eyebrow && (
          <div className="cms-block__eyebrow">
            <RichTextRenderer value={block.eyebrow} />
          </div>
        )}
        <h1 className="cms-block__title" style={{ fontFamily: "var(--font-title)" }}>
          <RichTextRenderer value={block.headline} />
        </h1>
        {block.subheadline && (
          <div className="cms-block__subheadline" style={{ fontFamily: "var(--font-text)" }}>
            <RichTextRenderer value={block.subheadline} />
          </div>
        )}
        {(block.cta?.href || block.secondary?.href) && (
          <div className="cms-block__actions">
            {block.cta?.href && block.cta.label && (
              <a className="cms-block__primary" href={block.cta.href} {...actionAnalyticsAttrs("primary", block.cta.label)}>
                {block.cta.label}
              </a>
            )}
            {block.secondary?.href && block.secondary.label && (
              <a
                className="cms-block__secondary cms-block__secondary--ghost"
                href={block.secondary.href}
                {...actionAnalyticsAttrs("secondary", block.secondary.label)}
              >
                {block.secondary.label}
              </a>
            )}
          </div>
        )}
      </div>
      {foreground && (
        <figure className="cms-block__mediaHero-foreground">
          <img src={foreground.src} alt={foreground.alt ?? ""} loading="lazy" decoding="async" />
        </figure>
      )}
    </section>
  )
}
