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
})
