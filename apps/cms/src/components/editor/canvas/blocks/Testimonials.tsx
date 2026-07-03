"use client"
import * as React from "react"
import { ClickToEditField } from "../inline/ClickToEditField"
import { InlineImage } from "../inline/InlineImage"
import {
  canvasSourceVariantClassName,
  canvasSourceVariantDataAttribute,
  mergeCanvasSectionProps,
  type CanvasBlockRendererProps,
} from "@/components/editor/canvas/CanvasBlockRenderer"
import { isCoarsePointer } from "@siteinabox/ui/lib/utils"
import { isReadOnlyView } from "@/components/editor/canvas/canvasView"
import { useCanvasSelection } from "@/components/editor/canvas/CanvasSelectionContext"
import { useTranslations } from "next-intl"

/**
 * Canvas-mode renderer for the Testimonials block.
 *
 * Emits the shared renderer testimonials DOM class structure
 * so tenant CSS targets the same classes.
 *
 * NOTE: The site component types `title` as RtField / rich-text, but the
 * block schema (src/blocks/Testimonials.ts) declares it as `type: "text"`
 * (plain string). This renderer trusts the block schema — title is plain text
 * edited via ClickToEditField. The site component will need to be reconciled
 * in downstream repos when this discrepancy is addressed (see backlog).
 *
 * Similarly, the site component reads `item.avatarUrl` (a resolved string),
 * but the block stores `item.avatar` as an upload relation. InlineImage
 * handles upload relations via its internal resolveUrl helper.
 *
 * Fields:
 *   - title: plain text → ClickToEditField with <input>
 *   - items[].quote: textarea → ClickToEditField with <textarea>
 *   - items[].author: plain text → ClickToEditField with <input>
 *   - items[].role: plain text → ClickToEditField with <input>
 *   - items[].avatar: upload relation → InlineImage
 */
export const TestimonialsCanvas: React.FC<CanvasBlockRendererProps> = ({
  block,
  isActive,
  manifest: _manifest,
  onActivate,
  onUpdate,
  tenantId,
  legacyTenant,
  sectionChromeProps,
}) => {
  const t = useTranslations("editor")
  const { view } = useCanvasSelection()
  const isReadOnly = isReadOnlyView(view)
  const set = (field: string) => (value: any) => onUpdate({ ...block, [field]: value })
  const idx = block.__index as number

  const setItem = (i: number) => (key: string) => (value: any) =>
    onUpdate({
      ...block,
      items: (block.items ?? []).map((item: any, j: number) =>
        j === i ? { ...item, [key]: value } : item
      ),
    })

  const items: any[] = block.items ?? []
  const titleValue: string = typeof block.title === "string" ? block.title : ""

  // FE-52: bring the just-appended testimonial card into view after the
  // grid grows. Avoids the new card being pushed off-screen in long pages.
  const gridRef = React.useRef<HTMLDivElement>(null)
  const justAddedRef = React.useRef(false)
  React.useEffect(() => {
    if (!justAddedRef.current) return
    justAddedRef.current = false
    const last = gridRef.current?.querySelector<HTMLElement>("figure:last-of-type")
    last?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [items.length])
  const sectionProps = mergeCanvasSectionProps(
    {
      id: block.anchor || undefined,
      className: `cms-block cms-block--testimonials bg-secondary/40 px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-20 ${canvasSourceVariantClassName(block, legacyTenant)}`.trim(),
      "data-source-variant": canvasSourceVariantDataAttribute(block, legacyTenant),
      "data-block-index": block.__index ?? undefined,
      "data-active": isActive || undefined,
      onClick: onActivate,
    },
    sectionChromeProps,
  )

  return (
    <section {...sectionProps}>
      <div className="container mx-auto">
        <h2 className="mb-12 text-center font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px] [font-family:var(--font-heading)]">
          <ClickToEditField
            ariaLabel={t("editTestimonialsTitle")}
            affordance="inline"
            elementPath={{ blockIndex: idx, field: "title" }}
            editor={(close) => (
              <input
                autoFocus={!isCoarsePointer()}
                type="text"
                defaultValue={titleValue}
                placeholder={t("sectionTitlePlaceholder")}
                className="w-full rounded border border-border bg-popover px-2 py-1 text-[28px] font-serif leading-[1.1] tracking-[-0.01em] text-ink outline-none ring-1 ring-ring @min-[48rem]/site-frame:text-[36px]"
                onBlur={(e) => { set("title")(e.target.value); close() }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { set("title")(e.currentTarget.value); close() }
                  if (e.key === "Escape") close()
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          >
            {titleValue || <span className="text-muted-foreground">{t("addTitlePlaceholder")}</span>}
          </ClickToEditField>
        </h2>

        <div ref={gridRef} className="grid gap-6 @min-[48rem]/site-frame:grid-cols-2 @min-[64rem]/site-frame:grid-cols-3">
          {items.map((item: any, i: number) => {
            const quoteValue: string = typeof item.quote === "string" ? item.quote : ""
            const authorValue: string = typeof item.author === "string" ? item.author : ""
            const roleValue: string = typeof item.role === "string" ? item.role : ""

            return (
              <figure
                key={i}
                className="flex flex-col rounded-lg border border-rule bg-card p-6"
              >
                <blockquote className="flex-1 font-serif text-[17px] italic leading-[1.5] text-ink [font-family:var(--font-heading)]">
                  &ldquo;
                  <ClickToEditField
                    ariaLabel={t("editQuote", { number: i + 1 })}
                    affordance="corner"
                    elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "quote" }}
                    editor={(close) => (
                      <textarea
                        autoFocus={!isCoarsePointer()}
                        rows={4}
                        defaultValue={quoteValue}
                        placeholder={t("addQuotePlaceholder")}
                        className="w-full rounded border border-border bg-popover px-2 py-1 text-sm text-ink outline-none ring-1 ring-ring"
                        onBlur={(e) => { setItem(i)("quote")(e.target.value); close() }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") close()
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  >
                    {quoteValue || <span className="text-muted-foreground italic">{t("addQuotePlaceholder")}</span>}
                  </ClickToEditField>
                  &rdquo;
                </blockquote>

                <figcaption className="mt-4 flex items-center gap-3">
                  <InlineImage
                    value={item.avatar}
                    onChange={setItem(i)("avatar")}
                    alt={authorValue || undefined}
                    className="h-10 w-10 rounded-full object-cover"
                    tenantId={tenantId ?? undefined}
                    elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "avatar" }}
                  />
                  <div>
                    <div className="font-medium text-ink [font-family:var(--font-text)]">
                      <ClickToEditField
                        ariaLabel={t("editAuthorName", { number: i + 1 })}
                        affordance="inline"
                        elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "author" }}
                        editor={(close) => (
                          <input
                            autoFocus={!isCoarsePointer()}
                            type="text"
                            defaultValue={authorValue}
                            placeholder={t("authorNamePlaceholder")}
                            className="rounded border border-border bg-popover px-2 py-0.5 text-sm text-ink outline-none ring-1 ring-ring"
                            onBlur={(e) => { setItem(i)("author")(e.target.value); close() }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { setItem(i)("author")(e.currentTarget.value); close() }
                              if (e.key === "Escape") close()
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      >
                        {authorValue || <span className="text-muted-foreground">{t("authorNamePlaceholder")}</span>}
                      </ClickToEditField>
                    </div>
                    <div className="text-sm text-ink-muted [font-family:var(--font-text)]">
                      <ClickToEditField
                        ariaLabel={t("editAuthorRole", { number: i + 1 })}
                        affordance="inline"
                        elementPath={{ blockIndex: idx, field: "items", itemIndex: i, subField: "role" }}
                        editor={(close) => (
                          <input
                            autoFocus={!isCoarsePointer()}
                            type="text"
                            defaultValue={roleValue}
                            placeholder={t("authorRolePlaceholder")}
                            className="rounded border border-border bg-popover px-2 py-0.5 text-sm text-ink-muted outline-none ring-1 ring-ring"
                            onBlur={(e) => { setItem(i)("role")(e.target.value); close() }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { setItem(i)("role")(e.currentTarget.value); close() }
                              if (e.key === "Escape") close()
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      >
                        {roleValue || <span className="text-muted-foreground">{t("rolePlaceholder")}</span>}
                      </ClickToEditField>
                    </div>
                  </div>
                </figcaption>
              </figure>
            )
          })}
          {!isReadOnly && (
          /* FE-52: inline "+ Add testimonial" — mirrors Hero's "+ Add pill"
              affordance pattern, sized as a grid card so it lines up with
              the existing testimonials. */
            <button
              type="button"
              aria-label={t("addTestimonial")}
              onClick={(e) => {
                e.stopPropagation()
                const next = [
                  ...(block.items ?? []),
                  { quote: "", author: "", role: "", avatar: null },
                ]
                justAddedRef.current = true
                set("items")(next)
              }}
              className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-rule bg-transparent p-6 text-[14px] font-medium text-ink-muted opacity-60 transition-opacity hover:opacity-100 focus:opacity-100 [font-family:var(--font-text)]"
            >
              + {t("addTestimonial")}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
