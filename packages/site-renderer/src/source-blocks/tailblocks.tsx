import * as React from "react"
import type { CTABlock, RichTextBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "../blocks/types"
import { providerTokenStyles, richTextSlot } from "./utils"

export function TailblocksCtaA({ block, options }: { block: CTABlock; options: BlockRenderOptions }) {
  const primaryLabel = block.primary?.label?.trim()
  const primaryHref = block.primary?.href?.trim()

  return (
    <section
      id={block.anchor || undefined}
      className="text-[var(--color-ink-muted)] body-font"
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "cta", options.index)}
    >
      <div className="container mx-auto px-5 py-24">
        <div className="mx-auto flex flex-col items-start sm:flex-row sm:items-center lg:w-2/3">
          <h1 className="title-font flex-grow text-2xl font-medium text-[var(--color-ink)] sm:pr-16" style={providerTokenStyles.heading}>
            {richTextSlot({
              options,
              name: "cta.headline",
              value: block.headline,
              variant: "inline",
              elementPath: { blockIndex: options.index, field: "headline" },
            })}
          </h1>
          {((primaryLabel && primaryHref) || options.editSlots?.renderCta) && (
            options.editSlots?.renderCta
              ? options.editSlots.renderCta({
                name: "cta.primary",
                value: block.primary,
                className: "mt-10 flex-shrink-0 rounded-[var(--radius-md)] border-0 bg-[var(--color-accent)] px-8 py-2 text-lg text-[var(--color-on-accent)] hover:brightness-95 focus:outline-none sm:mt-0",
                actionAttributes: actionAnalyticsAttrs("primary", primaryLabel),
                elementPath: { blockIndex: options.index, field: "primary" },
              })
              : (
                <a
                  href={primaryHref}
                  className="mt-10 flex-shrink-0 rounded-[var(--radius-md)] border-0 bg-[var(--color-accent)] px-8 py-2 text-lg text-[var(--color-on-accent)] hover:brightness-95 focus:outline-none sm:mt-0"
                  {...actionAnalyticsAttrs("primary", primaryLabel)}
                >
                  {primaryLabel}
                </a>
              )
          )}
        </div>
      </div>
    </section>
  )
}

export function TailblocksContentA({ block, options }: { block: RichTextBlock; options: BlockRenderOptions }) {
  return (
    <section
      id={block.anchor || undefined}
      className="text-[var(--color-ink-muted)] body-font"
      data-source-variant={block.designVariant ?? undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "richText", options.index)}
    >
      <div className="container mx-auto px-5 py-24">
        <div className="mb-20 flex w-full flex-col text-center">
          <div className="mx-auto leading-relaxed text-base lg:w-2/3" style={providerTokenStyles.text}>
            {options.editSlots?.renderRichText
              ? options.editSlots.renderRichText({
                name: "richText.body",
                value: block.body,
                variant: "block",
                elementPath: { blockIndex: options.index, field: "body" },
              })
              : <RichTextRenderer value={block.body} />}
          </div>
        </div>
      </div>
    </section>
  )
}
