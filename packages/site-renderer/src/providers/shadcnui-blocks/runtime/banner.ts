import type { SiteSettings } from "@siteinabox/contracts"

export type BannerViewModel = {
  title?: string
  message: string
  link?: { label: string; href: string }
  dismissible: boolean
  consent: boolean
}

export function adaptBanner(settings: SiteSettings): BannerViewModel | null {
  const banner = settings.chrome?.banner
  if (!banner || banner.visible === false || !banner.message.trim()) return null
  const link = banner.link?.label?.trim() && banner.link.href?.trim()
    ? { label: banner.link.label.trim(), href: banner.link.href.trim() }
    : undefined
  return {
    title: banner.title?.trim() || undefined,
    message: banner.message.trim(),
    link,
    dismissible: banner.dismissible === true,
    consent: settings.analyticsConsent?.enabled === true,
  }
}
