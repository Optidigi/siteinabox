import * as React from "react"
import type { ContentSectionBlock, MediaRef } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { resolveMedia } from "../../../../../media"
import { RichTextRenderer } from "../../../../../rich-text"
import { richTextSlot } from "../../../../../source-blocks/utils"

const defaultScreenshot: Exclude<MediaRef, null> = {
  url: "https://tailwindcss.com/plus-assets/img/component-images/dark-project-app-screenshot.png",
  alt: "",
  width: 1824,
  height: 1080,
}

function FeatureIcon({ index }: { index: number }) {
  if (index === 1) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" data-slot="icon" aria-hidden="true" className="mt-1 size-5 flex-none text-indigo-600">
        <path d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" fillRule="evenodd" />
      </svg>
    )
  }
  if (index === 2) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" data-slot="icon" aria-hidden="true" className="mt-1 size-5 flex-none text-indigo-600">
        <path d="M4.632 3.533A2 2 0 0 1 6.577 2h6.846a2 2 0 0 1 1.945 1.533l1.976 8.234A3.489 3.489 0 0 0 16 11.5H4c-.476 0-.93.095-1.344.267l1.976-8.234Z" />
        <path d="M4 13a2 2 0 1 0 0 4h12a2 2 0 1 0 0-4H4Zm11.24 2a.75.75 0 0 1 .75-.75H16a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75h-.01a.75.75 0 0 1-.75-.75V15Zm-2.25-.75a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75H13a.75.75 0 0 0 .75-.75V15a.75.75 0 0 0-.75-.75h-.01Z" clipRule="evenodd" fillRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" data-slot="icon" aria-hidden="true" className="mt-1 size-5 flex-none text-indigo-600">
      <path d="M5.5 17a4.5 4.5 0 0 1-1.44-8.765 4.5 4.5 0 0 1 8.302-3.046 3.5 3.5 0 0 1 4.504 4.272A4 4 0 0 1 15 17H5.5Zm3.75-2.75a.75.75 0 0 0 1.5 0V9.66l1.95 2.1a.75.75 0 1 0 1.1-1.02l-3.25-3.5a.75.75 0 0 0-1.1 0l-3.25 3.5a.75.75 0 1 0 1.1 1.02l1.95-2.1v4.59Z" clipRule="evenodd" fillRule="evenodd" />
    </svg>
  )
}

export function TailwindPlusMarketingContentStickyProductScreenshotRenderer({
  block,
  options,
}: {
  block: ContentSectionBlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const imageValue = block.image ?? defaultScreenshot
  const resolvedImage = resolveMedia(imageValue, options.mediaResolver)
  const features = (block.features ?? []).slice(0, 3)
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "relative isolate overflow-hidden bg-white px-6 py-24 sm:py-32 lg:overflow-visible lg:px-0 cms-block cms-block--contentSection cms-block--source-tailwindplus-content-sticky-product-screenshot",
      "data-provider-block": "tailwindplus",
      "data-provider-variant": "tailwindplus.marketing.content.sticky-product-screenshot",
      "data-source-backed-block": "true",
      "data-source-variant": "tailwindplus.marketing.content.sticky-product-screenshot",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "contentSection", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <svg aria-hidden="true" className="absolute top-0 left-[max(50%,25rem)] h-256 w-512 -translate-x-1/2 mask-[radial-gradient(64rem_64rem_at_top,white,transparent)] stroke-gray-200">
          <defs>
            <pattern id={`tailwindplus-content-grid-${options.index}`} width="200" height="200" x="50%" y="-1" patternUnits="userSpaceOnUse">
              <path d="M100 200V.5M.5 .5H200" fill="none" />
            </pattern>
          </defs>
          <svg x="50%" y="-1" className="overflow-visible fill-gray-50">
            <path d="M-100.5 0h201v201h-201Z M699.5 0h201v201h-201Z M499.5 400h201v201h-201Z M-300.5 600h201v201h-201Z" strokeWidth="0" />
          </svg>
          <rect width="100%" height="100%" fill={`url(#tailwindplus-content-grid-${options.index})`} strokeWidth="0" />
        </svg>
      </div>
      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:items-start lg:gap-y-10">
        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:mx-auto lg:grid lg:w-full lg:max-w-7xl lg:grid-cols-2 lg:gap-x-8 lg:px-8">
          <div className="lg:pr-4">
            <div className="lg:max-w-lg">
              {(block.eyebrow || slots?.renderRichText) && (
                <p className="text-base/7 font-semibold text-indigo-600">
                  {richTextSlot({
                    options,
                    name: "contentSection.eyebrow",
                    value: block.eyebrow,
                    variant: "inline",
                    className: "contents",
                    elementPath: { blockIndex: options.index, field: "eyebrow" },
                    blockMode: "inline",
                  })}
                </p>
              )}
              <h2 className="mt-2 text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
                {richTextSlot({
                  options,
                  name: "contentSection.title",
                  value: block.title,
                  variant: "inline",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "title" },
                  blockMode: "inline",
                })}
              </h2>
              <p className="mt-6 text-xl/8 text-gray-700">
                {richTextSlot({
                  options,
                  name: "contentSection.intro",
                  value: block.intro,
                  variant: "inline",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "intro" },
                  blockMode: "text",
                })}
              </p>
            </div>
          </div>
        </div>
        <div className="-mt-12 -ml-12 p-12 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:overflow-hidden">
          {slots?.renderImage
            ? slots.renderImage({
              name: "contentSection.image",
              value: block.image,
              alt: resolvedImage?.alt ?? "Product screenshot",
              loading: "lazy",
              decoding: "async",
              className: "w-3xl max-w-none rounded-xl bg-gray-900 shadow-xl ring-1 ring-gray-400/10 sm:w-228",
              elementPath: { blockIndex: options.index, field: "image" },
            })
            : resolvedImage ? (
              <img
                src={resolvedImage.src}
                alt={resolvedImage.alt ?? ""}
                className="w-3xl max-w-none rounded-xl bg-gray-900 shadow-xl ring-1 ring-gray-400/10 sm:w-228"
                loading="lazy"
                decoding="async"
              />
            ) : null}
        </div>
        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:mx-auto lg:grid lg:w-full lg:max-w-7xl lg:grid-cols-2 lg:gap-x-8 lg:px-8">
          <div className="lg:pr-4">
            <div className="max-w-xl text-base/7 text-gray-600 lg:max-w-lg">
              <p>
                {richTextSlot({
                  options,
                  name: "contentSection.body",
                  value: block.body,
                  variant: "inline",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "body" },
                  blockMode: "text",
                })}
              </p>
              <ul role="list" className="mt-8 space-y-8 text-gray-600">
                {features.map((feature, index) => (
                  <li key={index} className="flex gap-x-3">
                    <FeatureIcon index={index} />
                    <span>
                      <strong className="font-semibold text-gray-900">
                        <RichTextRenderer value={feature.title} blockMode="inline" />
                      </strong>{" "}
                      {feature.description ? <RichTextRenderer value={feature.description} blockMode="text" /> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-16 text-2xl font-bold tracking-tight text-gray-900">
                {richTextSlot({
                  options,
                  name: "contentSection.secondaryTitle",
                  value: block.secondaryTitle,
                  variant: "inline",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "secondaryTitle" },
                  blockMode: "inline",
                })}
              </h3>
              <p className="mt-6">
                {richTextSlot({
                  options,
                  name: "contentSection.secondaryBody",
                  value: block.secondaryBody,
                  variant: "inline",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "secondaryBody" },
                  blockMode: "text",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
