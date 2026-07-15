import * as React from "react"
import type { SiteSettings } from "@siteinabox/contracts"
import type { MediaResolver } from "./media"
import { getProviderChromeRenderer } from "./source-chrome/registry"

export type SiteChromeProps = { settings: SiteSettings; currentSlug?: string; mediaResolver?: MediaResolver }

function renderChrome(area: "header" | "footer" | "banner", props: SiteChromeProps) {
  const config = props.settings.chrome?.[area]
  if (!config) return null
  if (area === "banner") {
    const banner = props.settings.chrome?.banner
    if (!banner || banner.visible === false || !banner.message) return null
  }
  const variant = config.variant?.trim()
  if (!variant) throw new Error(`Configured ${area} chrome requires an approved explicit provider variant.`)
  const Renderer = getProviderChromeRenderer(area, variant)
  if (!Renderer) throw new Error(`Unresolved provider chrome variant "${variant}" for ${area}.`)
  return <>{Renderer(props)}</>
}

export const SiteHeader = (props: SiteChromeProps) => renderChrome("header", props)
export const SiteFooter = (props: SiteChromeProps) => renderChrome("footer", props)
export const SiteBanner = (props: SiteChromeProps) => renderChrome("banner", props)

export function SiteMaintenanceBanner({ settings }: SiteChromeProps) {
  if (!settings.maintenance?.enabled) return null
  return <aside className="border-b border-border bg-muted px-6 py-3 text-center text-sm text-muted-foreground" role="status" data-siab-site-maintenance-banner>{settings.maintenance.message?.trim() || "Deze website is tijdelijk in onderhoud."}</aside>
}
