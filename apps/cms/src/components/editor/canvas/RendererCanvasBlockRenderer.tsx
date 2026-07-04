"use client"

import * as React from "react"
import {
  BlockRenderer,
  createRendererMediaResolver,
  type BlockEditSlots,
  type RendererElementPath,
} from "@siteinabox/site-renderer"
import type { RtManifest } from "@/lib/richText/manifest"
import { RtSlot } from "@/components/editor/canvas/inline/RtSlot"
import { InlineImage } from "@/components/editor/canvas/inline/InlineImage"
import { InlineCtaButton } from "@/components/editor/canvas/inline/InlineCtaButton"
import { InlineIcon } from "@/components/editor/canvas/inline/InlineIcon"
import { ClickToEditField } from "@/components/editor/canvas/inline/ClickToEditField"
import { useTranslations } from "next-intl"

type DataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined
}

type CanvasSectionChromeProps = React.ComponentPropsWithRef<"section"> & DataAttributes

type RendererCanvasBlockRendererProps = {
  block: any
  index: number
  isActive: boolean
  manifest: RtManifest
  onActivate: () => void
  onUpdate: (next: any) => void
  tenantId?: number | string | null
  sectionChromeProps?: CanvasSectionChromeProps
}

function mergeSectionProps(
  baseProps: React.ComponentPropsWithoutRef<"section"> & DataAttributes,
  chromeProps?: CanvasSectionChromeProps,
): CanvasSectionChromeProps {
  if (!chromeProps) return baseProps
  const { className: baseClassName, onClick: baseOnClick, ...baseRest } = baseProps
  const { className: chromeClassName, onClick: chromeOnClick, ...chromeRest } = chromeProps
  return {
    ...chromeRest,
    ...baseRest,
    className: [baseClassName, chromeClassName].filter(Boolean).join(" "),
    onClick: chromeOnClick ?? baseOnClick,
  }
}

function placeholderFor(name: string, t: (key: any) => string) {
  if (name.endsWith(".eyebrow")) return t("eyebrowPlaceholder")
  if (name === "hero.headline" || name === "cta.headline") return t("headlinePlaceholder")
  if (name === "hero.subheadline") return t("subheadlinePlaceholder")
  if (name === "featureList.intro") return t("kickerIntroPlaceholder")
  if (name === "featureList.title") return t("sectionTitlePlaceholder")
  if (name === "featureList.featureTitle") return t("featureTitlePlaceholder")
  if (name === "featureList.featureDescription") return t("featureDescriptionPlaceholder")
  if (name === "cta.description") return t("descriptionPlaceholder")
  return t("longFormContentPlaceholder")
}

export function RendererCanvasBlockRenderer({
  block,
  index,
  isActive,
  manifest,
  onActivate,
  onUpdate,
  tenantId,
  sectionChromeProps,
}: RendererCanvasBlockRendererProps) {
  const t = useTranslations("editor")
  const mediaResolver = React.useMemo(
    () => tenantId != null ? createRendererMediaResolver(String(tenantId)) : undefined,
    [tenantId],
  )

  const updateField = React.useCallback((path: RendererElementPath, value: unknown) => {
    if (path.field === "features" && path.itemIndex != null && path.subField) {
      const next = [...(block.features ?? [])]
      next[path.itemIndex] = { ...(next[path.itemIndex] ?? {}), [path.subField]: value }
      onUpdate({ ...block, features: next })
      return
    }
    if (path.field === "pills" && path.itemIndex != null) {
      const next = [...(block.pills ?? [])]
      next[path.itemIndex] = { ...(next[path.itemIndex] ?? {}), label: value }
      onUpdate({ ...block, pills: next })
      return
    }
    onUpdate({ ...block, [path.field]: value })
  }, [block, onUpdate])

  const slots = React.useMemo<BlockEditSlots>(() => ({
    renderRichText: (slot) => (
      <RtSlot
        as={slot.as}
        variant={slot.variant}
        manifest={manifest}
        value={slot.value ?? undefined}
        onChange={(next) => updateField(slot.elementPath, next)}
        className={slot.className}
        placeholder={slot.placeholder ?? placeholderFor(slot.name, t)}
        elementPath={slot.elementPath}
        allowFontFamily={slot.allowFontFamily}
      />
    ),
    renderCta: (slot) => (
      <InlineCtaButton
        value={slot.value}
        onChange={(next) => updateField(slot.elementPath, next)}
        className={slot.className}
        style={slot.style}
        actionAttributes={slot.actionAttributes}
        emptyLabel={slot.emptyLabel ?? (slot.name === "cta.primary" ? t("addContactLink") : t("addCtaButton"))}
        elementPath={slot.elementPath}
      />
    ),
    renderImage: (slot) => (
      <InlineImage
        value={slot.value}
        onChange={(next) => updateField(slot.elementPath, next)}
        alt={slot.alt}
        className={slot.className}
        tenantId={tenantId ?? undefined}
        chrome={slot.chrome}
        emptyLabel={slot.emptyLabel}
        changeLabel={slot.changeLabel}
        removeLabel={slot.removeLabel}
        openOnImageClick={slot.openOnImageClick}
        elementPath={slot.elementPath}
      />
    ),
    renderIcon: (slot) => (
      <InlineIcon
        value={slot.value}
        onChange={(next) => updateField(slot.elementPath, next)}
        className={slot.className}
        triggerClassName={slot.triggerClassName}
        size={slot.size}
        strokeWidth={slot.strokeWidth}
        elementPath={slot.elementPath}
      />
    ),
    renderText: (slot) => (
      <ClickToEditField
        ariaLabel={`Edit ${slot.name}`}
        affordance="inline"
        elementPath={slot.elementPath}
        editor={(close) => (
          <input
            autoFocus
            type="text"
            defaultValue={slot.value ?? ""}
            placeholder={slot.placeholder}
            className="rounded border border-border bg-popover px-2 py-0.5 text-[12px] text-ink-muted outline-none ring-1 ring-ring"
            onBlur={(event) => {
              updateField(slot.elementPath, event.target.value)
              close()
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                updateField(slot.elementPath, event.currentTarget.value)
                close()
              }
              if (event.key === "Escape") close()
            }}
            onClick={(event) => event.stopPropagation()}
          />
        )}
      >
        {slot.value || <span className="text-muted-foreground">{slot.placeholder ?? t("pillLabelPlaceholder")}</span>}
      </ClickToEditField>
    ),
  }), [manifest, t, tenantId, updateField])

  const sectionAttributes = mergeSectionProps(
    {
      "data-active": isActive || undefined,
      onClick: onActivate,
    },
    sectionChromeProps,
  )

  return (
    <BlockRenderer
      block={block}
      index={index}
      options={{ mediaResolver, formAction: "#", editSlots: slots, sectionAttributes }}
    />
  )
}
