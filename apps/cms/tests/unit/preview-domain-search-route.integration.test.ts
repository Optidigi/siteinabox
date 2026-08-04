import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  providerReadsAllowed: vi.fn(),
  requireContext: vi.fn(),
  checkAvailability: vi.fn(),
  logTiming: vi.fn(),
  startTimer: vi.fn(),
}))

vi.mock("@/lib/commerce/releaseGate", () => ({
  commerceProviderReadsAllowed: mocks.providerReadsAllowed,
}))
vi.mock("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/previewCheckoutContext", () => ({
  requirePreviewDomainSearchContext: mocks.requireContext,
}))
vi.mock("@/lib/preview/domainCheckoutTiming", () => ({
  logPreviewCheckoutTiming: mocks.logTiming,
  startPreviewCheckoutTimer: mocks.startTimer,
}))
vi.mock("@/lib/domains/openprovider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/domains/openprovider")>(
    "@/lib/domains/openprovider",
  )
  return {
    ...actual,
    checkOpenProviderDomainsAvailability: mocks.checkAvailability,
  }
})

import { POST } from "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/domain-search/route"

const routeContext = { params: Promise.resolve({ clientSlug: "acme" }) }

const request = (body: unknown, headers: Record<string, string> = {}) => new NextRequest(
  "https://preview.siteinabox.nl/acme/checkout/domain-search",
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "preview.siteinabox.nl",
      "x-forwarded-host": "preview.siteinabox.nl",
      origin: "https://preview.siteinabox.nl",
      ...headers,
    },
    body: JSON.stringify(body),
  },
)

describe("preview domain-search route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.startTimer.mockReturnValue(100)
    mocks.providerReadsAllowed.mockReturnValue(true)
    mocks.requireContext.mockResolvedValue({
      clientSlug: "acme",
      run: { id: 42 },
    })
    mocks.checkAvailability.mockImplementation((domains: string[]) => {
      expect(domains).toEqual([
        "acme.nl",
        "acme.com",
        "acme.info",
        "acme.org",
        "acme.eu",
      ])
      return Promise.resolve([
        {
          status: "unavailable",
          domain: "acme.nl",
          available: false,
          premium: false,
          price: null,
          internalReason: null,
        },
        {
          status: "available",
          domain: "acme.com",
          available: true,
          premium: false,
          price: { amount: "6.50", currency: "EUR" },
          internalReason: null,
        },
        {
          status: "unavailable",
          domain: "acme.info",
          available: false,
          premium: false,
          price: null,
          internalReason: null,
        },
        {
          status: "available",
          domain: "acme.org",
          available: true,
          premium: false,
          price: { amount: "6.50", currency: "EUR" },
          internalReason: null,
        },
        {
          status: "unavailable",
          domain: "acme.eu",
          available: false,
          premium: false,
          price: null,
          internalReason: null,
        },
      ])
    })
  })

  it("returns discovery results for mixed valid and unsupported exact candidates", async () => {
    const response = await POST(request({
      query: "acme.invalid",
      mode: "primary",
    }), routeContext)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(body).toMatchObject({
      ok: true,
      hasMore: true,
    })
    const resultByDomain = new Map(body.results.map((result: { domain: string }) => [result.domain, result]))
    expect(resultByDomain.get("acme.invalid")).toMatchObject({
      domain: "acme.invalid",
      availability: "unavailable",
      purchasable: false,
      included: false,
      extraFee: null,
    })
    expect(body.results).toEqual([
      expect.objectContaining({ domain: "acme.invalid" }),
      expect.objectContaining({ domain: "acme.nl" }),
      expect.objectContaining({ domain: "acme.com" }),
      expect.objectContaining({ domain: "acme.info" }),
      expect.objectContaining({ domain: "acme.org" }),
      expect.objectContaining({ domain: "acme.eu" }),
    ])
    expect(body.results[0]).toMatchObject({ domain: "acme.invalid" })
    expect(body.results).toContainEqual(expect.objectContaining({
      domain: "acme.com",
      purchasable: true,
      included: true,
      availability: "available",
    }))

    expect(mocks.checkAvailability).toHaveBeenCalledTimes(1)
    expect(mocks.checkAvailability).toHaveBeenCalledWith(
      ["acme.nl", "acme.com", "acme.info", "acme.org", "acme.eu"],
      { signal: expect.any(Object) },
    )
    expect(body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "acme.invalid",
          checkedAt: expect.any(String),
        }),
        expect.objectContaining({
          domain: "acme.com",
          checkedAt: expect.any(String),
        }),
      ]),
    )
    for (const result of body.results) {
      expect(result).not.toHaveProperty("providerPriceAmount")
      expect(result).not.toHaveProperty("providerPriceCurrency")
      expect(result).not.toHaveProperty("messageKey")
    }
    expect(mocks.checkAvailability).toHaveBeenCalledTimes(1)
    expect(mocks.checkAvailability).toHaveBeenCalledWith(
      ["acme.nl", "acme.com", "acme.info", "acme.org", "acme.eu"],
      { signal: expect.any(Object) },
    )
  })
})
