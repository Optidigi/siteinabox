import { describe, expect, it } from "vitest"
import {
  ConsentReceiptSchema,
  ConsentSelectionSchema,
  ConsentSnapshotSchema,
  CONSENT_VARIANTS,
  DEFAULT_CONSENT_VARIANT,
  SiteSettingsSchema,
} from "./index"

describe("settings-owned consent contract", () => {
  it("defaults legacy settings data to the first-party consent design", () => {
    const parsed = SiteSettingsSchema.parse({
      siteName: "Voorbeeld",
      siteUrl: "https://voorbeeld.test",
      language: "nl",
      consent: { visible: true },
    })

    expect(parsed.consent?.variant).toBe(DEFAULT_CONSENT_VARIANT)
  })

  it("accepts only the closed consent variant and field set", () => {
    expect(CONSENT_VARIANTS).toEqual(["consent-01"])
    expect(SiteSettingsSchema.safeParse({
      siteName: "Voorbeeld",
      siteUrl: "https://voorbeeld.test",
      language: "nl",
      consent: { variant: "consent-02" },
    }).success).toBe(false)
    expect(SiteSettingsSchema.safeParse({
      siteName: "Voorbeeld",
      siteUrl: "https://voorbeeld.test",
      language: "nl",
      consent: { variant: "consent-01", marketing: true },
    }).success).toBe(false)
    expect(SiteSettingsSchema.safeParse({
      siteName: "Voorbeeld",
      siteUrl: "https://voorbeeld.test",
      language: "nl",
      consent: {
        variant: "consent-01",
        preferencesLabel: "Voorkeuren",
        marketingLabel: "Marketing",
      },
    }).success).toBe(true)
  })

  it("normalizes older analytics-only receipts to disabled future categories", () => {
    expect(ConsentReceiptSchema.parse({
      version: "test",
      categories: { necessary: true, analytics: true },
    })).toEqual({
      version: "test",
      categories: { necessary: true, preferences: false, analytics: true, marketing: false },
    })
  })

  it("keeps optional category selections and snapshots closed and typed", () => {
    expect(ConsentSelectionSchema.safeParse({
      preferences: true,
      analytics: false,
      marketing: true,
    }).success).toBe(true)
    expect(ConsentSelectionSchema.safeParse({
      preferences: false,
      analytics: false,
      marketing: false,
      advertising: true,
    }).success).toBe(false)
    expect(ConsentSnapshotSchema.safeParse({
      necessary: true,
      preferences: false,
      analytics: true,
      marketing: false,
      decided: true,
    }).success).toBe(true)
  })
})
