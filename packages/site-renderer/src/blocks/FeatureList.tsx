import * as React from "react"
import type { FeatureListBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { resolveIcon } from "./icons"
import type { BlockRenderOptions } from "./types"

export function FeatureListBlockRenderer({ block, options }: { block: FeatureListBlock; options: BlockRenderOptions }) {
  if (!block.features || block.features.length === 0) return null
  const sourceVariant =
    block.analytics?.sectionVariant === "tailwind-plus-centered-2x2"
      ? "cms-block--source-tailwind-plus-centered-2x2"
      : ""

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--featurelist ${sourceVariant}`.trim()}
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "featureList", options.index)}
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
      <ul className="cms-block__features">
        {block.features.map((feature, i) => {
          const Icon = resolveIcon(feature.icon)
          return (
            <li key={i} className="cms-block__feature" style={{ borderRadius: "var(--radius-lg)" }}>
              {Icon && (
                <span className="cms-block__feature-icon" aria-hidden="true">
                  <Icon />
                </span>
              )}
              <h3 className="cms-block__feature-title" style={{ fontFamily: "var(--font-heading)" }}>
                <RichTextRenderer value={feature.title} />
              </h3>
              {feature.description && (
                <div className="cms-block__feature-description" style={{ fontFamily: "var(--font-text)" }}>
                  <RichTextRenderer value={feature.description} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
