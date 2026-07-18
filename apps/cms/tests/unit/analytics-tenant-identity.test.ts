import { describe, expect, it } from "vitest"
import { tenantAnalyticsProperties } from "@/lib/analytics/identity"

describe("tenant analytics identity", () => {
  it("maps every tenant to stable event properties and a native PostHog group", () => {
    expect(tenantAnalyticsProperties({ id: 7, name: "Amicare", slug: "amicare", domain: "ami-care.nl" })).toEqual({
      site_kind: "tenant",
      tenant_id: "7",
      tenant_slug: "amicare",
      tenant_name: "Amicare",
      site_id: "7",
      site_domain: "ami-care.nl",
      $groups: { tenant: "7" },
    })
  })

  it("uses an explicit platform identity when no tenant applies", () => {
    expect(tenantAnalyticsProperties(null)).toEqual({
      site_kind: "platform",
      tenant_id: null,
      tenant_slug: null,
      tenant_name: null,
      site_id: null,
      site_domain: null,
    })
  })
})
