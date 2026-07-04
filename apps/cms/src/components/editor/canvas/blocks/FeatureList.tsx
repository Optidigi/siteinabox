"use client"
import * as React from "react"
import { Plus } from "lucide-react"
import { RtSlot } from "../inline/RtSlot"
import { InlineIcon } from "../inline/InlineIcon"
import {
  canvasSourceVariantClassName,
  canvasSourceVariantDataAttribute,
  mergeCanvasSectionProps,
  type CanvasBlockRendererProps,
} from "@/components/editor/canvas/CanvasBlockRenderer"
import { resolveBlockAnchor } from "@siteinabox/site-renderer"
import { useCanvasSelection } from "@/components/editor/canvas/CanvasSelectionContext"
import { isReadOnlyView } from "@/components/editor/canvas/canvasView"
import { useTranslations } from "next-intl"

const MAX_FEATURE_CARDS = 3

/**
 * Canvas-mode renderer for the FeatureList block.
 *
 * Emits the shared renderer feature-list DOM class structure
 * so tenant CSS targets the same classes.
 *
 * Fields:
 *   - title: inline rich-text → RtSlot as h2
 *   - intro: block rich-text rendered as a single-line script kicker → RtSlot as span
 *   - features[].icon: plain string (lucide icon name) → InlineIcon
 *   - features[].title: inline rich-text → RtSlot as h3
 *   - features[].description: block rich-text → RtSlot as p
 */
export const FeatureListCanvas: React.FC<CanvasBlockRendererProps> = ({ block, isActive, manifest, onActivate, onUpdate, tenantRendererKey, sectionChromeProps }) => {
  const t = useTranslations("editor")
  const { view } = useCanvasSelection()
  const isReadOnly = isReadOnlyView(view)
  const isAmicareTenantRenderer = tenantRendererKey === "amicare"
  const amicareSourceClassName = isAmicareTenantRenderer ? "cms-block--source-amicare-care-cards" : ""
  const set = (field: string) => (value: any) => onUpdate({ ...block, [field]: value })
  const idx = block.__index as number

  const setFeature = (i: number) => (key: string) => (value: any) => {
    const next = [...(block.features ?? [])]
    next[i] = { ...(next[i] ?? {}), [key]: value }
    onUpdate({ ...block, features: next })
  }

  const features: any[] = block.features ?? []
  const visibleFeatures = features.length ? features : [{}]
  const canAddFeature = !isReadOnly && features.length < MAX_FEATURE_CARDS
  const addFeature = () => {
    if (!canAddFeature) return
    onUpdate({ ...block, features: [...features, {}] })
  }
  const sectionProps = mergeCanvasSectionProps(
    {
      id: resolveBlockAnchor(block, { tenantRendererKey, surface: "canvas" }),
      className: `cms-block cms-block--featurelist ${amicareSourceClassName} relative bg-card/50 px-6 py-20 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-24 @min-[64rem]/site-frame:px-24 ${canvasSourceVariantClassName(block, tenantRendererKey, { rendererDom: "canvas-fallback" })}`.trim(),
      "data-source-variant": canvasSourceVariantDataAttribute(block, tenantRendererKey),
      "data-block-index": block.__index ?? undefined,
      "data-active": isActive || undefined,
      onClick: onActivate,
    },
    sectionChromeProps,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 space-y-3 text-center">
          <RtSlot
            as="span"
            variant="block"
            manifest={manifest}
            value={block.intro}
            onChange={set("intro")}
            className="cms-block__intro inline-block -rotate-2 text-[20px] text-accent [font-family:var(--font-script)]"
            placeholder={t("kickerIntroPlaceholder")}
            elementPath={{ blockIndex: idx, field: "intro" }}
          />
          <RtSlot
            as="h2"
            variant="inline"
            manifest={manifest}
            value={block.title}
            onChange={set("title")}
            className="cms-block__title font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px] [&_em]:not-italic [&_em]:italic [&_em]:text-accent [font-family:var(--font-heading)]"
            placeholder={t("sectionTitlePlaceholder")}
            elementPath={{ blockIndex: idx, field: "title" }}
          />
        </div>

        <div className="cms-block__features grid grid-cols-1 gap-8 @min-[48rem]/site-frame:grid-cols-3">
          {visibleFeatures.map((feature: any, i: number) => (
            <article
              key={features.length ? i : "empty-feature"}
              className="cms-block__feature overflow-hidden rounded-lg border border-rule bg-card shadow-lg"
            >
              <div className="cms-block__feature-icon flex h-32 items-center justify-center bg-accent/[0.08]">
                <InlineIcon
                  value={feature.icon}
                  onChange={setFeature(i)("icon")}
                  className="text-accent"
                  size={44}
                  strokeWidth={1.5}
                  elementPath={{ blockIndex: idx, field: "features", itemIndex: i, subField: "icon" }}
                />
              </div>
              <div className="space-y-3 p-7 text-center">
                <RtSlot
                  as="h3"
                  variant="inline"
                  manifest={manifest}
                  value={feature.title}
                  onChange={setFeature(i)("title")}
                  className="cms-block__feature-title font-serif text-[24px] leading-[1.2] [font-family:var(--font-heading)]"
                  placeholder={t("featureTitlePlaceholder")}
                  elementPath={{ blockIndex: idx, field: "features", itemIndex: i, subField: "title" }}
                />
                <RtSlot
                  as="p"
                  variant="block"
                  manifest={manifest}
                  value={feature.description}
                  onChange={setFeature(i)("description")}
                  className="cms-block__feature-description text-[16px] leading-[1.6] text-ink-muted [font-family:var(--font-text)]"
                  placeholder={t("featureDescriptionPlaceholder")}
                  elementPath={{ blockIndex: idx, field: "features", itemIndex: i, subField: "description" }}
                />
              </div>
            </article>
          ))}
          {canAddFeature && (
            <button
              type="button"
              className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-background/70 p-7 text-center text-muted-foreground transition-colors hover:border-ring hover:bg-accent/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                addFeature()
              }}
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-popover text-popover-foreground">
                <Plus className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-medium">{t("addFeatureCard")}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
