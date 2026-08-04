import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  providerReadsAllowed: vi.fn(),
  requireContext: vi.fn(),
  search: vi.fn(),
  logTiming: vi.fn(),
  startTimer: vi.fn(),
}))

vi.mock("@/lib/commerce/releaseGate", () => ({
  commerceProviderReadsAllowed: mocks.providerReadsAllowed,
}))
vi.mock("@/lib/domains/previewDomainSearch", () => ({
  searchPreviewDomains: mocks.search,
}))
vi.mock(
  "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/previewCheckoutContext",
  () => ({
    requirePreviewDomainSearchContext: mocks.requireContext,
  }),
)
vi.mock("@/lib/preview/domainCheckoutTiming", () => ({
  logPreviewCheckoutTiming: mocks.logTiming,
  startPreviewCheckoutTimer: mocks.startTimer,
}))

import { POST } from "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/domain-search/route"

const routeContext = { params: Promise.resolve({ clientSlug: "acme" }) }

const request = (
  body: unknown,
  headers: Record<string, string> = {},
) => new NextRequest("https://preview.siteinabox.nl/acme/checkout/domain-search", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    host: "preview.siteinabox.nl",
    "x-forwarded-host": "preview.siteinabox.nl",
    origin: "https://preview.siteinabox.nl",
    ...headers,
  },
  body: JSON.stringify(body),
})

describe("preview domain-search route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.startTimer.mockReturnValue(100)
    mocks.providerReadsAllowed.mockReturnValue(true)
    mocks.requireContext.mockResolvedValue({
      clientSlug: "acme",
      run: { id: 42 },
    })
    mocks.search.mockResolvedValue({
      hasMore: true,
      results: [{
        domain: "acme.nl",
        availability: "available",
        purchasable: true,
        included: true,
        extraFee: null,
        checkedAt: "2026-08-03T10:00:00.000Z",
      }],
    })
  })

  it("rejects non-preview hosts and missing or cross-origin browser requests before authorization", async () => {
    const nonPreview = await POST(request({ query: "acme" }, {
      host: "cms.siteinabox.nl",
      "x-forwarded-host": "cms.siteinabox.nl",
      origin: "https://cms.siteinabox.nl",
    }), routeContext)
    const missingOrigin = await POST(request({ query: "acme" }, { origin: "" }), routeContext)
    const crossOrigin = await POST(request({ query: "acme" }, { origin: "https://attacker.example" }), routeContext)

    expect(nonPreview.status).toBe(403)
    expect(await nonPreview.json()).toEqual({ ok: false, errorCode: "request_authority_rejected" })
    expect(missingOrigin.status).toBe(403)
    expect(await missingOrigin.json()).toEqual({ ok: false, errorCode: "request_authority_rejected" })
    expect(crossOrigin.status).toBe(403)
    expect(await crossOrigin.json()).toEqual({ ok: false, errorCode: "request_authority_rejected" })
    expect(mocks.requireContext).not.toHaveBeenCalled()
    expect(mocks.search).not.toHaveBeenCalled()
    expect(mocks.logTiming).toHaveBeenCalledTimes(3)
    expect(mocks.logTiming).toHaveBeenCalledWith(
      "domain_search_total",
      100,
      { clientSlug: "acme" },
      { mode: "primary", ok: false, failureCode: "request_authority_rejected" },
    )
  })

  it("returns 401 when minimal preview search authority cannot be established", async () => {
    mocks.requireContext.mockRejectedValue(new Error("Preview login is required."))

    const response = await POST(request({ query: "acme" }), routeContext)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, errorCode: "preview_context_unavailable" })
    expect(mocks.providerReadsAllowed).not.toHaveBeenCalled()
    expect(mocks.search).not.toHaveBeenCalled()
    expect(mocks.logTiming).toHaveBeenCalledWith(
      "domain_search_total",
      100,
      { clientSlug: "acme" },
      { mode: "primary", ok: false, failureCode: "preview_context_unavailable" },
    )
  })

  it("returns 503 while provider reads are gated without running discovery", async () => {
    mocks.providerReadsAllowed.mockReturnValue(false)

    const response = await POST(request({ query: "acme" }), routeContext)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      ok: false,
      errorCode: "provider_reads_disabled",
      results: [],
      hasMore: false,
    })
    expect(mocks.search).not.toHaveBeenCalled()
    expect(mocks.logTiming).toHaveBeenCalledWith(
      "domain_search_total",
      100,
      { clientSlug: "acme" },
      { mode: "primary", ok: false, failureCode: "provider_reads_disabled" },
    )
  })

  it("returns compact, uncached discovery data and propagates the request cancellation signal", async () => {
    const domainRequest = request({ query: "Acme", mode: "more" })

    const response = await POST(domainRequest, routeContext)

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("server-timing")).toMatch(/^domain-search;dur=\d+$/)
    expect(await response.json()).toEqual({
      ok: true,
      hasMore: true,
      results: [{
        domain: "acme.nl",
        availability: "available",
        purchasable: true,
        included: true,
        extraFee: null,
        checkedAt: "2026-08-03T10:00:00.000Z",
      }],
    })
    expect(mocks.search).toHaveBeenCalledWith({
      run: { id: 42 },
      query: "Acme",
      mode: "more",
      signal: domainRequest.signal,
    })
    expect(mocks.logTiming).toHaveBeenCalledWith(
      "domain_search_total",
      100,
      { clientSlug: "acme" },
      { mode: "more", candidateCount: 1, ok: true },
    )
  })

  it("maps unexpected discovery failures to domain_search_failed with safe timing diagnostics", async () => {
    mocks.search.mockRejectedValue(new Error("provider outage"))

    const response = await POST(request({ query: "acme" }), routeContext)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      ok: false,
      errorCode: "domain_search_failed",
      results: [],
      hasMore: false,
    })
    expect(mocks.logTiming).toHaveBeenCalledWith(
      "domain_search_total",
      100,
      { clientSlug: "acme" },
      { mode: "primary", ok: false, failureCode: "domain_search_failed", errorName: "Error" },
    )
  })
})
