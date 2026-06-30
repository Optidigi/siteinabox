import { describe, expect, it } from "vitest"
import { normalizeDomain, splitDomain } from "@/lib/domains/normalize"
import {
  createDomainOrderState,
  maxDomainProviderPriceFromEnv,
  providerPriceWithinCap,
  fixedDomainOrderPriceFromEnv,
  normalizeDomainOrderState,
} from "@/lib/domains/orderState"

describe("domain normalization", () => {
  it("normalizes URL-like input and splits the registrable request parts", () => {
    expect(normalizeDomain(" HTTPS://www.Example-Site.nl/path ")).toEqual({
      ok: true,
      domain: "example-site.nl",
      name: "example-site",
      extension: "nl",
      labels: ["example-site", "nl"],
    })
    expect(splitDomain("shop.example-site.nl")).toEqual({
      domain: "shop.example-site.nl",
      name: "shop.example-site",
      extension: "nl",
    })
  })

  it("rejects invalid hostnames and numeric TLDs", () => {
    expect(normalizeDomain("not a domain")).toEqual({
      ok: false,
      input: "not a domain",
      reason: "invalid_format",
    })
    expect(normalizeDomain("1.2.3.4")).toEqual({
      ok: false,
      input: "1.2.3.4",
      reason: "invalid_tld",
    })
  })
})

describe("domain order state", () => {
  it("normalizes unknown persisted JSON into a fixed shape", () => {
    expect(normalizeDomainOrderState({
      status: "registered",
      domain: " example.nl ",
      provider: "openprovider",
      providerReference: " 123 ",
      ignored: true,
    })).toMatchObject({
      status: "registered",
      domain: "example.nl",
      provider: "openprovider",
      providerReference: "123",
      fixedPriceAmount: null,
      providerPriceAmount: null,
    })
  })

  it("requires a configured fixed customer price", () => {
    expect(() => fixedDomainOrderPriceFromEnv({} as unknown as NodeJS.ProcessEnv)).toThrow("MOLLIE_SITE_PAYMENT_AMOUNT")
    expect(fixedDomainOrderPriceFromEnv({
      OPENPROVIDER_DOMAIN_FIXED_PRICE_AMOUNT: "19.00",
    } as unknown as NodeJS.ProcessEnv)).toEqual({ amount: "19.00", currency: "EUR" })
  })

  it("defaults to a low provider cost cap and rejects domains above it", () => {
    const cap = maxDomainProviderPriceFromEnv({} as unknown as NodeJS.ProcessEnv)
    expect(cap).toEqual({ amount: "7.00", currency: "EUR" })
    expect(providerPriceWithinCap({ amount: "6.99", currency: "EUR" }, cap)).toBe(true)
    expect(providerPriceWithinCap({ amount: "7.01", currency: "EUR" }, cap)).toBe(false)
    expect(providerPriceWithinCap({ amount: "6.99", currency: "USD" }, cap)).toBe(false)
  })

  it("creates timestamped operational states", () => {
    expect(createDomainOrderState({
      status: "ready_to_register",
      domain: "example.nl",
      fixedPrice: { amount: "19.00", currency: "EUR" },
      providerPrice: { amount: "8.50", currency: "EUR" },
      now: "2026-06-30T10:00:00.000Z",
    })).toEqual({
      status: "ready_to_register",
      domain: "example.nl",
      provider: "openprovider",
      fixedPriceAmount: "19.00",
      fixedPriceCurrency: "EUR",
      providerPriceAmount: "8.50",
      providerPriceCurrency: "EUR",
      providerReference: null,
      reason: null,
      checkedAt: "2026-06-30T10:00:00.000Z",
      requestedAt: null,
      registeredAt: null,
      updatedAt: "2026-06-30T10:00:00.000Z",
      registrant: null,
      ownerHandle: null,
      adminHandle: null,
      maxProviderPriceAmount: null,
      maxProviderPriceCurrency: null,
    })
  })
})
