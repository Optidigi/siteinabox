import * as React from "react"
import type { PricingBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function PricingBlockRenderer({ block, options }: { block: PricingBlock; options: BlockRenderOptions }) {
  if (!block.plans.length) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--pricing", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "pricing", options.index)}
    >
      <div className={cx("cms-block__pricingHeader", nativeBlockClassName(block, "header"))}>
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
      <div className={cx("cms-block__pricingPlans", nativeBlockClassName(block, "grid"))}>
        {block.plans.map((plan, i) => {
          const ctaLabel = plan.cta?.label?.trim()
          const ctaHref = plan.cta?.href?.trim()
          return (
            <article key={i} className={cx("cms-block__pricingPlan", nativeBlockClassName(block, "card"))} data-highlighted={plan.highlighted ? "true" : undefined}>
              {plan.badge && <p className="cms-block__pricingBadge">{plan.badge}</p>}
              <h3 className="cms-block__pricingTitle" style={{ fontFamily: "var(--font-heading)" }}>
                <RichTextRenderer value={plan.title} blockMode="inline" />
              </h3>
              {(plan.price || plan.period) && (
                <p className="cms-block__pricingPrice">
                  {plan.price && <span>{plan.price}</span>}
                  {plan.period && <small>{plan.period}</small>}
                </p>
              )}
              {plan.description && (
                <div className="cms-block__pricingDescription" style={{ fontFamily: "var(--font-text)" }}>
                  <RichTextRenderer value={plan.description} />
                </div>
              )}
              {plan.features && plan.features.length > 0 && (
                <ul className="cms-block__pricingFeatures">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} data-included={feature.included === false ? "false" : "true"}>
                      <span aria-hidden="true">{feature.included === false ? "x" : "+"}</span>
                      <RichTextRenderer value={feature.label} blockMode="inline" />
                    </li>
                  ))}
                </ul>
              )}
              {ctaLabel && ctaHref && (
                <a className={cx("cms-block__pricingCta", nativeBlockClassName(block, "cta"))} href={ctaHref} {...actionAnalyticsAttrs("primary", ctaLabel)}>
                  {ctaLabel}
                </a>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
