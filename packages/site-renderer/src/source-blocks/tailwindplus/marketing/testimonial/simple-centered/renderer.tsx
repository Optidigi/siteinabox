import * as React from "react"
import type { TestimonialsBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { resolveMedia } from "../../../../../media"

function adaptTestimonialSimpleCenteredSlots(block: TestimonialsBlock, options: BlockRenderOptions) {
  const item = block.items[0]
  if (!item) return null
  return {
    item,
    logo: resolveMedia(block.logo ?? null, options.mediaResolver),
    avatar: resolveMedia(item.avatar ?? null, options.mediaResolver),
    hasRole: Boolean(item.role?.trim()),
  }
}

export function TailwindPlusMarketingTestimonialSimpleCenteredRenderer({
  block,
  options,
}: {
  block: TestimonialsBlock
  options: BlockRenderOptions
}) {
  const source = adaptTestimonialSimpleCenteredSlots(block, options)
  if (!source) return null
  const { item, logo, avatar, hasRole } = source

  const slots = options.editSlots
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "relative isolate overflow-hidden bg-white px-6 py-24 sm:py-32 lg:px-8 cms-block cms-block--testimonials cms-block--source-tailwindplus-testimonial-simple-centered",
      "data-provider-block": "tailwindplus",
      "data-provider-variant": "tailwindplus.marketing.testimonial.simple-centered",
      "data-source-backed-block": "true",
      "data-source-variant": "tailwindplus.marketing.testimonial.simple-centered",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "testimonials", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div
        data-siab-tokenized-gradient="testimonial-radial"
        className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,var(--color-indigo-100),white)] opacity-20"
      />
      <div className="absolute inset-y-0 right-1/2 -z-10 mr-16 w-[200%] origin-bottom-left skew-x-[-30deg] bg-white shadow-xl ring-1 shadow-indigo-600/10 ring-indigo-50 sm:mr-28 lg:mr-0 xl:mr-16 xl:origin-center" />
      <div className="mx-auto max-w-2xl lg:max-w-4xl">
        {slots?.renderImage
          ? slots.renderImage({
            name: "testimonials.logo",
            value: block.logo,
            alt: logo?.alt ?? "",
            className: "mx-auto h-12",
            loading: "lazy",
            decoding: "async",
            elementPath: { blockIndex: options.index, field: "logo" },
          })
          : logo ? <img src={logo.src} alt={logo.alt ?? ""} className="mx-auto h-12" loading="lazy" decoding="async" /> : null}
        <figure className="mt-10">
          <blockquote className="text-center text-xl/8 font-semibold text-gray-900 sm:text-2xl/9">
            <p>
              {slots?.renderText
                ? slots.renderText({
                  name: "testimonials.quote",
                  value: item.quote,
                  className: "contents",
                  placeholder: "Quote",
                  multiline: true,
                  elementPath: { blockIndex: options.index, field: "items", itemIndex: 0, subField: "quote" },
                })
                : item.quote}
            </p>
          </blockquote>
          <figcaption className="mt-10">
            {(avatar || slots?.renderImage) && (
              slots?.renderImage
                ? slots.renderImage({
                  name: "testimonials.avatar",
                  value: item.avatar,
                  alt: avatar?.alt ?? "",
                  className: "mx-auto size-10 rounded-full",
                  loading: "lazy",
                  decoding: "async",
                  elementPath: { blockIndex: options.index, field: "items", itemIndex: 0, subField: "avatar" },
                })
                : <img src={avatar!.src} alt={avatar!.alt ?? ""} className="mx-auto size-10 rounded-full" loading="lazy" decoding="async" />
            )}
            <div className="mt-4 flex items-center justify-center space-x-3 text-base">
              <div className="font-semibold text-gray-900">
                {slots?.renderText
                  ? slots.renderText({
                    name: "testimonials.author",
                    value: item.author,
                    className: "contents",
                    placeholder: "Author",
                    elementPath: { blockIndex: options.index, field: "items", itemIndex: 0, subField: "author" },
                  })
                  : item.author}
              </div>
              {hasRole && (
                <>
                  <svg viewBox="0 0 2 2" width="3" height="3" aria-hidden="true" className="fill-gray-900">
                    <circle r="1" cx="1" cy="1" />
                  </svg>
                  <div className="text-gray-600">
                    {slots?.renderText
                      ? slots.renderText({
                        name: "testimonials.role",
                        value: item.role,
                        className: "contents",
                        placeholder: "Role",
                        elementPath: { blockIndex: options.index, field: "items", itemIndex: 0, subField: "role" },
                      })
                      : item.role}
                  </div>
                </>
              )}
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
