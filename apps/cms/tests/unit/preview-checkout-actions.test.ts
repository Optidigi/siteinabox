import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { errLike } from "../_helpers/cast"
import {
  buildCheckoutQuote,
  sealCheckoutQuote,
} from "@/lib/checkout/checkoutQuote"
const mocks = vi.hoisted(() => ({
  headers: new Headers({ host: "preview.siteinabox.nl" }),
  getSession: vi.fn(),
  loadPreviewGrantContext: vi.fn(),
  checkAndRecordPreviewDomainOrder: vi.fn(),
  requireReadyPreviewDomainOrder: vi.fn(),
  loginOpenProvider: vi.fn(),
  suggestAvailablePreviewDomainBatch: vi.fn(),
  saveCheckoutProfileVersion: vi.fn(),
  loadLatestCheckoutProfile: vi.fn(),
  domainRegistrantFromCheckoutProfile: vi.fn(),
  payloadUpdate: vi.fn(),
  createSiteApprovalEvidence: vi.fn(),
  createOrderAndAcceptanceEvidence: vi.fn(),
  satisfyRequirementsFromTransaction: vi.fn(),
  createMollieCheckoutForGenerationRun: vi.fn(),
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
  requireReadyPreviewDomainOrder: mocks.requireReadyPreviewDomainOrder,
  suggestAvailablePreviewDomainBatch: mocks.suggestAvailablePreviewDomainBatch,
}))

vi.mock("@/lib/payments/molliePayments", () => ({
  createMollieCheckoutForGenerationRun: mocks.createMollieCheckoutForGenerationRun,
}))

vi.mock("@/lib/checkout/checkoutProfile", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/checkout/checkoutProfile")>()
  return {
    ...original,
    saveCheckoutProfileVersion: mocks.saveCheckoutProfileVersion,
    loadLatestCheckoutProfile: mocks.loadLatestCheckoutProfile,
    domainRegistrantFromCheckoutProfile: mocks.domainRegistrantFromCheckoutProfile,
  }
})

vi.mock("@/lib/legal/checkoutEvidence", () => ({
  createSiteApprovalEvidence: mocks.createSiteApprovalEvidence,
  createOrderAndAcceptanceEvidence: mocks.createOrderAndAcceptanceEvidence,
}))

vi.mock("@/lib/legal/customerRequirements", () => ({
  satisfyRequirementsFromTransaction: mocks.satisfyRequirementsFromTransaction,
}))

const validPaymentForm = () => {
  const formData = new FormData()
  formData.set("domain", "ami-care.nl")
  formData.set("previewApproval", "accepted")
  formData.set("termsAcceptance", "accepted")
  formData.set("businessUseAcceptance", "accepted")
  formData.set("expectedProfileVersion", "1")
  formData.set("expectedProfileKey", "run:500:checkout-profile:1")
  formData.set("expectedTermsVersion", "2026-07-07.1")
  formData.set("expectedPrivacyVersion", "2026-07-18.1")
  formData.set(
    "expectedBusinessUseDeclarationVersion",
    "business-use-declaration-2026-07-26.1",
  )
  formData.set("billingPeriod", "annual")
  formData.set("checkoutQuoteToken", sealCheckoutQuote(buildCheckoutQuote({
    billingPeriod: "annual",
    providerOperationPriceNetMinor: 1_000,
    selectedDomain: "ami-care.nl",
    providerQuotedAt: new Date().toISOString(),
    profileVersion: 1,
    draftVersion: "draft-500",
  }), "checkout-test-secret").token)
  return formData
}

const validProfileForm = () => {
  const formData = new FormData()
  formData.set("expectedProfileVersion", "0")
  formData.set("requestToken", "profile-request-1")
  formData.set("partyType", "business_in_formation")
  formData.set("firstName", "Customer")
  formData.set("lastName", "Owner")
  formData.set("registeredBusinessName", "")
  formData.set("kvkNumber", "")
  formData.set("intendedCompanyName", "Ami Care")
  formData.set("street", "Markt")
  formData.set("number", "1")
  formData.set("suffix", "")
  formData.set("zipcode", "1234AB")
  formData.set("city", "Utrecht")
  formData.set("country", "NL")
  formData.set("phoneCountryCode", "+31")
  formData.set("phoneAreaCode", "30")
  formData.set("phoneSubscriberNumber", "1234567")
  return formData
}

describe("preview checkout domain suggestion action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.getSession.mockResolvedValue({ user: { email: "Customer@Example.com" } })
    mocks.loadPreviewGrantContext.mockResolvedValue({
      payload: { update: mocks.payloadUpdate },
      run: { id: 500, updatedAt: "draft-500" },
      tenant: { id: 12, name: "Ami Care" },
      pages: [],
      customerEmail: "customer@example.com",
      clientSlug: "ami-care",
    })
    vi.stubEnv("OPENPROVIDER_DOMAIN_FIXED_PRICE_AMOUNT", "10.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_FIXED_PRICE_CURRENCY", "EUR")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT", "10.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY", "EUR")
    vi.stubEnv("PAYLOAD_SECRET", "checkout-test-secret")
    mocks.checkAndRecordPreviewDomainOrder.mockResolvedValue({
      run: { id: 500 },
      messageKey: "checkoutDomainAvailable",
      domain: "ami-care.nl",
      included: true,
      extraFeeAmount: null,
      extraFeeCurrency: null,
      providerPriceAmount: "10.00",
      providerPriceCurrency: "EUR",
      providerQuotedAt: "2026-07-28T10:00:00.000Z",
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
    const profile = {
      id: 70,
      profileKey: "run:500:checkout-profile:1",
      profileVersion: 1,
      generationRun: 500,
      customerName: "Customer Owner",
      customerEmail: "customer@example.com",
      partyType: "registered_business",
      contractingPartyName: "Ami Care B.V.",
      kvkNumber: "12345678",
      domainRegistrantSource: "contracting_party",
      billingAddress: {
        schemaVersion: 1,
        street: "Markt",
        number: "1",
        suffix: null,
        zipcode: "1234AB",
        city: "Utrecht",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "30",
        phoneSubscriberNumber: "1234567",
      },
      createdAt: "2026-07-26T12:00:00.000Z",
    }
    mocks.loadLatestCheckoutProfile.mockResolvedValue(profile)
    mocks.domainRegistrantFromCheckoutProfile.mockReturnValue({
      companyName: "Ami Care B.V.",
      firstName: "Customer",
      lastName: "Owner",
      email: "customer@example.com",
      street: "Markt",
      number: "1",
      suffix: null,
      zipcode: "1234AB",
      city: "Utrecht",
      country: "NL",
      state: null,
      phoneCountryCode: "+31",
      phoneAreaCode: "30",
      phoneSubscriberNumber: "1234567",
      locale: "nl_NL",
    })
    mocks.requireReadyPreviewDomainOrder.mockResolvedValue({
      run: {
        id: 500,
        domainOrder: {
          domain: "ami-care.nl",
          providerPriceAmount: "10.00",
          providerPriceCurrency: "EUR",
          checkedAt: "2026-07-28T10:00:00.000Z",
          maxProviderPriceAmount: "10.00",
          maxProviderPriceCurrency: "EUR",
        },
      },
      domain: "ami-care.nl",
    })
    mocks.createSiteApprovalEvidence.mockResolvedValue({
      approval: { id: 80, approvedAt: "2026-07-26T12:01:00.000Z", snapshotHash: "snapshot" },
      revision: { id: 81 },
      snapshotHash: "snapshot",
    })
    mocks.createOrderAndAcceptanceEvidence.mockResolvedValue({
      order: { id: 90 },
      terms: { id: 91 },
      acceptance: { id: 92, acceptedAt: "2026-07-26T12:02:00.000Z" },
    })
    mocks.createMollieCheckoutForGenerationRun.mockResolvedValue({
      checkoutUrl: "https://payments.example.test/checkout",
    })
    mocks.payloadUpdate.mockResolvedValue({ id: 500 })
    mocks.saveCheckoutProfileVersion.mockResolvedValue({
      status: "saved",
      created: true,
      profile: {
        profileKey: "run:500:checkout-profile:1",
        profileVersion: 1,
        customerEmail: "customer@example.com",
        customerName: "Customer Owner",
        contractingPartyName: "Customer Owner",
        partyType: "business_in_formation",
        firstName: "Customer",
        lastName: "Owner",
        registeredBusinessName: "",
        kvkNumber: "",
        intendedCompanyName: "Ami Care",
        street: "Markt",
        number: "1",
        suffix: "",
        zipcode: "1234AB",
        city: "Utrecht",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "30",
        phoneSubscriberNumber: "1234567",
        supersedesProfileKey: null,
        revisionReason: "initial_capture",
        actorEmail: "customer@example.com",
        sourceRequestId: "request",
        createdAt: "2026-07-26T12:00:00.000Z",
      },
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

  it("saves profile identity only after the authenticated preview grant check", async () => {
    const { savePreviewCheckoutProfileAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")

    const result = await savePreviewCheckoutProfileAction(
      "ami-care",
      { ok: false, message: "" },
      validProfileForm(),
    )

    expect(result).toMatchObject({
      ok: true,
      status: "saved",
      requestToken: "profile-request-1",
      profile: { profileVersion: 1 },
    })
    expect(mocks.saveCheckoutProfileVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        generationRunId: 500,
        tenantId: 12,
        actorEmail: "customer@example.com",
        expectedProfileVersion: 0,
        draft: expect.objectContaining({
          partyType: "business_in_formation",
          kvkNumber: "",
        }),
      }),
    )
  })

  it("blocks payment before explicit terms acceptance", async () => {
    const { startPreviewCheckoutPaymentAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")
    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    formData.set("previewApproval", "accepted")

    const result = await startPreviewCheckoutPaymentAction("ami-care", { ok: false, message: "" }, formData)
    expect(result).toMatchObject({ ok: false, message: "checkoutTermsAcceptanceRequired" })
  })

  it("blocks payment before the governed business-use declaration is accepted", async () => {
    const { startPreviewCheckoutPaymentAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")
    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    formData.set("previewApproval", "accepted")
    formData.set("termsAcceptance", "accepted")

    const result = await startPreviewCheckoutPaymentAction("ami-care", { ok: false, message: "" }, formData)
    expect(result).toMatchObject({ ok: false, message: "checkoutBusinessUseRequired" })
  })

  it("rejects a stale authoritative profile before any domain or payment write", async () => {
    const { startPreviewCheckoutPaymentAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")
    const formData = validPaymentForm()
    formData.set("expectedProfileVersion", "0")

    const result = await startPreviewCheckoutPaymentAction("ami-care", { ok: false, message: "" }, formData)

    expect(result).toMatchObject({ ok: false, status: "profile_conflict" })
    expect(mocks.requireReadyPreviewDomainOrder).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
  })

  it("uses only the persisted profile to construct registrant identity", async () => {
    const { startPreviewCheckoutPaymentAction } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions")
    const formData = validPaymentForm()
    formData.set("companyName", "Attacker B.V.")
    formData.set("registrantEmail", "attacker@example.test")
    formData.set("firstName", "Mallory")

    const result = await startPreviewCheckoutPaymentAction("ami-care", { ok: false, message: "" }, formData)

    expect(result).toMatchObject({
      ok: true,
      checkoutUrl: "https://payments.example.test/checkout",
    })
    expect(mocks.domainRegistrantFromCheckoutProfile).toHaveBeenCalledWith(
      expect.objectContaining({ profileKey: "run:500:checkout-profile:1" }),
    )
    expect(mocks.requireReadyPreviewDomainOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "ami-care.nl",
      expect.objectContaining({
        companyName: "Ami Care B.V.",
        email: "customer@example.com",
        firstName: "Customer",
      }),
      {
        includedProviderPrice: { amount: "10.00", currency: "EUR" },
      },
    )
    expect(mocks.requireReadyPreviewDomainOrder).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ email: "attacker@example.test" }),
      expect.anything(),
    )
    expect(mocks.createOrderAndAcceptanceEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({
          selectedDomain: "ami-care.nl",
          billingPeriod: "annual",
          netAmountMinor: 19_000,
          vatAmountMinor: 3_990,
          grossAmountMinor: 22_990,
        }),
      }),
    )
    expect(mocks.createMollieCheckoutForGenerationRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: 90 }),
    )
  })

  it("requires renewed acceptance when the authoritative provider price changes", async () => {
    mocks.requireReadyPreviewDomainOrder.mockResolvedValue({
      run: {
        id: 500,
        updatedAt: "2026-07-28T10:01:00.000Z",
        domainOrder: {
          domain: "ami-care.nl",
          providerPriceAmount: "12.50",
          providerPriceCurrency: "EUR",
          checkedAt: "2026-07-28T10:01:00.000Z",
        },
      },
      domain: "ami-care.nl",
    })
    const { startPreviewCheckoutPaymentAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )

    const result = await startPreviewCheckoutPaymentAction(
      "ami-care",
      { ok: false, message: "" },
      validPaymentForm(),
    )

    expect(result).toMatchObject({
      ok: false,
      status: "version_conflict",
      message: "checkoutQuoteVersionConflict",
    })
    expect(mocks.createOrderAndAcceptanceEvidence).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
  })

  it("rejects an expired sealed quote before domain or payment writes", async () => {
    const formData = validPaymentForm()
    formData.set("checkoutQuoteToken", sealCheckoutQuote(buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_000,
      selectedDomain: "ami-care.nl",
      providerQuotedAt: "2026-01-01T10:00:00.000Z",
      profileVersion: 1,
      draftVersion: "draft-expired",
      now: new Date("2026-01-01T10:00:00.000Z"),
    }), "checkout-test-secret").token)
    const { startPreviewCheckoutPaymentAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )

    const result = await startPreviewCheckoutPaymentAction(
      "ami-care",
      { ok: false, message: "" },
      formData,
    )

    expect(result).toMatchObject({ ok: false, status: "version_conflict" })
    expect(mocks.requireReadyPreviewDomainOrder).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
  })

  it("rejects a stale draft version before approval, order, or payment writes", async () => {
    const context = await mocks.loadPreviewGrantContext()
    context.run.updatedAt = "draft-501"
    mocks.loadPreviewGrantContext.mockClear()
    mocks.loadPreviewGrantContext.mockResolvedValue(context)
    const { startPreviewCheckoutPaymentAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )

    const result = await startPreviewCheckoutPaymentAction(
      "ami-care",
      { ok: false, message: "" },
      validPaymentForm(),
    )

    expect(result).toMatchObject({ ok: false, status: "version_conflict" })
    expect(mocks.createSiteApprovalEvidence).not.toHaveBeenCalled()
    expect(mocks.createOrderAndAcceptanceEvidence).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
  })

  it("does not create another order or payment while server state is pending", async () => {
    const context = await mocks.loadPreviewGrantContext()
    context.run.payment = {
      status: "pending_provider",
      provider: "mollie",
      externalReference: "tr_existing",
    }
    mocks.loadPreviewGrantContext.mockClear()
    mocks.loadPreviewGrantContext.mockResolvedValue(context)
    const { startPreviewCheckoutPaymentAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )

    const results = await Promise.all([
      startPreviewCheckoutPaymentAction(
        "ami-care",
        { ok: false, message: "" },
        validPaymentForm(),
      ),
      startPreviewCheckoutPaymentAction(
        "ami-care",
        { ok: false, message: "" },
        validPaymentForm(),
      ),
    ])

    expect(results).toEqual([
      expect.objectContaining({ ok: false, status: "payment_pending" }),
      expect.objectContaining({ ok: false, status: "payment_pending" }),
    ])
    expect(mocks.createSiteApprovalEvidence).not.toHaveBeenCalled()
    expect(mocks.createOrderAndAcceptanceEvidence).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
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
      quotes: {
        monthly: {
          quote: {
            planPriceNetMinor: 1_900,
            grossAmountMinor: 2_299,
          },
        },
        annual: {
          quote: {
            planPriceNetMinor: 19_000,
            grossAmountMinor: 22_990,
          },
        },
      },
    })
    const context = await mocks.loadPreviewGrantContext.mock.results[0]?.value
    expect(mocks.checkAndRecordPreviewDomainOrder).toHaveBeenCalledWith(
      context.payload,
      context.run,
      "ami-care.nl",
      null,
      {
        record: false,
        includedProviderPrice: { amount: "10.00", currency: "EUR" },
      },
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
