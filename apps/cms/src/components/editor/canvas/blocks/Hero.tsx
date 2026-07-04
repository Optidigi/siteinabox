"use client"
import * as React from "react"
import { RtSlot } from "../inline/RtSlot"
import { ClickToEditField } from "../inline/ClickToEditField"
import { InlineCtaButton } from "../inline/InlineCtaButton"
import { InlineImage } from "../inline/InlineImage"
import {
  canvasSourceVariantClassName,
  canvasSourceVariantDataAttribute,
  mergeCanvasSectionProps,
  type CanvasBlockRendererProps,
} from "@/components/editor/canvas/CanvasBlockRenderer"
import { resolveBlockAnchor } from "@siteinabox/site-renderer"
import { useCanvasSelection } from "../CanvasSelectionContext"
import { isReadOnlyView } from "../canvasView"
import { cn, isCoarsePointer } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"
import { MapPin } from "lucide-react"

/**
 * Canvas-mode renderer for the Hero block.
 *
 * Mirrors the Ami-care tenant renderer hero DOM: same classes, animations, and
 * decorative floating cards (pull-quote + MapPin).
 */

const AMICARE_PULL_QUOTE = "Écht verschil maken voor jongeren en gezinnen."

export const HeroCanvas: React.FC<CanvasBlockRendererProps> = ({ block, isActive, manifest, onActivate, onUpdate, tenantId, tenantRendererKey, sectionChromeProps }) => {
  const t = useTranslations("editor")
  const set = <K extends string>(field: K) => (value: any) => onUpdate({ ...block, [field]: value })
  const idx = block.__index as number
  const { view, select } = useCanvasSelection()
  const tapToSelect = isReadOnlyView(view)
  const isAmicareTenantRenderer = tenantRendererKey === "amicare"
  const showAmicareBadges = isAmicareTenantRenderer && Boolean(block.image)
  const [autoOpenPillIndex, setAutoOpenPillIndex] = React.useState<number | null>(null)
  // Only one pill editor is ever open at a time, so a single ref suffices.
  // Reset to false at the top of the editor factory (which re-runs each open).
  const pillCommittedRef = React.useRef(false)
  const sectionProps = mergeCanvasSectionProps(
    {
      id: resolveBlockAnchor(block, { tenantRendererKey, surface: "canvas" }),
      className: `cms-block cms-block--hero relative flex min-h-[90vh] flex-col items-center overflow-hidden px-6 py-12 @min-[48rem]/site-frame:flex-row @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-24 ${canvasSourceVariantClassName(block, tenantRendererKey, { rendererDom: "canvas-fallback" })}`.trim(),
      "data-source-variant": canvasSourceVariantDataAttribute(block, tenantRendererKey),
      "data-block-index": block.__index ?? undefined,
      "data-active": isActive || undefined,
      onClick: onActivate,
    },
    sectionChromeProps,
  )

  return (
    <section {...sectionProps}>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -left-[10%] -top-[10%] -z-10 h-[500px] w-[500px] rounded-full blur-3xl",
          isAmicareTenantRenderer ? "amicare-hero-glow amicare-hero-glow--start" : "bg-accent/15",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-[10%] -right-[5%] -z-10 h-[400px] w-[400px] rounded-full blur-3xl",
          isAmicareTenantRenderer ? "amicare-hero-glow amicare-hero-glow--end" : "bg-accent/10",
        )}
      />

      <div className="relative z-10 w-full space-y-7 @min-[48rem]/site-frame:w-1/2">
        <RtSlot
          as="span"
          variant="inline"
          manifest={manifest}
          value={block.eyebrow}
          onChange={set("eyebrow")}
          className="inline-block -rotate-2 text-[22px] text-accent animate-fade-up [animation-delay:0ms] [font-family:var(--font-script)]"
          placeholder={t("eyebrowPlaceholder")}
          elementPath={{ blockIndex: idx, field: "eyebrow" }}
        />

        <RtSlot
          as="h1"
          variant="inline"
          manifest={manifest}
          value={block.headline}
          onChange={set("headline")}
          className="max-w-[14ch] font-serif text-[44px] font-normal leading-[1.05] tracking-[-0.01em] @min-[48rem]/site-frame:text-[60px] @min-[64rem]/site-frame:text-[76px] animate-fade-up [animation-delay:50ms] [overflow-wrap:anywhere] [&_em]:relative [&_em]:not-italic [&_em]:inline-block [&_em]:whitespace-nowrap [&_em]:italic [&_em]:text-accent [font-family:var(--font-title)]"
          placeholder={t("headlinePlaceholder")}
          elementPath={{ blockIndex: idx, field: "headline" }}
        />

        <RtSlot
          as="p"
          variant="block"
          manifest={manifest}
          value={block.subheadline}
          onChange={set("subheadline")}
          className="max-w-md text-[17px] leading-[1.6] text-ink-muted @min-[48rem]/site-frame:text-[18px] animate-fade-up [animation-delay:150ms] [font-family:var(--font-text)]"
          placeholder={t("subheadlinePlaceholder")}
          elementPath={{ blockIndex: idx, field: "subheadline" }}
        />

        <div className="flex flex-wrap gap-2 pt-2 animate-fade [animation-delay:300ms]">
          {(block.pills ?? []).map((pill: { label: string; id?: string | null }, i: number) => (
            <span
              key={pill.id ?? i}
              // Match the live-site span exactly when there's no X-button
              // (mobile / read-only). When the desktop hover-X is rendered
              // we need `inline-flex items-center gap-1` so the X tracks
              // baseline; without those classes the bare span sizes to text
              // line-height, matching the shared renderer's hero pill DOM.
              className={cn(
                "group relative rounded-md border border-rule bg-secondary/40 px-3 py-1.5 text-[12px] font-medium text-ink-muted [font-family:var(--font-text)]",
                !tapToSelect && "inline-flex items-center gap-1",
              )}
              data-mobile-pill-hit={tapToSelect ? "true" : undefined}
              onClick={tapToSelect
                ? (e) => { e.preventDefault(); e.stopPropagation(); select({ blockIndex: idx, field: "pills", itemIndex: i }) }
                : undefined}
            >
              {/* Mobile / read-only: render the label as a bare text node so
                  the pill's height matches the live-site span exactly. The
                  outer <span>'s onClick already routes selection — the
                  ClickToEditField wrapper would just add an inline-block
                  child whose intrinsic line-box pushes the pill ~6px
                  taller than the site. */}
              {tapToSelect ? (
                pill.label || <span className="text-muted-foreground">{t("pillLabelPlaceholder")}</span>
              ) : (
              <ClickToEditField
                ariaLabel={`Edit pill ${i + 1}`}
                affordance="inline"
                autoOpen={autoOpenPillIndex === i}
                elementPath={{ blockIndex: idx, field: "pills", itemIndex: i }}
                editor={(close) => {
                  // Reset per open-session so a genuine click-away blur still commits.
                  pillCommittedRef.current = false

                  // Shared commit logic. Sets the committed flag so a trailing blur
                  // from the unmount caused by close() doesn't re-run this path.
                  const commit = (value: string) => {
                    pillCommittedRef.current = true
                    const currentPills: Array<{ label: string; id?: string | null }> = block.pills ?? []
                    const next = value.trim() === ""
                      ? currentPills.filter((_: any, j: number) => j !== i)
                      : currentPills.map((p: any, j: number) => j === i ? { ...p, label: value } : p)
                    set("pills")(next)
                  }

                  return (
                    <input
                      autoFocus={!isCoarsePointer()}
                      type="text"
                      defaultValue={pill.label}
                      placeholder={t("pillLabelPlaceholder")}
                      className="rounded border border-border bg-popover px-2 py-0.5 text-[12px] text-ink-muted outline-none ring-1 ring-ring"
                      onBlur={(e) => {
                        // Blur fires after Enter/Escape unmounts the input — skip re-commit.
                        if (pillCommittedRef.current) { close(); setAutoOpenPillIndex(null); return }
                        commit(e.target.value)
                        close()
                        setAutoOpenPillIndex(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          const value = e.currentTarget.value
                          if (value.trim() === "") {
                            commit(value)
                          } else {
                            pillCommittedRef.current = true
                            const currentPills: Array<{ label: string; id?: string | null }> = block.pills ?? []
                            const updated = currentPills.map((p: any, j: number) => j === i ? { ...p, label: value } : p)
                            // FE-27: stamp a stable client id so React keys don't fall back to
                            // the array index for the unsaved pill — index-keys break on
                            // reorder-before-save. Payload will reassign on first save.
                            const next = [...updated, { id: crypto.randomUUID(), label: "" }]
                            set("pills")(next)
                            setAutoOpenPillIndex(next.length - 1)
                          }
                          close()
                        }
                        if (e.key === "Escape") {
                          pillCommittedRef.current = true
                          const currentPills: Array<{ label: string; id?: string | null }> = block.pills ?? []
                          if (!currentPills[i]?.label) {
                            const next = currentPills.filter((_: any, j: number) => j !== i)
                            set("pills")(next)
                          }
                          close()
                          setAutoOpenPillIndex(null)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )
                }}
              >
                {pill.label || <span className="text-muted-foreground">{t("pillLabelPlaceholder")}</span>}
              </ClickToEditField>
              )}
              {!tapToSelect && (
                <button
                  type="button"
                  aria-label={`Remove pill ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    const next = (block.pills ?? []).filter((_: any, j: number) => j !== i)
                    set("pills")(next)
                  }}
                  className="ml-0.5 hidden size-3.5 items-center justify-center rounded-full text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 @min-[48rem]/site-frame:inline-flex"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              const pills = block.pills ?? []
              // FE-27: see sibling create-on-Enter above for the rationale.
              const next = [...pills, { id: crypto.randomUUID(), label: "" }]
              set("pills")(next)
              setAutoOpenPillIndex(next.length - 1)
            }}
            className="min-h-11 rounded-full border border-dashed border-rule px-3 py-1.5 text-[12px] font-medium text-ink-muted opacity-60 transition-opacity hover:opacity-100 rounded-[var(--radius-sm)] @min-[48rem]/site-frame:min-h-0 [font-family:var(--font-text)]"
          >
            + {t("addPill")}
          </button>
        </div>

        <InlineCtaButton
          value={block.cta}
          onChange={set("cta")}
          className={cn(
            "inline-block rounded-md bg-accent px-6 py-3 text-[14px] font-medium shadow-sm transition-colors hover:bg-accent/90 animate-fade-up [animation-delay:400ms]",
            isAmicareTenantRenderer ? "amicare-button-primary [font-family:var(--font-text)]" : "text-bg",
          )}
          emptyLabel={t("addCtaButton")}
          elementPath={{ blockIndex: idx, field: "cta" }}
        />
      </div>

      <div className="relative mt-14 w-full @min-[48rem]/site-frame:mt-0 @min-[48rem]/site-frame:w-1/2">
        <div className="relative z-10 animate-fade [animation-delay:100ms]">
          <InlineImage
            value={block.image}
            onChange={set("image")}
            alt={block.imageAlt ?? null}
            className="aspect-[4/5] w-full rotate-0 transform rounded-[var(--radius-lg)] object-cover shadow-2xl @min-[48rem]/site-frame:aspect-[4/3] @min-[48rem]/site-frame:rotate-3"
            tenantId={tenantId ?? undefined}
            elementPath={{ blockIndex: idx, field: "image" }}
          />
          {showAmicareBadges && (
            <>
              <figure className="absolute -bottom-8 -left-2 max-w-[230px] animate-float rounded-lg border border-rule bg-card p-4 shadow-lg [animation-delay:0ms] @min-[48rem]/site-frame:-bottom-10 @min-[48rem]/site-frame:-left-8 @min-[48rem]/site-frame:p-5">
                <span aria-hidden="true" className="mr-1 align-top text-3xl italic leading-none text-accent [font-family:var(--font-serif)]">&ldquo;</span>
                <blockquote className="inline font-serif text-[17px] italic leading-[1.35] text-ink @min-[48rem]/site-frame:text-[19px]">{AMICARE_PULL_QUOTE}</blockquote>
              </figure>
              <div className="absolute -top-6 -right-2 flex max-w-[200px] animate-float items-center gap-3 rounded-lg border border-rule bg-card p-3 shadow-lg [animation-delay:500ms] @min-[48rem]/site-frame:-top-8 @min-[48rem]/site-frame:-right-8 @min-[48rem]/site-frame:p-4">
                <span className="rounded-full bg-accent/10 p-2 text-accent">
                  <MapPin size={18} aria-hidden />
                </span>
                <div className="text-[12px] leading-tight">
                  <p className="font-serif text-[14px] italic text-ink">Roermond e.o.</p>
                  <p className="text-ink-muted">Limburg-Noord</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
