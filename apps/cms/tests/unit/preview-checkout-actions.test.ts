import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { errLike } from "../_helpers/cast"
import {
  buildCheckoutQuote,
  openCheckoutQuote,
  sealCheckoutQuote,
} from "@/lib/checkout/checkoutQuote"
import {
  assessExistingDomainMigrationInput,
  existingDomainMigrationCheckoutEnabled,
} from "@/lib/domains/migrationCheckout"
import { DomainMigrationCustomerInputError } from "@/lib/domains/migration"
import { migrationCheckoutSecretKey } from "@/lib/domains/migrationCheckoutSecret"
import { tldCapabilityAt } from "@siteinabox/contracts/tld-capabilities"
const mocks = vi.hoisted(() => ({
  headers: new Headers({ host: "preview.siteinabox.nl" }),
  getSession: vi.fn(),
  loadPreviewGrantContext: vi.fn(),
  checkAndRecordPreviewDomainOrder: vi.fn(),
  requireReadyPreviewDomainOrder: vi.fn(),
  loginOpenProvider: vi.fn(),
  getOpenProviderDomainTransferPrice: vi.fn(),
  inspectExistingDomainPublicEvidence: vi.fn(),
  loadAcceptedCheckoutResume: vi.fn(),
  suggestAvailablePreviewDomainBatch: vi.fn(),
  saveCheckoutProfileVersion: vi.fn(),
  loadLatestCheckoutProfile: vi.fn(),
  domainRegistrantFromCheckoutProfile: vi.fn(),
  payloadUpdate: vi.fn(),
  createSiteApprovalEvidence: vi.fn(),
  createOrderAndAcceptanceEvidence: vi.fn(),
  satisfyRequirementsFromTransaction: vi.fn(),
  createMollieCheckoutForGenerationRun: vi.fn(),
  createSupplementalMigrationMollieCheckout: vi.fn(),
  requestMigrationOperatorWork: vi.fn(),
  persistMigrationCheckoutSecret: vi.fn(),
  attachMigrationCheckoutSecret: vi.fn(),
  openAttachedMigrationCheckoutSecret: vi.fn(),
  replaceExpiredAttachedMigrationCheckoutSecret: vi.fn(),
  replaceMigrationTransferAuthorization: vi.fn(),
  acquireAutomaticMigrationInputs: vi.fn(),
  acquireCloudflareSource: vi.fn(),
  acquireValidatedProviderExport: vi.fn(),
  cloudflareSourceOAuthEnabled: vi.fn(() => false),
  commerceProviderReadsAllowed: vi.fn(() => true),
  productionTldCapabilitiesAt: vi.fn(() => [{}]),
  loadCloudflareSourceAuthorization: vi.fn(),
  attachCloudflareSourceAuthorization: vi.fn(),
  loadCustomerBillingAgreement: vi.fn(),
  scheduleCancellationAtPeriodEnd: vi.fn(),
}))

vi.mock("@siteinabox/contracts/tld-capabilities", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@siteinabox/contracts/tld-capabilities")
  >()
  return {
    ...original,
    productionTldCapabilitiesAt: mocks.productionTldCapabilitiesAt,
  }
})

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

vi.mock("@/lib/domains/openprovider", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/domains/openprovider")>()
  return {
    ...original,
    loginOpenProvider: mocks.loginOpenProvider,
    getOpenProviderDomainTransferPrice: mocks.getOpenProviderDomainTransferPrice,
  }
})

vi.mock("@/lib/domains/migrationCheckout", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/domains/migrationCheckout")>()
  return {
    ...original,
    inspectExistingDomainPublicEvidence: mocks.inspectExistingDomainPublicEvidence,
  }
})

vi.mock("@/lib/domains/migrationCheckoutSecret", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/domains/migrationCheckoutSecret")
  >()
  return {
    ...original,
    persistMigrationCheckoutSecret: mocks.persistMigrationCheckoutSecret,
    attachMigrationCheckoutSecret: mocks.attachMigrationCheckoutSecret,
    openAttachedMigrationCheckoutSecret: mocks.openAttachedMigrationCheckoutSecret,
    replaceExpiredAttachedMigrationCheckoutSecret:
      mocks.replaceExpiredAttachedMigrationCheckoutSecret,
  }
})

vi.mock("@/lib/domains/migration", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/domains/migration")>()
  return {
    ...original,
    replaceMigrationTransferAuthorization:
      mocks.replaceMigrationTransferAuthorization,
    acquireAutomaticMigrationInputs:
      mocks.acquireAutomaticMigrationInputs,
  }
})

vi.mock("@/lib/commerce/releaseGate", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/commerce/releaseGate")>()
  return {
    ...original,
    commerceProviderReadsAllowed: mocks.commerceProviderReadsAllowed,
  }
})

vi.mock("@/lib/checkout/acceptedCheckoutResume", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/checkout/acceptedCheckoutResume")
  >()
  return {
    ...original,
    loadAcceptedCheckoutResume: mocks.loadAcceptedCheckoutResume,
  }
})

vi.mock("@/lib/domains/previewDomainOrder", () => ({
  checkAndRecordPreviewDomainOrder: mocks.checkAndRecordPreviewDomainOrder,
  requireReadyPreviewDomainOrder: mocks.requireReadyPreviewDomainOrder,
  suggestAvailablePreviewDomainBatch: mocks.suggestAvailablePreviewDomainBatch,
}))

vi.mock("@/lib/domains/migrationSources/providerExport", () => ({
  acquireValidatedProviderExport: mocks.acquireValidatedProviderExport,
}))

vi.mock("@/lib/domains/migrationSources/cloudflare", () => ({
  acquireCloudflareSource: mocks.acquireCloudflareSource,
}))

vi.mock("@/lib/domains/cloudflareSourceOAuth", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/domains/cloudflareSourceOAuth")
  >()
  return {
    ...original,
    cloudflareSourceOAuthEnabled: mocks.cloudflareSourceOAuthEnabled,
    loadCloudflareSourceAuthorization:
      mocks.loadCloudflareSourceAuthorization,
    attachCloudflareSourceAuthorization:
      mocks.attachCloudflareSourceAuthorization,
  }
})

vi.mock("@/lib/payments/molliePayments", () => ({
  createMollieCheckoutForGenerationRun: mocks.createMollieCheckoutForGenerationRun,
  createSupplementalMigrationMollieCheckout:
    mocks.createSupplementalMigrationMollieCheckout,
}))

vi.mock("@/lib/domains/assistedMigration", () => ({
  requestMigrationOperatorWork: mocks.requestMigrationOperatorWork,
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

vi.mock("@/lib/billing/customerBillingAgreement", () => ({
  loadCustomerBillingAgreement: mocks.loadCustomerBillingAgreement,
}))

vi.mock("@/lib/billing/billingLifecycle", () => ({
  scheduleCancellationAtPeriodEnd: mocks.scheduleCancellationAtPeriodEnd,
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

const completeExistingDomainZone = () => ({
  schemaVersion: 1,
  format: "siab-complete-zone-v1",
  domain: "ami-care.nl",
  acquiredAt: new Date().toISOString(),
  authority: {
    mechanism: "customer_authorized_provider_export",
    provider: "legacy-provider",
    complete: true,
  },
  authoritativeNameservers: ["ns1.legacy.example", "ns2.legacy.example"],
  dnssec: { status: "unsigned", parentDsRecords: [] },
  records: [
    { type: "A", name: "ami-care.nl", ttl: 300, content: "192.0.2.10" },
    {
      type: "MX",
      name: "ami-care.nl",
      ttl: 3_600,
      priority: 10,
      target: "mail.example.net",
    },
  ],
})

const validExistingDomainForm = () => {
  const formData = new FormData()
  formData.set("domain", "ami-care.nl")
  formData.set("domainMode", "existing_domain")
  formData.set("migrationSourceMethod", "validated_provider_export_v1")
  formData.set("sourceProviderName", "legacy-provider")
  formData.set("zoneExport", new File(["complete bind export"], "zone.bind", {
    type: "text/plain",
  }))
  formData.set("transferCode", "opaque-transfer-code")
  formData.set("transferAuthorization", "accepted")
  formData.set("migrationAssistance", "automatic")
  formData.set("requestToken", "existing-check-1")
  return formData
}

describe("preview checkout domain suggestion action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cloudflareSourceOAuthEnabled.mockReturnValue(false)
    mocks.commerceProviderReadsAllowed.mockReturnValue(true)
    mocks.productionTldCapabilitiesAt.mockReturnValue([{}])
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
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_AMOUNT", "10.00")
    vi.stubEnv("OPENPROVIDER_DOMAIN_MAX_COST_CURRENCY", "EUR")
    vi.stubEnv("PAYLOAD_SECRET", "checkout-test-secret")
    vi.stubEnv("DOMAIN_MIGRATION_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"))
    vi.stubEnv("COMMERCE_RELEASE_STAGE", "shadow")
    vi.stubEnv("COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED", "1")
    vi.stubEnv("COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_ENABLED", "1")
    vi.stubEnv("COMMERCE_MIGRATION_SOURCE_AXFR_ENABLED", "1")
    vi.stubEnv("COMMERCE_MIGRATION_SOURCE_PROVIDER_EXPORT_ENABLED", "1")
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
    mocks.getOpenProviderDomainTransferPrice.mockResolvedValue({
      netAmountMinor: 1_250,
      currency: "EUR",
      premium: false,
    })
    mocks.inspectExistingDomainPublicEvidence.mockResolvedValue({
      checkedAt: new Date().toISOString(),
      authoritativeNameservers: ["ns1.legacy.example", "ns2.legacy.example"],
      dnssecDsPresent: false,
      dnssecDsRecords: [],
      dnssecDsTtl: null,
      probableDnsProvider: "legacy-provider",
      registrar: "Legacy Registrar",
      supplementalOnly: true,
    })
    mocks.acquireValidatedProviderExport.mockImplementation(() => {
      const zone = {
        ...completeExistingDomainZone(),
        authority: {
          mechanism: "validated_provider_export",
          provider: "legacy-provider",
          complete: true,
        },
      }
      return {
        mechanism: "validated_provider_export_v1",
        zone,
        refreshCredential: {
          kind: "provider_export",
          sourceSoaSerial: 2026072901,
        },
      }
    })
    mocks.acquireAutomaticMigrationInputs.mockResolvedValue({ id: 100 })
    mocks.loadAcceptedCheckoutResume.mockResolvedValue(null)
    mocks.loadCustomerBillingAgreement.mockResolvedValue(null)
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
    mocks.createSupplementalMigrationMollieCheckout.mockResolvedValue({
      checkoutUrl: "https://payments.example.test/supplemental",
    })
    mocks.persistMigrationCheckoutSecret.mockResolvedValue({
      id: 99,
      state: "pending_order",
    })
    mocks.attachMigrationCheckoutSecret.mockResolvedValue({
      id: 99,
      state: "attached",
      order: 90,
    })
    mocks.openAttachedMigrationCheckoutSecret.mockResolvedValue({
      sourceZoneHash: "a".repeat(64),
    })
    mocks.replaceMigrationTransferAuthorization.mockResolvedValue({
      id: 100,
      state: "ready_to_prepare",
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

  it("does not advertise existing-domain checkout without an enabled transfer TLD", () => {
    mocks.productionTldCapabilitiesAt.mockReturnValue([])

    expect(existingDomainMigrationCheckoutEnabled()).toBe(false)
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

  it("retries the exact accepted order after provider return despite a later run timestamp", async () => {
    const formData = validPaymentForm()
    const acceptedQuote = openCheckoutQuote(
      String(formData.get("checkoutQuoteToken")),
      "checkout-test-secret",
    )
    formData.set("acceptedOrderId", "90")
    const context = await mocks.loadPreviewGrantContext()
    context.run.updatedAt = "run-mutated-after-provider-return"
    mocks.loadPreviewGrantContext.mockClear()
    mocks.loadPreviewGrantContext.mockResolvedValue(context)
    mocks.loadAcceptedCheckoutResume.mockResolvedValue({
      orderId: 90,
      domain: "ami-care.nl",
      billingPeriod: "annual",
      quotes: {
        annual: { quote: acceptedQuote, token: "renewed-annual" },
        monthly: { quote: acceptedQuote, token: "renewed-annual" },
      },
      tldCapabilityVersion: null,
    })
    mocks.requireReadyPreviewDomainOrder.mockResolvedValue({
      run: {
        ...context.run,
        domainOrder: {
          domain: "ami-care.nl",
          providerPriceAmount: "99.00",
          providerPriceCurrency: "EUR",
          checkedAt: "2026-07-29T10:00:00.000Z",
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
      formData,
    )

    expect(result).toMatchObject({
      ok: true,
      checkoutUrl: "https://payments.example.test/checkout",
    })
    expect(mocks.loadAcceptedCheckoutResume).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        generationRunId: 500,
        customerEmail: "customer@example.com",
      }),
    )
    expect(mocks.createOrderAndAcceptanceEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({
          draftVersion: "draft-500",
          providerOperationPriceNetMinor: acceptedQuote.providerOperationPriceNetMinor,
          grossAmountMinor: acceptedQuote.grossAmountMinor,
        }),
      }),
    )
    expect(mocks.requireReadyPreviewDomainOrder).not.toHaveBeenCalled()
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

  it("never logs raw provider errors or customer data", async () => {
    mocks.createMollieCheckoutForGenerationRun.mockRejectedValueOnce(
      new Error("provider detail client@example.com transfer-code-secret"),
    )
    const { startPreviewCheckoutPaymentAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const result = await startPreviewCheckoutPaymentAction(
      "ami-care",
      { ok: false, message: "" },
      validPaymentForm(),
    )

    expect(result).toMatchObject({ ok: false, status: "payment_error" })
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logged).toContain("unexpected_failure")
    expect(logged).not.toMatch(
      /client@example\.com|transfer-code-secret|provider detail/,
    )
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

  it("returns domain identity with a safe visible error", async () => {
    mocks.checkAndRecordPreviewDomainOrder.mockRejectedValueOnce(
      new Error("provider detail must not be exposed"),
    )
    const { checkPreviewCheckoutDomainAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    formData.set("domainMode", "new_registration")
    formData.set("requestToken", "domain-check-1")

    await expect(checkPreviewCheckoutDomainAction(
      "ami-care",
      { ok: false, message: "" },
      formData,
    )).resolves.toMatchObject({
      ok: false,
      status: "service_error",
      domain: "ami-care.nl",
      domainMode: "new_registration",
      requestToken: "domain-check-1",
      message: "checkoutDomainServiceUnavailable",
    })
  })

  it("offers a read-only existing-domain preflight while paid migration stays disabled", async () => {
    vi.stubEnv("COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED", "0")
    const { checkPreviewCheckoutDomainAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    formData.set("domainMode", "existing_domain")
    formData.set("requestToken", "existing-preflight-1")

    const result = await checkPreviewCheckoutDomainAction(
      "ami-care",
      { ok: false, message: "" },
      formData,
    )
    expect(result).toMatchObject({
      ok: true,
      domain: "ami-care.nl",
      domainMode: "existing_domain",
      migrationReadiness: "unsupported",
      migrationPreflightOnly: true,
      status: "preflight_complete",
      requestToken: "existing-preflight-1",
    })
    expect(result.quotes).toBeUndefined()
    expect(mocks.inspectExistingDomainPublicEvidence).toHaveBeenCalledWith(
      "ami-care.nl",
    )
    expect(mocks.getOpenProviderDomainTransferPrice).not.toHaveBeenCalled()
    expect(mocks.createOrderAndAcceptanceEvidence).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
  })

  it("performs no existing-domain source read while commerce reads are disabled", async () => {
    vi.stubEnv("COMMERCE_RELEASE_STAGE", "disabled")
    mocks.commerceProviderReadsAllowed.mockReturnValue(false)
    const { checkPreviewCheckoutDomainAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("domain", "ami-care.nl")
    formData.set("domainMode", "existing_domain")
    formData.set("requestToken", "existing-disabled-1")

    await expect(checkPreviewCheckoutDomainAction(
      "ami-care",
      { ok: false, message: "" },
      formData,
    )).resolves.toMatchObject({
      ok: false,
      status: "service_error",
      domainMode: "existing_domain",
      migrationPreflightOnly: true,
    })
    expect(mocks.inspectExistingDomainPublicEvidence).not.toHaveBeenCalled()
    expect(mocks.loadCloudflareSourceAuthorization).not.toHaveBeenCalled()
    expect(mocks.getOpenProviderDomainTransferPrice).not.toHaveBeenCalled()
  })

  it("performs no new-domain provider read or repricing while commerce reads are disabled", async () => {
    mocks.commerceProviderReadsAllowed.mockReturnValue(false)
    const {
      checkPreviewCheckoutDomainAction,
      savePreviewCheckoutProfileAction,
      startPreviewCheckoutPaymentAction,
      suggestPreviewCheckoutDomainsAction,
    } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const check = new FormData()
    check.set("domain", "ami-care.nl")
    check.set("domainMode", "new_registration")
    await expect(checkPreviewCheckoutDomainAction(
      "ami-care",
      { ok: false, message: "" },
      check,
    )).resolves.toMatchObject({
      ok: false,
      status: "service_error",
    })

    const suggestions = new FormData()
    suggestions.set("domain", "ami-care.nl")
    await expect(suggestPreviewCheckoutDomainsAction(
      "ami-care",
      { ok: false },
      suggestions,
    )).resolves.toMatchObject({
      ok: false,
      suggestions: [],
      done: true,
    })

    const profileForm = validProfileForm()
    profileForm.set("domain", "ami-care.nl")
    profileForm.set("domainMode", "new_registration")
    await expect(savePreviewCheckoutProfileAction(
      "ami-care",
      { ok: false, message: "" },
      profileForm,
    )).resolves.toMatchObject({
      ok: true,
      status: "saved",
      quotes: undefined,
    })

    await expect(startPreviewCheckoutPaymentAction(
      "ami-care",
      { ok: false, message: "" },
      validPaymentForm(),
    )).resolves.toMatchObject({
      ok: false,
      status: "version_conflict",
    })

    expect(mocks.checkAndRecordPreviewDomainOrder).not.toHaveBeenCalled()
    expect(mocks.suggestAvailablePreviewDomainBatch).not.toHaveBeenCalled()
    expect(mocks.requireReadyPreviewDomainOrder).not.toHaveBeenCalled()
    expect(mocks.getOpenProviderDomainTransferPrice).not.toHaveBeenCalled()
  })

  it("keeps existing-domain payment disabled without complete DNSSEC evidence", async () => {
    const { checkPreviewCheckoutDomainAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )

    const checked = await checkPreviewCheckoutDomainAction(
      "ami-care",
      { ok: false, message: "" },
      validExistingDomainForm(),
    )

    expect(checked).toMatchObject({
      ok: false,
      status: "invalid",
      domain: "ami-care.nl",
      domainMode: "existing_domain",
      migrationReadiness: "unsupported",
      migrationClassification: null,
    })
    expect(JSON.stringify(checked)).not.toContain("opaque-transfer-code")
    expect(mocks.checkAndRecordPreviewDomainOrder).not.toHaveBeenCalled()
    expect(mocks.getOpenProviderDomainTransferPrice).not.toHaveBeenCalled()
    expect(mocks.createOrderAndAcceptanceEvidence).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
  })

  it("recollects only the exact expired evidence for the authenticated accepted order", async () => {
    const acceptedAt = new Date(Date.now() - 31 * 24 * 60 * 60_000)
    const acceptedZone = {
      ...completeExistingDomainZone(),
      acquiredAt: acceptedAt.toISOString(),
    }
    const assessment = assessExistingDomainMigrationInput({
      generationRunId: 500,
      domain: "ami-care.nl",
      zoneExport: acceptedZone as Parameters<
        typeof assessExistingDomainMigrationInput
      >[0]["zoneExport"],
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      requestedAssistance: true,
      acceptedOrderRecollection: true,
      publicEvidence: await mocks.inspectExistingDomainPublicEvidence(),
      now: acceptedAt,
    }, {
      capabilityForTld: (tld, _operation, now) => {
        const capability = tldCapabilityAt(tld, now)
        return capability
          ? {
              ...capability,
              dnssec: {
                ...capability.dnssec,
                productionEvidenceComplete: true,
              },
            }
          : null
      },
    })
    if (!assessment.sourceZoneHash || !assessment.encryptedInput) {
      throw new Error("Expected accepted-order recollection assessment.")
    }
    const quote = buildCheckoutQuote({
      catalogVersion: "2026-07-26.1",
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_250,
      selectedDomain: "ami-care.nl",
      domainMode: "existing_domain",
      migrationClassification: "assisted_standard",
      migrationSourceZoneHash: assessment.sourceZoneHash,
      migrationInputEnvelope: null,
      migrationSecretKey: migrationCheckoutSecretKey(
        500,
        "ami-care.nl",
        assessment.sourceZoneHash,
      ),
      providerQuotedAt: new Date().toISOString(),
      profileVersion: 1,
      draftVersion: "draft-500",
    })
    mocks.loadAcceptedCheckoutResume.mockResolvedValue({
      orderId: 90,
      domain: "ami-care.nl",
      billingPeriod: "annual",
      quotes: {
        monthly: sealCheckoutQuote(quote, "checkout-test-secret"),
        annual: sealCheckoutQuote(quote, "checkout-test-secret"),
      },
      requiresMigrationRecollection: true,
      tldCapabilityVersion: "tld-nl-2026-07-28.1",
    })
    const { recollectAcceptedMigrationInputAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const recollectedZone = {
      ...acceptedZone,
      acquiredAt: new Date().toISOString(),
    }
    const formData = new FormData()
    formData.set("zoneExport", JSON.stringify(recollectedZone))
    formData.set("transferCode", "opaque-transfer-code")
    formData.set("transferAuthorization", "accepted")
    formData.set("acceptedOrderId", "90")

    await expect(recollectAcceptedMigrationInputAction("ami-care", formData))
      .rejects.toThrow()
    expect(mocks.replaceExpiredAttachedMigrationCheckoutSecret)
      .toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          secretKey: quote.migrationSecretKey,
          orderId: 90,
          generationRunId: 500,
          domain: "ami-care.nl",
          sourceZoneHash: assessment.sourceZoneHash,
          encryptedInput: expect.any(String),
        }),
      )

    mocks.replaceExpiredAttachedMigrationCheckoutSecret.mockClear()
    const changedForm = new FormData()
    changedForm.set("acceptedOrderId", "90")
    changedForm.set("zoneExport", JSON.stringify({
      ...recollectedZone,
      records: recollectedZone.records.map((record, index) =>
        index === 0 ? { ...record, content: "192.0.2.99" } : record),
    }))
    changedForm.set("transferCode", "opaque-transfer-code")
    changedForm.set("transferAuthorization", "accepted")
    await expect(
      recollectAcceptedMigrationInputAction("ami-care", changedForm),
    ).resolves.toEqual({
      ok: false,
      status: "invalid_input",
      message: "checkoutMigrationActionInvalidInput",
    })
    expect(mocks.replaceExpiredAttachedMigrationCheckoutSecret)
      .not.toHaveBeenCalled()
  })

  it("recollects an accepted Cloudflare order through its bound OAuth handle", async () => {
    mocks.cloudflareSourceOAuthEnabled.mockReturnValue(true)
    const context = await mocks.loadPreviewGrantContext()
    const authorizationKey = "oauth-handle-" + "a".repeat(40)
    const cloudflareZone = {
      ...completeExistingDomainZone(),
      schemaVersion: 1 as const,
      format: "siab-complete-zone-v1" as const,
      authority: {
        mechanism: "cloudflare_api" as const,
        provider: "cloudflare",
        complete: true as const,
      },
    } as Parameters<typeof assessExistingDomainMigrationInput>[0]["zoneExport"]
    const acquiredSource = {
      mechanism: "cloudflare_api_v1" as const,
      zone: cloudflareZone,
      refreshCredential: {
        kind: "cloudflare_oauth" as const,
        authorizationKey,
        zoneId: "a".repeat(32),
      },
    }
    const assessment = assessExistingDomainMigrationInput({
      generationRunId: 500,
      domain: "ami-care.nl",
      zoneExport: acquiredSource.zone,
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      requestedAssistance: false,
      acceptedOrderRecollection: true,
      acceptedCapabilityVersion: "tld-nl-2026-07-28.1",
      publicEvidence: await mocks.inspectExistingDomainPublicEvidence(),
      acquiredSource,
    })
    if (!assessment.sourceZoneHash || !assessment.encryptedInput) {
      throw new Error("Expected automatic Cloudflare recollection assessment.")
    }
    const quote = buildCheckoutQuote({
      catalogVersion: "2026-07-26.1",
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_250,
      selectedDomain: "ami-care.nl",
      domainMode: "existing_domain",
      migrationClassification: "automatic",
      migrationSourceMechanism: "cloudflare_api_v1",
      migrationSourceZoneHash: assessment.sourceZoneHash,
      migrationInputEnvelope: null,
      migrationSecretKey: migrationCheckoutSecretKey(
        500,
        "ami-care.nl",
        assessment.sourceZoneHash,
      ),
      providerQuotedAt: new Date().toISOString(),
      profileVersion: 1,
      draftVersion: "draft-500",
    })
    mocks.loadAcceptedCheckoutResume.mockResolvedValue({
      orderId: 90,
      domain: "ami-care.nl",
      billingPeriod: "annual",
      quotes: {
        monthly: sealCheckoutQuote(quote, "checkout-test-secret"),
        annual: sealCheckoutQuote(quote, "checkout-test-secret"),
      },
      requiresMigrationRecollection: true,
      tldCapabilityVersion: "tld-nl-2026-07-28.1",
    })
    const authorizationRecord = {
      id: 200,
      authorizationKey,
      stateDigest: "a".repeat(64),
      browserBindingDigest: "b".repeat(64),
      generationRun: 500,
      tenant: 12,
      clientSlug: "ami-care",
      customerEmailDigest: "c".repeat(64),
      domainNameAscii: "ami-care.nl",
      encryptedAuthority: "sealed",
      state: "authorized" as const,
      expiresAt: "2026-07-31T10:00:00.000Z",
      updatedAt: "2026-07-30T10:00:00.000Z",
    }
    mocks.loadCloudflareSourceAuthorization.mockResolvedValue({
      record: authorizationRecord,
      source: acquiredSource,
    })
    const { recollectAcceptedMigrationInputAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("acceptedOrderId", "90")
    formData.set("migrationSourceMethod", "cloudflare_api_v1")
    formData.set("cloudflareSourceAuthorization", authorizationKey)
    formData.set("transferCode", "opaque-transfer-code")
    formData.set("transferAuthorization", "accepted")

    await expect(
      recollectAcceptedMigrationInputAction("ami-care", formData),
    ).rejects.toThrow()
    expect(mocks.loadCloudflareSourceAuthorization).toHaveBeenCalledWith(
      context.payload,
      {
        authorizationKey,
        generationRunId: 500,
        tenantId: 12,
        clientSlug: "ami-care",
        customerEmail: "customer@example.com",
        domain: "ami-care.nl",
      },
    )
    expect(mocks.attachCloudflareSourceAuthorization).toHaveBeenCalledWith(
      context.payload,
      authorizationRecord,
    )
    expect(mocks.replaceExpiredAttachedMigrationCheckoutSecret)
      .toHaveBeenCalledWith(
        context.payload,
        expect.objectContaining({
          orderId: 90,
          generationRunId: 500,
          domain: "ami-care.nl",
          sourceZoneHash: assessment.sourceZoneHash,
          encryptedInput: expect.any(String),
        }),
      )
    expect(
      mocks.attachCloudflareSourceAuthorization.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.replaceExpiredAttachedMigrationCheckoutSecret
        .mock.invocationCallOrder[0]!,
    )
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
    expect(mocks.checkAndRecordPreviewDomainOrder).not.toHaveBeenCalled()
  })

  it("stops existing-domain payment before any evidence write when transfer pricing changes", async () => {
    const { startPreviewCheckoutPaymentAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const assessed = assessExistingDomainMigrationInput({
      generationRunId: 500,
      domain: "ami-care.nl",
      zoneExport: completeExistingDomainZone() as Parameters<
        typeof assessExistingDomainMigrationInput
      >[0]["zoneExport"],
      transferCode: "opaque-transfer-code",
      transferAuthorizationAccepted: true,
      requestedAssistance: true,
      acceptedOrderRecollection: true,
      publicEvidence: await mocks.inspectExistingDomainPublicEvidence(),
      now: new Date(),
    }, {
      capabilityForTld: (tld, _operation, now) => {
        const capability = tldCapabilityAt(tld, now)
        return capability
          ? {
              ...capability,
              dnssec: {
                ...capability.dnssec,
                productionEvidenceComplete: true,
              },
            }
          : null
      },
    })
    if (!assessed.encryptedInput || !assessed.sourceZoneHash) {
      throw new Error("Expected a test-only verified migration assessment.")
    }
    const acceptedQuote = buildCheckoutQuote({
      catalogVersion: "2026-07-26.1",
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_250,
      selectedDomain: "ami-care.nl",
      domainMode: "existing_domain",
      migrationClassification: "assisted_standard",
      migrationSourceZoneHash: assessed.sourceZoneHash,
      migrationInputEnvelope: assessed.encryptedInput,
      migrationSecretKey: migrationCheckoutSecretKey(
        500,
        "ami-care.nl",
        assessed.sourceZoneHash,
      ),
      providerQuotedAt: new Date().toISOString(),
      profileVersion: 1,
      draftVersion: "draft-500",
    })
    mocks.getOpenProviderDomainTransferPrice.mockResolvedValue({
      netAmountMinor: 1_500,
      currency: "EUR",
      premium: false,
    })
    const paymentForm = validPaymentForm()
    paymentForm.set(
      "checkoutQuoteToken",
      sealCheckoutQuote(acceptedQuote, "checkout-test-secret").token,
    )

    const result = await startPreviewCheckoutPaymentAction(
      "ami-care",
      { ok: false, message: "" },
      paymentForm,
    )

    expect(result).toMatchObject({
      ok: false,
      status: "version_conflict",
    })
    expect(result.quotes).toBeUndefined()
    expect(mocks.createSiteApprovalEvidence).not.toHaveBeenCalled()
    expect(mocks.createOrderAndAcceptanceEvidence).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
  })

  it("keeps a signed migration behind the TLD gate before transfer pricing or payment", async () => {
    const { checkPreviewCheckoutDomainAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = validExistingDomainForm()
    mocks.acquireValidatedProviderExport.mockImplementationOnce(() => ({
      mechanism: "validated_provider_export_v1",
      zone: {
        ...completeExistingDomainZone(),
        authority: {
          mechanism: "validated_provider_export",
          provider: "legacy-provider",
          complete: true,
        },
        dnssec: {
          status: "signed",
          parentDsRecords: ["12345 13 2 AABBCCDD"],
        },
      },
      refreshCredential: {
        kind: "provider_export",
        sourceSoaSerial: 2026072901,
      },
    }))
    mocks.inspectExistingDomainPublicEvidence.mockResolvedValue({
      checkedAt: new Date().toISOString(),
      authoritativeNameservers: ["ns1.legacy.example", "ns2.legacy.example"],
      dnssecDsPresent: true,
      dnssecDsRecords: ["12345 13 2 " + "AB".repeat(32)],
      dnssecDsTtl: 3600,
      probableDnsProvider: "legacy-provider",
      registrar: "Legacy Registrar",
      supplementalOnly: true,
    })

    const result = await checkPreviewCheckoutDomainAction(
      "ami-care",
      { ok: false, message: "" },
      formData,
    )

    expect(result).toMatchObject({
      ok: false,
      domainMode: "existing_domain",
      migrationReadiness: "unsupported",
    })
    expect(result.quotes).toBeUndefined()
    expect(mocks.getOpenProviderDomainTransferPrice).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
  })

  it("keeps an independently disabled source adapter out of payable checkout", async () => {
    vi.stubEnv("COMMERCE_MIGRATION_SOURCE_PROVIDER_EXPORT_ENABLED", "0")
    const { checkPreviewCheckoutDomainAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )

    await expect(checkPreviewCheckoutDomainAction(
      "ami-care",
      { ok: false, message: "" },
      validExistingDomainForm(),
    )).resolves.toMatchObject({
      ok: false,
      status: "invalid",
      migrationReadiness: "unsupported",
    })
    expect(mocks.acquireValidatedProviderExport).not.toHaveBeenCalled()
    expect(mocks.getOpenProviderDomainTransferPrice).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
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

  it("binds transfer-code correction to the authenticated run, tenant, and customer", async () => {
    const context = await mocks.loadPreviewGrantContext()
    context.payload.findByID = vi.fn()
      .mockResolvedValueOnce({
        id: 100,
        originatingOrder: 90,
        updatedAt: "migration-version-1",
      })
      .mockResolvedValueOnce({
        id: 90,
        generationRun: 500,
        tenant: 12,
        customerEmail: "customer@example.com",
      })
    mocks.loadPreviewGrantContext.mockResolvedValue(context)
    const { submitMigrationTransferCodeAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("migrationId", "100")
    formData.set("expectedMigrationVersion", "migration-version-1")
    formData.set("transferCode", "replacement-secret")

    await submitMigrationTransferCodeAction("ami-care", formData)

    expect(mocks.replaceMigrationTransferAuthorization).toHaveBeenCalledWith(
      context.payload,
      {
        migrationId: 100,
        expectedUpdatedAt: "migration-version-1",
        transferCode: "replacement-secret",
      },
    )
  })

  it("rejects pasted Cloudflare tokens during paid-source reauthorization", async () => {
    const context = await mocks.loadPreviewGrantContext()
    context.payload.findByID = vi.fn()
      .mockResolvedValueOnce({
        id: 100,
        originatingOrder: 90,
        domainNameAscii: "ami-care.nl",
        sourceMechanism: "cloudflare_api_v1",
        state: "awaiting_customer",
        failureReason: "source_evidence_stale",
        updatedAt: "migration-version-1",
      })
      .mockResolvedValueOnce({
        id: 90,
        generationRun: 500,
        tenant: 12,
        customerEmail: "customer@example.com",
      })
    mocks.loadPreviewGrantContext.mockResolvedValue(context)
    const reacquiredZone = {
      ...completeExistingDomainZone(),
      authority: {
        mechanism: "cloudflare_api" as const,
        provider: "cloudflare",
        complete: true as const,
      },
    }
    mocks.acquireCloudflareSource.mockResolvedValueOnce({
      mechanism: "cloudflare_api_v1",
      zone: reacquiredZone,
      refreshCredential: {
        kind: "cloudflare_api_token",
        token: "customer-read-token",
        zoneId: "a".repeat(32),
      },
    })
    const { submitMigrationTransferCodeAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("migrationId", "100")
    formData.set("expectedMigrationVersion", "migration-version-1")
    formData.set("cloudflareSourceToken", "customer-read-token")
    formData.set("transferCode", "replacement-secret")

    await expect(
      submitMigrationTransferCodeAction("ami-care", formData),
    ).resolves.toMatchObject({ ok: false, status: "invalid_input" })
    expect(mocks.acquireCloudflareSource).not.toHaveBeenCalled()
    expect(mocks.acquireAutomaticMigrationInputs).not.toHaveBeenCalled()
    expect(mocks.replaceMigrationTransferAuthorization).not.toHaveBeenCalled()
  })

  it("reauthorizes a paid Cloudflare migration through a bound opaque OAuth handle", async () => {
    mocks.cloudflareSourceOAuthEnabled.mockReturnValue(true)
    const context = await mocks.loadPreviewGrantContext()
    context.payload.findByID = vi.fn()
      .mockResolvedValueOnce({
        id: 100,
        originatingOrder: 90,
        domainNameAscii: "ami-care.nl",
        sourceMechanism: "cloudflare_api_v1",
        state: "awaiting_customer",
        failureReason: "source_evidence_stale",
        updatedAt: "migration-version-1",
      })
      .mockResolvedValueOnce({
        id: 90,
        generationRun: 500,
        tenant: 12,
        customerEmail: "customer@example.com",
      })
    mocks.loadPreviewGrantContext.mockResolvedValue(context)
    const reacquiredZone = {
      ...completeExistingDomainZone(),
      authority: {
        mechanism: "cloudflare_api" as const,
        provider: "cloudflare",
        complete: true as const,
      },
    }
    const authorizationRecord = {
      id: 200,
      authorizationKey: "opaque-source-handle",
      stateDigest: "a".repeat(64),
      browserBindingDigest: "b".repeat(64),
      generationRun: 500,
      tenant: 12,
      clientSlug: "ami-care",
      customerEmail: "customer@example.com",
      domainNameAscii: "ami-care.nl",
      encryptedAuthority: "sealed",
      state: "authorized" as const,
      expiresAt: "2026-07-31T10:00:00.000Z",
      updatedAt: "2026-07-30T10:00:00.000Z",
    }
    const source = {
      mechanism: "cloudflare_api_v1" as const,
      zone: reacquiredZone,
      refreshCredential: {
        kind: "cloudflare_oauth" as const,
        authorizationKey: "opaque-source-handle",
        zoneId: "a".repeat(32),
      },
    }
    mocks.loadCloudflareSourceAuthorization.mockResolvedValue({
      record: authorizationRecord,
      source,
    })
    const { submitMigrationTransferCodeAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("migrationId", "100")
    formData.set("expectedMigrationVersion", "migration-version-1")
    formData.set("cloudflareSourceAuthorization", "opaque-source-handle")
    formData.set("transferCode", "replacement-secret")

    await expect(
      submitMigrationTransferCodeAction("ami-care", formData),
    ).resolves.toMatchObject({ ok: true, status: "saved" })
    expect(mocks.loadCloudflareSourceAuthorization).toHaveBeenCalledWith(
      context.payload,
      {
        authorizationKey: "opaque-source-handle",
        generationRunId: 500,
        tenantId: 12,
        clientSlug: "ami-care",
        customerEmail: "customer@example.com",
        domain: "ami-care.nl",
      },
    )
    expect(mocks.acquireCloudflareSource).not.toHaveBeenCalled()
    expect(mocks.acquireAutomaticMigrationInputs).toHaveBeenCalledWith(
      context.payload,
      expect.objectContaining({
        migrationId: 100,
        zoneExport: reacquiredZone,
        transferCode: "replacement-secret",
        sourceRefreshAuthority: expect.objectContaining({
          credential: source.refreshCredential,
        }),
        expectedUpdatedAt: "migration-version-1",
      }),
    )
    expect(mocks.attachCloudflareSourceAuthorization).toHaveBeenCalledWith(
      context.payload,
      authorizationRecord,
    )
    expect(
      mocks.attachCloudflareSourceAuthorization.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.acquireAutomaticMigrationInputs.mock.invocationCallOrder[0]!,
    )
  })

  it("does not reauthorize a paid migration through a disabled source adapter", async () => {
    vi.stubEnv("COMMERCE_MIGRATION_SOURCE_PROVIDER_EXPORT_ENABLED", "0")
    const context = await mocks.loadPreviewGrantContext()
    context.payload.jobs = { queue: vi.fn() }
    context.payload.findByID = vi.fn()
      .mockResolvedValueOnce({
        id: 100,
        originatingOrder: 90,
        domainNameAscii: "ami-care.nl",
        sourceMechanism: "validated_provider_export_v1",
        state: "awaiting_customer",
        failureReason: "source_evidence_stale",
        updatedAt: "migration-version-1",
      })
      .mockResolvedValueOnce({
        id: 90,
        generationRun: 500,
        tenant: 12,
        customerEmail: "customer@example.com",
      })
    mocks.loadPreviewGrantContext.mockResolvedValue(context)
    const { submitMigrationTransferCodeAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("migrationId", "100")
    formData.set("expectedMigrationVersion", "migration-version-1")
    formData.set("sourceProviderName", "legacy-provider")
    formData.set("zoneExport", new File(["zone"], "zone.bind"))
    formData.set("transferCode", "replacement-secret")

    await expect(
      submitMigrationTransferCodeAction("ami-care", formData),
    ).resolves.toMatchObject({
      ok: false,
      status: "retryable_service_error",
    })
    expect(mocks.acquireValidatedProviderExport).not.toHaveBeenCalled()
    expect(mocks.acquireAutomaticMigrationInputs).not.toHaveBeenCalled()
    expect(context.payload.update).not.toHaveBeenCalled()
    expect(context.payload.jobs.queue).not.toHaveBeenCalled()
  })

  it("rejects cross-tenant transfer-code correction without exposing the code", async () => {
    const context = await mocks.loadPreviewGrantContext()
    context.payload.findByID = vi.fn()
      .mockResolvedValueOnce({
        id: 100,
        originatingOrder: 90,
        updatedAt: "migration-version-1",
      })
      .mockResolvedValueOnce({
        id: 90,
        generationRun: 500,
        tenant: 99,
        customerEmail: "customer@example.com",
      })
    mocks.loadPreviewGrantContext.mockResolvedValue(context)
    const { submitMigrationTransferCodeAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("migrationId", "100")
    formData.set("expectedMigrationVersion", "migration-version-1")
    formData.set("transferCode", "must-not-log")

    await expect(
      submitMigrationTransferCodeAction("ami-care", formData),
    ).resolves.toEqual({
      ok: false,
      status: "refresh_required",
      message: "checkoutMigrationActionRefreshRequired",
    })
    expect(mocks.replaceMigrationTransferAuthorization).not.toHaveBeenCalled()
    expect(JSON.stringify(vi.mocked(console.error).mock.calls))
      .not.toContain("must-not-log")
  })

  it("classifies an incomplete transfer-code correction as invalid input", async () => {
    const { submitMigrationTransferCodeAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("migrationId", "100")
    formData.set("expectedMigrationVersion", "migration-version-1")

    await expect(
      submitMigrationTransferCodeAction("ami-care", formData),
    ).resolves.toEqual({
      ok: false,
      status: "invalid_input",
      message: "checkoutMigrationActionInvalidInput",
    })
    expect(mocks.replaceMigrationTransferAuthorization).not.toHaveBeenCalled()
  })

  it("classifies a rejected non-empty transfer code as invalid input", async () => {
    const context = await mocks.loadPreviewGrantContext()
    context.payload.findByID = vi.fn()
      .mockResolvedValueOnce({
        id: 100,
        originatingOrder: 90,
        updatedAt: "migration-version-1",
        state: "awaiting_customer",
        failureReason: "provider_rejected_transfer_authorization",
      })
      .mockResolvedValueOnce({
        id: 90,
        generationRun: 500,
        tenant: 12,
        customerEmail: "customer@example.com",
      })
    mocks.loadPreviewGrantContext.mockResolvedValue(context)
    mocks.replaceMigrationTransferAuthorization.mockRejectedValueOnce(
      new DomainMigrationCustomerInputError("invalid_input"),
    )
    const { submitMigrationTransferCodeAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )
    const formData = new FormData()
    formData.set("migrationId", "100")
    formData.set("expectedMigrationVersion", "migration-version-1")
    formData.set("transferCode", "invalid-but-non-empty")

    await expect(
      submitMigrationTransferCodeAction("ami-care", formData),
    ).resolves.toEqual({
      ok: false,
      status: "invalid_input",
      message: "checkoutMigrationActionInvalidInput",
    })
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

  it("derives period-end cancellation only from authenticated checkout authority", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "preview-user-7", email: "Customer@Example.com" },
    })
    const agreement = {
      id: 88,
      state: "active",
      billingPeriod: "annual",
      currentPeriodEndsAt: "2027-07-30T10:00:00.000Z",
      cancelAt: null,
      updatedAt: "2026-07-30T10:00:00.000Z",
    }
    mocks.loadCustomerBillingAgreement.mockResolvedValue(agreement)
    mocks.scheduleCancellationAtPeriodEnd.mockResolvedValue({
      ...agreement,
      state: "cancellation_scheduled",
      cancelAt: "2027-07-30T10:00:00.000Z",
    })
    const { schedulePreviewCheckoutCancellationAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )

    await expect(schedulePreviewCheckoutCancellationAction(
      "ami-care",
      { ok: false, status: "idle", message: "" },
      new FormData(),
    )).resolves.toMatchObject({
      ok: true,
      status: "scheduled",
      agreement: {
        id: 88,
        state: "cancellation_scheduled",
      },
    })

    expect(mocks.loadCustomerBillingAgreement).toHaveBeenCalledWith(
      expect.anything(),
      {
        generationRunId: 500,
        tenantId: 12,
        customerEmail: "customer@example.com",
      },
    )
    expect(mocks.scheduleCancellationAtPeriodEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementId: 88,
        tenantId: 12,
        actorUserId: "preview-user-7",
        actorEmail: "customer@example.com",
      }),
    )
  })

  it("fails closed when preview cancellation has no authenticated actor", async () => {
    mocks.getSession.mockResolvedValue(null)
    const { schedulePreviewCheckoutCancellationAction } = await import(
      "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions"
    )

    await expect(schedulePreviewCheckoutCancellationAction(
      "ami-care",
      { ok: false, status: "idle", message: "" },
      new FormData(),
    )).resolves.toMatchObject({
      ok: false,
      status: "failed",
    })
    expect(mocks.loadCustomerBillingAgreement).not.toHaveBeenCalled()
    expect(mocks.scheduleCancellationAtPeriodEnd).not.toHaveBeenCalled()
  })
})
