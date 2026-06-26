import * as React from "react"
import type { HeroBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"

export function HeroBlockRenderer({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const image = resolveMedia(block.image ?? null, options.mediaResolver)
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()
  const sourceVariant =
    block.analytics?.sectionVariant === "tailwind-plus-simple-centered"
      ? "cms-block--source-tailwind-plus-simple-centered"
      : ""

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--hero ${sourceVariant}`.trim()}
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "hero", options.index)}
    >
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
      {block.pills && block.pills.length > 0 && (
        <ul className="cms-block__pills">
          {block.pills.map((pill, i) => (
            <li key={pill.id ?? i} className="cms-block__pill" style={{ borderRadius: "var(--radius-sm)" }}>
              {pill.label}
            </li>
          ))}
        </ul>
      )}
      {ctaLabel && ctaHref && (
        <a
          className="cms-block__cta"
          href={ctaHref}
          style={{ borderRadius: "var(--radius-md)" }}
          {...actionAnalyticsAttrs("primary", ctaLabel)}
        >
          {ctaLabel}
        </a>
      )}
      {image && (
        <figure className="cms-block__image" style={{ borderRadius: "var(--radius-lg)" }}>
          <img src={image.src} alt={image.alt ?? ""} loading="eager" decoding="async" />
        </figure>
      )}
    </section>
  )
}
