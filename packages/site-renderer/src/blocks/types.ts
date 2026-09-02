import type * as React from "react"
import type { LucideIcon } from "lucide-react"
import type { Block, MediaRef, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
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

export type RendererCtaSlotProps = {
  name: string
  value?: { label?: string | null; href?: string | null; external?: boolean } | null
  className?: string
  style?: React.CSSProperties
  /** Decorative directional affordance required to keep editor/public CTA parity. */
  showArrow?: boolean
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
  /** Pre-resolved Lucide icon supplied by the editor integration. */
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
  renderCta?: (props: RendererCtaSlotProps) => React.ReactNode
  renderImage?: (props: RendererImageSlotProps) => React.ReactNode
  renderIcon?: (props: RendererIconSlotProps) => React.ReactNode
  renderText?: (props: RendererTextSlotProps) => React.ReactNode
}

export type BlockRenderOptions = {
  index: number
  mediaResolver?: MediaResolver
  /** Preview/editor-only override for comparison surfaces that intentionally show many heroes at once. */
  imageLoading?: "eager" | "lazy"
  formAction?: string
  editSlots?: BlockEditSlots
  sectionAttributes?: RendererSectionAttributes
  siteSettings?: SiteSettings
  theme?: ThemeTokenSpec | null
  /** Public output uses the real appointment API; CMS frames use deterministic local behavior. */
  appointmentMode?: "public" | "preview"
}

export type BlockRendererComponent<TBlock extends Block = Block> = (props: {
  block: TBlock
  options: BlockRenderOptions
}) => React.ReactNode
