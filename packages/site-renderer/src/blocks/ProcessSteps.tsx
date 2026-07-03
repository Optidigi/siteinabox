import * as React from "react"
import type { ProcessStepsBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveIcon } from "./icons"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function ProcessStepsBlockRenderer({ block, options }: { block: ProcessStepsBlock; options: BlockRenderOptions }) {
  if (!block.steps.length) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--processSteps", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "processSteps", options.index)}
    >
      {(block.title || block.intro) && (
        <div className={cx("cms-block__stepsHeader", nativeBlockClassName(block, "header"))}>
          {block.title && (
            <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
              <RichTextRenderer value={block.title} blockMode="inline" />
            </h2>
          )}
          {block.intro && (
            <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro"))} style={{ fontFamily: "var(--font-text)" }}>
              <RichTextRenderer value={block.intro} />
            </div>
          )}
        </div>
      )}
      <ol className={cx("cms-block__stepsList", nativeBlockClassName(block, "list"))}>
        {block.steps.map((step, i) => {
          const Icon = resolveIcon(step.icon)
          const image = resolveMedia(step.image ?? null, options.mediaResolver)
          const ctaLabel = step.cta?.label?.trim()
          const ctaHref = step.cta?.href?.trim()
          return (
            <li key={i} className={cx("cms-block__step", nativeBlockClassName(block, "item"))}>
              <span className={cx("cms-block__stepMarker", nativeBlockClassName(block, "marker"))} aria-hidden="true">
                {image ? <img src={image.src} alt="" loading="lazy" decoding="async" /> : Icon ? <Icon /> : i + 1}
              </span>
              <div>
                <h3>
                  <RichTextRenderer value={step.title} blockMode="inline" />
                </h3>
                {step.description && (
                  <div className="cms-block__stepDescription">
                    <RichTextRenderer value={step.description} />
                  </div>
                )}
                {ctaLabel && ctaHref && (
                  <a className="cms-block__stepCta" href={ctaHref} {...actionAnalyticsAttrs("inline", ctaLabel)}>
                    {ctaLabel}
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
