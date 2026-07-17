import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import { cn } from "@siteinabox/ui/lib/utils"
import { BlockRenderer, type BlockRegistry } from "./blocks"
import { SiteBanner, SiteFooter, SiteHeader, SiteMaintenanceBanner } from "./chrome"
import { AmicarePageRenderer, type AmicareRenderBlock, type AmicareRenderChrome } from "./tenant-renderers/amicare/AmicarePage"
import { resolveTenantRenderer } from "./tenant-renderers/resolve"
import type { MediaResolver } from "./media"
import { ThemeCanvas } from "./theme"
import { getProviderBlockVariant } from "@siteinabox/contracts"

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
  const firstBlock = page.blocks[0]
  const firstVariant = firstBlock ? getProviderBlockVariant(firstBlock) : null
  const embedsNavigation = firstVariant?.composition.suppressesChromeAreas.some((area) => area === "header") ?? false
  const headerChrome = embedsNavigation ? null : (header ?? <SiteHeader settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />)
  const bannerChrome = <SiteBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
  const maintenanceChrome = <SiteMaintenanceBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
  const renderedBody = <>{bannerChrome}{headerChrome}{maintenanceChrome}{renderBlocks ? renderBlocks({ blocks: page.blocks, defaultRenderBlocks }) : defaultRenderBlocks}</>

  return (
    <div className={cn("site-renderer", className)} data-siab-site-renderer>
      <ThemeCanvas
        theme={theme}
        {...canvasAttributes}
        className={cn("rt-canvas w-full", canvasClassName)}
        data-page-slug={page.slug}
      >
        <div className="site-frame-root">
          {renderedBody}
          {footer ?? <SiteFooter settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />}
        </div>
      </ThemeCanvas>
    </div>
  )
}
