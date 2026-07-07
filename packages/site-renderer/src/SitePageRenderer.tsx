import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import { cn } from "@siteinabox/ui/lib/utils"
import { BlockRenderer, type BlockRegistry } from "./blocks"
import { SiteBanner, SiteFooter, SiteHeader, SiteMaintenanceBanner } from "./chrome"
import { AmicarePageRenderer, type AmicareRenderBlock, type AmicareRenderChrome } from "./tenant-renderers/amicare/AmicarePage"
import { resolveTenantRenderer } from "./tenant-renderers/resolve"
import type { MediaResolver } from "./media"
import { PUBLIC_RENDERER_THEME_SCOPE, ThemeStyle, themeMode } from "./theme"

const TAILWIND_PLUS_MARKETING_HEADER_WITH_STACKED_FLYOUT_MENU_ID =
  "tailwindplus.marketing.header.with-stacked-flyout-menu"
const TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_ID =
  "tailwindplus.marketing.hero.simple-centered"

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
  const headerChrome = header ?? <SiteHeader settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
  const bannerChrome = <SiteBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
  const maintenanceChrome = <SiteMaintenanceBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
  const firstBlock = page.blocks[0]
  const shouldAnchorHeaderToFirstBlock =
    settings.chrome?.header?.variant === TAILWIND_PLUS_MARKETING_HEADER_WITH_STACKED_FLYOUT_MENU_ID &&
    firstBlock?.designVariant === TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_ID &&
    !renderBlocks
  const renderedBody = shouldAnchorHeaderToFirstBlock && defaultRenderBlocks[0]
    ? (
      <>
        {bannerChrome}
        {maintenanceChrome}
        <div
          className="site-top-stack site-top-stack--source-tailwindplus-marketing-header-hero bg-white"
          data-siab-top-stack="tailwindplus.marketing.header-hero"
          data-provider-top-stack="tailwindplus"
          data-source-chrome-variant={TAILWIND_PLUS_MARKETING_HEADER_WITH_STACKED_FLYOUT_MENU_ID}
          data-anchored-source-variant={TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_ID}
        >
          {headerChrome}
          {defaultRenderBlocks[0]}
        </div>
        {defaultRenderBlocks.slice(1)}
      </>
    )
    : (
      <>
        {headerChrome}
        {bannerChrome}
        {maintenanceChrome}
        {renderBlocks ? renderBlocks({ blocks: page.blocks, defaultRenderBlocks }) : defaultRenderBlocks}
      </>
    )

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
          {renderedBody}
          {footer ?? <SiteFooter settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />}
        </div>
      </div>
    </div>
  )
}
