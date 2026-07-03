"use client"
import * as React from "react"
import {
  SITE_GENERATION_BLOCK_CATALOG_BY_SLUG,
  SITE_GENERATION_BLOCK_SLUGS,
  type SiteBlockCatalogVariant,
  type SiteGenerationBlockSlug,
} from "@siteinabox/contracts"
import {
  BlogCardsBlockRenderer,
  ComparisonBlockRenderer,
  CTABlockRenderer,
  ContactSectionBlockRenderer,
  FAQBlockRenderer,
  FeatureListBlockRenderer,
  GalleryBlockRenderer,
  HeroBlockRenderer,
  LogoCloudBlockRenderer,
  PricingBlockRenderer,
  ProcessStepsBlockRenderer,
  RichTextBlockRenderer,
  resolveBlockVariant,
  StatsBlockRenderer,
  TeamBlockRenderer,
  TestimonialsBlockRenderer,
  type BlockRenderOptions,
  type RendererEditableSlot,
} from "@siteinabox/site-renderer"
import type { RtManifest } from "@/lib/richText/manifest"
import { InlineCtaButton } from "@/components/editor/canvas/inline/InlineCtaButton"
import { InlineIcon } from "@/components/editor/canvas/inline/InlineIcon"
import { InlineImage } from "@/components/editor/canvas/inline/InlineImage"
import { RtSlot } from "@/components/editor/canvas/inline/RtSlot"
import { ClickToEditField } from "@/components/editor/canvas/inline/ClickToEditField"
import { cn } from "@siteinabox/ui/lib/utils"

type DataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined
}

type CanvasSectionBaseProps = React.ComponentPropsWithoutRef<"section"> & DataAttributes

export type CanvasSectionChromeProps = React.ComponentPropsWithRef<"section"> & DataAttributes

type SourceVariantContext = {
  legacyTenant?: "amicare" | null
}

const generationBlockSlugs = new Set<string>(SITE_GENERATION_BLOCK_SLUGS)

export interface CanvasBlockRendererProps {
  block: any
  index: number
  isActive: boolean
  manifest: RtManifest
  onActivate: () => void
  onUpdate: (next: any) => void
  tenantId?: number | string | null
  legacyTenant?: "amicare" | null
  sectionChromeProps?: CanvasSectionChromeProps
}

function mergeSyntheticEventHandlers<Event extends React.SyntheticEvent>(
  base?: (event: Event) => void,
  chrome?: (event: Event) => void,
) {
  if (!base) return chrome
  if (!chrome) return base
  return (event: Event) => {
    base(event)
    chrome(event)
  }
}

function mergeClickHandler(
  base?: React.MouseEventHandler<HTMLElement>,
  chrome?: React.MouseEventHandler<HTMLElement>,
) {
  return chrome ?? base
}

export function mergeCanvasSectionProps(
  baseProps: CanvasSectionBaseProps,
  chromeProps?: CanvasSectionChromeProps,
): CanvasSectionChromeProps {
  if (!chromeProps) return baseProps

  const {
    className: baseClassName,
    onClick: baseOnClick,
    onMouseEnter: baseOnMouseEnter,
    onMouseLeave: baseOnMouseLeave,
    onFocusCapture: baseOnFocusCapture,
    onBlurCapture: baseOnBlurCapture,
    ...baseRest
  } = baseProps
  const {
    className: chromeClassName,
    onClick: chromeOnClick,
    onMouseEnter: chromeOnMouseEnter,
    onMouseLeave: chromeOnMouseLeave,
    onFocusCapture: chromeOnFocusCapture,
    onBlurCapture: chromeOnBlurCapture,
    ...chromeRest
  } = chromeProps

  return {
    ...chromeRest,
    ...baseRest,
    className: cn(baseClassName, chromeClassName),
    onClick: mergeClickHandler(baseOnClick, chromeOnClick),
    onMouseEnter: mergeSyntheticEventHandlers(baseOnMouseEnter, chromeOnMouseEnter),
    onMouseLeave: mergeSyntheticEventHandlers(baseOnMouseLeave, chromeOnMouseLeave),
    onFocusCapture: mergeSyntheticEventHandlers(baseOnFocusCapture, chromeOnFocusCapture),
    onBlurCapture: mergeSyntheticEventHandlers(baseOnBlurCapture, chromeOnBlurCapture),
  }
}

export function resolvedCanvasSourceVariant(block: any, context: SourceVariantContext = {}): SiteBlockCatalogVariant | undefined {
  if (!generationBlockSlugs.has(block?.blockType)) return undefined
  const catalog = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[block.blockType as SiteGenerationBlockSlug]
  const resolved = resolveBlockVariant(block, context)
  if (!resolved.variant) return undefined
  return (catalog.variants as readonly SiteBlockCatalogVariant[]).find((entry) =>
    entry.variant === resolved.variant
  )
}

export function canvasSourceVariantDataAttribute(block: any, legacyTenant?: "amicare" | null) {
  return resolveBlockVariant(block, { legacyTenant }).variant
}

export function canvasSourceVariantClassName(
  block: any,
  legacyTenant?: "amicare" | null,
  options: { rendererDom?: "native" | "legacy" } = {},
) {
  if (options.rendererDom === "legacy") return ""
  return resolveBlockVariant(block, { legacyTenant }).rendererClassName ?? ""
}

function updateRendererSlotValue(block: any, onUpdate: (next: any) => void, slot: RendererEditableSlot, value: unknown) {
  const { field, itemIndex, subField, subItemIndex, subSubField } = slot.path
  if (itemIndex == null) {
    onUpdate({ ...block, [field]: value })
    return
  }

  const items = [...(block[field] ?? [])]
  const item = { ...(items[itemIndex] ?? {}) }

  if (!subField) {
    items[itemIndex] = value
    onUpdate({ ...block, [field]: items })
    return
  }

  if (subItemIndex == null) {
    item[subField] = value
    items[itemIndex] = item
    onUpdate({ ...block, [field]: items })
    return
  }

  const nestedItems = [...(item[subField] ?? [])]
  const nestedItem = { ...(nestedItems[subItemIndex] ?? {}) }
  if (subSubField) {
    nestedItem[subSubField] = value
    nestedItems[subItemIndex] = nestedItem
  } else {
    nestedItems[subItemIndex] = value
  }
  item[subField] = nestedItems
  items[itemIndex] = item
  onUpdate({ ...block, [field]: items })
}

function renderCanvasSlot({
  block,
  manifest,
  onUpdate,
  tenantId,
}: Pick<CanvasBlockRendererProps, "block" | "manifest" | "onUpdate" | "tenantId">) {
  return (slot: RendererEditableSlot) => {
    const onChange = (next: unknown) => updateRendererSlotValue(block, onUpdate, slot, next)
    switch (slot.kind) {
      case "richtext":
        return (
          <RtSlot
            as={slot.as}
            variant={slot.variant}
            manifest={manifest}
            value={slot.value as any}
            onChange={onChange as any}
            className={slot.className}
            style={slot.style}
            placeholder={slot.placeholder}
            elementPath={slot.path}
            allowFontFamily={slot.allowFontFamily}
          />
        )
      case "icon":
        return (
          <InlineIcon
            value={slot.value}
            onChange={onChange as (next: string | null) => void}
            className={slot.className}
            size={slot.size}
            strokeWidth={slot.strokeWidth}
            elementPath={slot.path}
          />
        )
      case "image":
        if (slot.imageClassName) {
          return (
            <figure className={slot.className} style={slot.style}>
              <InlineImage
                value={slot.value}
                onChange={onChange}
                tenantId={tenantId ?? undefined}
                chrome="overlay"
                alt={slot.alt}
                className={slot.imageClassName}
                elementPath={slot.path}
              />
            </figure>
          )
        }
        return (
          <InlineImage
            value={slot.value}
            onChange={onChange}
            tenantId={tenantId ?? undefined}
            chrome="overlay"
            alt={slot.alt}
            className={slot.className}
            style={slot.style}
            elementPath={slot.path}
          />
        )
      case "cta":
        return (
          <InlineCtaButton
            value={slot.value as any}
            onChange={onChange as any}
            className={slot.className}
            style={slot.style}
            emptyLabel={slot.emptyLabel}
            elementPath={slot.path}
          />
        )
      case "text":
        return (
          <ClickToEditField
            ariaLabel={slot.placeholder ?? "Edit text"}
            affordance="inline"
            className={slot.className}
            style={slot.style}
            elementPath={slot.path}
            editor={(close) => {
              const commonProps = {
                autoFocus: true,
                defaultValue: slot.value ?? "",
                placeholder: slot.placeholder,
                className: "rounded border border-border bg-popover px-2 py-1 text-sm text-foreground outline-none ring-1 ring-ring",
                onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                  onChange(event.target.value)
                  close()
                },
                onClick: (event: React.MouseEvent) => event.stopPropagation(),
                onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                  if (event.key === "Escape") close()
                  if (!slot.multiline && event.key === "Enter") {
                    onChange(event.currentTarget.value)
                    close()
                  }
                },
              }
              return slot.multiline
                ? <textarea rows={4} {...commonProps} />
                : <input type="text" {...commonProps} />
            }}
          >
            {slot.value || <span className="text-muted-foreground">{slot.placeholder}</span>}
          </ClickToEditField>
        )
      default:
        return null
    }
  }
}

function rendererCanvasOptions(
  props: CanvasBlockRendererProps,
  blockWithIndex: any,
): BlockRenderOptions {
  return {
    index: props.index,
    surface: "canvas",
    slots: { render: renderCanvasSlot({ ...props, block: blockWithIndex }) },
    sectionProps: mergeCanvasSectionProps(
      {
        "data-active": props.isActive || undefined,
        onClick: props.onActivate,
      },
      props.sectionChromeProps,
    ),
    variantContext: { legacyTenant: props.legacyTenant },
  }
}

/** Per-block-type dispatcher for canvas mode. Each block renderer is in
 *  `./blocks/<Name>.tsx`. Unknown block types fall back to a debug panel.
 *
 *  `block.__index` is injected here from `props.index` so the individual
 *  block renderers can derive their ElementPath blockIndex without drilling
 *  a separate prop — they read `block.__index` as the canonical block position.
 *  This is the ONLY place that sets `__index`; block renderers must NOT
 *  derive it any other way.
 */
export const CanvasBlockRenderer: React.FC<CanvasBlockRendererProps> = (props) => {
  const { block, index } = props
  // Stamp __index so block renderers can derive ElementPath without an extra prop.
  const blockWithIndex = { ...block, __index: index }
  const augmented = { ...props, block: blockWithIndex }
  const unknownSectionProps = mergeCanvasSectionProps(
    {
      className: "cms-block cms-block--unknown rounded-md border border-destructive bg-destructive/5 p-4 text-sm text-destructive my-2",
      "data-block-index": index,
      "data-active": props.isActive || undefined,
      onClick: props.onActivate,
    },
    props.sectionChromeProps,
  )

  switch (block?.blockType) {
    case "hero":           return (
      <HeroBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "featureList":    return (
      <FeatureListBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "cta":            return (
      <CTABlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "richText":       return (
      <RichTextBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "contactSection": return (
      <ContactSectionBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "faq":            return (
      <FAQBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "testimonials":   return (
      <TestimonialsBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "pricing":        return (
      <PricingBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "stats":          return (
      <StatsBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "logoCloud":      return (
      <LogoCloudBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "gallery":        return (
      <GalleryBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "team":           return (
      <TeamBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "blogCards":      return (
      <BlogCardsBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "processSteps":   return (
      <ProcessStepsBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    case "comparison":     return (
      <ComparisonBlockRenderer
        block={blockWithIndex}
        options={rendererCanvasOptions(props, blockWithIndex)}
      />
    )
    default:
      return (
        <section {...unknownSectionProps}>
          Unknown block type: <code>{String(block?.blockType ?? "?")}</code>
        </section>
      )
  }
}
