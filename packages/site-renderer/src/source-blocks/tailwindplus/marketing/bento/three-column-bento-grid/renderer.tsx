import * as React from "react"
import type { BentoGridBlock, MediaRef } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { resolveMedia } from "../../../../../media"
import { RichTextRenderer } from "../../../../../rich-text"
import { richTextSlot } from "../../../../../source-blocks/utils"

const fallbackImages: Array<MediaRef> = [
  {
    url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-mobile-friendly.png",
    alt: "",
    width: 720,
    height: 1280,
  },
  {
    url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-performance.png",
    alt: "",
    width: 1024,
    height: 768,
  },
  {
    url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-security.png",
    alt: "",
    width: 1024,
    height: 512,
  },
  null,
]

function CardText({
  block,
  index,
}: {
  block: BentoGridBlock
  index: number
}) {
  const item = block.items[index]
  if (!item) return null
  const textClassName = index === 1 || index === 2
    ? "px-8 pt-8 sm:px-10 sm:pt-10"
    : "px-8 pt-8 pb-3 sm:px-10 sm:pt-10 sm:pb-0"
  return (
    <div className={textClassName}>
      <p className="mt-2 text-lg font-medium tracking-tight text-gray-950 max-lg:text-center">
        <RichTextRenderer value={item.title} blockMode="inline" />
      </p>
      {item.description ? (
        <p className="mt-2 max-w-lg text-sm/6 text-gray-600 max-lg:text-center">
          <RichTextRenderer value={item.description} blockMode="text" />
        </p>
      ) : null}
    </div>
  )
}

function BentoImage({
  block,
  options,
  index,
  className,
}: {
  block: BentoGridBlock
  options: BlockRenderOptions
  index: number
  className: string
}) {
  const value = block.items[index]?.image ?? fallbackImages[index] ?? null
  const resolved = resolveMedia(value, options.mediaResolver)
  if (options.editSlots?.renderImage) {
    return options.editSlots.renderImage({
      name: "bentoGrid.itemImage",
      value: block.items[index]?.image,
      alt: resolved?.alt ?? "",
      loading: "lazy",
      decoding: "async",
      className,
      elementPath: { blockIndex: options.index, field: "items", itemIndex: index, subField: "image" },
    })
  }
  return resolved ? <img src={resolved.src} alt={resolved.alt ?? ""} className={className} loading="lazy" decoding="async" /> : null
}

export function TailwindPlusMarketingBentoThreeColumnBentoGridRenderer({
  block,
  options,
}: {
  block: BentoGridBlock
  options: BlockRenderOptions
}) {
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "bg-gray-50 py-24 sm:py-32 cms-block cms-block--bentoGrid cms-block--source-tailwindplus-bento-three-column-bento-grid",
      "data-provider-block": "tailwindplus",
      "data-provider-variant": "tailwindplus.marketing.bento.three-column-bento-grid",
      "data-source-backed-block": "true",
      "data-source-variant": "tailwindplus.marketing.bento.three-column-bento-grid",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "bentoGrid", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto max-w-2xl px-6 lg:max-w-7xl lg:px-8">
        <h2 className="text-center text-base/7 font-semibold text-indigo-600">
          {richTextSlot({
            options,
            name: "bentoGrid.title",
            value: block.title,
            variant: "inline",
            className: "contents",
            elementPath: { blockIndex: options.index, field: "title" },
            blockMode: "inline",
          })}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-4xl font-semibold tracking-tight text-balance text-gray-950 sm:text-5xl">
          {richTextSlot({
            options,
            name: "bentoGrid.intro",
            value: block.intro,
            variant: "inline",
            className: "contents",
            elementPath: { blockIndex: options.index, field: "intro" },
            blockMode: "text",
          })}
        </p>
        <div className="mt-10 grid gap-4 sm:mt-16 lg:grid-cols-3 lg:grid-rows-2">
          <div className="relative lg:row-span-2">
            <div className="absolute inset-px rounded-lg bg-white lg:rounded-l-4xl" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] lg:rounded-l-[calc(2rem+1px)]">
              <CardText block={block} index={0} />
              <div className="@container relative min-h-120 w-full grow max-lg:mx-auto max-lg:max-w-sm">
                <div className="absolute inset-x-10 top-10 bottom-0 overflow-hidden rounded-t-[12cqw] border-x-[3cqw] border-t-[3cqw] border-gray-700 bg-gray-900 shadow-2xl" data-theme-zone="fixed-dark">
                  <BentoImage block={block} options={options} index={0} className="size-full object-cover object-top" />
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg shadow-sm outline outline-black/5 lg:rounded-l-4xl" />
          </div>
          <div className="relative max-lg:row-start-1">
            <div className="absolute inset-px rounded-lg bg-white max-lg:rounded-t-4xl" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] max-lg:rounded-t-[calc(2rem+1px)]">
              <CardText block={block} index={1} />
              <div className="flex flex-1 items-center justify-center px-8 max-lg:pt-10 max-lg:pb-12 sm:px-10 lg:pb-2">
                <BentoImage block={block} options={options} index={1} className="w-full max-lg:max-w-xs" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg shadow-sm outline outline-black/5 max-lg:rounded-t-4xl" />
          </div>
          <div className="relative max-lg:row-start-3 lg:col-start-2 lg:row-start-2">
            <div className="absolute inset-px rounded-lg bg-white" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)]">
              <CardText block={block} index={2} />
              <div className="@container flex flex-1 items-center max-lg:py-6 lg:pb-2">
                <BentoImage block={block} options={options} index={2} className="h-[min(152px,40cqw)] object-cover" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg shadow-sm outline outline-black/5" />
          </div>
          <div className="relative lg:row-span-2">
            <div className="absolute inset-px rounded-lg bg-white max-lg:rounded-b-4xl lg:rounded-r-4xl" />
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] max-lg:rounded-b-[calc(2rem+1px)] lg:rounded-r-[calc(2rem+1px)]">
              <CardText block={block} index={3} />
              <div className="relative min-h-120 w-full grow">
                <div className="absolute top-10 right-0 bottom-0 left-10 overflow-hidden rounded-tl-xl bg-gray-900 shadow-2xl outline outline-white/10" data-theme-zone="fixed-dark">
                  <div className="flex bg-gray-900 outline outline-white/5">
                    <div className="-mb-px flex text-sm/6 font-medium text-gray-400">
                      <div className="border-r border-b border-r-white/10 border-b-white/20 bg-white/5 px-4 py-2 text-white">NotificationSetting.jsx</div>
                      <div className="border-r border-gray-600/10 px-4 py-2">App.jsx</div>
                    </div>
                  </div>
                  <div className="px-6 pt-6 pb-14">
                    <pre className="text-[0.8125rem]/6 text-gray-300"><code>{`import { useState } from 'react'

function Example() {
  const [enabled, setEnabled] = useState(true)

  return (
    <form action="/notification-settings" method="post">
      {/* ... */}
    </form>
  )
}`}</code></pre>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-px rounded-lg shadow-sm outline outline-black/5 max-lg:rounded-b-4xl lg:rounded-r-4xl" />
          </div>
        </div>
      </div>
    </section>
  )
}
