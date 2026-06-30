import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: new Headers({ host: "preview.siteinabox.nl" }),
  getSession: vi.fn(),
  loadPreviewGrantContext: vi.fn(),
  checkAndRecordPreviewDomainOrder: vi.fn(),
  loginOpenProvider: vi.fn(),
  suggestAvailablePreviewDomains: vi.fn(),
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
  suggestAvailablePreviewDomains: mocks.suggestAvailablePreviewDomains,
}))

vi.mock("@/lib/payments/molliePayments", () => ({
  createMollieCheckoutForGenerationRun: vi.fn(),
}))

describe("preview checkout domain suggestion action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    mocks.suggestAvailablePreviewDomains.mockResolvedValue([
      {
        domain: "amicare-web.nl",
        included: false,
        extraFeeAmount: "20.00",
        extraFeeCurrency: "EUR",
      },
    ])
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
    })
    expect(mocks.loadPreviewGrantContext).toHaveBeenCalledWith({
      clientSlug: "ami-care",
      email: "Customer@Example.com",
    })
    expect(mocks.loginOpenProvider).toHaveBeenCalledTimes(1)
    expect(mocks.suggestAvailablePreviewDomains).toHaveBeenCalledWith(
      "ami-care.nl",
      { amount: "10.00", currency: "EUR" },
      "token-123",
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
    expect(mocks.suggestAvailablePreviewDomains).not.toHaveBeenCalled()
  })
})
