import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import { BlockRenderer, type BlockEditSlots, type BlockRegistry } from "./blocks"
import type { MediaResolver } from "./media"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import { SitePageShell } from "./SitePageShell"

export type SiteRenderBlocks = (args: {
  blocks: Page["blocks"]
  defaultRenderBlocks: React.ReactNode[]
}) => React.ReactNode

export type SitePageRendererProps = {
  page: Page
  settings: SiteSettings
  theme?: ThemeTokenSpec | null
  registry?: BlockRegistry
  mediaResolver?: MediaResolver
  formAction?: string
  /** Editor-only field markers / inline edit hooks. Never set for public renderer output. */
  editSlots?: BlockEditSlots
  /**
   * When the page is a sliced view (e.g. mobile focused section with one block),
   * add this offset so `data-block-index` / element paths stay page-canonical.
   */
  blockIndexOffset?: number
  className?: string
  canvasClassName?: string
  canvasAttributes?: React.HTMLAttributes<HTMLDivElement>
  nonce?: string
  tenantSlug?: string | null
  domain?: string | null
  includeBehaviorScripts?: boolean
  header?: React.ReactNode
  banner?: React.ReactNode
  footer?: React.ReactNode
  renderBlocks?: SiteRenderBlocks
}

export function SitePageRenderer({
  page,
  settings,
  theme,
  registry,
  mediaResolver,
  formAction,
  editSlots,
  blockIndexOffset = 0,
  className,
  canvasClassName,
  canvasAttributes,
  nonce,
  tenantSlug,
  domain,
  includeBehaviorScripts = true,
  header,
  banner,
  footer,
  renderBlocks,
}: SitePageRendererProps) {
  const defaultRenderBlocks = page.blocks.map((block, index) => (
    <BlockRenderer
      key={`${block.blockType}-${index}`}
      block={block}
      index={blockIndexOffset + index}
      registry={registry}
      options={{ mediaResolver, formAction, editSlots, siteSettings: settings }}
    />
  ))
  return (
    <SitePageShell {...{ page, settings, theme, mediaResolver, className, canvasClassName, canvasAttributes, header, banner, footer }}>
      {renderBlocks ? renderBlocks({ blocks: page.blocks, defaultRenderBlocks }) : defaultRenderBlocks}
    </SitePageShell>
  )
}
