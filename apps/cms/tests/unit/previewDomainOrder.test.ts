import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SiteGenerationRun } from "@/payload-types"

import { cast } from "../_helpers/cast"
import { asPayload, type MockCreateArgs } from "../_helpers/mockPayload"
vi.mock("@/lib/domains/openprovider", () => ({
  checkOpenProviderDomainAvailability: vi.fn(),
  checkOpenProviderDomainsAvailability: vi.fn(),
  loginOpenProvider: vi.fn(),
  suggestOpenProviderDomains: vi.fn(),
}))

import {
  checkOpenProviderDomainAvailability,
  checkOpenProviderDomainsAvailability,
  suggestOpenProviderDomains,
} from "@/lib/domains/openprovider"
import { createDomainOrderState, type DomainRegistrantDetails } from "@/lib/domains/orderState"
import { previewDomainCandidates } from "@/lib/domains/previewDomainCandidates"
import { checkAndRecordPreviewDomainOrder, requireReadyPreviewDomainOrder, suggestAvailablePreviewDomainBatch, suggestAvailablePreviewDomains } from "@/lib/domains/previewDomainOrder"

describe("preview domain order", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("MOLLIE_SITE_PAYMENT_AMOUNT", "228.00")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_CURRENCY", "EUR")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT", "10.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY", "EUR")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_OFFER_AMOUNT", "25.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_OFFER_CURRENCY", "EUR")
    vi.mocked(suggestOpenProviderDomains).mockResolvedValue([])
  })

  it("returns unavailable primary domain results without waiting for alternatives", async () => {
    const run = {
      id: 123,
      domainOrder: null,
    }
    const payload = {
      update: vi.fn(async ({ data }: MockCreateArgs) => {
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

    const result = await checkAndRecordPreviewDomainOrder(asPayload(payload), cast<SiteGenerationRun>(run), "acme.nl")

    expect(result).toMatchObject({
      messageKey: "checkoutDomainUnavailable",
      domain: "acme.nl",
      suggestions: [],
    })
    expect(checkOpenProviderDomainAvailability).toHaveBeenCalledWith("acme.nl")
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
    )).resolves.toEqual([
      { domain: "acmeonline.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
      { domain: "acme-online.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
      { domain: "acmesite.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
      { domain: "acme-site.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
      { domain: "acmeweb.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
    ])
    expect(suggestOpenProviderDomains).not.toHaveBeenCalled()
    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledWith(
      expect.arrayContaining(["acmesite.nl", "acme-site.nl", "acmeonline.nl", "acme-online.nl", "acmeweb.nl"]),
      undefined,
    )
  })

  it("exposes shared local preview domain candidates in server suggestion order", () => {
    expect(previewDomainCandidates("ami-care.nl").slice(0, 7)).toEqual([
      "ami-careonline.nl",
      "ami-care-online.nl",
      "ami-caresite.nl",
      "ami-care-site.nl",
      "ami-careweb.nl",
      "ami-care-web.nl",
      "ami-carestudio.nl",
    ])
    expect(previewDomainCandidates("https://www.acme.nl/path")).not.toContain("acme.nl")
  })

  it("uses provider suggestions only after local candidates are exhausted", async () => {
    vi.mocked(suggestOpenProviderDomains).mockResolvedValue([
      { domain: "provider-one.nl", name: "provider-one", extension: "nl" },
      { domain: "provider-two.nl", name: "provider-two", extension: "nl" },
    ])
    vi.mocked(checkOpenProviderDomainsAvailability).mockImplementation(async (domains: string[]) => domains.map((domain) => ({
      status: "available",
      domain,
      available: true,
      premium: false,
      price: { amount: "6.50", currency: "EUR" },
      internalReason: null,
    })))

    const batch = await suggestAvailablePreviewDomainBatch(
      "acme.nl",
      { amount: "10.00", currency: "EUR" },
      { cursor: 22, batchSize: 3 },
    )

    expect(suggestOpenProviderDomains).toHaveBeenCalledWith("acme.nl", { limit: 12 })
    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledWith(
      ["provider-one.nl", "provider-two.nl"],
      undefined,
    )
    expect(batch).toMatchObject({
      suggestions: [
        { domain: "provider-one.nl" },
        { domain: "provider-two.nl" },
      ],
      nextCursor: 24,
      done: true,
    })
  })

  it("keeps pagination open after the final local batch so provider suggestions can load next", async () => {
    vi.mocked(checkOpenProviderDomainsAvailability).mockImplementation(async (domains: string[]) => domains.map((domain) => ({
      status: "unavailable",
      domain,
      available: false,
      premium: false,
      price: null,
      internalReason: null,
    })))

    const finalLocalBatch = await suggestAvailablePreviewDomainBatch(
      "acme.nl",
      { amount: "10.00", currency: "EUR" },
      { cursor: 20, batchSize: 5 },
    )

    expect(suggestOpenProviderDomains).not.toHaveBeenCalled()
    expect(finalLocalBatch).toMatchObject({
      suggestions: [],
      nextCursor: 22,
      done: false,
    })

    vi.mocked(suggestOpenProviderDomains).mockResolvedValue([
      { domain: "provider-one.nl", name: "provider-one", extension: "nl" },
    ])
    vi.mocked(checkOpenProviderDomainsAvailability).mockResolvedValue([
      {
        status: "available",
        domain: "provider-one.nl",
        available: true,
        premium: false,
        price: { amount: "6.50", currency: "EUR" },
        internalReason: null,
      },
    ])

    await expect(suggestAvailablePreviewDomainBatch(
      "acme.nl",
      { amount: "10.00", currency: "EUR" },
      { cursor: finalLocalBatch.nextCursor, batchSize: 5 },
    )).resolves.toMatchObject({
      suggestions: [{ domain: "provider-one.nl" }],
      done: true,
    })
  })

  it("returns progressive suggestion batches with cursor state", async () => {
    vi.mocked(checkOpenProviderDomainsAvailability).mockImplementation(async (domains: string[]) => domains.map((domain) => ({
      status: "available",
      domain,
      available: true,
      premium: false,
      price: { amount: "6.50", currency: "EUR" },
      internalReason: null,
    })))

    await expect(suggestAvailablePreviewDomainBatch(
      "ami-care.nl",
      { amount: "10.00", currency: "EUR" },
      { cursor: 0, batchSize: 3 },
    )).resolves.toMatchObject({
      suggestions: [
        { domain: "ami-careonline.nl" },
        { domain: "ami-care-online.nl" },
        { domain: "ami-caresite.nl" },
      ],
      nextCursor: 3,
      done: false,
    })
  })

  it("keeps cursor positions stable when previous suggestions are excluded from new results", async () => {
    vi.mocked(checkOpenProviderDomainsAvailability).mockImplementation(async (domains: string[]) => domains.map((domain) => ({
      status: "available",
      domain,
      available: true,
      premium: false,
      price: { amount: "6.50", currency: "EUR" },
      internalReason: null,
    })))

    const batch = await suggestAvailablePreviewDomainBatch(
      "ami-care.nl",
      { amount: "10.00", currency: "EUR" },
      {
        cursor: 3,
        batchSize: 2,
        existingDomains: ["ami-careonline.nl", "ami-care-online.nl", "ami-caresite.nl"],
      },
    )

    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledWith(
      ["ami-care-site.nl", "ami-careweb.nl"],
      undefined,
    )
    expect(batch).toMatchObject({
      suggestions: [
        { domain: "ami-care-site.nl" },
        { domain: "ami-careweb.nl" },
      ],
      nextCursor: 5,
      done: false,
    })
  })

  it("marks available domains above the included cap as ready with an extra fee and no offer cap", async () => {
    const run = { id: 123, domainOrder: null }
    const payload = {
      update: vi.fn(async ({ data }: MockCreateArgs) => {
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

    const result = await checkAndRecordPreviewDomainOrder(asPayload(payload), cast<SiteGenerationRun>(run), "levelweb.nl")

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
      update: vi.fn(async ({ data }: MockCreateArgs) => {
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

    const result = await checkAndRecordPreviewDomainOrder(asPayload(payload), cast<SiteGenerationRun>(run), "readonly.nl", null, { record: false })

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
      update: vi.fn(async ({ data }: MockCreateArgs) => {
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

    const result = await requireReadyPreviewDomainOrder(asPayload(payload), cast<SiteGenerationRun>(run), "levelweb.nl", registrant)

    expect(result).toMatchObject({ domain: "levelweb.nl" })
    expect(payload.update).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainAvailability).toHaveBeenCalledWith("levelweb.nl")
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      domain: "levelweb.nl",
      providerPriceAmount: "30.00",
      registrant,
    })
  })
})
