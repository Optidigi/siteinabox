import { describe, expect, it } from "vitest"

import { buildCheckoutQuote } from "@/lib/checkout/checkoutQuote"

describe("Phase 3 checkout quote", () => {
  it("quotes monthly and annual subscriptions from the versioned catalog", () => {
    expect(buildCheckoutQuote({
      billingPeriod: "monthly",
      providerOperationPriceNetMinor: 1_000,
    })).toMatchObject({
      catalogVersion: "2026-07-26.1",
      packageCode: "siteinabox-monthly",
      netAmountMinor: 1_900,
      vatAmountMinor: 399,
      grossAmountMinor: 2_299,
    })
    expect(buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_000,
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

  it("adds one assisted-standard fee per domain and stops complex checkout", () => {
    expect(buildCheckoutQuote({
      billingPeriod: "monthly",
      providerOperationPriceNetMinor: 1_000,
      migrationClassification: "assisted_standard",
    })).toMatchObject({
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
    })).toThrow("custom quote")
  })
})
