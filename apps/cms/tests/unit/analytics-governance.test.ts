import { describe, expect, it } from "vitest"
import {
  ANALYTICS_RETENTION_MONTHS,
  CMS_ANALYTICS_POLICY,
  PUBLIC_BROWSER_ANALYTICS_POLICY,
  PUBLIC_SERVER_ANALYTICS_POLICY,
} from "@/lib/analytics/governance"
import { CMS_EVENT_NAMES, PUBLIC_SITE_EVENT_NAMES } from "@/lib/analytics/events"

describe("analytics purpose governance", () => {
  it("requires a purpose policy for every declared browser event", () => {
    expect(Object.keys(CMS_ANALYTICS_POLICY).sort()).toEqual([...CMS_EVENT_NAMES].sort())
    expect(Object.keys(PUBLIC_BROWSER_ANALYTICS_POLICY).sort()).toEqual([...PUBLIC_SITE_EVENT_NAMES].sort())
  })

  it("keeps public browser intelligence consent-gated and direct-identifier free", () => {
    for (const policy of Object.values(PUBLIC_BROWSER_ANALYTICS_POLICY)) {
      expect(policy).toMatchObject({
        legalBasis: "consent",
        consentCategory: "analytics",
        retentionMonths: ANALYTICS_RETENTION_MONTHS,
        permitsDirectIdentifiers: false,
      })
    }
  })

  it("limits non-consent public server analytics to minimized conversion outcomes", () => {
    expect(Object.keys(PUBLIC_SERVER_ANALYTICS_POLICY).sort()).toEqual([
      "site_conversion_completed",
      "site_form_accepted",
    ])
    for (const policy of Object.values(PUBLIC_SERVER_ANALYTICS_POLICY)) {
      expect(policy).toMatchObject({
        purpose: "operational_conversion",
        legalBasis: "legitimate_interest",
        consentCategory: null,
        permitsDirectIdentifiers: false,
      })
    }
  })
})
