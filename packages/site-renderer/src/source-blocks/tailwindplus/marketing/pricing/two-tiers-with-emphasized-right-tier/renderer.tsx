import * as React from "react"
import type { PricingBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { RichTextRenderer } from "../../../../../rich-text"
import { richTextSlot } from "../../../../../source-blocks/utils"

const gradientClipPath =
  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"

function CheckIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" data-slot="icon" aria-hidden="true" className={className}>
      <path
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </svg>
  )
}

export function TailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierRenderer({
  block,
  options,
}: {
  block: PricingBlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const plans = block.plans.slice(0, 2)
  if (plans.length < 2) return null

  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className:
        "relative isolate bg-white px-6 py-24 sm:py-32 lg:px-8 cms-block cms-block--pricing cms-block--source-tailwindplus-pricing-two-tiers-with-emphasized-right-tier",
      "data-provider-block": "tailwindplus",
      "data-provider-variant": "tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier",
      "data-source-backed-block": "true",
      "data-source-variant": "tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "pricing", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div aria-hidden="true" className="absolute inset-x-0 -top-3 -z-10 transform-gpu overflow-hidden px-36 blur-3xl">
        <div
          style={{ clipPath: gradientClipPath }}
          className="mx-auto aspect-1155/678 w-288.75 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30"
        />
      </div>
      <div className="mx-auto max-w-4xl text-center">
        {(block.eyebrow || slots?.renderRichText) && (
          <h2 className="text-base/7 font-semibold text-indigo-600">
            {richTextSlot({
              options,
              name: "pricing.eyebrow",
              value: block.eyebrow,
              variant: "inline",
              className: "contents",
              elementPath: { blockIndex: options.index, field: "eyebrow" },
              blockMode: "inline",
            })}
          </h2>
        )}
        <p className="mt-2 text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-6xl">
          {richTextSlot({
            options,
            name: "pricing.title",
            value: block.title,
            variant: "inline",
            className: "contents",
            elementPath: { blockIndex: options.index, field: "title" },
            blockMode: "inline",
          })}
        </p>
      </div>
      {(block.intro || slots?.renderRichText) && (
        <div className="mx-auto mt-6 max-w-2xl text-center text-lg font-medium text-pretty text-gray-600 sm:text-xl/8">
          {richTextSlot({
            options,
            name: "pricing.intro",
            value: block.intro,
            variant: "block",
            className: "contents",
            elementPath: { blockIndex: options.index, field: "intro" },
          })}
        </div>
      )}
      <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 items-center gap-y-6 sm:mt-20 sm:gap-y-0 lg:max-w-4xl lg:grid-cols-2">
        {plans.map((plan, index) => {
          const emphasized = index === 1
          const ctaLabel = plan.cta?.label?.trim()
          const ctaHref = plan.cta?.href?.trim()
          return (
            <div
              key={index}
              data-theme-zone={emphasized ? "fixed-dark" : "ambient"}
              className={emphasized
                ? "relative rounded-3xl bg-gray-900 p-8 shadow-2xl ring-1 ring-gray-900/10 sm:p-10"
                : "rounded-3xl rounded-t-3xl bg-white/60 p-8 ring-1 ring-gray-900/10 sm:mx-8 sm:rounded-b-none sm:p-10 lg:mx-0 lg:rounded-tr-none lg:rounded-bl-3xl"}
            >
              <h3 id={`tier-${index}`} className={emphasized ? "text-base/7 font-semibold text-indigo-400" : "text-base/7 font-semibold text-indigo-600"}>
                {richTextSlot({
                  options,
                  name: "pricing.planTitle",
                  value: plan.title,
                  variant: "inline",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "plans", itemIndex: index, subField: "title" },
                  blockMode: "inline",
                })}
                </h3>
                <p className="mt-4 flex items-baseline gap-x-2">
                  {plan.price || slots?.renderText ? (
                    <span className={emphasized ? "text-5xl font-semibold tracking-tight text-white" : "text-5xl font-semibold tracking-tight text-gray-900"}>
                      {slots?.renderText
                        ? slots.renderText({
                          name: "pricing.planPrice",
                          value: plan.price,
                          placeholder: "Price",
                          elementPath: { blockIndex: options.index, field: "plans", itemIndex: index, subField: "price" },
                        })
                        : plan.price}
                    </span>
                  ) : null}
                  {plan.period || slots?.renderText ? (
                    <span className={emphasized ? "text-base text-gray-400" : "text-base text-gray-500"}>
                      {slots?.renderText
                        ? slots.renderText({
                          name: "pricing.planPeriod",
                          value: plan.period,
                          placeholder: "Period",
                          elementPath: { blockIndex: options.index, field: "plans", itemIndex: index, subField: "period" },
                        })
                        : plan.period}
                    </span>
                  ) : null}
                </p>
              {(plan.description || slots?.renderRichText) && (
                <div className={emphasized ? "mt-6 text-base/7 text-gray-300" : "mt-6 text-base/7 text-gray-600"}>
                  {richTextSlot({
                    options,
                    name: "pricing.planDescription",
                    value: plan.description,
                    variant: "block",
                    className: "contents",
                    elementPath: { blockIndex: options.index, field: "plans", itemIndex: index, subField: "description" },
                  })}
                </div>
              )}
              {plan.features && plan.features.length > 0 ? (
                <ul role="list" className={emphasized ? "mt-8 space-y-3 text-sm/6 text-gray-300 sm:mt-10" : "mt-8 space-y-3 text-sm/6 text-gray-600 sm:mt-10"}>
                  {plan.features.slice(0, emphasized ? 6 : 4).map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex gap-x-3">
                      <CheckIcon className={emphasized ? "h-6 w-5 flex-none text-indigo-400" : "h-6 w-5 flex-none text-indigo-600"} />
                      <RichTextRenderer value={feature.label} blockMode="inline" />
                    </li>
                  ))}
                </ul>
              ) : null}
              {slots?.renderCta
                ? slots.renderCta({
                  name: "pricing.planCta",
                  value: plan.cta,
                  className: emphasized
                    ? "mt-8 block rounded-md bg-indigo-500 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:mt-10"
                    : "mt-8 block rounded-md px-3.5 py-2.5 text-center text-sm font-semibold text-indigo-600 inset-ring inset-ring-indigo-200 hover:inset-ring-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:mt-10",
                  actionAttributes: actionAnalyticsAttrs("primary", ctaLabel),
                  elementPath: { blockIndex: options.index, field: "plans", itemIndex: index, subField: "cta" },
                })
                : ctaLabel && ctaHref ? (
                  <a
                    href={ctaHref}
                    aria-describedby={`tier-${index}`}
                    className={emphasized
                      ? "mt-8 block rounded-md bg-indigo-500 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:mt-10"
                      : "mt-8 block rounded-md px-3.5 py-2.5 text-center text-sm font-semibold text-indigo-600 inset-ring inset-ring-indigo-200 hover:inset-ring-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:mt-10"}
                    {...actionAnalyticsAttrs("primary", ctaLabel)}
                  >
                    {ctaLabel}
                  </a>
                ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
