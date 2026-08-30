import * as React from "react"
import type {
  LinkRef,
  NavLink,
  NavigationIcon,
  SiteNavbar,
  SiteSettings,
} from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import { resolveMedia, type MediaResolver } from "../media"
import {
  SiteArrowUpRight,
  SiteBuilding,
  SiteChevronDown,
  SiteClose,
  SiteCircleInfo,
  SiteLayers,
  SiteMapPin,
  SiteMenu,
  SiteMoon,
  SitePackage,
  SiteSpark,
  SiteSun,
  SiteTag,
  SiteUser,
} from "../icons/SiteIcons"

export type NavbarVariantProps = {
  navbar: SiteNavbar
  settings: SiteSettings
  links: NavLink[]
  mediaResolver?: MediaResolver
}

function hrefFor(value: string | null | undefined): string | null {
  const href = value?.trim()
  return href ? href : null
}

function externalProps(external: boolean | null | undefined): React.AnchorHTMLAttributes<HTMLAnchorElement> {
  return external ? { target: "_blank", rel: "noreferrer" } : {}
}

function NavigationGlyph({ icon }: { icon?: NavigationIcon | null }) {
  if (!icon) return null
  const props = { size: 18, className: "site-navbar-dropdown-icon" }
  switch (icon) {
    case "backpack":
    case "package":
      return <SitePackage {...props} />
    case "cake-slice":
    case "ice-cream":
      return <SiteSpark {...props} />
    case "coffee":
      return <SiteCircleInfo {...props} />
    case "grape":
      return <SiteLayers {...props} />
    case "hotel":
      return <SiteBuilding {...props} />
    case "map-pin":
      return <SiteMapPin {...props} />
    case "pizza":
    case "sandwich":
      return <SiteTag {...props} />
    case "plane":
      return <SiteArrowUpRight {...props} />
    case "smile":
      return <SiteUser {...props} />
    default:
      return null
  }
}

function NavigationAnchor({
  item,
  className,
  mobile = false,
}: {
  item: NavLink
  className?: string
  mobile?: boolean
}) {
  const href = hrefFor(item.href)
  if (!href) return null
  return (
    <a
      href={href}
      data-navbar-link="true"
      data-navbar-mobile-link={mobile ? "true" : undefined}
      className={cn("site-navbar-link", className)}
      {...externalProps(item.external)}
    >
      <NavigationGlyph icon={item.icon} />
      <span>{item.label}</span>
      {item.external ? <SiteArrowUpRight size={15} className="site-navbar-external-icon" /> : null}
    </a>
  )
}

function NavigationItems({
  links,
  mobile = false,
}: {
  links: NavLink[]
  mobile?: boolean
}) {
  return links.map((item, index) => {
    const children = item.children?.filter((child) => Boolean(hrefFor(child.href))) ?? []
    if (children.length === 0) {
      return (
        <li key={`${item.label}-${index}`}>
          <NavigationAnchor item={item} mobile={mobile} />
        </li>
      )
    }

    const dropdownId = `site-navbar-${mobile ? "mobile" : "desktop"}-dropdown-${index}`
    return (
      <li key={`${item.label}-${index}`} className="site-navbar-group-item">
        <details className={cn("site-navbar-group", mobile && "site-navbar-group-mobile")}>
          <summary
            className="site-navbar-group-trigger"
            aria-controls={dropdownId}
            aria-expanded={false}
          >
            <span>{item.label}</span>
            <SiteChevronDown size={16} className="site-navbar-chevron" />
          </summary>
          <div id={dropdownId} className="site-navbar-dropdown">
            <ul className="site-navbar-dropdown-list">
              {children.map((child, childIndex) => (
                <li key={`${child.label}-${childIndex}`}>
                  <NavigationAnchor
                    item={child}
                    mobile={mobile}
                    className="site-navbar-dropdown-link"
                  />
                </li>
              ))}
            </ul>
          </div>
        </details>
      </li>
    )
  })
}

function ActionLink({ action }: { action?: LinkRef | null }) {
  const href = hrefFor(action?.href)
  const label = action?.label?.trim()
  if (!action || !href || !label) return null
  return (
    <a
      href={href}
      className="site-navbar-action site-navbar-action-primary"
      {...externalProps(action.external)}
    >
      <span>{label}</span>
      {action.external ? <SiteArrowUpRight size={15} aria-hidden="true" /> : null}
    </a>
  )
}

function ThemeToggle() {
  return (
    <button
      type="button"
      data-theme-toggle="true"
      className="site-navbar-theme-toggle"
      aria-label="Use dark theme"
      aria-pressed="false"
    >
      <SiteSun size={18} className="site-navbar-theme-sun" />
      <SiteMoon size={18} className="site-navbar-theme-moon" />
      <span className="sr-only">Toggle color theme</span>
    </button>
  )
}

export function NavbarBrand({
  settings,
  navbar,
  mediaResolver,
}: {
  settings: SiteSettings
  navbar: SiteNavbar
  mediaResolver?: MediaResolver
}) {
  const media = resolveMedia(navbar.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const compactMedia = resolveMedia(settings.branding?.favicon ?? null, mediaResolver)
  const hasCompactLogo = Boolean(media && compactMedia)
  const content = media ? (
    <>
      <img
        src={media.src}
        alt=""
        aria-hidden="true"
        className={cn("site-navbar-logo", hasCompactLogo && "site-navbar-logo-full")}
      />
      {compactMedia ? (
        <img
          src={compactMedia.src}
          alt=""
          aria-hidden="true"
          className="site-navbar-logo site-navbar-logo-mark"
        />
      ) : null}
    </>
  ) : compactMedia ? (
    <img
      src={compactMedia.src}
      alt=""
      aria-hidden="true"
      className="site-navbar-logo site-navbar-logo-fallback"
    />
  ) : (
    <span className="site-navbar-wordmark">{settings.siteName}</span>
  )
  return (
    <a
      href="/"
      className={cn("site-navbar-brand", hasCompactLogo && "site-navbar-brand-has-compact-logo")}
      aria-label={`${settings.siteName} home`}
    >
      {content}
    </a>
  )
}

export function NavbarActions({ navbar, mobile = false }: { navbar: SiteNavbar; mobile?: boolean }) {
  return (
    <div className={cn(
      "site-navbar-actions",
      mobile && "site-navbar-actions-mobile",
      mobile && navbar.showThemeToggle && "site-navbar-actions-with-theme-toggle",
    )}>
      {navbar.showThemeToggle ? <ThemeToggle /> : null}
      <ActionLink action={navbar.cta} />
    </div>
  )
}

export function NavbarDesktop({ links, navbar }: { links: NavLink[]; navbar: SiteNavbar }) {
  return (
    <>
      <nav
        className="site-navbar-desktop-slot site-navbar-desktop-links"
        aria-label="Primary navigation"
      >
        <ul className="site-navbar-links">
          <NavigationItems links={links} />
        </ul>
      </nav>
      <div className="site-navbar-desktop-slot site-navbar-actions-slot">
        <NavbarActions navbar={navbar} />
      </div>
    </>
  )
}

export function NavbarMobile({ links, navbar }: { links: NavLink[]; navbar: SiteNavbar }) {
  const menuMode = navbar.mobileMenu ?? "dropdown"
  return (
    <details className={cn("site-navbar-mobile-menu", menuMode === "drawer" && "site-navbar-mobile-menu-drawer")}>
      <summary
        className="site-navbar-mobile-trigger"
        aria-label="Toggle navigation"
        aria-controls="site-navbar-mobile-panel"
        aria-expanded={false}
      >
        <SiteMenu size={21} className="site-navbar-menu-icon" />
        <span className="site-navbar-mobile-close" aria-hidden="true"><SiteClose size={21} className="site-navbar-close-icon" /></span>
      </summary>
      <div id="site-navbar-mobile-panel" className="site-navbar-mobile-panel">
        <nav aria-label="Mobile navigation">
          <ul className="site-navbar-mobile-links">
            <NavigationItems links={links} mobile />
          </ul>
        </nav>
        <NavbarActions navbar={navbar} mobile />
      </div>
    </details>
  )
}
