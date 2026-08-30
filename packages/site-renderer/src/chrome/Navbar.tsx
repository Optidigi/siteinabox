import * as React from "react"
import { DEFAULT_THEME_TOKEN_SPEC, type Page, type SiteSettings, type ThemeTokenSpec } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import { assertNever } from "../blocks/shared"
import { resolveMedia } from "../media"
import { Navbar01 } from "./Navbar01"
import { Navbar02 } from "./Navbar02"
import { Navbar03 } from "./Navbar03"
import type { NavbarVariantProps } from "./NavbarShared"

export type NavbarRendererProps = {
  page: Page
  settings: SiteSettings
  theme?: ThemeTokenSpec | null
  mediaResolver?: NavbarVariantProps["mediaResolver"]
}

function hasImageDrivenOpeningHero(
  page: Page,
  theme: ThemeTokenSpec | null | undefined,
  mediaResolver: NavbarVariantProps["mediaResolver"],
): boolean {
  if ((theme?.appearance?.backgroundMode ?? DEFAULT_THEME_TOKEN_SPEC.appearance.backgroundMode) !== "image") {
    return false
  }

  const openingBlock = page.blocks[0]
  if (openingBlock?.blockType !== "hero") return false

  // Hero-03, hero-04, and hero-05 own ordinary image slots in their
  // composition. Their image does not sit behind a transparent opening
  // navbar, so it must not opt the navbar into on-media contrast. Only the
  // lead and service-panel designs consume the global image mode as a
  // full-bleed opening background.
  if (openingBlock.variant !== "hero-01" && openingBlock.variant !== "hero-02") return false

  return Boolean(openingBlock.image && resolveMedia(openingBlock.image, mediaResolver))
}

function NavbarVariantView(props: NavbarVariantProps) {
  switch (props.navbar.variant) {
    case "navbar-01":
      return <Navbar01 {...props} />
    case "navbar-02":
      return <Navbar02 {...props} />
    case "navbar-03":
      return <Navbar03 {...props} />
    default:
      return assertNever(props.navbar.variant)
  }
}

export function NavbarRenderer({ page, settings, theme, mediaResolver }: NavbarRendererProps) {
  const navbar = settings.chrome?.navbar
  if (!navbar) return null
  const links = settings.navigation?.primary ?? []
  const variantClassName = `site-navbar-variant-${navbar.variant.replace("navbar-", "")}`
  const placementClassName = navbar.placement === "hero-overlay"
    ? "site-navbar-frame-hero-overlay"
    : "site-navbar-frame-sticky"
  const openingHeroUsesImage = hasImageDrivenOpeningHero(page, theme, mediaResolver)
  return (
    <div
      className={cn("site-navbar-frame", placementClassName, variantClassName)}
      data-siab-navbar-frame="true"
      data-navbar-placement={navbar.placement}
      data-navbar-variant={navbar.variant}
      data-navbar-active-mode={navbar.activeMode ?? "path"}
      data-navbar-mobile-menu={navbar.mobileMenu ?? "dropdown"}
      data-navbar-has-hero={page.blocks[0]?.blockType === "hero" ? "true" : "false"}
      data-navbar-over-media={openingHeroUsesImage ? "true" : undefined}
      data-navbar-page-slug={page.slug}
      data-navbar-scroll-state={navbar.placement === "sticky" ? "top" : undefined}
    >
      <header className="site-navbar">
        <NavbarVariantView
          navbar={navbar}
          settings={settings}
          links={links}
          mediaResolver={mediaResolver}
        />
      </header>
    </div>
  )
}
