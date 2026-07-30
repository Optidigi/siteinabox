import { describe, expect, it } from "vitest"

import {
  buildCheckoutQuote,
  openCheckoutQuote,
  sameCommercialCheckoutQuote,
  sealCheckoutQuote,
} from "@/lib/checkout/checkoutQuote"

const quoteContext = {
  selectedDomain: "example.nl",
  providerQuotedAt: "2026-07-28T10:00:00.000Z",
  draftVersion: "draft-1",
  now: new Date("2026-07-28T10:00:00.000Z"),
}

describe("Phase 3 checkout quote", () => {
  it("quotes monthly and annual subscriptions from the versioned catalog", () => {
    expect(buildCheckoutQuote({
      billingPeriod: "monthly",
      providerOperationPriceNetMinor: 1_000,
      ...quoteContext,
    })).toMatchObject({
      catalogVersion: "2026-07-29.1",
      packageCode: "siteinabox-monthly",
      netAmountMinor: 1_900,
      vatAmountMinor: 399,
      grossAmountMinor: 2_299,
    })
    expect(buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_000,
      ...quoteContext,
    })).toMatchObject({
      packageCode: "siteinabox-annual",
      netAmountMinor: 19_000,
      vatAmountMinor: 3_990,
      grossAmountMinor: 22_990,
    })
  })

  it("adds only the uncovered domain operation price before VAT", () => {
    expect(buildCheckoutQuote({
      billingPeriod: "monthly",
      providerOperationPriceNetMinor: 1_250,
      ...quoteContext,
    })).toMatchObject({
      netAmountMinor: 2_150,
      vatAmountMinor: 452,
      grossAmountMinor: 2_602,
      lineItems: [
        { code: "siteinabox-monthly", netAmountMinor: 1_900 },
        { code: "domain-operation-surcharge", netAmountMinor: 250 },
      ],
    })
  })

  it("retires assisted checkout while preserving explicit historical reconstruction", () => {
    expect(() => buildCheckoutQuote({
      billingPeriod: "monthly",
      providerOperationPriceNetMinor: 1_000,
      migrationClassification: "assisted_standard",
      migrationSourceZoneHash: "a".repeat(64),
      migrationInputEnvelope: "encrypted-migration-input",
      domainMode: "existing_domain",
      ...quoteContext,
    })).toThrow("unavailable")
    expect(buildCheckoutQuote({
      catalogVersion: "2026-07-26.1",
      billingPeriod: "monthly",
      providerOperationPriceNetMinor: 1_000,
      migrationClassification: "assisted_standard",
      migrationSourceZoneHash: "a".repeat(64),
      migrationInputEnvelope: "encrypted-migration-input",
      domainMode: "existing_domain",
      ...quoteContext,
    })).toMatchObject({
      catalogVersion: "2026-07-26.1",
      migrationClassification: "assisted_standard",
      netAmountMinor: 6_800,
      vatAmountMinor: 1_428,
      grossAmountMinor: 8_228,
      lineItems: [
        { code: "siteinabox-monthly", netAmountMinor: 1_900 },
        {
          code: "migration-assisted-standard-per-domain",
          quantity: 1,
          netAmountMinor: 4_900,
        },
      ],
    })
    expect(() => buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_000,
      migrationClassification: "complex",
      domainMode: "existing_domain",
      ...quoteContext,
    })).toThrow("unavailable")
  })

  it("requires and compares frozen migration evidence for an existing domain", () => {
    const automatic = buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 800,
      migrationClassification: "automatic",
      migrationSourceMechanism: "validated_provider_export_v1",
      migrationSourceZoneHash: "a".repeat(64),
      migrationInputEnvelope: "encrypted-a",
      domainMode: "existing_domain",
      ...quoteContext,
    })
    const changedSource = buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 800,
      migrationClassification: "automatic",
      migrationSourceMechanism: "validated_provider_export_v1",
      migrationSourceZoneHash: "b".repeat(64),
      migrationInputEnvelope: "encrypted-b",
      domainMode: "existing_domain",
      ...quoteContext,
    })

    expect(sameCommercialCheckoutQuote(automatic, changedSource)).toBe(false)
    expect(() => buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 800,
      migrationClassification: "automatic",
      domainMode: "existing_domain",
      ...quoteContext,
    })).toThrow("frozen migration input evidence")
  })

  it("discloses and freezes the governed .nl and .be transfer-renewal effects", () => {
    const existingDomainQuote = (selectedDomain: string) => buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 800,
      migrationClassification: "automatic",
      migrationSourceMechanism: "validated_provider_export_v1",
      migrationSourceZoneHash: "a".repeat(64),
      migrationInputEnvelope: "encrypted-source",
      domainMode: "existing_domain",
      ...quoteContext,
      selectedDomain,
    })
    const nl = existingDomainQuote("example.nl")
    const be = existingDomainQuote("example.be")

    expect(nl).toMatchObject({
      transferRenewalEffect: "unchanged",
      domainRenewalExplanation: expect.stringContaining(
        "wijzigt de huidige verlengdatum niet",
      ),
    })
    expect(be).toMatchObject({
      transferRenewalEffect: "restarts_from_transfer_date",
      domainRenewalExplanation: expect.stringContaining(
        "nieuwe registratieperiode vanaf de transferdatum",
      ),
    })
    expect(sameCommercialCheckoutQuote(nl, {
      ...nl,
      transferRenewalEffect: "extends_one_year",
    })).toBe(false)
  })

  it("seals quote evidence and rejects tampering or expiry", () => {
    const issuedAt = new Date("2026-07-28T10:00:00.000Z")
    const envelope = sealCheckoutQuote(buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_250,
      ...quoteContext,
      now: issuedAt,
    }), "quote-test-secret")

    expect(openCheckoutQuote(
      envelope.token,
      "quote-test-secret",
      new Date("2026-07-28T10:14:59.000Z"),
    )).toEqual(envelope.quote)
    expect(() => openCheckoutQuote(
      `${envelope.token.slice(0, -1)}x`,
      "quote-test-secret",
      new Date("2026-07-28T10:01:00.000Z"),
    )).toThrow("invalid")
    expect(() => openCheckoutQuote(
      envelope.token,
      "quote-test-secret",
      new Date("2026-07-28T10:15:00.000Z"),
    )).toThrow("expired")
  })

  it("requires explicit acceptance when the provider price changes", () => {
    const accepted = buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_000,
      ...quoteContext,
    })
    const repriced = buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_250,
      ...quoteContext,
    })

    expect(sameCommercialCheckoutQuote(accepted, accepted)).toBe(true)
    expect(sameCommercialCheckoutQuote(accepted, repriced)).toBe(false)
  })
})
