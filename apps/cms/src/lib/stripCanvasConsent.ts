import { asRecord } from "@/lib/record"

export type StripCanvasConsentOptions = {
  /** Keep the settings-owned rail available for the customer preview review. */
  hidePresentation?: boolean
}

/**
 * Editor + customer preview must not enable analytics capture in the canvas.
 * The editor hides the public consent presentation defensively so a fixed
 * banner cannot cover editing controls. Customer preview opts into the shared
 * presentation separately and uses an in-memory runtime instead.
 */
export function stripCanvasConsent<T>(settings: T, options: StripCanvasConsentOptions = {}): T {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return settings
  const record = settings as Record<string, unknown>
  const consent = asRecord(record.analyticsConsent)
  if (consent?.enabled !== true) return settings

  const consentPresentation = asRecord(record.consent)
  const nextSettings: Record<string, unknown> = {
    ...record,
    analyticsConsent: { ...consent, enabled: false },
  }
  if (options.hidePresentation !== false && consentPresentation) {
    nextSettings.consent = { ...consentPresentation, visible: false }
  }
  return {
    ...nextSettings,
  } as T
}
