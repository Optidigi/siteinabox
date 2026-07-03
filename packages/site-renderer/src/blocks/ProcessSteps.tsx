import * as React from "react"
import type { ProcessStepsBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { resolveIcon } from "./icons"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function ProcessStepsBlockRenderer({ block, options }: { block: ProcessStepsBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  if ((!block.steps || block.steps.length === 0) && !renderSlot) return null
  const steps: ProcessStepsBlock["steps"] = block.steps && block.steps.length > 0
    ? block.steps
    : [{ title: undefined as any, description: undefined, icon: null, image: undefined as any, cta: null }]
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const sectionProps = mergeRendererSectionProps(
    {
      id: renderSlot
        ? resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface })
        : block.anchor || undefined,
      className: cx("cms-block cms-block--processSteps", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "processSteps", options.index),
    },
    options.sectionProps,
  )
  const title = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.title,
      path: { blockIndex: options.index, field: "title" },
      variant: "inline",
      as: "h2",
      className: cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext)),
      placeholder: "Process title",
      blockMode: "inline",
      style: { fontFamily: "var(--font-heading)" },
    })
    : block.title ? (
      <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext))} style={{ fontFamily: "var(--font-heading)" }}>
        <RichTextRenderer value={block.title} blockMode="inline" />
      </h2>
    ) : null
  const intro = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.intro,
      path: { blockIndex: options.index, field: "intro" },
      variant: "block",
      as: "div",
      className: cx("cms-block__intro", nativeBlockClassName(block, "intro", options.variantContext)),
      placeholder: "Intro",
      style: { fontFamily: "var(--font-text)" },
    })
    : block.intro ? (
      <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro", options.variantContext))} style={{ fontFamily: "var(--font-text)" }}>
        <RichTextRenderer value={block.intro} />
      </div>
    ) : null

  return (
    <section {...sectionProps}>
      {(renderSlot || block.title || block.intro) && (
        <div className={cx("cms-block__stepsHeader", nativeBlockClassName(block, "header", options.variantContext))}>
          {title}
          {intro}
        </div>
      )}
      <ol className={cx("cms-block__stepsList", nativeBlockClassName(block, "list", options.variantContext))}>
        {steps.map((step, i) => {
          const Icon = resolveIcon(step.icon)
          const image = resolveMedia(step.image ?? null, options.mediaResolver)
          const ctaLabel = step.cta?.label?.trim()
          const ctaHref = step.cta?.href?.trim()
          return (
            <li key={i} className={cx("cms-block__step", nativeBlockClassName(block, "item", options.variantContext))}>
              <span className={cx("cms-block__stepMarker", nativeBlockClassName(block, "marker", options.variantContext))} aria-hidden="true">
                {renderSlot
                  ? step.image
                    ? renderSlot({
                      kind: "image",
                      value: step.image,
                      path: { blockIndex: options.index, field: "steps", itemIndex: i, subField: "image" },
                      alt: "",
                    })
                    : renderSlot({
                      kind: "icon",
                      value: step.icon,
                      path: { blockIndex: options.index, field: "steps", itemIndex: i, subField: "icon" },
                    })
                  : image ? <img src={image.src} alt="" loading="lazy" decoding="async" /> : Icon ? <Icon /> : i + 1}
              </span>
              <div>
                {renderSlot ? (
                  renderSlot({
                    kind: "richtext",
                    value: step.title,
                    path: { blockIndex: options.index, field: "steps", itemIndex: i, subField: "title" },
                    variant: "inline",
                    as: "h3",
                    className: "cms-block__stepTitle",
                    placeholder: "Step title",
                    blockMode: "inline",
                  })
                ) : (
                  <h3>
                    <RichTextRenderer value={step.title} blockMode="inline" />
                  </h3>
                )}
                {renderSlot ? (
                  <div className="cms-block__stepDescription">
                    {renderSlot({
                      kind: "richtext",
                      value: step.description,
                      path: { blockIndex: options.index, field: "steps", itemIndex: i, subField: "description" },
                      variant: "block",
                      as: "div",
                      placeholder: "Step description",
                    })}
                  </div>
                ) : step.description && (
                  <div className="cms-block__stepDescription">
                    <RichTextRenderer value={step.description} />
                  </div>
                )}
                {renderSlot ? (
                  renderSlot({
                    kind: "cta",
                    value: step.cta,
                    path: { blockIndex: options.index, field: "steps", itemIndex: i, subField: "cta" },
                    className: "cms-block__stepCta",
                    emptyLabel: "Add CTA",
                    actionName: "inline",
                  })
                ) : ctaLabel && ctaHref && (
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
