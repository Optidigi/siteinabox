import * as React from "react"
import type { PricingBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function PricingBlockRenderer({ block, options }: { block: PricingBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  const isEditable = Boolean(renderSlot)
  if ((!block.plans || block.plans.length === 0) && !isEditable) return null
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const plans: PricingBlock["plans"] = block.plans && block.plans.length > 0
    ? block.plans
    : [{ title: undefined as any, description: undefined, price: null, period: null, features: [], cta: null, badge: null, highlighted: null }]
  const title = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.title,
      path: { blockIndex: options.index, field: "title" },
      variant: "inline",
      as: "h2",
      className: cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext)),
      placeholder: "Section title",
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
  const sectionProps = mergeRendererSectionProps(
    {
      id: resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface }),
      className: cx("cms-block cms-block--pricing", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "pricing", options.index),
    },
    options.sectionProps,
  )

  return (
    <section {...sectionProps}>
      <div className={cx("cms-block__pricingHeader", nativeBlockClassName(block, "header", options.variantContext))}>
        {title}
        {intro}
      </div>
      <div className={cx("cms-block__pricingPlans", nativeBlockClassName(block, "grid", options.variantContext))}>
        {plans.map((plan, i) => {
          const ctaLabel = plan.cta?.label?.trim()
          const ctaHref = plan.cta?.href?.trim()
          const features = renderSlot && (!plan.features || plan.features.length === 0)
            ? [{ label: undefined as any, included: true }]
            : plan.features
          return (
            <article key={i} className={cx("cms-block__pricingPlan", nativeBlockClassName(block, "card", options.variantContext))} data-highlighted={plan.highlighted ? "true" : undefined}>
              {(plan.badge || renderSlot) && (
                <p className="cms-block__pricingBadge">
                  {renderSlot
                    ? renderSlot({
                      kind: "text",
                      value: plan.badge,
                      path: { blockIndex: options.index, field: "plans", itemIndex: i, subField: "badge" },
                      placeholder: "Badge",
                    })
                    : plan.badge}
                </p>
              )}
              <h3 className="cms-block__pricingTitle" style={{ fontFamily: "var(--font-heading)" }}>
                {renderSlot
                  ? renderSlot({
                    kind: "richtext",
                    value: plan.title,
                    path: { blockIndex: options.index, field: "plans", itemIndex: i, subField: "title" },
                    variant: "inline",
                    as: "span",
                    placeholder: "Plan title",
                    blockMode: "inline",
                  })
                  : <RichTextRenderer value={plan.title} blockMode="inline" />}
              </h3>
              {(plan.price || plan.period || renderSlot) && (
                <p className="cms-block__pricingPrice">
                  {(plan.price || renderSlot) && (
                    <span>
                      {renderSlot
                        ? renderSlot({
                          kind: "text",
                          value: plan.price,
                          path: { blockIndex: options.index, field: "plans", itemIndex: i, subField: "price" },
                          placeholder: "Price",
                        })
                        : plan.price}
                    </span>
                  )}
                  {(plan.period || renderSlot) && (
                    <small>
                      {renderSlot
                        ? renderSlot({
                          kind: "text",
                          value: plan.period,
                          path: { blockIndex: options.index, field: "plans", itemIndex: i, subField: "period" },
                          placeholder: "Period",
                        })
                        : plan.period}
                    </small>
                  )}
                </p>
              )}
              {renderSlot ? (
                <div className="cms-block__pricingDescription" style={{ fontFamily: "var(--font-text)" }}>
                  {renderSlot({
                    kind: "richtext",
                    value: plan.description,
                    path: { blockIndex: options.index, field: "plans", itemIndex: i, subField: "description" },
                    variant: "block",
                    as: "div",
                    placeholder: "Plan description",
                  })}
                </div>
              ) : plan.description && (
                <div className="cms-block__pricingDescription" style={{ fontFamily: "var(--font-text)" }}>
                  <RichTextRenderer value={plan.description} />
                </div>
              )}
              {features && features.length > 0 && (
                <ul className="cms-block__pricingFeatures">
                  {features.map((feature, featureIndex) => (
                    <li key={featureIndex} data-included={feature.included === false ? "false" : "true"}>
                      <span aria-hidden="true">{feature.included === false ? "x" : "+"}</span>
                      {renderSlot
                        ? renderSlot({
                          kind: "richtext",
                          value: feature.label,
                          path: { blockIndex: options.index, field: "plans", itemIndex: i, subField: "features", subItemIndex: featureIndex, subSubField: "label" },
                          variant: "inline",
                          as: "span",
                          placeholder: "Feature",
                          blockMode: "inline",
                        })
                        : <RichTextRenderer value={feature.label} blockMode="inline" />}
                    </li>
                  ))}
                </ul>
              )}
              {renderSlot ? (
                renderSlot({
                  kind: "cta",
                  value: plan.cta,
                  path: { blockIndex: options.index, field: "plans", itemIndex: i, subField: "cta" },
                  className: cx("cms-block__pricingCta", nativeBlockClassName(block, "cta", options.variantContext)),
                  emptyLabel: "Add CTA",
                  actionName: "primary",
                })
              ) : ctaLabel && ctaHref && (
                <a className={cx("cms-block__pricingCta", nativeBlockClassName(block, "cta", options.variantContext))} href={ctaHref} {...actionAnalyticsAttrs("primary", ctaLabel)}>
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
