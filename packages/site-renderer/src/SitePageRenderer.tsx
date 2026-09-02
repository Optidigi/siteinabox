import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import { BlockRenderer, type BlockEditSlots } from "./blocks"
import { resolveBlockAnchor } from "./blocks/anchors"
import { sectionAnalyticsAttrs } from "./analytics"
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
  mediaResolver?: MediaResolver
  imageLoading?: "eager" | "lazy"
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
  /** Public runtime sets this only when an approved analytics config exists. */
  consentAvailable?: boolean
  /** Appointment sections use the real public API by default and local behavior in CMS frames. */
  appointmentMode?: "public" | "preview"
  includeBehaviorScripts?: boolean
  renderBlocks?: SiteRenderBlocks
}

export function SitePageRenderer({
  page,
  settings,
  theme,
  mediaResolver,
  imageLoading,
  formAction,
  editSlots,
  blockIndexOffset = 0,
  className,
  canvasClassName,
  canvasAttributes,
  nonce,
  tenantSlug,
  domain,
  consentAvailable,
  appointmentMode = "public",
  includeBehaviorScripts = true,
  renderBlocks,
}: SitePageRendererProps) {
  const defaultRenderBlocks = page.blocks.map((block, index) => {
    const sectionAnchor = resolveBlockAnchor(block)

    return (
      <BlockRenderer
        key={`${block.blockType}-${"variant" in block ? block.variant : index}`}
        block={block}
        options={{
          index: blockIndexOffset + index,
          mediaResolver,
          imageLoading,
          formAction,
          editSlots,
          siteSettings: settings,
          theme,
          appointmentMode,
          sectionAttributes: {
            id: sectionAnchor,
            "data-block-index": blockIndexOffset + index,
            "data-block-type": block.blockType,
            ...sectionAnalyticsAttrs({
              sectionType: block.blockType,
              sectionPosition: blockIndexOffset + index,
              sectionAnchor: sectionAnchor ?? null,
            }, block.blockType, blockIndexOffset + index),
          },
        }}
      />
    )
  })
  return (
    <SitePageShell {...{ page, settings, theme, mediaResolver, className, canvasClassName, canvasAttributes, consentAvailable }}>
      {renderBlocks ? renderBlocks({ blocks: page.blocks, defaultRenderBlocks }) : defaultRenderBlocks}
    </SitePageShell>
  )
}
