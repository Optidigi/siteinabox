import { afterEach, describe, expect, it, vi } from "vitest"

import type { SiteGenerationRun } from "@/payload-types"
import { asPayload } from "../_helpers/mockPayload"

const openProviderMocks = vi.hoisted(() => ({
  checkAvailability: vi.fn(),
  checkAvailabilityBatch: vi.fn(),
  suggestions: vi.fn(),
}))

vi.mock("@/lib/domains/openprovider", () => ({
  checkOpenProviderDomainAvailability: openProviderMocks.checkAvailability,
  checkOpenProviderDomainsAvailability: openProviderMocks.checkAvailabilityBatch,
  suggestOpenProviderDomains: openProviderMocks.suggestions,
}))

import {
  checkAndRecordPreviewDomainOrder,
  suggestAvailablePreviewDomainBatch,
} from "@/lib/domains/previewDomainOrder"

const run = {
  id: 50,
  domainOrder: null,
} as unknown as SiteGenerationRun
const LEGACY_NL_ENABLED_AT = "2026-07-28T14:59:59.999Z"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("effective TLD allowlist integration", () => {
  it("rejects an unsupported TLD before provider availability or checkout state writes", async () => {
    openProviderMocks.checkAvailability.mockResolvedValue({
      status: "available",
      domain: "example.com",
      available: true,
      premium: false,
      price: { amount: "8.00", currency: "EUR" },
      internalReason: null,
    })
    const payload = asPayload({ update: vi.fn() })

    await expect(checkAndRecordPreviewDomainOrder(
      payload,
      run,
      "example.com",
      null,
      { record: false, capabilityEffectiveAt: LEGACY_NL_ENABLED_AT },
    )).rejects.toThrow("not enabled")

    expect(openProviderMocks.checkAvailability).not.toHaveBeenCalled()
  })

  it("keeps unsupported alternatives and invalid registry labels away from provider reads", async () => {
    await expect(suggestAvailablePreviewDomainBatch(
      "example.com",
      { amount: "10.00", currency: "EUR" },
      { capabilityEffectiveAt: LEGACY_NL_ENABLED_AT },
    )).resolves.toEqual({
      suggestions: [],
      nextCursor: 0,
      done: true,
    })
    expect(openProviderMocks.checkAvailabilityBatch).not.toHaveBeenCalled()
    expect(openProviderMocks.suggestions).not.toHaveBeenCalled()

    await expect(checkAndRecordPreviewDomainOrder(
      asPayload({ update: vi.fn() }),
      run,
      "a.nl",
      null,
      { record: false, capabilityEffectiveAt: LEGACY_NL_ENABLED_AT },
    )).rejects.toThrow("Domain label")
    expect(openProviderMocks.checkAvailability).not.toHaveBeenCalled()
  })

  it("keeps a modeled .be capability away from provider reads before activation", async () => {
    openProviderMocks.checkAvailability.mockResolvedValue({
      status: "available",
      domain: "example.be",
      available: true,
      premium: false,
      price: { amount: "8.00", currency: "EUR" },
      internalReason: null,
    })
    const payload = asPayload({ update: vi.fn() })

    await expect(checkAndRecordPreviewDomainOrder(
      payload,
      run,
      "example.be",
      null,
      { record: false, capabilityEffectiveAt: LEGACY_NL_ENABLED_AT },
    )).rejects.toThrow("not enabled")

    expect(openProviderMocks.checkAvailability).not.toHaveBeenCalled()
  })

  it("allows historically enabled .nl through provider-backed pricing", async () => {
    openProviderMocks.checkAvailability.mockResolvedValue({
      status: "available",
      domain: "example.nl",
      available: true,
      premium: false,
      price: { amount: "8.00", currency: "EUR" },
      internalReason: null,
    })

    await expect(checkAndRecordPreviewDomainOrder(
      asPayload({ update: vi.fn() }),
      run,
      "example.nl",
      null,
      { record: false, capabilityEffectiveAt: LEGACY_NL_ENABLED_AT },
    )).resolves.toMatchObject({
      domain: "example.nl",
      included: true,
      messageKey: "checkoutDomainAvailable",
    })
    expect(openProviderMocks.checkAvailability).toHaveBeenCalledWith("example.nl")
  })

  it.each(["nl", "com", "eu", "org", "net", "be", "de", "info", "online", "shop"])(
    "allows current production registration checks for .%s",
    async (tld) => {
      openProviderMocks.checkAvailability.mockResolvedValue({
        status: "available",
        domain: `example.${tld}`,
        available: true,
        premium: false,
        price: { amount: "8.00", currency: "EUR" },
        internalReason: null,
      })

      await expect(checkAndRecordPreviewDomainOrder(
        asPayload({ update: vi.fn() }),
        run,
        `example.${tld}`,
        null,
        { record: false, requireProductionCapability: false },
      )).resolves.toMatchObject({
        domain: `example.${tld}`,
        messageKey: "checkoutDomainAvailable",
        productionOperationEnabled: true,
      })
      expect(openProviderMocks.checkAvailability).toHaveBeenCalledWith(`example.${tld}`)
      openProviderMocks.checkAvailability.mockClear()

      await expect(checkAndRecordPreviewDomainOrder(
        asPayload({ update: vi.fn() }),
        run,
        `example.${tld}`,
        null,
        { record: false },
      )).resolves.toMatchObject({
        domain: `example.${tld}`,
        messageKey: "checkoutDomainAvailable",
        productionOperationEnabled: true,
      })
      expect(openProviderMocks.checkAvailability).toHaveBeenCalledWith(`example.${tld}`)
    },
  )
})
