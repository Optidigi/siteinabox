import * as React from "react"
import { getProviderChromeVariant, type SiteBannerChromeVariant, type SiteSettings } from "@siteinabox/contracts"
import type { MediaResolver } from "./media"
import { ShadcnUiChromeView } from "./providers/shadcnui-blocks/views"

export { isViewportFixedConsentBanner } from "./providers/shadcnui-blocks/runtime/banner"

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
  if (!getProviderChromeVariant(area, variant)) throw new Error(`Unresolved provider chrome variant "${variant}" for ${area}.`)
  return <ShadcnUiChromeView area={area} variant={variant} {...props} />
}

export const SiteHeader = (props: SiteChromeProps) => renderChrome("header", props)
export const SiteFooter = (props: SiteChromeProps) => renderChrome("footer", props)
export const SiteBanner = (props: SiteChromeProps) => renderChrome("banner", props)

export function SiteMaintenanceBanner({ settings }: SiteChromeProps) {
  if (!settings.maintenance?.enabled) return null
  const variant = settings.maintenance.variant?.trim()
  const message = settings.maintenance.message?.trim()
  const approvedVariant = variant ? getProviderChromeVariant("banner", variant) : null
  if (!approvedVariant) throw new Error("Enabled maintenance mode requires an approved explicit provider banner variant.")
  const approvedVariantId = approvedVariant.id as SiteBannerChromeVariant
  if (!message) throw new Error("Enabled maintenance mode requires message content.")
  const maintenanceSettings: SiteSettings = {
    ...settings,
    analyticsConsent: { ...settings.analyticsConsent, enabled: false },
    chrome: {
      ...settings.chrome,
      banner: { variant: approvedVariantId, visible: true, message, dismissible: false },
    },
  }
  return <ShadcnUiChromeView area="banner" variant={approvedVariantId} settings={maintenanceSettings} />
}
