import * as React from "react"
import type { LinkRef, NavLink, SiteSettings } from "@siteinabox/contracts"
import { actionAnalyticsAttrs } from "./analytics"
import { cx, nativeChromeClassName } from "./blocks/native-classes"
import { type MediaResolver, resolveMedia } from "./media"

export type SiteChromeProps = {
  settings: SiteSettings
  currentSlug?: string
  mediaResolver?: MediaResolver
}

type HeaderActiveMode = NonNullable<NonNullable<SiteSettings["chrome"]>["header"]>["activeMode"]

function chromeVariantClassName() {
  return ""
}

function normalizePath(value: string): string {
  if (!value || value === "index") return "/"
  if (value.startsWith("#")) return value
  try {
    const url = new URL(value, "https://example.invalid")
    const path = url.pathname === "/index" ? "/" : url.pathname.replace(/\/$/, "") || "/"
    return `${path}${url.hash}`
  } catch {
    return value.replace(/\/$/, "") || "/"
  }
}

function pagePath(slug: string | undefined): string {
  if (!slug || slug === "index" || slug === "home") return "/"
  return `/${slug.replace(/^\/|\/$/g, "")}`
}

function isActiveLink(link: NavLink, currentSlug: string | undefined, activeMode: HeaderActiveMode) {
  if (activeMode === "none") return false
  if (activeMode === "anchor") return link.href.startsWith("#")
  return normalizePath(link.href).split("#")[0] === pagePath(currentSlug)
}

function renderLink(link: LinkRef | NavLink, role: "nav" | "footer", className: string, active?: boolean) {
  if (!link.href || !link.label) return null
  const external = "external" in link ? link.external : /^https?:\/\//.test(link.href)
  return (
    <a
      className={className}
      href={link.href}
      aria-current={active ? "page" : undefined}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...actionAnalyticsAttrs(role, link.label)}
    >
      {link.label}
    </a>
  )
}

export function SiteHeader({ settings, currentSlug, mediaResolver }: SiteChromeProps) {
  const links = settings.navHeader ?? []
  const header = settings.chrome?.header
  const logo = resolveMedia(header?.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const activeMode = header?.activeMode ?? "path"
  const variant = header?.variant ?? "default"
  const variantClassName = chromeVariantClassName()
  const toggleId = `site-header-menu-toggle-${(currentSlug ?? "index").replace(/[^a-zA-Z0-9_-]/g, "-")}`
  const hasChrome = links.length > 0 || logo || header?.cta?.href
  if (!hasChrome) return null

  return (
    <header
      className={cx(
        "site-chrome site-header",
        `site-header--${header?.behavior ?? "static"}`,
        `site-header--mobile-${header?.mobileMenu ?? "dropdown"}`,
        variantClassName,
        nativeChromeClassName("header", variant, "root"),
      )}
      data-source-variant={variant}
      data-siab-site-header
    >
      <a className={cx("site-header__brand", nativeChromeClassName("header", variant, "brand"))} href="/" {...actionAnalyticsAttrs("nav", settings.siteName)}>
        {logo ? <img src={logo.src} alt={logo.alt ?? settings.siteName} loading="eager" decoding="async" /> : null}
        <span>{settings.siteName}</span>
      </a>
      <input className="site-header__toggle" type="checkbox" id={toggleId} aria-label="Toggle navigation" />
      <label className={cx("site-header__toggleButton", nativeChromeClassName("header", variant, "toggle"))} htmlFor={toggleId} aria-label="Toggle navigation">
        <span aria-hidden="true" />
      </label>
      <nav className={cx("site-header__nav", nativeChromeClassName("header", variant, "nav"))} aria-label="Primary">
        {links.map((link) => (
          <React.Fragment key={`${link.label}-${link.href}`}>
            {renderLink(
              link,
              "nav",
              cx("site-header__link", nativeChromeClassName("header", variant, "link")),
              isActiveLink(link, currentSlug, activeMode),
            )}
          </React.Fragment>
        ))}
      </nav>
      {header?.cta?.href && header.cta.label
        ? renderLink(header.cta, "nav", cx("site-header__cta", nativeChromeClassName("header", variant, "cta")))
        : null}
    </header>
  )
}

export function SiteFooter({ settings, mediaResolver }: SiteChromeProps) {
  const footer = settings.chrome?.footer
  const logo = resolveMedia(footer?.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const columns = footer?.columns ?? []
  const navFooter = settings.navFooter ?? []
  const legalLinks = footer?.legalLinks ?? []
  const variant = footer?.variant ?? "default"
  const variantClassName = chromeVariantClassName()
  const hasChrome = logo || footer?.tagline || footer?.copyright || columns.length > 0 || navFooter.length > 0 || legalLinks.length > 0
  if (!hasChrome) return null
  const businessLines = [
    settings.nap?.legalName ? `Handelsnaam: ${settings.nap.legalName}` : null,
    settings.nap?.kvkNumber ? `KVK ${settings.nap.kvkNumber}` : null,
    settings.nap?.establishmentNumber ? `Vestigingsnr. ${settings.nap.establishmentNumber}` : null,
  ].filter((line): line is string => Boolean(line))
  const fallbackContactLinks = settings.contactEmail
    ? [{ label: settings.contactEmail, href: `mailto:${settings.contactEmail}` }]
    : []
  const hasNavigationColumn = columns.some((column) => column.items?.some((item) => item.type === "navigation"))

  return (
    <footer className={cx("site-chrome site-footer", variantClassName, nativeChromeClassName("footer", variant, "root"))} data-source-variant={variant} data-siab-site-footer>
      <div className={cx("site-footer__inner", nativeChromeClassName("footer", variant, "inner"))}>
        <div className={cx("site-footer__brand", nativeChromeClassName("footer", variant, "brand"))}>
          {logo ? <img src={logo.src} alt={logo.alt ?? settings.siteName} loading="lazy" decoding="async" /> : null}
          <strong>{settings.siteName}</strong>
          {footer?.tagline && <p>{footer.tagline}</p>}
        </div>
        <div className={cx("site-footer__columns", nativeChromeClassName("footer", variant, "columns"))}>
          {columns.map((column, columnIndex) => (
            <div key={column.id ?? columnIndex} className={cx("site-footer__column", nativeChromeClassName("footer", variant, "column"))}>
              {column.items?.map((item, itemIndex) => (
                <div key={item.id ?? itemIndex} className={cx("site-footer__item", nativeChromeClassName("footer", variant, "item"))} data-item-type={item.type || undefined}>
                  {item.label && <h2>{item.label}</h2>}
                  {item.text && <p>{item.text}</p>}
                  {item.type === "business" && !item.text && businessLines.length > 0 && (
                    <p>{businessLines.join("\n")}</p>
                  )}
                  {item.type === "navigation" && navFooter.length > 0 && (
                    <ul>
                      {navFooter.map((link) => (
                        <li key={`${link.label}-${link.href}`}>{renderLink(link, "footer", cx("site-footer__link", nativeChromeClassName("footer", variant, "link")))}</li>
                      ))}
                    </ul>
                  )}
                  {item.links && item.links.length > 0 && (
                    <ul>
                      {item.links.map((link) => (
                        <li key={`${link.label}-${link.href}`}>{renderLink(link, "footer", cx("site-footer__link", nativeChromeClassName("footer", variant, "link")))}</li>
                      ))}
                    </ul>
                  )}
                  {item.type === "contact" && (!item.links || item.links.length === 0) && fallbackContactLinks.length > 0 && (
                    <ul>
                      {fallbackContactLinks.map((link) => (
                        <li key={`${link.label}-${link.href}`}>{renderLink(link, "footer", cx("site-footer__link", nativeChromeClassName("footer", variant, "link")))}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ))}
          {navFooter.length > 0 && !hasNavigationColumn && (
            <div className={cx("site-footer__column", nativeChromeClassName("footer", variant, "column"))}>
              <div className={cx("site-footer__item", nativeChromeClassName("footer", variant, "item"))} data-item-type="navigation">
                <h2>Navigation</h2>
                <ul>
                  {navFooter.map((link) => (
                    <li key={`${link.label}-${link.href}`}>{renderLink(link, "footer", cx("site-footer__link", nativeChromeClassName("footer", variant, "link")))}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
      {(footer?.copyright || legalLinks.length > 0) && (
        <div className={cx("site-footer__bottom", nativeChromeClassName("footer", variant, "bottom"))}>
          {footer?.copyright && <p>{footer.copyright}</p>}
          {legalLinks.length > 0 && (
            <nav aria-label="Legal">
              {legalLinks.map((link) => (
                <React.Fragment key={`${link.label}-${link.href}`}>
                  {renderLink(link, "footer", cx("site-footer__legalLink", nativeChromeClassName("footer", variant, "link")))}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>
      )}
    </footer>
  )
}

export function SiteBanner({ settings }: SiteChromeProps) {
  const banner = settings.chrome?.banner
  if (!banner || banner.visible === false || !banner.message) return null

  const variant = banner.variant ?? "default"
  const variantClassName = chromeVariantClassName()
  const link = banner.link?.href && banner.link.label ? banner.link : null

  return (
    <aside
      className={cx("site-chrome site-banner", variantClassName, nativeChromeClassName("banner", variant, "root"))}
      data-source-variant={variant}
      data-dismissible={banner.dismissible ? "true" : undefined}
      data-siab-site-banner
    >
      <p className={cx("site-banner__content", nativeChromeClassName("banner", variant, "content"))}>
        {banner.title ? <strong>{banner.title}</strong> : null}
        <span>{banner.message}</span>
        {link ? renderLink(link, "nav", cx("site-banner__link", nativeChromeClassName("banner", variant, "link"))) : null}
      </p>
      {banner.dismissible ? (
        <button className={cx("site-banner__dismiss", nativeChromeClassName("banner", variant, "dismiss"))} type="button" aria-label="Dismiss announcement">
          <span aria-hidden="true">x</span>
        </button>
      ) : null}
    </aside>
  )
}

export function SiteMaintenanceBanner({ settings }: SiteChromeProps) {
  if (!settings.maintenance?.enabled) return null

  const message = settings.maintenance.message?.trim() || "Deze website is tijdelijk in onderhoud."

  return (
    <aside className="site-chrome site-maintenance-banner" role="status" data-siab-site-maintenance-banner>
      <p className="site-maintenance-banner__content">{message}</p>
    </aside>
  )
}
