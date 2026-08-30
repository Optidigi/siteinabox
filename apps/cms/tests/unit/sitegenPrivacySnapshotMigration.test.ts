import { describe, expect, it } from "vitest"
import {
  privacyDisclosureFromSettings,
  type PrivacySettingsRow,
} from "../../src/migrations/20260830_160000_repair_tenant_privacy_snapshot"

const settingsRow = (overrides: Partial<PrivacySettingsRow> = {}): PrivacySettingsRow => ({
  tenant_id: 1,
  privacy_disclosure_enabled: true,
  privacy_disclosure_mode: "custom",
  privacy_disclosure_title: "Privacy- en cookieverklaring",
  privacy_disclosure_body: {
    t: "root",
    variant: "block",
    children: [{ t: "paragraph", children: [{ t: "text", v: "Inhoud" }] }],
  },
  privacy_disclosure_version: "tenant-privacy-owned-2026-08-13.1",
  privacy_disclosure_effective_at: "2026-07-10T00:00:00.000Z",
  privacy_disclosure_controller_legal_name: "Voorbeeld BV",
  privacy_disclosure_controller_trade_name: "Voorbeeld",
  privacy_disclosure_controller_email: "info@voorbeeld.nl",
  privacy_disclosure_controller_privacy_email: "privacy@voorbeeld.nl",
  privacy_disclosure_controller_kvk_number: "12345678",
  privacy_disclosure_controller_address: "Voorbeeldstraat 1, 1000 AA Amsterdam",
  privacy_disclosure_contact_methods: { email: true, phone: false, whatsapp: false, forms: null },
  privacy_disclosure_marketing_technologies: [],
  privacy_disclosure_additional_processors: [],
  ...overrides,
})

describe("published privacy snapshot repair", () => {
  it("projects enabled CMS settings into the settings-owned legal contract", () => {
    expect(privacyDisclosureFromSettings(settingsRow())).toMatchObject({
      enabled: true,
      mode: "custom",
      title: "Privacy- en cookieverklaring",
      version: "tenant-privacy-owned-2026-08-13.1",
      controller: {
        legalName: "Voorbeeld BV",
        email: "info@voorbeeld.nl",
      },
    })
  })

  it("rejects an enabled disclosure without authoritative contact data", () => {
    expect(() => privacyDisclosureFromSettings(settingsRow({
      privacy_disclosure_controller_email: null,
    }))).toThrow(/failed contract validation/)
  })

  it("does not project a disabled disclosure", () => {
    expect(privacyDisclosureFromSettings(settingsRow({
      privacy_disclosure_enabled: false,
    }))).toBeNull()
  })
})
