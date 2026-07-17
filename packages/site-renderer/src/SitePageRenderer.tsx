import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import { BlockRenderer, type BlockRegistry } from "./blocks"
import { AmicarePageRenderer, type AmicareRenderBlock, type AmicareRenderChrome } from "./tenant-renderers/amicare/AmicarePage"
import { resolveTenantRenderer } from "./tenant-renderers/resolve"
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
  renderHeader?: AmicareRenderChrome
  renderFooter?: AmicareRenderChrome
  renderBlock?: AmicareRenderBlock
  renderBlocks?: SiteRenderBlocks
}

export function SitePageRenderer({
  page,
  settings,
  theme,
  registry,
  mediaResolver,
  formAction,
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
  renderHeader,
  renderFooter,
  renderBlock,
  renderBlocks,
}: SitePageRendererProps) {
  const tenantRendererKey = resolveTenantRenderer({ tenantSlug, domain, settings })

  if (tenantRendererKey === "amicare") {
    return (
      <AmicarePageRenderer
        page={page}
        settings={settings}
        theme={theme}
        registry={registry}
        mediaResolver={mediaResolver}
        formAction={formAction}
        className={className}
        canvasClassName={canvasClassName}
        canvasAttributes={canvasAttributes}
        nonce={nonce}
        includeBehaviorScripts={includeBehaviorScripts}
        renderBlock={renderBlock}
        renderBlocks={renderBlocks}
        renderHeader={renderHeader}
        renderFooter={renderFooter}
      />
    )
  }

  const defaultRenderBlocks = page.blocks.map((block, index) => (
    <BlockRenderer
      key={`${block.blockType}-${index}`}
      block={block}
      index={index}
      registry={registry}
      options={{ mediaResolver, formAction, siteSettings: settings }}
    />
  ))
  return (
    <SitePageShell {...{ page, settings, theme, mediaResolver, className, canvasClassName, canvasAttributes, header, banner, footer }}>
      {renderBlocks ? renderBlocks({ blocks: page.blocks, defaultRenderBlocks }) : defaultRenderBlocks}
    </SitePageShell>
  )
}
