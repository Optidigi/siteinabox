import type * as React from "react"
import type { LucideIcon } from "lucide-react"
import type { Block, MediaRef, RtRoot, SiteSettings } from "@siteinabox/contracts"
import type { MediaResolver } from "../media"

export type RendererElementPath = {
  blockIndex: number
  field: string
  itemIndex?: number
  subField?: string
}

export type RendererDataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined
}

export type RendererSectionAttributes = React.ComponentPropsWithoutRef<"section"> & RendererDataAttributes

export type RendererRichTextSlotProps = {
  name: string
  value: RtRoot | null | undefined
  variant: "block" | "inline"
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  placeholder?: string
  elementPath: RendererElementPath
  allowFontFamily?: boolean
  blockMode?: "normal" | "inline" | "text"
}

export type RendererCtaSlotProps = {
  name: string
  value?: { label?: string | null; href?: string | null } | null
  className?: string
  style?: React.CSSProperties
  emptyLabel?: string
  actionAttributes?: Record<string, string>
  elementPath: RendererElementPath
}

export type RendererImageSlotProps = {
  name: string
  value: MediaRef | undefined
  alt?: string | null
  className?: string
  loading?: "eager" | "lazy"
  decoding?: "async" | "auto" | "sync"
  chrome?: "none" | "overlay"
  emptyLabel?: string
  changeLabel?: string
  removeLabel?: string
  openOnImageClick?: boolean
  elementPath: RendererElementPath
}

export type RendererIconSlotProps = {
  name: string
  value?: string | null
  /** Pre-resolved Lucide icon (preferred when variants use catalog fallbacks). */
  icon?: LucideIcon | null
  className?: string
  triggerClassName?: string
  size?: number
  strokeWidth?: number
  elementPath: RendererElementPath
}

export type RendererTextSlotProps = {
  name: string
  value?: string | null
  className?: string
  placeholder?: string
  multiline?: boolean
  elementPath: RendererElementPath
}

export type BlockEditSlots = {
  renderRichText?: (props: RendererRichTextSlotProps) => React.ReactNode
  renderCta?: (props: RendererCtaSlotProps) => React.ReactNode
  renderImage?: (props: RendererImageSlotProps) => React.ReactNode
  renderIcon?: (props: RendererIconSlotProps) => React.ReactNode
  renderText?: (props: RendererTextSlotProps) => React.ReactNode
}

export type BlockRenderOptions = {
  index: number
  mediaResolver?: MediaResolver
  formAction?: string
  editSlots?: BlockEditSlots
  sectionAttributes?: RendererSectionAttributes
  siteSettings?: SiteSettings
}

export type BlockRendererComponent<TBlock extends Block = Block> = (props: {
  block: TBlock
  options: BlockRenderOptions
}) => React.ReactNode

export type BlockRegistry = Partial<Record<Block["blockType"], BlockRendererComponent>>
