import * as React from "react"
import type { HeroBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../../../../../analytics"
import { RichTextRenderer } from "../../../../../rich-text"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"

const gradientClipPath =
  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"

export function TailwindPlusMarketingHeroSimpleCenteredRenderer({
  block,
  options,
}: {
  block: HeroBlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()
  const secondaryLabel = block.secondary?.label?.trim()
  const secondaryHref = block.secondary?.href?.trim()
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "bg-white cms-block cms-block--hero cms-block--source-tailwindplus-hero-simple-centered",
      "data-source-variant": "tailwindplus.marketing.hero.simple-centered",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "hero", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
            style={{ clipPath: gradientClipPath }}
          />
        </div>
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          {(block.eyebrow || slots?.renderRichText) && (
            <div className="hidden sm:mb-8 sm:flex sm:justify-center">
              <div className="relative rounded-full px-3 py-1 text-sm/6 text-gray-600 ring-1 ring-gray-900/10 hover:ring-gray-900/20">
                {slots?.renderRichText
                  ? slots.renderRichText({
                    name: "hero.eyebrow",
                    value: block.eyebrow,
                    variant: "inline",
                    className: "contents",
                    elementPath: { blockIndex: options.index, field: "eyebrow" },
                  })
                  : <RichTextRenderer value={block.eyebrow} blockMode="inline" />}
              </div>
            </div>
          )}
          <div className="text-center">
            <h1 className="text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-7xl">
              {slots?.renderRichText
                ? slots.renderRichText({
                  name: "hero.headline",
                  value: block.headline,
                  variant: "inline",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "headline" },
                })
                : <RichTextRenderer value={block.headline} blockMode="inline" />}
            </h1>
            {(block.subheadline || slots?.renderRichText) && (
              <div className="mt-8 text-lg font-medium text-pretty text-gray-500 sm:text-xl/8">
                {slots?.renderRichText
                  ? slots.renderRichText({
                    name: "hero.subheadline",
                    value: block.subheadline,
                    variant: "block",
                    className: "contents",
                    elementPath: { blockIndex: options.index, field: "subheadline" },
                  })
                  : <RichTextRenderer value={block.subheadline} />}
              </div>
            )}
            {((ctaLabel && ctaHref) || (secondaryLabel && secondaryHref) || slots?.renderCta) && (
              <div className="mt-10 flex items-center justify-center gap-x-6">
                {slots?.renderCta
                  ? slots.renderCta({
                    name: "hero.cta",
                    value: block.cta,
                    className: "rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                    actionAttributes: actionAnalyticsAttrs("primary", ctaLabel),
                    elementPath: { blockIndex: options.index, field: "cta" },
                  })
                  : (
                    <a
                      href={ctaHref}
                      className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      {...actionAnalyticsAttrs("primary", ctaLabel)}
                    >
                      {ctaLabel}
                    </a>
                  )}
                {slots?.renderCta
                  ? slots.renderCta({
                    name: "hero.secondary",
                    value: block.secondary,
                    className: "text-sm/6 font-semibold text-gray-900",
                    actionAttributes: actionAnalyticsAttrs("secondary", secondaryLabel),
                    elementPath: { blockIndex: options.index, field: "secondary" },
                  })
                  : secondaryLabel && secondaryHref ? (
                    <a
                      href={secondaryHref}
                      className="text-sm/6 font-semibold text-gray-900"
                      {...actionAnalyticsAttrs("secondary", secondaryLabel)}
                    >
                      {secondaryLabel} <span aria-hidden="true">→</span>
                    </a>
                  ) : null}
              </div>
            )}
          </div>
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
        >
          <div
            className="relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-288.75"
            style={{ clipPath: gradientClipPath }}
          />
        </div>
      </div>
    </section>
  )
}
