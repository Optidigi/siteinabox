import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
import {
  checkAndRecordPreviewDomainOrder,
  checkPreviewDomainOrders,
  MAX_PREVIEW_DOMAIN_ORDER_BATCH_SIZE,
  requireReadyPreviewDomainOrder,
  suggestAvailablePreviewDomainBatch,
  suggestAvailablePreviewDomains,
} from "@/lib/domains/previewDomainOrder"

describe("preview domain order", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-28T14:59:59.999Z"))
    vi.clearAllMocks()
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT", "10.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY", "EUR")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_OFFER_AMOUNT", "25.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_OFFER_CURRENCY", "EUR")
    vi.mocked(suggestOpenProviderDomains).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
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

    const result = await checkAndRecordPreviewDomainOrder(
      asPayload(payload),
      cast<SiteGenerationRun>(run),
      "acme.nl",
      null,
      { capabilityEffectiveAt: "2026-07-28T14:59:59.999Z" },
    )

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

  it("uses provider evidence without requiring a global fixed checkout amount", async () => {
    const run = {
      id: 124,
      domainOrder: null,
    }
    const payload = {
      update: vi.fn(async ({ data }: MockCreateArgs) => {
        Object.assign(run, data)
        return { ...run }
      }),
    }
    vi.mocked(checkOpenProviderDomainAvailability).mockResolvedValue({
      status: "available",
      domain: "acme.nl",
      available: true,
      premium: false,
      price: { amount: "6.50", currency: "EUR" },
      internalReason: null,
    })

    await expect(checkAndRecordPreviewDomainOrder(
      asPayload(payload),
      cast<SiteGenerationRun>(run),
      "acme.nl",
      null,
      { capabilityEffectiveAt: "2026-07-28T14:59:59.999Z" },
    )).resolves.toMatchObject({
      messageKey: "checkoutDomainAvailable",
      domain: "acme.nl",
      providerPriceAmount: "6.50",
    })
    expect(run.domainOrder).toMatchObject({
      fixedPriceAmount: null,
      fixedPriceCurrency: null,
      providerPriceAmount: "6.50",
      providerPriceCurrency: "EUR",
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

  it("marks available domains above the included cap as unavailable when there is no fixed surcharge", async () => {
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

    const result = await checkAndRecordPreviewDomainOrder(
      asPayload(payload),
      cast<SiteGenerationRun>(run),
      "levelweb.nl",
      null,
      { capabilityEffectiveAt: "2026-07-28T14:59:59.999Z" },
    )

    expect(result).toMatchObject({
      messageKey: "checkoutDomainUnavailable",
      domain: "levelweb.nl",
      included: false,
      extraFeeAmount: null,
      extraFeeCurrency: null,
      suggestions: [],
    })
    expect(run.domainOrder).toMatchObject({
      status: "failed",
      reason: "provider_price_unavailable",
      domain: "levelweb.nl",
      fixedPriceAmount: null,
      providerPriceAmount: "30.00",
      providerPriceCurrency: "EUR",
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

    const result = await checkAndRecordPreviewDomainOrder(
      asPayload(payload),
      cast<SiteGenerationRun>(run),
      "readonly.nl",
      null,
      {
        record: false,
        capabilityEffectiveAt: "2026-07-28T14:59:59.999Z",
      },
    )

    expect(result).toMatchObject({
      messageKey: "checkoutDomainAvailable",
      domain: "readonly.nl",
      included: true,
    })
    expect(payload.update).not.toHaveBeenCalled()
    expect(run.domainOrder).toBeNull()
  })

  it("checks normalized checkout candidates in one non-persistent batch and restores candidate order", async () => {
    const run = { id: 123, domainOrder: null }
    vi.mocked(checkOpenProviderDomainsAvailability).mockResolvedValue([
      {
        status: "available",
        domain: "acme.com",
        available: true,
        premium: false,
        price: { amount: "12.50", currency: "EUR" },
        internalReason: null,
      },
      {
        status: "available",
        domain: "acme.nl",
        available: true,
        premium: false,
        price: { amount: "6.50", currency: "EUR" },
        internalReason: null,
      },
    ])

    await expect(checkPreviewDomainOrders(
      cast<SiteGenerationRun>(run),
      ["Acme.NL", "acme.com", "acme.nl"],
      null,
      {
        includedProviderPrice: { amount: "10.00", currency: "EUR" },
        capabilityEffectiveAt: "2026-07-28T14:59:59.999Z",
        requireProductionCapability: false,
      },
    )).resolves.toMatchObject([
      {
        run,
        domain: "acme.nl",
        messageKey: "checkoutDomainAvailable",
        included: true,
      },
      {
        run,
        domain: "acme.com",
        messageKey: "checkoutDomainReleasePending",
        included: false,
        extraFeeAmount: "16.50",
      },
    ])

    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledWith(["acme.nl", "acme.com"])
    expect(checkOpenProviderDomainAvailability).not.toHaveBeenCalled()
    expect(run.domainOrder).toBeNull()
  })

  it("marks invalid discovery candidates as unavailable without skipping valid candidates", async () => {
    const run = { id: 123, domainOrder: null }
    vi.mocked(checkOpenProviderDomainsAvailability).mockResolvedValue([
      {
        status: "unavailable",
        domain: "acme.com",
        available: false,
        premium: false,
        price: null,
        internalReason: null,
      },
      {
        status: "available",
        domain: "acme.nl",
        available: true,
        premium: false,
        price: { amount: "6.50", currency: "EUR" },
        internalReason: null,
      },
    ])

    await expect(checkPreviewDomainOrders(
      cast<SiteGenerationRun>(run),
      ["acme.invalid", "acme.nl", "acme.com"],
      null,
      {
        includedProviderPrice: { amount: "10.00", currency: "EUR" },
        capabilityEffectiveAt: "2026-07-28T14:59:59.999Z",
        requireProductionCapability: false,
      },
    )).resolves.toMatchObject([
      {
        run,
        domain: "acme.invalid",
        messageKey: "checkoutDomainUnavailable",
        included: false,
        productionOperationEnabled: false,
      },
      {
        run,
        domain: "acme.nl",
        messageKey: "checkoutDomainAvailable",
        included: true,
      },
      {
        run,
        domain: "acme.com",
        messageKey: "checkoutDomainUnavailable",
      },
    ])

    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledWith(["acme.nl", "acme.com"])
    expect(checkOpenProviderDomainAvailability).not.toHaveBeenCalled()
  })

  it("preserves candidate order while short-circuiting invalid discovery entries", async () => {
    const run = { id: 123, domainOrder: null }
    vi.mocked(checkOpenProviderDomainsAvailability).mockResolvedValue([
      {
        status: "available",
        domain: "acme.nl",
        available: true,
        premium: false,
        price: { amount: "6.50", currency: "EUR" },
        internalReason: null,
      },
      {
        status: "unavailable",
        domain: "acme.com",
        available: false,
        premium: false,
        price: null,
        internalReason: null,
      },
    ])

    await expect(checkPreviewDomainOrders(
      cast<SiteGenerationRun>(run),
      ["acme.nl", "-bad.tld", "acme.com"],
      null,
      {
        includedProviderPrice: { amount: "10.00", currency: "EUR" },
        capabilityEffectiveAt: "2026-07-28T14:59:59.999Z",
        requireProductionCapability: false,
      },
    )).resolves.toMatchObject([
      { run, domain: "acme.nl", messageKey: "checkoutDomainAvailable", included: true },
      { run, domain: "-bad.tld", messageKey: "checkoutDomainUnavailable", included: false },
      { run, domain: "acme.com", messageKey: "checkoutDomainUnavailable", included: false },
    ])

    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledWith(["acme.nl", "acme.com"])
  })

  it("classifies unsupported-label discovery candidates without affecting valid candidates", async () => {
    const run = { id: 123, domainOrder: null }
    vi.mocked(checkOpenProviderDomainsAvailability).mockResolvedValue([{
      status: "available",
      domain: "acme.nl",
      available: true,
      premium: false,
      price: { amount: "6.50", currency: "EUR" },
      internalReason: null,
    }])

    await expect(checkPreviewDomainOrders(
      cast<SiteGenerationRun>(run),
      ["a.org", "acme.nl"],
      null,
      {
        includedProviderPrice: { amount: "10.00", currency: "EUR" },
        capabilityEffectiveAt: "2026-07-28T14:59:59.999Z",
        requireProductionCapability: false,
      },
    )).resolves.toMatchObject([
      {
        run,
        domain: "a.org",
        messageKey: "checkoutDomainUnavailable",
        included: false,
        productionOperationEnabled: false,
      },
      {
        run,
        domain: "acme.nl",
        messageKey: "checkoutDomainAvailable",
        included: true,
      },
    ])
    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainsAvailability).toHaveBeenCalledWith(["acme.nl"])
  })

  it("does not call provider reads when candidates fail normalization and no valid domains remain", async () => {
    await expect(checkPreviewDomainOrders(
      cast<SiteGenerationRun>({ id: 123, domainOrder: null }),
      ["-bad.name", ".invalid", "foo"],
      null,
      {
        includedProviderPrice: { amount: "10.00", currency: "EUR" },
        capabilityEffectiveAt: "2026-07-28T14:59:59.999Z",
      },
    )).resolves.toMatchObject([])

    expect(checkOpenProviderDomainsAvailability).not.toHaveBeenCalled()
    expect(checkOpenProviderDomainAvailability).not.toHaveBeenCalled()
  })

  it("throws typed validation failures for direct selected-domain checks with meaningful messages", async () => {
    const run = { id: 123, domainOrder: null }
    const payload = { update: vi.fn() }

    await expect(checkAndRecordPreviewDomainOrder(
      asPayload(payload),
      cast<SiteGenerationRun>(run),
      "acme.invalid",
      null,
      {
        record: false,
        capabilityEffectiveAt: "2026-07-20T00:00:00.000Z",
      },
    )).rejects.toThrow("TLD .invalid is not enabled for checkout.")
    await expect(checkAndRecordPreviewDomainOrder(
      asPayload(payload),
      cast<SiteGenerationRun>({ ...run }),
      "a.org",
      null,
      {
        record: false,
        capabilityEffectiveAt: "2026-08-02T00:00:00.000Z",
      },
    )).rejects.toThrow("Domain label is not supported for .org.")
    await expect(checkAndRecordPreviewDomainOrder(
      asPayload(payload),
      cast<SiteGenerationRun>({ ...run }),
      "-bad.name",
      null,
      {
        record: false,
        capabilityEffectiveAt: "2026-08-02T00:00:00.000Z",
      },
    )).rejects.toThrow("Invalid domain: invalid_format")

    expect(checkOpenProviderDomainAvailability).not.toHaveBeenCalled()
  })

  it("rejects checkout batches above the bounded provider limit before calling OpenProvider", async () => {
    const domainInputs = Array.from(
      { length: MAX_PREVIEW_DOMAIN_ORDER_BATCH_SIZE + 1 },
      (_, index) => `acme${index}.nl`,
    )

    await expect(checkPreviewDomainOrders(
      cast<SiteGenerationRun>({ id: 123, domainOrder: null }),
      domainInputs,
      null,
      { capabilityEffectiveAt: "2026-07-28T14:59:59.999Z" },
    )).rejects.toThrow(`Checkout domain batch exceeds ${MAX_PREVIEW_DOMAIN_ORDER_BATCH_SIZE} domains.`)

    expect(checkOpenProviderDomainsAvailability).not.toHaveBeenCalled()
  })

  it("checks an explicitly entered non-recommended TLD through OpenProvider without adding it to suggestions", async () => {
    const run = { id: 123, domainOrder: null }
    const payload = {
      update: vi.fn(async ({ data }: MockCreateArgs) => {
        Object.assign(run, data)
        return { ...run }
      }),
    }
    vi.mocked(checkOpenProviderDomainAvailability).mockResolvedValue({
      status: "available",
      domain: "acme.ai",
      available: true,
      premium: false,
      price: { amount: "14.00", currency: "EUR" },
      internalReason: null,
    })

    await expect(checkAndRecordPreviewDomainOrder(
      asPayload(payload),
      cast<SiteGenerationRun>(run),
      "acme.ai",
      null,
      {
        record: false,
        capabilityEffectiveAt: "2026-08-02T00:00:00.000Z",
        requireProductionCapability: false,
      },
    )).resolves.toMatchObject({
      messageKey: "checkoutDomainAvailableExtraFee",
      domain: "acme.ai",
      included: false,
      extraFeeAmount: "179.00",
    })
    expect(checkOpenProviderDomainAvailability).toHaveBeenCalledWith("acme.ai")
    expect(suggestOpenProviderDomains).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("checks an explicitly entered qualified TLD through OpenProvider with its EUR quote", async () => {
    const run = { id: 123, domainOrder: null }
    vi.mocked(checkOpenProviderDomainAvailability).mockResolvedValue({
      status: "available",
      domain: "acme.com",
      available: true,
      premium: false,
      price: { amount: "14.00", currency: "EUR" },
      internalReason: null,
    })

    await expect(checkAndRecordPreviewDomainOrder(
      asPayload({ update: vi.fn() }),
      cast<SiteGenerationRun>(run),
      "Acme.Com",
      null,
      {
        record: false,
        capabilityEffectiveAt: "2026-08-02T00:00:00.000Z",
        requireProductionCapability: false,
      },
    )).resolves.toMatchObject({
      domain: "acme.com",
      messageKey: "checkoutDomainAvailableExtraFee",
      providerPriceAmount: "14.00",
      providerPriceCurrency: "EUR",
      extraFeeAmount: "18.50",
      extraFeeCurrency: "EUR",
    })
    expect(checkOpenProviderDomainAvailability).toHaveBeenCalledWith("acme.com")
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

    await expect(requireReadyPreviewDomainOrder(asPayload(payload), cast<SiteGenerationRun>(run), "levelweb.nl", registrant))
      .rejects.toThrow("checkoutDomainUnavailable")

    expect(payload.update).toHaveBeenCalledTimes(1)
    expect(checkOpenProviderDomainAvailability).toHaveBeenCalledWith("levelweb.nl", { forceFresh: true })
    expect(run.domainOrder).toMatchObject({
      status: "failed",
      domain: "levelweb.nl",
      providerPriceAmount: "30.00",
      reason: "provider_price_unavailable",
      registrant,
    })
  })
})
