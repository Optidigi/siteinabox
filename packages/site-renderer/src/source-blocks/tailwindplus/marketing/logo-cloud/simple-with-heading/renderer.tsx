import * as React from "react"
import type { LogoCloudBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { resolveMedia } from "../../../../../media"
import { RichTextRenderer } from "../../../../../rich-text"

const logoImageClasses = [
  "col-span-2 max-h-12 w-full object-contain lg:col-span-1",
  "col-span-2 max-h-12 w-full object-contain lg:col-span-1",
  "col-span-2 max-h-12 w-full object-contain lg:col-span-1",
  "col-span-2 max-h-12 w-full object-contain sm:col-start-2 lg:col-span-1",
  "col-span-2 col-start-2 max-h-12 w-full object-contain sm:col-start-auto lg:col-span-1",
]

export function TailwindPlusMarketingLogoCloudSimpleWithHeadingRenderer({
  block,
  options,
}: {
  block: LogoCloudBlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const logos = block.logos.slice(0, 5)
  if (!logos.length) return null

  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "bg-white py-24 sm:py-32 cms-block cms-block--logoCloud cms-block--source-tailwindplus-logo-cloud-simple-with-heading",
      "data-provider-block": "tailwindplus",
      "data-provider-variant": "tailwindplus.marketing.logo-cloud.simple-with-heading",
      "data-source-backed-block": "true",
      "data-source-variant": "tailwindplus.marketing.logo-cloud.simple-with-heading",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "logoCloud", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-center text-lg/8 font-semibold text-gray-900">
          {slots?.renderRichText
            ? slots.renderRichText({
              name: "logoCloud.title",
              value: block.title,
              variant: "inline",
              className: "contents",
              elementPath: { blockIndex: options.index, field: "title" },
            })
            : <RichTextRenderer value={block.title} blockMode="inline" />}
        </h2>
        <div className="mx-auto mt-10 grid max-w-lg grid-cols-4 items-center gap-x-8 gap-y-10 sm:max-w-xl sm:grid-cols-6 sm:gap-x-10 lg:mx-0 lg:max-w-none lg:grid-cols-5">
          {logos.map((logo, index) => {
            const image = resolveMedia(logo.image, options.mediaResolver)
            const className = logoImageClasses[index] ?? logoImageClasses[0]
            const content = slots?.renderImage
              ? slots.renderImage({
                name: "logoCloud.logoImage",
                value: logo.image,
                alt: image?.alt ?? logo.name,
                className,
                loading: "lazy",
                decoding: "async",
                elementPath: { blockIndex: options.index, field: "logos", itemIndex: index, subField: "image" },
              })
              : image ? (
                <img
                  width="158"
                  height="48"
                  src={image.src}
                  alt={image.alt ?? logo.name}
                  className={className}
                  loading="lazy"
                  decoding="async"
                />
              ) : null

            return logo.href ? (
              <a key={index} href={logo.href} {...actionAnalyticsAttrs("inline", logo.name)}>
                {content}
              </a>
            ) : <React.Fragment key={index}>{content}</React.Fragment>
          })}
        </div>
      </div>
    </section>
  )
}
