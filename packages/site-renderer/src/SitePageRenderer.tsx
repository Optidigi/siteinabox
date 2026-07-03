import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import { cn } from "@siteinabox/ui/lib/utils"
import { BlockRenderer, type BlockRegistry } from "./blocks"
import { SiteBanner, SiteFooter, SiteHeader, SiteMaintenanceBanner } from "./chrome"
import { AmicarePageRenderer, type AmicareRenderBlock, type AmicareRenderChrome } from "./legacy-tenants/amicare/AmicarePage"
import { resolveLegacyTenant } from "./legacy-tenants/resolve"
import type { MediaResolver } from "./media"
import { PUBLIC_RENDERER_THEME_SCOPE, ThemeStyle, themeMode } from "./theme"

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
  includeThemeStyle?: boolean
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
  includeThemeStyle = true,
  includeBehaviorScripts = true,
  header,
  footer,
  renderHeader,
  renderFooter,
  renderBlock,
  renderBlocks,
}: SitePageRendererProps) {
  const legacyTenant = resolveLegacyTenant({ tenantSlug, domain, settings })

  if (legacyTenant === "amicare") {
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
        includeThemeStyle={includeThemeStyle}
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
      options={{ mediaResolver, formAction }}
    />
  ))

  return (
    <div className={cn("site-renderer", className)} data-siab-site-renderer>
      {includeThemeStyle && <ThemeStyle theme={theme} nonce={nonce} scope={PUBLIC_RENDERER_THEME_SCOPE} />}
      <div
        {...canvasAttributes}
        className={cn("rt-canvas w-full", canvasClassName)}
        data-rt-mode={themeMode(theme)}
        data-page-slug={page.slug}
      >
        <div className="site-frame-root">
          {header ?? <SiteHeader settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />}
          <SiteBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
          <SiteMaintenanceBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
          {renderBlocks ? renderBlocks({ blocks: page.blocks, defaultRenderBlocks }) : defaultRenderBlocks}
          {footer ?? <SiteFooter settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />}
        </div>
      </div>
    </div>
  )
}
