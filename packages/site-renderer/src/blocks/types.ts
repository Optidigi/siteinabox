import type * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { MediaResolver } from "../media"

export type RendererFieldPath = {
  blockIndex: number
  field: string
  itemIndex?: number
  subField?: string
  subItemIndex?: number
  subSubField?: string
}

export type RendererSectionProps = React.ComponentPropsWithoutRef<"section"> & {
  [key: `data-${string}`]: string | number | boolean | undefined
}

export type RendererSlotBase<TValue> = {
  value: TValue
  path: RendererFieldPath
  className?: string
  placeholder?: string
  style?: React.CSSProperties
}

export type RendererRichTextSlot = RendererSlotBase<unknown> & {
  kind: "richtext"
  block?: Block
  variant: "block" | "inline"
  as?: keyof React.JSX.IntrinsicElements
  blockMode?: "normal" | "inline" | "text"
  allowFontFamily?: boolean
}

export type RendererTextSlot = RendererSlotBase<string | null | undefined> & {
  kind: "text"
  as?: keyof React.JSX.IntrinsicElements
  multiline?: boolean
}

export type RendererIconSlot = RendererSlotBase<string | null | undefined> & {
  kind: "icon"
  value?: string | null
  size?: number
  strokeWidth?: number
}

export type RendererCtaSlot = RendererSlotBase<unknown> & {
  kind: "cta"
  value: unknown
  emptyLabel?: string
  actionName?: string
}

export type RendererImageSlot = RendererSlotBase<unknown> & {
  kind: "image"
  value: unknown
  imageClassName?: string
  alt?: string
  loading?: "eager" | "lazy"
}

export type RendererEditableSlot =
  | RendererRichTextSlot
  | RendererTextSlot
  | RendererIconSlot
  | RendererCtaSlot
  | RendererImageSlot

export type BlockRenderSlots = {
  render?: (slot: RendererEditableSlot) => React.ReactNode
  readOnly?: boolean
}

export type BlockRenderOptions = {
  index: number
  mediaResolver?: MediaResolver
  formAction?: string
  slots?: BlockRenderSlots
  sectionProps?: RendererSectionProps
  variantContext?: {
    legacyTenant?: "amicare" | null
    tenantSlug?: string | null
  }
  surface?: "canvas" | "live"
}

function mergeSyntheticEventHandlers<Event extends React.SyntheticEvent>(
  base?: (event: Event) => void,
  extension?: (event: Event) => void,
) {
  if (!base) return extension
  if (!extension) return base
  return (event: Event) => {
    base(event)
    extension(event)
  }
}

export function mergeRendererSectionProps(
  baseProps: RendererSectionProps,
  extensionProps?: RendererSectionProps,
): RendererSectionProps {
  if (!extensionProps) return baseProps

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
    className: extensionClassName,
    onClick: extensionOnClick,
    onMouseEnter: extensionOnMouseEnter,
    onMouseLeave: extensionOnMouseLeave,
    onFocusCapture: extensionOnFocusCapture,
    onBlurCapture: extensionOnBlurCapture,
    ...extensionRest
  } = extensionProps

  return {
    ...extensionRest,
    ...baseRest,
    className: [baseClassName, extensionClassName].filter(Boolean).join(" "),
    onClick: mergeSyntheticEventHandlers(baseOnClick, extensionOnClick),
    onMouseEnter: mergeSyntheticEventHandlers(baseOnMouseEnter, extensionOnMouseEnter),
    onMouseLeave: mergeSyntheticEventHandlers(baseOnMouseLeave, extensionOnMouseLeave),
    onFocusCapture: mergeSyntheticEventHandlers(baseOnFocusCapture, extensionOnFocusCapture),
    onBlurCapture: mergeSyntheticEventHandlers(baseOnBlurCapture, extensionOnBlurCapture),
  }
}

export type BlockRendererComponent<TBlock extends Block = Block> = (props: {
  block: TBlock
  options: BlockRenderOptions
}) => React.ReactNode

export type BlockRegistry = Partial<Record<Block["blockType"], BlockRendererComponent<any>>>
