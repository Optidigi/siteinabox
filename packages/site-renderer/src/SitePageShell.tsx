import * as React from "react"
import { getProviderBlockVariant } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import { SiteBanner, SiteFooter, SiteHeader, SiteMaintenanceBanner } from "./chrome"
import type { MediaResolver } from "./media"
import { ThemeCanvas } from "./theme"
import type { SitePageRendererProps } from "./SitePageRenderer"

export function SitePageShell({
  page,
  settings,
  theme,
  mediaResolver,
  className,
  canvasClassName,
  canvasAttributes,
  header,
  banner,
  footer,
  children,
}: Pick<
  SitePageRendererProps,
  "page" | "settings" | "theme" | "mediaResolver" | "className" | "canvasClassName" | "canvasAttributes" | "header" | "banner" | "footer"
> & { children: React.ReactNode }) {
  const firstVariant = page.blocks[0] ? getProviderBlockVariant(page.blocks[0]) : null
  const embedsNavigation = firstVariant?.composition.suppressesChromeAreas.some((area) => area === "header") ?? false
  const headerChrome = embedsNavigation
    ? null
    : header === undefined
      ? <SiteHeader settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
      : header

  return (
    <div className={cn("site-renderer", className)} data-siab-site-renderer>
      <ThemeCanvas
        theme={theme}
        {...canvasAttributes}
        className={cn("rt-canvas w-full", canvasClassName)}
        data-page-slug={page.slug}
        data-siab-composed-sections={page.blocks.length > 1 ? "true" : undefined}
      >
        <div className="site-frame-root">
          {banner === undefined
            ? <SiteBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
            : banner}
          {headerChrome}
          <SiteMaintenanceBanner settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
          {children}
          {footer === undefined
            ? <SiteFooter settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />
            : footer}
        </div>
      </ThemeCanvas>
    </div>
  )
}
