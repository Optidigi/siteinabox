import * as React from "react"
import type { TeamBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { resolveMedia } from "../../../../../media"
import { richTextSlot } from "../../../../../source-blocks/utils"

export function TailwindPlusMarketingTeamWithSmallImagesRenderer({
  block,
  options,
}: {
  block: TeamBlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const members = block.members.slice(0, 6)
  if (!members.length) return null

  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "bg-white py-24 sm:py-32 cms-block cms-block--team cms-block--source-tailwindplus-team-with-small-images",
      "data-provider-block": "tailwindplus",
      "data-provider-variant": "tailwindplus.marketing.team.with-small-images",
      "data-source-backed-block": "true",
      "data-source-variant": "tailwindplus.marketing.team.with-small-images",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "team", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto grid max-w-7xl gap-20 px-6 lg:px-8 xl:grid-cols-3">
        <div className="max-w-xl">
          <h2 className="text-3xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-4xl">
            {richTextSlot({
              options,
              name: "team.title",
              value: block.title,
              variant: "inline",
              className: "contents",
              elementPath: { blockIndex: options.index, field: "title" },
              blockMode: "inline",
            })}
          </h2>
          {(block.intro || slots?.renderRichText) && (
            <div className="mt-6 text-lg/8 text-gray-600">
              {richTextSlot({
                options,
                name: "team.intro",
                value: block.intro,
                variant: "block",
                className: "contents",
                elementPath: { blockIndex: options.index, field: "intro" },
              })}
            </div>
          )}
        </div>
        <ul role="list" className="grid gap-x-8 gap-y-12 sm:grid-cols-2 sm:gap-y-16 xl:col-span-2">
          {members.map((member, index) => {
            const image = resolveMedia(member.image ?? null, options.mediaResolver)
            return (
              <li key={index}>
                <div className="flex items-center gap-x-6">
                  {slots?.renderImage
                    ? slots.renderImage({
                      name: "team.memberImage",
                      value: member.image,
                      alt: image?.alt ?? member.name,
                      className: "size-16 rounded-full outline-1 -outline-offset-1 outline-black/5",
                      loading: "lazy",
                      decoding: "async",
                      elementPath: { blockIndex: options.index, field: "members", itemIndex: index, subField: "image" },
                    })
                    : image ? (
                      <img
                        src={image.src}
                        alt={image.alt ?? member.name}
                        className="size-16 rounded-full outline-1 -outline-offset-1 outline-black/5"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                  <div>
                    <h3 className="text-base/7 font-semibold tracking-tight text-gray-900">
                      {slots?.renderText
                        ? slots.renderText({
                          name: "team.memberName",
                          value: member.name,
                          className: "contents",
                          placeholder: "Name",
                          elementPath: { blockIndex: options.index, field: "members", itemIndex: index, subField: "name" },
                        })
                        : member.name}
                    </h3>
                    <p className="text-sm/6 font-semibold text-indigo-600">
                      {slots?.renderText
                        ? slots.renderText({
                          name: "team.memberRole",
                          value: member.role,
                          className: "contents",
                          placeholder: "Role",
                          elementPath: { blockIndex: options.index, field: "members", itemIndex: index, subField: "role" },
                        })
                        : member.role}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
