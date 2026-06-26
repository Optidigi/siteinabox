import * as React from "react"
import type { BeforeAfterGalleryBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"

export function BeforeAfterGalleryBlockRenderer({
  block,
  options,
}: {
  block: BeforeAfterGalleryBlock
  options: BlockRenderOptions
}) {
  if (!block.pairs.length) return null

  return (
    <section
      id={block.anchor || undefined}
      className="cms-block cms-block--beforeAfterGallery"
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "beforeAfterGallery", options.index)}
    >
      {block.title && (
        <h2 className="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
          <RichTextRenderer value={block.title} />
        </h2>
      )}
      {block.intro && (
        <div className="cms-block__intro" style={{ fontFamily: "var(--font-text)" }}>
          <RichTextRenderer value={block.intro} />
        </div>
      )}
      <div className="cms-block__comparisonGrid">
        {block.pairs.map((pair, i) => {
          const before = resolveMedia(pair.before, options.mediaResolver)
          const after = resolveMedia(pair.after, options.mediaResolver)
          if (!before || !after) return null
          const ratio = Math.max(5, Math.min(95, Math.round((pair.initialRatio ?? 0.5) * 100)))
          const orientation = pair.orientation ?? "horizontal"
          return (
            <figure
              key={i}
              className={`cms-block__comparison cms-block__comparison-${orientation}`}
              data-siab-before-after-pair="true"
              data-initial-ratio={ratio}
              data-orientation={orientation}
              style={{ "--comparison-ratio": `${ratio}%` } as React.CSSProperties}
            >
              <div className="cms-block__comparisonFrame">
                <img className="cms-block__comparisonImage" src={before.src} alt={before.alt ?? pair.beforeLabel ?? ""} loading="lazy" decoding="async" />
                <div className="cms-block__comparisonAfter" aria-hidden="true">
                  <img src={after.src} alt="" loading="lazy" decoding="async" />
                </div>
                <span className="cms-block__comparisonLabel cms-block__comparisonLabel-before">{pair.beforeLabel ?? "Before"}</span>
                <span className="cms-block__comparisonLabel cms-block__comparisonLabel-after">{pair.afterLabel ?? "After"}</span>
                <span className="cms-block__comparisonHandle" aria-hidden="true" />
              </div>
              {pair.caption && (
                <figcaption className="cms-block__comparisonCaption">
                  <RichTextRenderer value={pair.caption} />
                </figcaption>
              )}
            </figure>
          )
        })}
      </div>
    </section>
  )
}
