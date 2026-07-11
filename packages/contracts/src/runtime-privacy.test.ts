import { describe, expect, it } from "vitest"
import { SiteSettingsSchema } from "./runtime"

const settings = {
  siteName: "Voorbeeldbedrijf",
  siteUrl: "https://voorbeeld.nl",
  language: "nl",
  privacyDisclosure: {
    enabled: true,
    version: "2026-07-10.1",
    effectiveAt: "2026-07-10T00:00:00.000Z",
    controller: {
      legalName: "Voorbeeldbedrijf B.V.",
      tradeName: "Voorbeeldbedrijf",
      email: "privacy@voorbeeld.nl",
      kvkNumber: "12345678",
      address: "Voorbeeldstraat 1, 1234 AB Voorbeeld",
    },
    contactMethods: {
      email: true,
      forms: {
        enabled: true,
        mode: "cms",
        retention: { kind: "days", days: 90 },
      },
    },
    additionalProcessors: [
      { name: "Voorbeeld Hosting", purpose: "Hosting", location: "EU" },
    ],
  },
}

describe("SiteSettingsSchema tenant privacy disclosure", () => {
  it("accepts a structured tenant disclosure", () => {
    expect(SiteSettingsSchema.parse(settings).privacyDisclosure).toEqual(settings.privacyDisclosure)
  })

  it("rejects an invalid controller email", () => {
    const result = SiteSettingsSchema.safeParse({
      ...settings,
      privacyDisclosure: {
        ...settings.privacyDisclosure,
        controller: { ...settings.privacyDisclosure.controller, email: "not-an-email" },
      },
    })

    expect(result.success).toBe(false)
  })

  it("rejects an unbounded or nonsensical form retention", () => {
    const result = SiteSettingsSchema.safeParse({
      ...settings,
      privacyDisclosure: {
        ...settings.privacyDisclosure,
        contactMethods: {
          forms: { enabled: true, mode: "cms", retention: { kind: "days", days: 0 } },
        },
      },
    })

    expect(result.success).toBe(false)
  })
})
