import { describe, expect, it } from "vitest"

import {
  INTENDED_TLD_CATALOG,
  TLD_CAPABILITY_CATALOG,
  getTldCapabilityForProductionOperation,
  getTldCapabilityByVersion,
  productionTldCapabilitiesAt,
  tldProductionOperations,
  tldCapabilityAt,
  tldCapabilityCatalogSchema,
  validateTldRegistrationLabel,
  validateTldRegistrantPrerequisites,
  validateTldTransferAuthorization,
} from "./tld-capabilities"

const PHASE_8_EFFECTIVE_AT = "2026-07-28T00:00:00.000Z"
const PRODUCTION_READINESS_EFFECTIVE_AT = "2026-07-28T15:00:00.000Z"
const REGISTRATION_PRODUCTION_EFFECTIVE_AT = "2026-07-29T12:00:00.000Z"
const CONTRACT_CORRECTION_EFFECTIVE_AT = "2026-07-29T17:20:00.000Z"
const PROVIDER_CAPABILITY_ENABLEMENT_EFFECTIVE_AT =
  "2026-07-30T14:30:00.000Z"
const BEFORE_PROVIDER_CAPABILITY_ENABLEMENT =
  "2026-07-30T14:29:59.999Z"

describe("effective-dated TLD capability catalog", () => {
  it("contains only schema-valid, non-overlapping capability records", () => {
    expect(tldCapabilityCatalogSchema.safeParse(TLD_CAPABILITY_CATALOG).success).toBe(true)
    expect(new Set(
      TLD_CAPABILITY_CATALOG.map((entry) => entry.capabilityVersion),
    ).size).toBe(TLD_CAPABILITY_CATALOG.length)

    for (const tld of new Set(TLD_CAPABILITY_CATALOG.map((entry) => entry.tld))) {
      const records = TLD_CAPABILITY_CATALOG
        .filter((entry) => entry.tld === tld)
        .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
      for (let index = 1; index < records.length; index += 1) {
        expect(records[index - 1]?.effectiveUntil).not.toBeNull()
        expect(records[index - 1]?.effectiveUntil).toBe(
          records[index]!.effectiveFrom,
        )
      }
    }
  })

  it("models the intended catalogue and preserves the fail-closed period", () => {
    expect(
      productionTldCapabilitiesAt(
        "registration",
        "2026-07-26T23:59:59.999Z",
      ).map((entry) => entry.tld),
    )
      .toEqual(["nl"])
    for (const operation of tldProductionOperations) {
      expect(
        productionTldCapabilitiesAt(
          operation,
          PRODUCTION_READINESS_EFFECTIVE_AT,
        ),
      ).toEqual([])
    }
    expect(
      getTldCapabilityForProductionOperation(
        "com",
        "registration",
        PHASE_8_EFFECTIVE_AT,
      ),
    ).toBeNull()
    expect(getTldCapabilityByVersion("tld-be-2026-07-28.1")?.tld).toBe("be")
    expect(
      [...new Set(TLD_CAPABILITY_CATALOG.map((entry) => entry.tld))].sort(),
    ).toEqual([...INTENDED_TLD_CATALOG].sort())
  })

  it("enables only registration and its required verification for every intended TLD", () => {
    expect(
      productionTldCapabilitiesAt(
        "registration",
        REGISTRATION_PRODUCTION_EFFECTIVE_AT,
      ).map((entry) => entry.tld),
    ).toEqual([...INTENDED_TLD_CATALOG].sort())
    expect(
      productionTldCapabilitiesAt(
        "registrant_verification",
        REGISTRATION_PRODUCTION_EFFECTIVE_AT,
      ).map((entry) => entry.tld),
    ).toEqual([...INTENDED_TLD_CATALOG].sort())
    for (const operation of [
      "incoming_transfer",
      "renewal_provider_autorenew",
      "renewal_explicit",
      "restoration",
    ] as const) {
      expect(
        productionTldCapabilitiesAt(
          operation,
          REGISTRATION_PRODUCTION_EFFECTIVE_AT,
        ),
      ).toEqual([])
    }
  })

  it.each(INTENDED_TLD_CATALOG)(
    "has a complete provider, lifecycle, pricing, and renderer/TLS contract for .%s",
    (tld) => {
      const capability = tldCapabilityAt(tld, REGISTRATION_PRODUCTION_EFFECTIVE_AT)
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
          executionMode: "provider_autorenew",
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
    const capability = tldCapabilityAt("nl", PRODUCTION_READINESS_EFFECTIVE_AT)!
    expect(capability.registration.labelLength).toEqual({ min: 2, max: 63 })
    expect(capability.registration.idn).toBe(false)
    expect(capability.transfer).toMatchObject({
      completion: "realtime",
      validRegistrantPhoneRequired: true,
      renewalEffect: "unchanged",
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
    const capability = tldCapabilityAt("be", PHASE_8_EFFECTIVE_AT)!
    expect(capability.production).toEqual({
      registration: false,
      incomingTransfer: false,
      renewal: false,
      registrantVerification: false,
      restoration: false,
    })
    expect(capability.registration.labelLength).toEqual({ min: 2, max: 63 })
    expect(capability.registration.idn).toBe(true)
    expect(capability.transfer).toMatchObject({
      completion: "realtime",
      authorizationFormat: "dns_belgium_5x3",
      authorizationValidityDays: 7,
      renewalEffect: "restarts_from_transfer_date",
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

  it("records the reviewed transfer renewal effect for every intended TLD", () => {
    const effects = Object.fromEntries(INTENDED_TLD_CATALOG.map((tld) => [
      tld,
      tldCapabilityAt(tld, PHASE_8_EFFECTIVE_AT)?.transfer.renewalEffect,
    ]))
    expect(effects).toEqual({
      nl: "unchanged",
      com: "extends_one_year",
      eu: "extends_one_year",
      org: "extends_one_year",
      net: "extends_one_year",
      be: "restarts_from_transfer_date",
      de: "restarts_from_transfer_date",
      info: "extends_one_year",
      online: "extends_one_year",
      shop: "extends_one_year",
    })
  })

  it("records provider-backed outgoing transfer automation for every intended TLD", () => {
    for (const tld of INTENDED_TLD_CATALOG) {
      expect(
        tldCapabilityAt(tld, CONTRACT_CORRECTION_EFFECTIVE_AT)?.transfer.outgoing,
      ).toEqual({
        supported: true,
        mechanism: ["be", "eu"].includes(tld)
          ? "openprovider_registrant_delivery"
          : "openprovider_external_auth_code",
        providerEvidenceUrl: "https://docs.openprovider.com/doc/all#tag/AuthCode",
      })
    }
  })

  it("fails closed after correcting the current contracts pending provider rehearsals", () => {
    for (const operation of tldProductionOperations) {
      expect(
        productionTldCapabilitiesAt(operation, CONTRACT_CORRECTION_EFFECTIVE_AT),
      ).toEqual([])
    }
  })

  it("enables every governed operation after live provider capability evidence", () => {
    for (const operation of tldProductionOperations.filter(
      (operation) => operation !== "renewal_explicit",
    )) {
      expect(
        productionTldCapabilitiesAt(
          operation,
          PROVIDER_CAPABILITY_ENABLEMENT_EFFECTIVE_AT,
        ).map((capability) => capability.tld),
      ).toEqual([...INTENDED_TLD_CATALOG].sort())
    }
    expect(
      productionTldCapabilitiesAt(
        "renewal_explicit",
        PROVIDER_CAPABILITY_ENABLEMENT_EFFECTIVE_AT,
      ),
    ).toEqual([])

    for (const tld of INTENDED_TLD_CATALOG) {
      const capability = tldCapabilityAt(
        tld,
        PROVIDER_CAPABILITY_ENABLEMENT_EFFECTIVE_AT,
      )
      expect(capability?.production).toEqual({
        registration: true,
        incomingTransfer: true,
        renewal: true,
        registrantVerification: true,
        restoration: true,
      })
      expect(capability?.dnssec.productionEvidenceComplete).toBe(true)
      expect(capability?.capabilityVersion).toBe(
        `tld-${tld}-2026-07-30.4`,
      )
      const providerAutorenew = getTldCapabilityForProductionOperation(
        tld,
        "renewal_provider_autorenew",
        PROVIDER_CAPABILITY_ENABLEMENT_EFFECTIVE_AT,
      )
      const explicitRenewal = getTldCapabilityForProductionOperation(
        tld,
        "renewal_explicit",
        PROVIDER_CAPABILITY_ENABLEMENT_EFFECTIVE_AT,
      )
      expect(Boolean(providerAutorenew) !== Boolean(explicitRenewal)).toBe(true)
    }
  })

  it("switches from registration-only to the complete catalog at the exact boundary", () => {
    expect(
      productionTldCapabilitiesAt(
        "registration",
        BEFORE_PROVIDER_CAPABILITY_ENABLEMENT,
      ).map((capability) => capability.tld),
    ).toEqual([])
    for (const operation of [
      "incoming_transfer",
      "renewal_provider_autorenew",
      "renewal_explicit",
      "registrant_verification",
      "restoration",
    ] as const) {
      expect(
        productionTldCapabilitiesAt(
          operation,
          BEFORE_PROVIDER_CAPABILITY_ENABLEMENT,
        ),
      ).toEqual([])
    }
    expect(
      productionTldCapabilitiesAt(
        "registration",
        PROVIDER_CAPABILITY_ENABLEMENT_EFFECTIVE_AT,
      ).map((capability) => capability.tld),
    ).toEqual([...INTENDED_TLD_CATALOG].sort())
  })

  it("models exact current label, transfer, and lifecycle differences", () => {
    const current = Object.fromEntries(INTENDED_TLD_CATALOG.map((tld) => [
      tld,
      tldCapabilityAt(tld, CONTRACT_CORRECTION_EFFECTIVE_AT)!,
    ]))

    expect(current.de!.registration.labelLength.min).toBe(1)
    expect(current.org!.registration.labelLength.min).toBe(3)
    expect(current.info!.registration.labelLength.min).toBe(3)
    expect(current.online!.registration.labelLength.min).toBe(3)
    expect(current.com!.transfer).toMatchObject({
      completion: "pending_confirmation",
      maximumExpectedWaitDays: 6,
      customerConfirmation: "registrant_email",
      renewalEffect: "provider_determined",
    })
    expect(current.eu!.transfer).toMatchObject({
      authorizationFormat: "eurid_tac_4x4",
      authorizationValidityDays: 40,
    })
    expect(current.de!.transfer).toMatchObject({
      authorizationFormat: "denic_authinfo_8_16",
      authorizationValidityDays: 30,
    })
    expect(current.be!.restoration).toMatchObject({
      providerWindowDays: 38,
      registryQuarantineDays: 40,
    })
    expect(current.com!.restoration).toMatchObject({
      providerWindowDays: 40,
      registryQuarantineDays: 40,
      redemptionPeriodDays: 30,
      pendingDeleteDays: 5,
    })
  })

  it("validates current registry authorization and registrant prerequisites", () => {
    const eu = tldCapabilityAt("eu", CONTRACT_CORRECTION_EFFECTIVE_AT)!
    const de = tldCapabilityAt("de", CONTRACT_CORRECTION_EFFECTIVE_AT)!
    const nl = tldCapabilityAt("nl", CONTRACT_CORRECTION_EFFECTIVE_AT)!
    expect(validateTldTransferAuthorization(eu, "AB12-CD34-EF56-GH78")).toBe(true)
    expect(validateTldTransferAuthorization(eu, "ordinary-epp-code")).toBe(false)
    expect(validateTldTransferAuthorization(de, "AuthCde9")).toBe(true)
    expect(validateTldTransferAuthorization(de, "Authicde9")).toBe(true)
    expect(validateTldTransferAuthorization(de, "AuthInfo9")).toBe(false)
    expect(validateTldTransferAuthorization(de, "AuthCde0")).toBe(false)
    expect(validateTldTransferAuthorization(de, "AuthCde!")).toBe(false)
    expect(validateTldTransferAuthorization(de, "short")).toBe(false)
    expect(validateTldRegistrantPrerequisites(nl, {
      street: "Postbus 10",
      zipcode: "1000AA",
      country: "NL",
      phoneCountryCode: "31",
      phoneAreaCode: "20",
      phoneSubscriberNumber: "1234567",
    })).toEqual({ valid: false, reason: "nl_postal_box_not_allowed" })
    expect(validateTldRegistrantPrerequisites(eu, {
      street: "Main Street",
      zipcode: "10001",
      country: "US",
      phoneCountryCode: "1",
      phoneAreaCode: "212",
      phoneSubscriberNumber: "5550199",
    })).toEqual({ valid: false, reason: "eu_eligibility_not_evidenced" })
    expect(validateTldRegistrantPrerequisites(eu, {
      street: "Main Street",
      zipcode: "10001",
      country: "US",
      phoneCountryCode: "1",
      phoneAreaCode: "212",
      phoneSubscriberNumber: "5550199",
      euEligibilityBasis: "citizenship",
      euEligibilityCountry: "US",
    })).toEqual({ valid: false, reason: "eu_eligibility_not_evidenced" })
    expect(validateTldRegistrantPrerequisites(eu, {
      street: "Markt",
      zipcode: "1234AB",
      country: "NL",
      companyName: "Example B.V.",
      phoneCountryCode: "31",
      phoneAreaCode: "30",
      phoneSubscriberNumber: "1234567",
      euEligibilityBasis: "establishment",
      euEligibilityCountry: "NL",
    })).toEqual({ valid: true })
    expect(validateTldRegistrantPrerequisites(eu, {
      street: "Markt",
      zipcode: "1234AB",
      country: "NL",
      companyName: "Example B.V.",
      phoneCountryCode: "31",
      phoneAreaCode: "30",
      phoneSubscriberNumber: "1234567",
      euEligibilityBasis: "citizenship",
      euEligibilityCountry: "NL",
    })).toEqual({ valid: false, reason: "eu_eligibility_not_evidenced" })
    expect(validateTldRegistrantPrerequisites(eu, {
      street: "Main Street",
      zipcode: "10001",
      country: "US",
      companyName: null,
      phoneCountryCode: "1",
      phoneAreaCode: "212",
      phoneSubscriberNumber: "5550199",
      euEligibilityBasis: "residence",
      euEligibilityCountry: "NL",
    })).toEqual({ valid: false, reason: "eu_eligibility_not_evidenced" })
  })
})
