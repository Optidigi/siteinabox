import * as React from "react"
import type { ContactDetailsBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveIcon } from "./icons"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function ContactDetailsBlockRenderer({ block, options }: { block: ContactDetailsBlock; options: BlockRenderOptions }) {
  if (!block.items.length && !block.legal) return null
  const layout = block.layout ?? "cards"
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--contactDetails cms-block--contactDetails-${layout} ${sourceVariant}`.trim()}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "contactDetails", options.index)}
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
      <dl className="cms-block__contactDetailsList">
        {block.items.map((item, i) => {
          const Icon = resolveIcon(item.icon ?? item.kind)
          const image = resolveMedia(item.image ?? null, options.mediaResolver)
          const value = (
            <span className="cms-block__contactDetailsValue">
              <RichTextRenderer value={item.value} />
            </span>
          )
          return (
            <div key={i} className="cms-block__contactDetailsItem" data-kind={item.kind || undefined}>
              {(image || Icon) && (
                <span className="cms-block__contactDetailsIcon" aria-hidden={image ? undefined : true}>
                  {image ? <img src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" /> : Icon ? <Icon /> : null}
                </span>
              )}
              <dt>{item.label}</dt>
              <dd>
                {item.href ? (
                  <a href={item.href} {...actionAnalyticsAttrs("inline", item.label)}>
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          )
        })}
        {block.legal?.kvkNumber && <LegalDetail label="KVK" value={block.legal.kvkNumber} />}
        {block.legal?.btwId && <LegalDetail label="BTW" value={block.legal.btwId} />}
        {block.legal?.iban && <LegalDetail label="IBAN" value={block.legal.iban} />}
        {block.legal?.bic && <LegalDetail label="BIC" value={block.legal.bic} />}
      </dl>
    </section>
  )
}

function LegalDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="cms-block__contactDetailsItem" data-kind="legal">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
