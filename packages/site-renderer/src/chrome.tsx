import * as React from "react"
import type { LinkRef, NavLink, SiteSettings } from "@siteinabox/contracts"
import { actionAnalyticsAttrs } from "./analytics"
import { type MediaResolver, resolveMedia } from "./media"

export type SiteChromeProps = {
  settings: SiteSettings
  currentSlug?: string
  mediaResolver?: MediaResolver
}

type HeaderActiveMode = NonNullable<NonNullable<SiteSettings["chrome"]>["header"]>["activeMode"]

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
  const toggleId = `site-header-menu-toggle-${(currentSlug ?? "index").replace(/[^a-zA-Z0-9_-]/g, "-")}`
  const hasChrome = links.length > 0 || logo || header?.cta?.href
  if (!hasChrome) return null

  return (
    <header
      className={`site-chrome site-header site-header--${header?.behavior ?? "static"} site-header--mobile-${header?.mobileMenu ?? "dropdown"}`.trim()}
      data-siab-site-header
    >
      <a className="site-header__brand" href="/" {...actionAnalyticsAttrs("nav", settings.siteName)}>
        {logo ? <img src={logo.src} alt={logo.alt ?? settings.siteName} loading="eager" decoding="async" /> : null}
        <span>{settings.siteName}</span>
      </a>
      <input className="site-header__toggle" type="checkbox" id={toggleId} aria-label="Toggle navigation" />
      <label className="site-header__toggleButton" htmlFor={toggleId} aria-label="Toggle navigation">
        <span aria-hidden="true" />
      </label>
      <nav className="site-header__nav" aria-label="Primary">
        {links.map((link) => (
          <React.Fragment key={`${link.label}-${link.href}`}>
            {renderLink(link, "nav", "site-header__link", isActiveLink(link, currentSlug, activeMode))}
          </React.Fragment>
        ))}
      </nav>
      {header?.cta?.href && header.cta.label ? renderLink(header.cta, "nav", "site-header__cta") : null}
    </header>
  )
}

export function SiteFooter({ settings, mediaResolver }: SiteChromeProps) {
  const footer = settings.chrome?.footer
  const logo = resolveMedia(footer?.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const columns = footer?.columns ?? []
  const navFooter = settings.navFooter ?? []
  const legalLinks = footer?.legalLinks ?? []
  const hasChrome = logo || footer?.tagline || footer?.copyright || columns.length > 0 || navFooter.length > 0 || legalLinks.length > 0
  if (!hasChrome) return null

  return (
    <footer className="site-chrome site-footer" data-siab-site-footer>
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          {logo ? <img src={logo.src} alt={logo.alt ?? settings.siteName} loading="lazy" decoding="async" /> : null}
          <strong>{settings.siteName}</strong>
          {footer?.tagline && <p>{footer.tagline}</p>}
        </div>
        <div className="site-footer__columns">
          {columns.map((column, columnIndex) => (
            <div key={column.id ?? columnIndex} className="site-footer__column">
              {column.items?.map((item, itemIndex) => (
                <div key={item.id ?? itemIndex} className="site-footer__item" data-item-type={item.type || undefined}>
                  {item.label && <h2>{item.label}</h2>}
                  {item.text && <p>{item.text}</p>}
                  {item.links && item.links.length > 0 && (
                    <ul>
                      {item.links.map((link) => (
                        <li key={`${link.label}-${link.href}`}>{renderLink(link, "footer", "site-footer__link")}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ))}
          {navFooter.length > 0 && (
            <div className="site-footer__column">
              <div className="site-footer__item" data-item-type="navigation">
                <h2>Navigation</h2>
                <ul>
                  {navFooter.map((link) => (
                    <li key={`${link.label}-${link.href}`}>{renderLink(link, "footer", "site-footer__link")}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
      {(footer?.copyright || legalLinks.length > 0) && (
        <div className="site-footer__bottom">
          {footer?.copyright && <p>{footer.copyright}</p>}
          {legalLinks.length > 0 && (
            <nav aria-label="Legal">
              {legalLinks.map((link) => (
                <React.Fragment key={`${link.label}-${link.href}`}>{renderLink(link, "footer", "site-footer__legalLink")}</React.Fragment>
              ))}
            </nav>
          )}
        </div>
      )}
    </footer>
  )
}
