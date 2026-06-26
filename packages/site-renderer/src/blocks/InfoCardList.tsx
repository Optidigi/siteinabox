import * as React from "react"
import type { InfoCardListBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveIcon } from "./icons"
import type { BlockRenderOptions } from "./types"

export function InfoCardListBlockRenderer({ block, options }: { block: InfoCardListBlock; options: BlockRenderOptions }) {
  if (!block.items.length) return null
  const layout = block.layout ?? "grid"
  const iconPosition = block.iconPosition ?? "top"

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--infoCardList cms-block--infoCardList-${layout} cms-block--infoCardList-icon-${iconPosition}`.trim()}
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "infoCardList", options.index)}
    >
      {block.title && (
        <h2 className="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
          <RichTextRenderer value={block.title} />
        </h2>
      )}
      {block.intro && (
        <div className="cms-block__intro" style={{ fontFamily: "var(--font-text)" }}>
          <RichTextRenderer value={block.intro} />
        </div>
      )}
      <ul className="cms-block__infoCards">
        {block.items.map((item, i) => {
          const Icon = resolveIcon(item.icon)
          const image = resolveMedia(item.image ?? null, options.mediaResolver)
          const card = (
            <>
              {(image || Icon) && (
                <span className="cms-block__infoCard-media" aria-hidden={image ? undefined : true}>
                  {image ? <img src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" /> : Icon ? <Icon /> : null}
                </span>
              )}
              <span className="cms-block__infoCard-body">
                <strong className="cms-block__infoCard-title">
                  <RichTextRenderer value={item.title} blockMode="inline" />
                </strong>
                {item.description && (
                  <span className="cms-block__infoCard-description">
                    <RichTextRenderer value={item.description} />
                  </span>
                )}
              </span>
            </>
          )

          return (
            <li
              key={i}
              className="cms-block__infoCard"
              data-animation={item.animation && item.animation !== "none" ? item.animation : undefined}
            >
              {item.link?.href && item.link.label ? (
                <a href={item.link.href} className="cms-block__infoCard-link" {...actionAnalyticsAttrs("inline", item.link.label)}>
                  {card}
                </a>
              ) : (
                card
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
