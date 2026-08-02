import { describe, expect, it, vi } from "vitest"
import type { ComponentProps } from "react"
import type { PreviewCheckout } from "@/components/preview/PreviewCheckout"
import { buildCheckoutQuote, sealCheckoutQuote } from "@/lib/checkout/checkoutQuote"

const mocks = vi.hoisted(() => ({
  headers: new Headers({ host: "preview.siteinabox.nl" }),
  getSession: vi.fn(),
  isPreviewHost: vi.fn(),
  loadPreviewGrantContext: vi.fn(),
  loadLatestCheckoutProfile: vi.fn(),
  loadCustomerMigrationStatus: vi.fn(),
  loadCustomerProvisioningStatus: vi.fn(),
  loadCustomerBillingAgreement: vi.fn(),
  loadAcceptedCheckoutResume: vi.fn(),
  checkDomainAction: vi.fn(),
  saveProfileAction: vi.fn(),
  startPaymentAction: vi.fn(),
  loadLiveStatusAction: vi.fn(),
  scheduleCancellationAction: vi.fn(),
  acceptMigrationSupplementalOrderAction: vi.fn(),
  recollectAcceptedMigrationInputAction: vi.fn(),
  submitMigrationTransferCodeAction: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "nl-NL"),
  getTranslations: vi.fn(async () => (key: string) => key),
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found")
  }),
}))

vi.mock("@/components/preview/PreviewCheckout", () => ({
  PreviewCheckout: vi.fn(() => null),
}))

vi.mock("@/components/preview/PreviewLoginShell", () => ({
  PreviewLoginShell: vi.fn(() => null),
}))

vi.mock("@/lib/preview/betterAuth", () => ({
  previewAuth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

vi.mock("@/lib/preview/previewHost", () => ({
  isPreviewHost: mocks.isPreviewHost,
}))

vi.mock("@/lib/preview/previewAccess", () => ({
  loadPreviewGrantContext: mocks.loadPreviewGrantContext,
  normalizePreviewClientSlug: (value: string) => value.trim().toLowerCase(),
}))

vi.mock("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/actions", () => ({
  acceptMigrationSupplementalOrderAction: mocks.acceptMigrationSupplementalOrderAction,
  recollectAcceptedMigrationInputAction: mocks.recollectAcceptedMigrationInputAction,
  submitMigrationTransferCodeAction: mocks.submitMigrationTransferCodeAction,
  checkPreviewCheckoutDomainAction: mocks.checkDomainAction,
  savePreviewCheckoutProfileAction: mocks.saveProfileAction,
  startPreviewCheckoutPaymentAction: mocks.startPaymentAction,
  loadPreviewCheckoutLiveStatusAction: mocks.loadLiveStatusAction,
  schedulePreviewCheckoutCancellationAction: mocks.scheduleCancellationAction,
}))

vi.mock("@/lib/checkout/checkoutProfile", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/checkout/checkoutProfile")>()
  return {
    ...original,
    loadLatestCheckoutProfile: mocks.loadLatestCheckoutProfile,
  }
})

vi.mock("@/lib/domains/migrationStatus", () => ({
  loadCustomerMigrationStatus: mocks.loadCustomerMigrationStatus,
}))

vi.mock("@/lib/domains/provisioningStatus", () => ({
  loadCustomerProvisioningStatus: mocks.loadCustomerProvisioningStatus,
}))

vi.mock("@/lib/checkout/acceptedCheckoutResume", () => ({
  loadAcceptedCheckoutResume: mocks.loadAcceptedCheckoutResume,
}))

vi.mock("@/lib/billing/customerBillingAgreement", () => ({
  loadCustomerBillingAgreement: mocks.loadCustomerBillingAgreement,
}))

type PreviewCheckoutProps = ComponentProps<typeof PreviewCheckout>

const baseContext = (overrides: Record<string, unknown> = {}) => ({
  customerEmail: "customer@example.com",
  clientSlug: "ami-care",
  payload: {},
  tenant: {
    id: 12,
    name: "Ami Care",
    domain: "ami-care.siteinabox.test",
  },
  run: {
    id: 123,
    payment: null,
    clientApproval: null,
    domainOrder: null,
    ...overrides,
  },
})

async function renderCheckoutProps(
  overrides: Record<string, unknown> = {},
  profile: Record<string, unknown> | null = null,
  paymentReturn = false,
  acceptedResume: Record<string, unknown> | null = null,
): Promise<PreviewCheckoutProps> {
  vi.clearAllMocks()
  vi.stubEnv("PAYLOAD_SECRET", "checkout-page-test-secret")
  mocks.isPreviewHost.mockResolvedValue(true)
  mocks.getSession.mockResolvedValue({ user: { email: "Customer@Example.com" } })
  mocks.loadPreviewGrantContext.mockResolvedValue(baseContext(overrides))
  mocks.loadLatestCheckoutProfile.mockResolvedValue(profile)
  mocks.loadCustomerMigrationStatus.mockResolvedValue(null)
  mocks.loadCustomerProvisioningStatus.mockResolvedValue(null)
  mocks.loadCustomerBillingAgreement.mockResolvedValue(null)
  mocks.loadAcceptedCheckoutResume.mockResolvedValue(acceptedResume)

  const { default: PreviewCheckoutPage } = await import("@/app/(frontend)/(site-preview)/[clientSlug]/checkout/page")
  const element = await PreviewCheckoutPage({
    params: Promise.resolve({ clientSlug: "AMI-CARE" }),
    searchParams: Promise.resolve(paymentReturn ? { payment: "return" } : {}),
  })

  expect(element).toBeTruthy()
  return (element as { props: PreviewCheckoutProps }).props
}

describe("preview checkout page domain initialization", () => {
  it("does not initialize checkout from the tenant domain when no domain order is ready", async () => {
    const props = await renderCheckoutProps()

    expect(props.currentDomain).toBeNull()
    expect(props.domainReady).toBe(false)
  })

  it("initializes checkout only from a ready domain order domain", async () => {
    const props = await renderCheckoutProps({
      domainOrder: {
        status: "ready_to_register",
        domain: "customer-selected.nl",
      },
    })

    expect(props.currentDomain).toBe("customer-selected.nl")
    expect(props.domainReady).toBe(true)
  })

  it("loads the latest checkout profile as the authoritative details version", async () => {
    const profile = {
      id: 44,
      profileKey: "run:123:checkout-profile:2",
      profileVersion: 2,
      generationRun: 123,
      customerName: "Ada Lovelace",
      customerEmail: "customer@example.com",
      partyType: "registered_business",
      contractingPartyName: "Analytical Engines B.V.",
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
      revisionReason: "customer_correction",
      createdAt: "2026-07-26T12:00:00.000Z",
    }

    const props = await renderCheckoutProps({}, profile)

    expect(props.initialProfile).toMatchObject({
      profileVersion: 2,
      profileKey: "run:123:checkout-profile:2",
      partyType: "registered_business",
      registeredBusinessName: "Analytical Engines B.V.",
    })
    expect(props.catalog.plans).toMatchObject({
      monthly: { netAmountMinor: 1_900 },
      annual: { netAmountMinor: 19_000 },
    })
  })

  it("returns from Mollie to the same persisted overview without trusting payment state", async () => {
    const profile = {
      id: 44,
      profileKey: "run:123:checkout-profile:2",
      profileVersion: 2,
      generationRun: 123,
      customerName: "Ada Lovelace",
      customerEmail: "customer@example.com",
      partyType: "registered_business",
      contractingPartyName: "Analytical Engines B.V.",
      kvkNumber: "12345678",
      domainRegistrantSource: "contracting_party",
      billingAddress: {
        street: "Markt",
        number: "1",
        zipcode: "1234AB",
        city: "Utrecht",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "30",
        phoneSubscriberNumber: "1234567",
      },
      createdAt: "2026-07-28T10:00:00.000Z",
    }
    const props = await renderCheckoutProps({
      updatedAt: "2026-07-28T10:00:00.000Z",
      payment: { status: "pending_provider" },
      domainOrder: {
        status: "ready_to_register",
        domain: "customer-selected.nl",
        providerPriceAmount: "10.00",
        providerPriceCurrency: "EUR",
        checkedAt: "2026-07-28T10:00:00.000Z",
      },
    }, profile, true)

    expect(props.initialStep).toBe("overview")
    expect(props.initialProfile).toMatchObject({ profileVersion: 2 })
    expect(props.initialQuotes?.annual.quote).toMatchObject({
      selectedDomain: "customer-selected.nl",
      profileVersion: 2,
      grossAmountMinor: 22_990,
    })
    expect(props.paymentStatus).toBe("pending_provider")
  })

  it("returns a cancelled existing-domain payment to its immutable accepted order", async () => {
    const profile = {
      id: 44,
      profileKey: "run:123:checkout-profile:2",
      profileVersion: 2,
      generationRun: 123,
      customerName: "Ada Lovelace",
      customerEmail: "customer@example.com",
      partyType: "registered_business",
      contractingPartyName: "Analytical Engines B.V.",
      kvkNumber: "12345678",
      domainRegistrantSource: "contracting_party",
      billingAddress: {
        street: "Markt",
        number: "1",
        zipcode: "1234AB",
        city: "Utrecht",
        country: "NL",
        phoneCountryCode: "+31",
        phoneAreaCode: "30",
        phoneSubscriberNumber: "1234567",
      },
      createdAt: "2026-07-28T10:00:00.000Z",
    }
    const accepted = buildCheckoutQuote({
      billingPeriod: "annual",
      providerOperationPriceNetMinor: 1_250,
      migrationClassification: "automatic",
      migrationSourceMechanism: "validated_provider_export_v1",
      migrationSourceZoneHash: "a".repeat(64),
      migrationPublicEvidenceHash: "c".repeat(64),
      migrationInputEnvelope: "v1.encrypted",
      selectedDomain: "existing.nl",
      domainMode: "existing_domain",
      providerQuotedAt: new Date().toISOString(),
      profileVersion: 2,
      draftVersion: "accepted-draft",
    })
    const envelope = sealCheckoutQuote(accepted, "checkout-page-test-secret")
    const acceptedResume = {
      orderId: 90,
      domain: "existing.nl",
      billingPeriod: "annual",
      quotes: { monthly: envelope, annual: envelope },
    }

    const props = await renderCheckoutProps({
      updatedAt: "run-mutated-after-provider-return",
      payment: { status: "canceled" },
      domainOrder: null,
    }, profile, true, acceptedResume)

    expect(props).toMatchObject({
      currentDomain: "existing.nl",
      domainReady: true,
      initialStep: "overview",
      acceptedOrderId: 90,
      paymentReturn: true,
    })
    expect(props.initialQuotes?.annual.quote).toMatchObject({
      domainMode: "existing_domain",
      migrationClassification: "automatic",
      draftVersion: "accepted-draft",
    })
  })
})
