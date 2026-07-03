import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import { cn } from "@siteinabox/ui/lib/utils"
import { BlockRenderer, type BlockRegistry } from "./blocks"
import { SiteBanner, SiteFooter, SiteHeader, SiteMaintenanceBanner } from "./chrome"
import {
  AmicareCookieConsent,
  AmicareFooter,
  AmicareMaintenanceBanner,
  AmicareNav,
  AmicareNavBehavior,
  type RenderProfileBlockOverride,
  type RenderProfileChromeOverride,
} from "./profiles/amicare"
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
  renderHeader?: RenderProfileChromeOverride
  renderFooter?: RenderProfileChromeOverride
  renderBlock?: RenderProfileBlockOverride
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
  const variantContext = { legacyTenant, tenantSlug }

  const defaultRenderBlocks = page.blocks.map((block, index) => {
    const defaultRender = (
      <BlockRenderer
        block={block}
        index={index}
        registry={registry}
        options={{ mediaResolver, formAction, variantContext, surface: "live" }}
      />
    )

    return (
      <React.Fragment key={`${block.blockType}-${index}`}>
        {renderBlock ? renderBlock({ block, index, defaultRender }) : defaultRender}
      </React.Fragment>
    )
  })
  const isAmicareProfile = legacyTenant === "amicare"
  const defaultHeader = isAmicareProfile
    ? <AmicareNav settings={settings} mediaResolver={mediaResolver} />
    : <SiteHeader settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
  const defaultFooter = isAmicareProfile
    ? <AmicareFooter settings={settings} mediaResolver={mediaResolver} />
    : <SiteFooter settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />

  return (
    <div
      className={cn(
        "site-renderer",
        className,
      )}
      data-siab-site-renderer
      data-renderer-profile={isAmicareProfile ? "amicare" : undefined}
      data-legacy-tenant={legacyTenant ?? undefined}
    >
      {includeThemeStyle && <ThemeStyle theme={theme} nonce={nonce} scope={PUBLIC_RENDERER_THEME_SCOPE} />}
      <div
        {...canvasAttributes}
        className={cn(
          "rt-canvas w-full",
          isAmicareProfile && "[container-name:site-frame] [container-type:inline-size]",
          canvasClassName,
        )}
        data-rt-mode={themeMode(theme)}
        data-page-slug={page.slug}
      >
        <div className="site-frame-root">
          {header ?? (renderHeader ? renderHeader({ defaultChrome: defaultHeader }) : defaultHeader)}
          {isAmicareProfile ? (
            <AmicareMaintenanceBanner settings={settings} />
          ) : (
            <>
              <SiteBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
              <SiteMaintenanceBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
            </>
          )}
          <main>{renderBlocks ? renderBlocks({ blocks: page.blocks, defaultRenderBlocks }) : defaultRenderBlocks}</main>
          {footer ?? (renderFooter ? renderFooter({ defaultChrome: defaultFooter }) : defaultFooter)}
        </div>
        {isAmicareProfile && includeBehaviorScripts && (
          <>
            <AmicareCookieConsent enabled={Boolean(settings.analytics || page.analytics)} nonce={nonce} />
            <AmicareNavBehavior nonce={nonce} />
          </>
        )}
      </div>
    </div>
  )
}
