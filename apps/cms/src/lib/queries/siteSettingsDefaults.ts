import type { RequiredDataFromCollectionSlug } from "payload"
import {
  DEFAULT_APPOINTMENT_SCHEDULE,
  DEFAULT_CONSENT_VARIANT,
  DEFAULT_FOOTER_VARIANT,
  DEFAULT_NAVBAR_PLACEMENT,
  DEFAULT_NAVBAR_VARIANT,
} from "@siteinabox/contracts"

/** Required create fields mirror SiteSettings field defaults without asserting a saved document. */
export function createSiteSettingsData(
  tenantId: number | string,
  siteName: string,
  siteUrl: string,
): RequiredDataFromCollectionSlug<"site-settings"> {
  return {
    tenant: Number(tenantId),
    siteName,
    siteUrl,
    chrome: {
      navbar: { variant: DEFAULT_NAVBAR_VARIANT, placement: DEFAULT_NAVBAR_PLACEMENT },
      footer: { variant: DEFAULT_FOOTER_VARIANT },
    },
    consent: { variant: DEFAULT_CONSENT_VARIANT },
    appointments: { ...DEFAULT_APPOINTMENT_SCHEDULE, weeklyAvailability: [], dateOverrides: [] },
  }
}
