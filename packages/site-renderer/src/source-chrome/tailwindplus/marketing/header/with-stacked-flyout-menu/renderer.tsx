import * as React from "react"
import type { NavLink } from "@siteinabox/contracts"
import { actionAnalyticsAttrs } from "../../../../../analytics"
import { type MediaResolver, resolveMedia } from "../../../../../media"
import type { ProviderChromeRendererProps } from "../../../../../source-chrome/registry"

function renderLogo(settings: ProviderChromeRendererProps["settings"], mediaResolver?: MediaResolver) {
  const header = settings.chrome?.header
  const logo = resolveMedia(header?.logo ?? settings.branding?.logo ?? null, mediaResolver)

  if (!logo) {
    return <span className="text-sm/6 font-semibold text-gray-900">{settings.siteName}</span>
  }

  return (
    <>
      <span className="sr-only">{settings.siteName}</span>
      <img src={logo.src} alt={logo.alt ?? settings.siteName} loading="eager" decoding="async" className="h-8 w-auto" />
    </>
  )
}

function renderNavLink(link: NavLink) {
  if (!link.href || !link.label) return null
  const external = "external" in link ? link.external : /^https?:\/\//.test(link.href)
  return (
    <a
      key={`${link.label}-${link.href}`}
      href={link.href}
      className="text-sm/6 font-semibold text-gray-900"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...actionAnalyticsAttrs("nav", link.label)}
    >
      {link.label}
    </a>
  )
}

export function TailwindPlusMarketingHeaderWithStackedFlyoutMenuRenderer({
  settings,
  currentSlug,
  mediaResolver,
}: ProviderChromeRendererProps) {
  const links = (settings.navHeader ?? []).slice(0, 6)
  const header = settings.chrome?.header
  const ctaLabel = header?.cta?.label?.trim()
  const ctaHref = header?.cta?.href?.trim()
  const toggleId = `tailwindplus-header-menu-toggle-${(currentSlug ?? "index").replace(/[^a-zA-Z0-9_-]/g, "-")}`

  return (
    <header
      className="site-chrome bg-white site-header--source-tailwindplus-marketing-stacked-flyout"
      data-provider-chrome="tailwindplus"
      data-provider-variant="tailwindplus.marketing.header.with-stacked-flyout-menu"
      data-source-backed-chrome="true"
      data-source-variant="tailwindplus.marketing.header.with-stacked-flyout-menu"
      data-siab-site-header
      data-site-chrome="header"
    >
      <nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
        <div className="flex lg:flex-1">
          <a href="/" className="-m-1.5 p-1.5" {...actionAnalyticsAttrs("nav", settings.siteName)}>
            {renderLogo(settings, mediaResolver)}
          </a>
        </div>
        <div className="flex lg:hidden">
          <input className="sr-only peer" type="checkbox" id={toggleId} aria-label="Toggle navigation" />
          <label htmlFor={toggleId} className="-m-2.5 inline-flex cursor-pointer items-center justify-center rounded-md p-2.5 text-gray-700">
            <span className="sr-only">Open main menu</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="size-6">
              <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </label>
          <div className="absolute inset-x-0 top-20 z-50 hidden bg-white px-6 py-6 shadow-lg ring-1 ring-gray-900/10 peer-checked:block lg:hidden">
            <div className="space-y-2">
              {links.map((link) => (
                <a
                  key={`${link.label}-${link.href}-mobile`}
                  href={link.href}
                  className="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-gray-900 hover:bg-gray-50"
                  {...actionAnalyticsAttrs("nav", link.label)}
                >
                  {link.label}
                </a>
              ))}
              {ctaLabel && ctaHref ? (
                <a
                  href={ctaHref}
                  className="-mx-3 block rounded-lg px-3 py-2.5 text-base/7 font-semibold text-gray-900 hover:bg-gray-50"
                  {...actionAnalyticsAttrs("nav", ctaLabel)}
                >
                  {ctaLabel}
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="hidden lg:flex lg:gap-x-12">
          {links.map(renderNavLink)}
        </div>
        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          {ctaLabel && ctaHref ? (
            <a href={ctaHref} className="text-sm/6 font-semibold text-gray-900" {...actionAnalyticsAttrs("nav", ctaLabel)}>
              {ctaLabel} <span aria-hidden="true">-&gt;</span>
            </a>
          ) : null}
        </div>
      </nav>
    </header>
  )
}
