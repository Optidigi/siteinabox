import { describe, expect, it } from "vitest"

import {
  TLD_CAPABILITY_CATALOG,
  enabledTldCapabilitiesAt,
  getEnabledTldCapability,
  getTldCapabilityByVersion,
  tldCapabilityCatalogSchema,
  validateTldRegistrationLabel,
  validateTldTransferAuthorization,
} from "./tld-capabilities"

const PHASE_8_EFFECTIVE_AT = "2026-07-27T00:00:00.000Z"

describe("effective-dated TLD capability catalog", () => {
  it("contains only schema-valid, non-overlapping capability records", () => {
    expect(tldCapabilityCatalogSchema.safeParse(TLD_CAPABILITY_CATALOG).success).toBe(true)

    for (const tld of new Set(TLD_CAPABILITY_CATALOG.map((entry) => entry.tld))) {
      const records = TLD_CAPABILITY_CATALOG
        .filter((entry) => entry.tld === tld)
        .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
      for (let index = 1; index < records.length; index += 1) {
        expect(records[index - 1]?.effectiveUntil).not.toBeNull()
        expect(records[index - 1]?.effectiveUntil! <= records[index]!.effectiveFrom).toBe(true)
      }
    }
  })

  it("expands the production allowlist by exactly one TLD at the Phase 8 effective date", () => {
    expect(enabledTldCapabilitiesAt("2026-07-26T23:59:59.999Z").map((entry) => entry.tld))
      .toEqual(["nl"])
    expect(enabledTldCapabilitiesAt(PHASE_8_EFFECTIVE_AT).map((entry) => entry.tld))
      .toEqual(["be", "nl"])
    expect(getEnabledTldCapability("com", PHASE_8_EFFECTIVE_AT)).toBeNull()
    expect(getTldCapabilityByVersion("tld-be-2026-07-27.1")?.tld).toBe("be")
  })

  it.each(["nl", "be"] as const)(
    "has a complete provider, lifecycle, pricing, and renderer/TLS contract for .%s",
    (tld) => {
      const capability = getEnabledTldCapability(tld, PHASE_8_EFFECTIVE_AT)
      expect(capability).not.toBeNull()
      expect(capability).toMatchObject({
        provider: "openprovider",
        registrant: {
          customerIsRegistrant: true,
          supportedPartyTypes: ["registered_business", "business_in_formation"],
          siteinaboxContactRoles: ["administrative", "technical", "billing"],
        },
        registration: {
          supported: true,
          periodYears: 1,
          confirmation: {
            mechanism: "provider_domain_poll",
            activeStatuses: ["ACT", "ACTIVE", "REGISTERED"],
          },
        },
        transfer: {
          supported: true,
          authorization: "required",
          confirmation: {
            mechanism: "provider_domain_poll",
          },
        },
        verification: {
          evidenceSource: "openprovider.verification_email_status",
          activationGate: "verified_or_not_required",
        },
        renewal: {
          dateSource: "openprovider.renewal_date",
          executionMode: "autorenew",
          completionEvidence: "renewal_date_advanced",
        },
        restoration: {
          supported: true,
          ordinaryCheckout: false,
        },
        pricing: {
          currency: "EUR",
          premiumDomains: "unsupported",
          acceptedOrderEvidence: "frozen_provider_operation_quote",
        },
        rendererTls: {
          apex: "explicit_active_host",
          www: "explicit_active_alias",
          edge: "cloudflare",
          https: "cloudflare_edge_certificate",
          origin: "protected_https_matching_host",
        },
      })
      expect(capability!.registrant.requiredFields).toEqual(expect.arrayContaining([
        "firstName",
        "lastName",
        "email",
        "street",
        "number",
        "zipcode",
        "city",
        "country",
        "phoneCountryCode",
        "phoneAreaCode",
        "phoneSubscriberNumber",
      ]))
      expect(capability!.pricing.operations).toEqual({
        registration: "provider_operation_quote",
        transfer: "provider_operation_quote",
        renewal: "provider_operation_quote",
        restore: "manual_provider_quote",
      })
    },
  )

  it("captures .nl transfer, restoration, and renderer constraints", () => {
    const capability = getEnabledTldCapability("nl", PHASE_8_EFFECTIVE_AT)!
    expect(capability.registration.labelLength).toEqual({ min: 2, max: 63 })
    expect(capability.registration.idn).toBe(false)
    expect(capability.transfer).toMatchObject({
      completion: "realtime",
      validRegistrantPhoneRequired: true,
      preservesRenewalDate: true,
    })
    expect(capability.restoration).toMatchObject({
      providerWindowDays: 38,
      registryQuarantineDays: 40,
      mode: "provider_restore",
    })
    expect(validateTldRegistrationLabel(capability, "a")).toBe(false)
    expect(validateTldRegistrationLabel(capability, "voorbeeld")).toBe(true)
    expect(validateTldRegistrationLabel(capability, "xn--caf-dma")).toBe(false)
  })

  it("captures .be auth-code confirmation, conditional verification, and restoration", () => {
    const capability = getEnabledTldCapability("be", PHASE_8_EFFECTIVE_AT)!
    expect(capability.registration.labelLength).toEqual({ min: 2, max: 63 })
    expect(capability.registration.idn).toBe(true)
    expect(capability.transfer).toMatchObject({
      completion: "realtime",
      authorizationFormat: "dns_belgium_5x3",
      authorizationValidityDays: 7,
      preservesRenewalDate: true,
    })
    expect(capability.verification.requirement).toBe("conditional_registry_risk_check")
    expect(capability.restoration).toMatchObject({
      providerWindowDays: 40,
      registryQuarantineDays: 40,
      mode: "provider_restore",
    })
    expect(validateTldRegistrationLabel(capability, "voorbeeld")).toBe(true)
    expect(validateTldRegistrationLabel(capability, "xn--caf-dma")).toBe(true)
    expect(validateTldTransferAuthorization(capability, "123-456-789-012-345")).toBe(true)
    expect(validateTldTransferAuthorization(capability, "ordinary-epp-code")).toBe(false)
  })
})
