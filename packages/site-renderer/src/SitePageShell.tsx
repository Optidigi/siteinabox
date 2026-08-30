import * as React from "react"
import { cn } from "@siteinabox/ui/lib/utils"
import { ThemeCanvas } from "./theme"
import type { SitePageRendererProps } from "./SitePageRenderer"
import { NavbarRenderer } from "./chrome/Navbar"
import { FooterRenderer } from "./chrome/Footer"
import { ConsentRenderer } from "./chrome/Consent"

export function SitePageShell({
  page,
  settings,
  theme,
  mediaResolver,
  className,
  canvasClassName,
  canvasAttributes,
  consentAvailable,
  children,
}: Pick<
  SitePageRendererProps,
  "page" | "settings" | "theme" | "mediaResolver" | "className" | "canvasClassName" | "canvasAttributes" | "consentAvailable"
> & {
  children: React.ReactNode
}) {
  return (
    <div className={cn("site-renderer", className)} data-siab-site-renderer>
      <ThemeCanvas
        theme={theme}
        {...canvasAttributes}
        className={cn("rt-canvas w-full bg-background text-foreground", canvasClassName)}
        data-page-slug={page.slug}
        data-siab-composed-sections={page.blocks.length > 1 ? "true" : undefined}
      >
        <div className={cn(
          "site-frame-root",
          settings.chrome?.navbar?.placement === "hero-overlay" && "site-frame-root-navbar-overlay",
          settings.chrome?.navbar?.placement === "sticky" && "site-frame-root-navbar-sticky",
        )} data-siab-navbar-variant={settings.chrome?.navbar?.variant}>
          <NavbarRenderer page={page} settings={settings} theme={theme} mediaResolver={mediaResolver} />
          <main>
          {children}
          </main>
          <FooterRenderer settings={settings} mediaResolver={mediaResolver} />
          <ConsentRenderer
            settings={settings}
            mediaResolver={mediaResolver}
            consentAvailable={consentAvailable}
          />
        </div>
      </ThemeCanvas>
    </div>
  )
}
