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
import { checkAndRecordPreviewDomainOrder, requireReadyPreviewDomainOrder } from "@/lib/domains/previewDomainOrder"

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

  it("suggests five local same-extension alternatives before calling provider suggestions", async () => {
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
      price: { amount: domain === "acme-expensive.nl" ? "26.00" : "6.50", currency: "EUR" },
      internalReason: null,
    })))

    const result = await checkAndRecordPreviewDomainOrder(payload as any, run as any, "acme.nl")

    expect(result).toMatchObject({
      messageKey: "checkoutDomainUnavailable",
      domain: "acme.nl",
      suggestions: [
        { domain: "acmesite.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
        { domain: "acme-site.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
        { domain: "acmeonline.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
        { domain: "acme-online.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
        { domain: "acmeweb.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
      ],
    })
    expect(loginOpenProvider).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainAvailability).toHaveBeenCalledWith("acme.nl", { token: "token-123" })
    expect(suggestOpenProviderDomains).not.toHaveBeenCalled()
    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledWith(
      expect.arrayContaining(["acmesite.nl", "acme-site.nl", "acmeonline.nl", "acme-online.nl", "acmeweb.nl"]),
      { token: "token-123" },
    )
    expect(run.domainOrder).toMatchObject({
      status: "unavailable",
      domain: "acme.nl",
      maxProviderPriceAmount: "10.00",
      maxProviderPriceCurrency: "EUR",
      maxOfferPriceAmount: "25.00",
      maxOfferPriceCurrency: "EUR",
    })
  })

  it("marks available domains above the included cap as ready with an extra fee", async () => {
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
      price: { amount: "12.50", currency: "EUR" },
      internalReason: null,
    })

    const result = await checkAndRecordPreviewDomainOrder(payload as any, run as any, "levelweb.nl")

    expect(result).toMatchObject({
      messageKey: "checkoutDomainAvailableExtraFee",
      domain: "levelweb.nl",
      included: false,
      extraFeeAmount: "2.50",
      extraFeeCurrency: "EUR",
    })
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      providerPriceAmount: "12.50",
      reason: "domain_cost_above_limit",
    })
  })

  it("persists registrant details on an existing ready order without rechecking availability", async () => {
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

    const result = await requireReadyPreviewDomainOrder(payload as any, run as any, "levelweb.nl", registrant)

    expect(result).toMatchObject({ domain: "levelweb.nl" })
    expect(payload.update).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainAvailability).not.toHaveBeenCalled()
    expect(loginOpenProvider).not.toHaveBeenCalled()
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      domain: "levelweb.nl",
      providerPriceAmount: "8.50",
      registrant,
    })
  })
})
