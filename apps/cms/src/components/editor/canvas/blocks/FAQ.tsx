"use client"
import * as React from "react"
import { RtSlot } from "../inline/RtSlot"
import {
  canvasSourceVariantClassName,
  canvasSourceVariantDataAttribute,
  mergeCanvasSectionProps,
  type CanvasBlockRendererProps,
} from "@/components/editor/canvas/CanvasBlockRenderer"
import { useTranslations } from "next-intl"

/**
 * Canvas-mode renderer for the FAQ block.
 *
 * Emits the shared renderer FAQ DOM class structure so
 * tenant CSS targets the same classes.
 *
 * All <details> are rendered open=true and the <summary> click is prevented
 * so items stay expanded during editing — the editor sees all answers inline.
 *
 * Fields:
 *   - title: inline rich-text → RtSlot as h2
 *   - items[].question: inline rich-text → RtSlot (inline) inside <span>
 *   - items[].answer: block rich-text → RtSlot (block) inside answer <div>
 */
export const FAQCanvas: React.FC<CanvasBlockRendererProps> = ({
  block,
  isActive,
  manifest,
  onActivate,
  onUpdate,
  legacyTenant,
  sectionChromeProps,
}) => {
  const t = useTranslations("editor")
  const set = (field: string) => (value: any) => onUpdate({ ...block, [field]: value })
  const idx = block.__index as number

  const setItem = (i: number) => (key: string) => (value: any) => {
    const next = [...(block.items ?? [])]
    next[i] = { ...(next[i] ?? {}), [key]: value }
    onUpdate({ ...block, items: next })
  }

  const items: any[] = block.items ?? []
  const visibleItems = items.length ? items : [{}]
  const sectionProps = mergeCanvasSectionProps(
    {
      id: block.anchor || undefined,
      className: `cms-block cms-block--faq px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-20 @min-[64rem]/site-frame:px-24 ${canvasSourceVariantClassName(block, legacyTenant, { rendererDom: "legacy" })}`.trim(),
      "data-source-variant": canvasSourceVariantDataAttribute(block, legacyTenant),
      "data-block-index": block.__index ?? undefined,
      "data-active": isActive || undefined,
      onClick: onActivate,
    },
    sectionChromeProps,
  )

  return (
    <section {...sectionProps}>
      <div className="container mx-auto max-w-3xl">
        <RtSlot
          as="h2"
          variant="inline"
          manifest={manifest}
          value={block.title}
          onChange={set("title")}
          className="mb-10 text-center font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px] [font-family:var(--font-heading)]"
          placeholder={t("faqTitlePlaceholder")}
          elementPath={{ blockIndex: idx, field: "title" }}
        />

        <dl className="space-y-4">
          {visibleItems.map((item: any, i: number) => (
            <details key={items.length ? i : "empty-faq-item"} open className="group rounded-lg border border-rule bg-card p-4">
              <summary
                className="flex list-none cursor-pointer items-center justify-between font-medium text-ink [font-family:var(--font-heading)]"
                onClick={(e) => e.preventDefault()}
              >
                <span>
                  <RtSlot
                    variant="inline"
                    manifest={manifest}
                    value={item.question}
                    onChange={setItem(i)("question")}
                    placeholder={t("questionPlaceholder")}
                    elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "question" }}
                  />
                </span>
                <span className="text-ink-muted transition-transform group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>
              <div className="mt-3 text-sm leading-relaxed text-ink-muted [font-family:var(--font-text)]">
                <RtSlot
                  variant="block"
                  manifest={manifest}
                  value={item.answer}
                  onChange={setItem(i)("answer")}
                  placeholder={t("answerPlaceholder")}
                  elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "answer" }}
                />
              </div>
            </details>
          ))}
        </dl>
      </div>
    </section>
  )
}
