import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { errLike } from "../_helpers/cast"
const mocks = vi.hoisted(() => ({
  headers: new Headers({ host: "preview.siteinabox.nl" }),
  getSession: vi.fn(),
  loadPreviewGrantContext: vi.fn(),
  checkAndRecordPreviewDomainOrder: vi.fn(),
  loginOpenProvider: vi.fn(),
  suggestAvailablePreviewDomainBatch: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "nl-NL"),
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      checkoutDomainAvailable: "{domain} available",
      previewLoginRequired: "Preview login required",
    }
    return messages[key] ?? key
  }),
}))

vi.mock("@/lib/preview/betterAuth", () => ({
  previewAuth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

vi.mock("@/lib/preview/previewAccess", () => ({
  loadPreviewGrantContext: mocks.loadPreviewGrantContext,
  normalizePreviewClientSlug: (value: string) => value,
}))

vi.mock("@/lib/domains/openprovider", () => ({
  loginOpenProvider: mocks.loginOpenProvider,
}))

vi.mock("@/lib/domains/previewDomainOrder", () => ({
  checkAndRecordPreviewDomainOrder: mocks.checkAndRecordPreviewDomainOrder,
  requireReadyPreviewDomainOrder: vi.fn(),
  suggestAvailablePreviewDomainBatch: mocks.suggestAvailablePreviewDomainBatch,
}))

vi.mock("@/lib/payments/molliePayments", () => ({
  createMollieCheckoutForGenerationRun: vi.fn(),
}))

describe("preview checkout domain suggestion action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.getSession.mockResolvedValue({ user: { email: "Customer@Example.com" } })
    mocks.loadPreviewGrantContext.mockResolvedValue({
      payload: { update: vi.fn() },
      run: { id: 500 },
      customerEmail: "customer@example.com",
      clientSlug: "ami-care",
    })
    vi.stubEnv("MOLLIE_SITE_PAYMENT_AMOUNT", "228.00")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_CURRENCY", "EUR")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT", "10.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY", "EUR")
    mocks.checkAndRecordPreviewDomainOrder.mockResolvedValue({
      run: { id: 500 },
      messageKey: "checkoutDomainAvailable",
      domain: "ami-care.nl",
      included: true,
      extraFeeAmount: null,
      extraFeeCurrency: null,
      suggestions: [],
    })
    mocks.loginOpenProvider.mockResolvedValue("token-123")
    mocks.suggestAvailablePreviewDomainBatch.mockResolvedValue({
      suggestions: [{
        domain: "amicare-web.nl",
        included: false,
        extraFeeAmount: "20.00",
        extraFeeCurrency: "EUR",
      }],
      nextCursor: 5,
      done: false,
    })
  })

  it("blocks payment before explicit preview approval", async () => {
    const { startPreviewCheckoutPaymentAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")
    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    formData.set("termsAcceptance", "accepted")

    const result = await startPreviewCheckoutPaymentAction("ami-care", { ok: false, message: "" }, formData)
    expect(result).toMatchObject({ ok: false, message: "checkoutPreviewApprovalRequired" })
  })

  it("blocks payment before explicit terms acceptance", async () => {
    const { startPreviewCheckoutPaymentAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")
    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    formData.set("previewApproval", "accepted")

    const result = await startPreviewCheckoutPaymentAction("ami-care", { ok: false, message: "" }, formData)
    expect(result).toMatchObject({ ok: false, message: "checkoutTermsAcceptanceRequired" })
  })

  it("checks the primary typed domain without recording auto-check state", async () => {
    const { checkPreviewCheckoutDomainAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")

    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    const result = await checkPreviewCheckoutDomainAction("ami-care", { ok: false, message: "" }, formData)

    expect(result).toMatchObject({
      ok: true,
      status: "available",
      domain: "ami-care.nl",
      suggestions: [],
    })
    const context = await mocks.loadPreviewGrantContext.mock.results[0]?.value
    expect(mocks.checkAndRecordPreviewDomainOrder).toHaveBeenCalledWith(
      context.payload,
      context.run,
      "ami-care.nl",
      null,
      { record: false },
    )
    expect(context.payload.update).not.toHaveBeenCalled()
  })

  it("loads alternatives through the authenticated preview grant without mutating checkout state", async () => {
    const { suggestPreviewCheckoutDomainsAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")

    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    const result = await suggestPreviewCheckoutDomainsAction("ami-care", { ok: false }, formData)

    expect(result).toMatchObject({
      ok: true,
      domain: "ami-care.nl",
      suggestions: [{
        domain: "amicare-web.nl",
        included: false,
        extraFeeAmount: "20.00",
        extraFeeCurrency: "EUR",
        extraFeeLabel: expect.stringContaining("20"),
      }],
      cursor: 5,
      done: false,
    })
    expect(mocks.loadPreviewGrantContext).toHaveBeenCalledWith({
      clientSlug: "ami-care",
      email: "Customer@Example.com",
    })
    expect(mocks.loginOpenProvider).not.toHaveBeenCalled()
    expect(mocks.suggestAvailablePreviewDomainBatch).toHaveBeenCalledWith(
      "ami-care.nl",
      { amount: "10.00", currency: "EUR" },
      { cursor: 0, batchSize: 5, existingDomains: [] },
    )
    const context = await mocks.loadPreviewGrantContext.mock.results[0]?.value
    expect(context.payload.update).not.toHaveBeenCalled()
  })

  it("requires preview login before querying alternatives", async () => {
    mocks.getSession.mockResolvedValue(null)
    const { suggestPreviewCheckoutDomainsAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")

    const formData = new FormData()
    formData.set("domain", "ami-care.nl")

    await expect(suggestPreviewCheckoutDomainsAction("ami-care", { ok: false }, formData))
      .rejects.toThrow("Preview login required")
    expect(mocks.loadPreviewGrantContext).not.toHaveBeenCalled()
    expect(mocks.loginOpenProvider).not.toHaveBeenCalled()
    expect(mocks.suggestAvailablePreviewDomainBatch).not.toHaveBeenCalled()
  })

  it("loads alternative batches through the authenticated route handler", async () => {
    mocks.suggestAvailablePreviewDomainBatch.mockResolvedValue({
      suggestions: [{
        domain: "amicare-online.nl",
        included: false,
        extraFeeAmount: "20.00",
        extraFeeCurrency: "EUR",
      }],
      nextCursor: 12,
      done: true,
    })
    const { POST } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/suggestions/route")
    const request = new NextRequest("https://preview.siteinabox.nl/ami-care/checkout/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "preview=1" },
      body: JSON.stringify({
        domain: "ami-care.nl",
        cursor: 7,
        existing: ["amicare-web.nl"],
      }),
    })

    const response = await POST(request, { params: Promise.resolve({ clientSlug: "ami-care" }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      ok: true,
      domain: "ami-care.nl",
      suggestions: [{
        domain: "amicare-online.nl",
        included: false,
        extraFeeAmount: "20.00",
        extraFeeCurrency: "EUR",
        extraFeeLabel: expect.stringContaining("20"),
      }],
      cursor: 12,
      done: true,
    })
    expect(mocks.loadPreviewGrantContext).toHaveBeenCalledWith({
      clientSlug: "ami-care",
      email: "Customer@Example.com",
    })
    expect(mocks.suggestAvailablePreviewDomainBatch).toHaveBeenCalledWith(
      "ami-care.nl",
      { amount: "10.00", currency: "EUR" },
      { cursor: 7, batchSize: 10, existingDomains: ["amicare-web.nl"] },
    )
    expect(mocks.loginOpenProvider).not.toHaveBeenCalled()
  })

  it("loops route suggestion batches until five suggestions are accumulated", async () => {
    mocks.suggestAvailablePreviewDomainBatch
      .mockResolvedValueOnce({
        suggestions: [
          { domain: "amicare-online.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
          { domain: "amicare-site.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
        ],
        nextCursor: 10,
        done: false,
      })
      .mockResolvedValueOnce({
        suggestions: [
          { domain: "amicare-web.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
          { domain: "amicare-studio.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
          { domain: "amicare-hq.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
          { domain: "amicare-group.nl", included: true, extraFeeAmount: null, extraFeeCurrency: null },
        ],
        nextCursor: 20,
        done: false,
      })
    const { POST } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/suggestions/route")
    const request = new NextRequest("https://preview.siteinabox.nl/ami-care/checkout/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "preview=1" },
      body: JSON.stringify({ domain: "ami-care.nl", cursor: 0, existing: ["taken.nl"] }),
    })

    const response = await POST(request, { params: Promise.resolve({ clientSlug: "ami-care" }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.suggestions.map((suggestion: { domain: string }) => suggestion.domain)).toEqual([
      "amicare-online.nl",
      "amicare-site.nl",
      "amicare-web.nl",
      "amicare-studio.nl",
      "amicare-hq.nl",
    ])
    expect(json).toMatchObject({ cursor: 20, done: true })
    expect(mocks.suggestAvailablePreviewDomainBatch).toHaveBeenNthCalledWith(
      1,
      "ami-care.nl",
      { amount: "10.00", currency: "EUR" },
      { cursor: 0, batchSize: 10, existingDomains: ["taken.nl"] },
    )
    expect(mocks.suggestAvailablePreviewDomainBatch).toHaveBeenNthCalledWith(
      2,
      "ami-care.nl",
      { amount: "10.00", currency: "EUR" },
      { cursor: 10, batchSize: 10, existingDomains: ["taken.nl", "amicare-online.nl", "amicare-site.nl"] },
    )
  })

  it("stops route suggestion looping when provider candidates are exhausted", async () => {
    mocks.suggestAvailablePreviewDomainBatch.mockResolvedValue({
      suggestions: [{
        domain: "amicare-final.nl",
        included: true,
        extraFeeAmount: null,
        extraFeeCurrency: null,
      }],
      nextCursor: 30,
      done: true,
    })
    const { GET } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/suggestions/route")
    const request = new NextRequest("https://preview.siteinabox.nl/ami-care/checkout/suggestions?domain=ami-care.nl&cursor=20")

    const response = await GET(request, { params: Promise.resolve({ clientSlug: "ami-care" }) })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      ok: true,
      cursor: 30,
      done: true,
      suggestions: [{ domain: "amicare-final.nl" }],
    })
    expect(mocks.suggestAvailablePreviewDomainBatch).toHaveBeenCalledTimes(1)
  })

  it("returns partial route suggestions when the short server deadline is reached", async () => {
    const nowValues = [0, 0, 5, 10, 10, 10, 15, 1120, 1125]
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => nowValues.shift() ?? 1125)
    mocks.suggestAvailablePreviewDomainBatch.mockResolvedValue({
      suggestions: [{
        domain: "amicare-partial.nl",
        included: true,
        extraFeeAmount: null,
        extraFeeCurrency: null,
      }],
      nextCursor: 10,
      done: false,
    })
    const { GET } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/suggestions/route")
    const request = new NextRequest("https://preview.siteinabox.nl/ami-care/checkout/suggestions?domain=ami-care.nl")

    const response = await GET(request, { params: Promise.resolve({ clientSlug: "ami-care" }) })
    const json = await response.json()
    nowSpy.mockRestore()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      ok: true,
      cursor: 10,
      done: false,
      suggestions: [{ domain: "amicare-partial.nl" }],
    })
    expect(mocks.suggestAvailablePreviewDomainBatch).toHaveBeenCalledTimes(1)
  })

  it("returns 401 JSON from the suggestions route when preview auth is missing", async () => {
    mocks.getSession.mockResolvedValue(null)
    const { GET } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/suggestions/route")
    const request = new NextRequest("https://preview.siteinabox.nl/ami-care/checkout/suggestions?domain=ami-care.nl")

    const response = await GET(request, { params: Promise.resolve({ clientSlug: "ami-care" }) })
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toMatchObject({
      ok: false,
      suggestions: [],
      cursor: 0,
      done: true,
    })
    expect(mocks.loadPreviewGrantContext).not.toHaveBeenCalled()
    expect(mocks.loginOpenProvider).not.toHaveBeenCalled()
  })

  it("prewarms the OpenProvider token after the authenticated preview grant check", async () => {
    const { POST } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/prewarm/route")
    const request = new NextRequest("https://preview.siteinabox.nl/ami-care/checkout/prewarm", {
      method: "POST",
      headers: { cookie: "preview=1" },
    })

    const response = await POST(request, { params: Promise.resolve({ clientSlug: "ami-care" }) })

    expect(response.status).toBe(204)
    expect(mocks.loadPreviewGrantContext).toHaveBeenCalledWith({
      clientSlug: "ami-care",
      email: "Customer@Example.com",
    })
    expect(mocks.loginOpenProvider).toHaveBeenCalledTimes(1)
    expect(mocks.loadPreviewGrantContext.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.loginOpenProvider.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY)
    expect(mocks.checkAndRecordPreviewDomainOrder).not.toHaveBeenCalled()
    expect(mocks.suggestAvailablePreviewDomainBatch).not.toHaveBeenCalled()
  })

  it("returns 401 JSON from the prewarm route when preview auth is missing", async () => {
    mocks.getSession.mockResolvedValue(null)
    const { POST } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/prewarm/route")
    const request = new NextRequest("https://preview.siteinabox.nl/ami-care/checkout/prewarm", {
      method: "POST",
    })

    const response = await POST(request, { params: Promise.resolve({ clientSlug: "ami-care" }) })
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toMatchObject({ ok: false })
    expect(mocks.loadPreviewGrantContext).not.toHaveBeenCalled()
    expect(mocks.loginOpenProvider).not.toHaveBeenCalled()
    expect(mocks.checkAndRecordPreviewDomainOrder).not.toHaveBeenCalled()
    expect(mocks.suggestAvailablePreviewDomainBatch).not.toHaveBeenCalled()
  })

  it("marks suggestion provider failures terminal for the current typed domain", async () => {
    mocks.suggestAvailablePreviewDomainBatch.mockRejectedValue(new Error("provider unavailable"))
    const { suggestPreviewCheckoutDomainsAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")

    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    const result = await suggestPreviewCheckoutDomainsAction(
      "ami-care",
      {
        ok: true,
        domain: "ami-care.nl",
        cursor: 5,
        done: false,
        suggestions: [{
          domain: "amicare-web.nl",
          included: true,
          extraFeeAmount: null,
          extraFeeCurrency: null,
        }],
      },
      formData,
    )

    expect(result).toMatchObject({
      ok: false,
      domain: "ami-care.nl",
      cursor: 5,
      done: true,
      suggestions: [{ domain: "amicare-web.nl" }],
    })
    expect(mocks.suggestAvailablePreviewDomainBatch).toHaveBeenCalledWith(
      "ami-care.nl",
      { amount: "10.00", currency: "EUR" },
      { cursor: 5, batchSize: 5, existingDomains: ["amicare-web.nl"] },
    )
  })
})
