import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/domains/openprovider", () => ({
  checkOpenProviderDomainAvailability: vi.fn(),
  checkOpenProviderDomainsAvailability: vi.fn(),
  loginOpenProvider: vi.fn(),
  suggestOpenProviderDomains: vi.fn(),
}))

import {
  checkOpenProviderDomainAvailability,
  checkOpenProviderDomainsAvailability,
  loginOpenProvider,
  suggestOpenProviderDomains,
} from "@/lib/domains/openprovider"
import { createDomainOrderState, type DomainRegistrantDetails } from "@/lib/domains/orderState"
import { checkAndRecordPreviewDomainOrder, requireReadyPreviewDomainOrder, suggestAvailablePreviewDomains } from "@/lib/domains/previewDomainOrder"

describe("preview domain order", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("MOLLIE_SITE_PAYMENT_AMOUNT", "228.00")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_CURRENCY", "EUR")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT", "10.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY", "EUR")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_OFFER_AMOUNT", "25.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_OFFER_CURRENCY", "EUR")
    vi.mocked(loginOpenProvider).mockResolvedValue("token-123")
    vi.mocked(suggestOpenProviderDomains).mockResolvedValue([])
  })

  it("returns unavailable primary domain results without waiting for alternatives", async () => {
    const run = {
      id: 123,
      domainOrder: null,
    }
    const payload = {
      update: vi.fn(async ({ data }: any) => {
        Object.assign(run, data)
        return { ...run }
      }),
    }

    vi.mocked(checkOpenProviderDomainAvailability).mockResolvedValue({
      status: "unavailable",
      domain: "acme.nl",
      available: false,
      premium: false,
      price: null,
      internalReason: null,
    })
    vi.mocked(checkOpenProviderDomainsAvailability).mockImplementation(async () => new Promise(() => {}))

    const result = await checkAndRecordPreviewDomainOrder(payload as any, run as any, "acme.nl")

    expect(result).toMatchObject({
      messageKey: "checkoutDomainUnavailable",
      domain: "acme.nl",
      suggestions: [],
    })
    expect(loginOpenProvider).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainAvailability).toHaveBeenCalledWith("acme.nl", { token: "token-123" })
    expect(suggestOpenProviderDomains).not.toHaveBeenCalled()
    expect(checkOpenProviderDomainsAvailability).not.toHaveBeenCalled()
    expect(run.domainOrder).toMatchObject({
      status: "unavailable",
      domain: "acme.nl",
      maxProviderPriceAmount: "10.00",
      maxProviderPriceCurrency: "EUR",
      maxOfferPriceAmount: null,
      maxOfferPriceCurrency: null,
    })
  })

  it("suggests five local same-extension alternatives in the separate suggestion path", async () => {
    vi.mocked(suggestOpenProviderDomains).mockResolvedValue([
      { domain: "acmesite.nl", name: "acmesite", extension: "nl" },
      { domain: "acme-online.nl", name: "acme-online", extension: "nl" },
      { domain: "acme-expensive.nl", name: "acme-expensive", extension: "nl" },
      { domain: "acme-studio.nl", name: "acme-studio", extension: "nl" },
      { domain: "acme-hq.nl", name: "acme-hq", extension: "nl" },
      { domain: "acme-groep.nl", name: "acme-groep", extension: "nl" },
      { domain: "acme.com", name: "acme", extension: "com" },
    ])
    vi.mocked(checkOpenProviderDomainsAvailability).mockImplementation(async (domains: string[]) => domains.map((domain) => ({
      status: "available",
      domain,
      available: true,
      premium: false,
      price: { amount: domain === "acme-expensive.nl" ? "30.00" : "6.50", currency: "EUR" },
      internalReason: null,
    })))

    await expect(suggestAvailablePreviewDomains(
      "acme.nl",
      { amount: "10.00", currency: "EUR" },
      "token-123",
    )).resolves.toEqual([
      { domain: "acmesite.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
      { domain: "acme-site.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
      { domain: "acmeonline.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
      { domain: "acme-online.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
      { domain: "acmeweb.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
    ])
    expect(suggestOpenProviderDomains).toHaveBeenCalledWith("acme.nl", { token: "token-123", limit: 12 })
    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledWith(
      expect.arrayContaining(["acmesite.nl", "acme-site.nl", "acmeonline.nl", "acme-online.nl", "acmeweb.nl"]),
      { token: "token-123" },
    )
  })

  it("marks available domains above the included cap as ready with an extra fee and no offer cap", async () => {
    const run = { id: 123, domainOrder: null }
    const payload = {
      update: vi.fn(async ({ data }: any) => {
        Object.assign(run, data)
        return { ...run }
      }),
    }

    vi.mocked(checkOpenProviderDomainAvailability).mockResolvedValue({
      status: "available",
      domain: "levelweb.nl",
      available: true,
      premium: false,
      price: { amount: "30.00", currency: "EUR" },
      internalReason: null,
    })

    const result = await checkAndRecordPreviewDomainOrder(payload as any, run as any, "levelweb.nl")

    expect(result).toMatchObject({
      messageKey: "checkoutDomainAvailableExtraFee",
      domain: "levelweb.nl",
      included: false,
      extraFeeAmount: "20.00",
      extraFeeCurrency: "EUR",
      suggestions: [],
    })
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      providerPriceAmount: "30.00",
      reason: "domain_cost_above_limit",
      maxOfferPriceAmount: null,
      maxOfferPriceCurrency: null,
    })
  })

  it("can return primary check results without recording domain order state", async () => {
    const run = { id: 123, domainOrder: null }
    const payload = {
      update: vi.fn(async ({ data }: any) => {
        Object.assign(run, data)
        return { ...run }
      }),
    }

    vi.mocked(checkOpenProviderDomainAvailability).mockResolvedValue({
      status: "available",
      domain: "readonly.nl",
      available: true,
      premium: false,
      price: { amount: "8.50", currency: "EUR" },
      internalReason: null,
    })

    const result = await checkAndRecordPreviewDomainOrder(payload as any, run as any, "readonly.nl", null, { record: false })

    expect(result).toMatchObject({
      messageKey: "checkoutDomainAvailable",
      domain: "readonly.nl",
      included: true,
    })
    expect(payload.update).not.toHaveBeenCalled()
    expect(run.domainOrder).toBeNull()
  })

  it("rechecks availability before accepting an existing ready order for payment", async () => {
    const registrant: DomainRegistrantDetails = {
      companyName: "Acme Studio",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "client@example.com",
      street: "Main Street",
      number: "10",
      suffix: null,
      zipcode: "1011AB",
      city: "Amsterdam",
      country: "NL",
      state: null,
      phoneCountryCode: "+31",
      phoneAreaCode: "20",
      phoneSubscriberNumber: "1234567",
      locale: "nl_NL",
    }
    const run = {
      id: 123,
      domainOrder: createDomainOrderState({
        status: "ready_to_register",
        domain: "levelweb.nl",
        fixedPrice: { amount: "228.00", currency: "EUR" },
        providerPrice: { amount: "8.50", currency: "EUR" },
        maxProviderPrice: { amount: "10.00", currency: "EUR" },
        maxOfferPrice: { amount: "25.00", currency: "EUR" },
        now: "2026-06-30T10:00:00.000Z",
      }),
    }
    const payload = {
      update: vi.fn(async ({ data }: any) => {
        Object.assign(run, data)
        return { ...run }
      }),
    }
    vi.mocked(checkOpenProviderDomainAvailability).mockResolvedValue({
      status: "available",
      domain: "levelweb.nl",
      available: true,
      premium: false,
      price: { amount: "30.00", currency: "EUR" },
      internalReason: null,
    })

    const result = await requireReadyPreviewDomainOrder(payload as any, run as any, "levelweb.nl", registrant)

    expect(result).toMatchObject({ domain: "levelweb.nl" })
    expect(payload.update).toHaveBeenCalledTimes(1)
    expect(loginOpenProvider).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainAvailability).toHaveBeenCalledWith("levelweb.nl", { token: "token-123" })
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      domain: "levelweb.nl",
      providerPriceAmount: "30.00",
      registrant,
    })
  })
})
