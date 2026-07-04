import * as React from "react"
import type { FeatureListBlock, MediaRef } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { resolveMedia } from "../../../../../media"
import { richTextSlot } from "../../../../../source-blocks/utils"

const defaultScreenshot: Exclude<MediaRef, null> = {
  url: "https://tailwindcss.com/plus-assets/img/component-images/project-app-screenshot.png",
  alt: "Product screenshot",
  width: 2432,
  height: 1442,
}

function FeatureIcon({ index }: { index: number }) {
  if (index === 1) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" data-slot="icon" aria-hidden="true" className="absolute top-1 left-1 size-5 text-indigo-600">
        <path d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" fillRule="evenodd" />
      </svg>
    )
  }
  if (index === 2) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" data-slot="icon" aria-hidden="true" className="absolute top-1 left-1 size-5 text-indigo-600">
        <path d="M4.632 3.533A2 2 0 0 1 6.577 2h6.846a2 2 0 0 1 1.945 1.533l1.976 8.234A3.489 3.489 0 0 0 16 11.5H4c-.476 0-.93.095-1.344.267l1.976-8.234Z" />
        <path d="M4 13a2 2 0 1 0 0 4h12a2 2 0 1 0 0-4H4Zm11.24 2a.75.75 0 0 1 .75-.75H16a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75h-.01a.75.75 0 0 1-.75-.75V15Zm-2.25-.75a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75H13a.75.75 0 0 0 .75-.75V15a.75.75 0 0 0-.75-.75h-.01Z" clipRule="evenodd" fillRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" data-slot="icon" aria-hidden="true" className="absolute top-1 left-1 size-5 text-indigo-600">
      <path d="M5.5 17a4.5 4.5 0 0 1-1.44-8.765 4.5 4.5 0 0 1 8.302-3.046 3.5 3.5 0 0 1 4.504 4.272A4 4 0 0 1 15 17H5.5Zm3.75-2.75a.75.75 0 0 0 1.5 0V9.66l1.95 2.1a.75.75 0 1 0 1.1-1.02l-3.25-3.5a.75.75 0 0 0-1.1 0l-3.25 3.5a.75.75 0 1 0 1.1 1.02l1.95-2.1v4.59Z" clipRule="evenodd" fillRule="evenodd" />
    </svg>
  )
}

export function TailwindPlusMarketingFeatureWithProductScreenshotRenderer({
  block,
  options,
}: {
  block: FeatureListBlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const imageValue = block.image ?? defaultScreenshot
  const resolvedImage = resolveMedia(imageValue, options.mediaResolver)
  const features = block.features.slice(0, 3)
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "overflow-hidden bg-white py-24 sm:py-32 cms-block cms-block--featurelist cms-block--source-tailwindplus-feature-with-product-screenshot",
      "data-source-variant": "tailwindplus.marketing.feature.with-product-screenshot",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "featureList", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          <div className="lg:pt-4 lg:pr-8">
            <div className="lg:max-w-lg">
              <h2 className="text-base/7 font-semibold text-indigo-600">
                {block.eyebrow || slots?.renderRichText
                  ? richTextSlot({
                    options,
                    name: "featureList.eyebrow",
                    value: block.eyebrow,
                    variant: "inline",
                    className: "contents",
                    elementPath: { blockIndex: options.index, field: "eyebrow" },
                    blockMode: "inline",
                  })
                  : "Deploy faster"}
              </h2>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
                {richTextSlot({
                  options,
                  name: "featureList.title",
                  value: block.title,
                  variant: "inline",
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "title" },
                  blockMode: "inline",
                })}
              </p>
              {(block.intro || slots?.renderRichText) && (
                <div className="mt-6 text-lg/8 text-gray-700">
                  {richTextSlot({
                    options,
                    name: "featureList.intro",
                    value: block.intro,
                    variant: "block",
                    className: "contents",
                    elementPath: { blockIndex: options.index, field: "intro" },
                  })}
                </div>
              )}
              <dl className="mt-10 max-w-xl space-y-8 text-base/7 text-gray-600 lg:max-w-none">
                {features.map((feature, index) => (
                  <div key={index} className="relative pl-9">
                    <dt className="inline font-semibold text-gray-900">
                      {slots?.renderIcon
                        ? slots.renderIcon({
                          name: "featureList.featureIcon",
                          value: feature.icon,
                          className: "absolute top-1 left-1 size-5 text-indigo-600",
                          size: 20,
                          elementPath: { blockIndex: options.index, field: "features", itemIndex: index, subField: "icon" },
                        })
                        : <FeatureIcon index={index} />}
                      {richTextSlot({
                        options,
                        name: "featureList.featureTitle",
                        value: feature.title,
                        variant: "inline",
                        className: "contents",
                        elementPath: { blockIndex: options.index, field: "features", itemIndex: index, subField: "title" },
                        blockMode: "inline",
                      })}
                    </dt>{" "}
                    {(feature.description || slots?.renderRichText) && (
                      <dd className="inline">
                        {richTextSlot({
                          options,
                          name: "featureList.featureDescription",
                          value: feature.description,
                          variant: "inline",
                          className: "contents",
                          elementPath: { blockIndex: options.index, field: "features", itemIndex: index, subField: "description" },
                          blockMode: "inline",
                        })}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          </div>
          {slots?.renderImage
            ? slots.renderImage({
              name: "featureList.image",
              value: block.image,
              alt: resolvedImage?.alt ?? "Product screenshot",
              loading: "lazy",
              decoding: "async",
              className: "w-3xl max-w-none rounded-xl shadow-xl ring-1 ring-gray-400/10 sm:w-228 md:-ml-4 lg:ml-0",
              elementPath: { blockIndex: options.index, field: "image" },
            })
            : resolvedImage ? (
              <img
                width="2432"
                height="1442"
                src={resolvedImage.src}
                alt={resolvedImage.alt ?? "Product screenshot"}
                className="w-3xl max-w-none rounded-xl shadow-xl ring-1 ring-gray-400/10 sm:w-228 md:-ml-4 lg:ml-0"
                loading="lazy"
                decoding="async"
              />
            ) : null}
        </div>
      </div>
    </section>
  )
}
