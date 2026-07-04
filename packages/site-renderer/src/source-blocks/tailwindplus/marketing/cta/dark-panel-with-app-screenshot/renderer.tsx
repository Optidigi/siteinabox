import * as React from "react"
import type { CTABlock, MediaRef } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { resolveMedia } from "../../../../../media"
import { RichTextRenderer } from "../../../../../rich-text"

const sourceScreenshot: MediaRef = {
  url: "https://tailwindcss.com/plus-assets/img/component-images/dark-project-app-screenshot.png",
  alt: "App screenshot",
  width: 1824,
  height: 1080,
}

export function TailwindPlusMarketingCtaDarkPanelWithAppScreenshotRenderer({
  block,
  options,
}: {
  block: CTABlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const primaryLabel = block.primary?.label?.trim()
  const primaryHref = block.primary?.href?.trim()
  const secondaryLabel = block.secondary?.label?.trim()
  const secondaryHref = block.secondary?.href?.trim()
  const screenshot = resolveMedia(block.backgroundImage ?? sourceScreenshot, options.mediaResolver)
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "bg-white cms-block cms-block--cta cms-block--source-tailwindplus-cta-dark-panel-with-app-screenshot",
      "data-source-variant": "tailwindplus.marketing.cta.dark-panel-with-app-screenshot",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "cta", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto max-w-7xl py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="relative isolate overflow-hidden bg-gray-900 px-6 pt-16 shadow-2xl sm:rounded-3xl sm:px-16 md:pt-24 lg:flex lg:gap-x-20 lg:px-24 lg:pt-0">
          <svg
            viewBox="0 0 1024 1024"
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -z-10 size-256 -translate-y-1/2 mask-[radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
          >
            <circle r="512" cx="512" cy="512" fill="url(#759c1415-0410-454c-8f7c-9a820de03641)" fillOpacity="0.7" />
            <defs>
              <radialGradient id="759c1415-0410-454c-8f7c-9a820de03641">
                <stop stopColor="#7775D6" />
                <stop offset="1" stopColor="#E935C1" />
              </radialGradient>
            </defs>
          </svg>
          <div className="mx-auto max-w-md text-center lg:mx-0 lg:flex-auto lg:py-32 lg:text-left">
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
              {slots?.renderRichText
                ? slots.renderRichText({
                  name: "cta.headline",
                  value: block.headline,
                  variant: "inline",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "headline" },
                })
                : <RichTextRenderer value={block.headline} blockMode="inline" />}
            </h2>
            {(block.description || slots?.renderRichText) && (
              <div className="mt-6 text-lg/8 text-pretty text-gray-300">
                {slots?.renderRichText
                  ? slots.renderRichText({
                    name: "cta.description",
                    value: block.description,
                    variant: "block",
                    className: "contents",
                    elementPath: { blockIndex: options.index, field: "description" },
                  })
                  : <RichTextRenderer value={block.description} />}
              </div>
            )}
            {((primaryLabel && primaryHref) || (secondaryLabel && secondaryHref) || slots?.renderCta) && (
              <div className="mt-10 flex items-center justify-center gap-x-6 lg:justify-start">
                {slots?.renderCta
                  ? slots.renderCta({
                    name: "cta.primary",
                    value: block.primary,
                    className: "rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-xs hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                    actionAttributes: actionAnalyticsAttrs("primary", primaryLabel),
                    elementPath: { blockIndex: options.index, field: "primary" },
                  })
                  : primaryLabel && primaryHref ? (
                    <a
                      href={primaryHref}
                      className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-xs hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      {...actionAnalyticsAttrs("primary", primaryLabel)}
                    >
                      {primaryLabel}
                    </a>
                  ) : null}
                {slots?.renderCta
                  ? slots.renderCta({
                    name: "cta.secondary",
                    value: block.secondary,
                    className: "text-sm/6 font-semibold text-white hover:text-gray-100",
                    actionAttributes: actionAnalyticsAttrs("secondary", secondaryLabel),
                    elementPath: { blockIndex: options.index, field: "secondary" },
                  })
                  : secondaryLabel && secondaryHref ? (
                    <a
                      href={secondaryHref}
                      className="text-sm/6 font-semibold text-white hover:text-gray-100"
                      {...actionAnalyticsAttrs("secondary", secondaryLabel)}
                    >
                      {secondaryLabel} <span aria-hidden="true">→</span>
                    </a>
                  ) : null}
              </div>
            )}
          </div>
          {((screenshot && !slots?.renderImage) || slots?.renderImage) && (
            <div className="relative mt-16 h-80 lg:mt-8">
              {slots?.renderImage
                ? slots.renderImage({
                  name: "cta.backgroundImage",
                  value: block.backgroundImage,
                  alt: "App screenshot",
                  className: "absolute top-0 left-0 w-228 max-w-none rounded-md bg-white/5 ring-1 ring-white/10",
                  loading: "lazy",
                  decoding: "async",
                  chrome: "overlay",
                  elementPath: { blockIndex: options.index, field: "backgroundImage" },
                })
                : (
                  <img
                    width="1824"
                    height="1080"
                    src={screenshot!.src}
                    alt={screenshot!.alt ?? "App screenshot"}
                    className="absolute top-0 left-0 w-228 max-w-none rounded-md bg-white/5 ring-1 ring-white/10"
                    loading="lazy"
                    decoding="async"
                  />
                )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
