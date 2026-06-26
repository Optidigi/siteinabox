import type * as React from "react"
import type { Block, SiteGenerationBlockSlug } from "@siteinabox/contracts"
import type { MediaResolver } from "../media"

export type BlockRenderOptions = {
  index: number
  mediaResolver?: MediaResolver
  formAction?: string
}

export type BlockRendererComponent<TBlock extends Block = Block> = (props: {
  block: TBlock
  options: BlockRenderOptions
}) => React.ReactNode

export type BlockRegistry = Partial<Record<SiteGenerationBlockSlug, BlockRendererComponent<any>>>
