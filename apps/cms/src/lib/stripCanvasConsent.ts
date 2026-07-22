import { asRecord } from "@/lib/record"

/**
 * Editor + customer preview must not paint viewport-fixed cookie consent.
 * Disables analyticsConsent for the canvas and hides chrome.banner when it was
 * consent chrome. Non-cookie announcement banners (consent never enabled) stay.
 */
export function stripCanvasConsent<T>(settings: T): T {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return settings
  const record = settings as Record<string, unknown>
  const consent = asRecord(record.analyticsConsent)
  if (consent?.enabled !== true) return settings

  const chrome = asRecord(record.chrome)
  const banner = chrome ? asRecord(chrome.banner) : null
  return {
    ...record,
    analyticsConsent: { ...consent, enabled: false },
    chrome: chrome
      ? {
          ...chrome,
          banner: banner ? { ...banner, visible: false } : chrome.banner,
        }
      : record.chrome,
  } as T
}
