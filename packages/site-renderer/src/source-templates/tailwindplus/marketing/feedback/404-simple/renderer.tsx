import * as React from "react"
import { PUBLIC_RENDERER_THEME_SCOPE, ThemeStyle, themeMode } from "../../../../../theme"
import type { ProviderSystemTemplateRendererProps } from "../../../../registry"

export function TailwindPlusMarketingFeedback404SimpleRenderer({
  settings,
  theme,
  tenantSlug,
  domain,
  pathname,
  nonce,
}: ProviderSystemTemplateRendererProps) {
  const siteName = settings.siteName?.trim() || "this site"
  const contactHref = settings.contactEmail ? `mailto:${settings.contactEmail}` : "/"
  const contactLabel = settings.contactEmail ? "Contact us" : "Go back home"

  return (
    <div
      className="site-renderer"
      data-siab-site-renderer
      data-provider-template="tailwindplus"
      data-provider-variant="tailwindplus.marketing.feedback.404-simple"
      data-system-template="tailwindplus.marketing.feedback.404-simple"
      data-system-template-kind="not-found"
      data-source-backed-template="true"
      data-source-variant="tailwindplus.marketing.feedback.404-simple"
      data-tenant-slug={tenantSlug || undefined}
      data-domain={domain || undefined}
      >
      <ThemeStyle theme={theme} nonce={nonce} scope={PUBLIC_RENDERER_THEME_SCOPE} />
      <main
        className="rt-canvas grid min-h-full place-items-center bg-white px-6 py-24 sm:py-32 lg:px-8 renderer-not-found--source-tailwindplus-404-simple"
        data-rt-mode={themeMode(theme)}
        aria-label={pathname?.trim() ? `Missing page: ${pathname}` : undefined}
      >
        <div className="text-center">
          <p className="text-base font-semibold text-indigo-600">404</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-7xl">
            Page not found
          </h1>
          <p className="mt-6 text-lg font-medium text-pretty text-gray-500 sm:text-xl/8">
            Sorry, we couldn't find that page on {siteName}.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a
              href="/"
              className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Go back home
            </a>
            <a href={contactHref} className="text-sm font-semibold text-gray-900">
              {contactLabel} <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
