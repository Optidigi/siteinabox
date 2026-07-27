import { asMockDoc, asNextRequest, cast } from "../_helpers/cast"
import { asPayload, matchesWhere, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockFindByIdArgs, type MockUpdateArgs, type MockWhere } from "../_helpers/mockPayload"
import crypto from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("payload", () => ({
  getPayload: vi.fn(),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/domains/verification", () => ({
  verifyParentDsAbsent: vi.fn(async () => ({
    status: "absent",
    records: [],
    reason: null,
  })),
  verifyAuthoritativeDns: vi.fn(async (_domain: string, nameServers: string[]) => ({
    status: "verified",
    delegatedNameServers: nameServers,
    respondingNameServers: nameServers,
    reason: null,
  })),
  verifyHttpsEndpoint: vi.fn(async () => ({
    status: "verified",
    httpStatus: 404,
    reason: null,
  })),
}))

import { getPayload } from "payload"
import {
  applyMollieWebhookPayment,
  createApplicationRecurringMolliePayment,
  createMollieCheckoutForGenerationRun,
  requestMollieRefund,
} from "@/lib/payments/molliePayments"
import { mollieApiKeyMode, mollieDomainProvisioningEnabled, verifyMollieWebhookSignature } from "@/lib/payments/mollieAdapter"
import { fulfillPaidOrder } from "@/lib/payments/fulfillOrder"
import { provisionPaidDomainOrder } from "@/lib/domains/provisioning"
import { CloudflareIndeterminateWriteError } from "@/lib/domains/cloudflare"
import { fulfillOrderTask } from "@/lib/jobs/fulfillOrderTask"
import { requestMollieRefundTask } from "@/lib/jobs/requestMollieRefundTask"
import { syncMolliePaymentTask } from "@/lib/jobs/syncMolliePaymentTask"
import { retryPostPaymentAutomation } from "@/lib/payments/postPaymentActivation"
import { POST as mollieWebhookPOST } from "@/app/(payload)/api/payments/mollie/webhook/route"

const registrant = {
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

const inlineText = (text: string) => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const blockText = (text: string) => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

const createPayloadStub = (overrides: Record<string, unknown> = {}) => {
  const tenant = {
    id: 1,
    name: "Acme Studio",
    slug: "acme-studio",
    domain: "acme.test",
    status: "provisioning",
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
  }
  const run = {
    id: 500,
    intakeSubmission: 400,
    status: "preview_ready",
    clientApproval: { status: "approved" },
    payment: null,
    domainOrder: null,
    tenant: 1,
    pages: [100],
    idempotencyKey: "run-500",
    normalizedIntake: {},
    normalizedIntakeHash: "hash",
    provider: "mock",
    model: "fixture",
    promptVersion: "site-generation-v1",
    generationInputHash: "input",
    errors: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  }
  const page = {
    id: 100,
    tenant: 1,
    title: "Home",
    slug: "index",
    status: "published",
    blocks: [{
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-01",
      anchor: "top",
      eyebrow: null,
      headline: inlineText("Acme Studio"),
      subheadline: blockText("A compact published page."),
      pills: [],
      cta: null,
      image: null,
    }],
    updatedAt: "2026-06-26T10:00:00.000Z",
  }
  const settings = {
    id: 300,
    tenant: 1,
    siteName: "Acme Studio",
    siteUrl: "https://clientsite.nl",
    language: "nl",
    updatedAt: "2026-06-26T10:00:00.000Z",
  }
  const orderDomain = (overrides.domainOrder as { domain?: string } | undefined)?.domain ?? tenant.domain
  const orderTld = orderDomain.split(".").at(-1)
  const tldCapabilityVersion = orderTld === "be"
    ? "tld-be-2026-07-27.1"
    : orderTld === "nl" ? "tld-nl-2026-07-26.1" : null
  const providerPrice = Number((overrides.domainOrder as { providerPriceAmount?: string } | undefined)?.providerPriceAmount ?? "10.00")
  const grossAmountMinor = providerPrice > 10
    ? 49_900 + Math.round((providerPrice - 10) * 100)
    : 49_900
  const netAmountMinor = Math.round(grossAmountMinor / 1.21)
  const vatAmountMinor = grossAmountMinor - netAmountMinor
  const profile = {
    id: 800,
    profileKey: "run:500:checkout-profile:1",
    profileVersion: 1,
    generationRun: 500,
    tenant: 1,
    customerName: "Ada Lovelace",
    customerEmail: "client@example.com",
    partyType: "registered_business",
    contractingPartyName: "Acme Studio",
    kvkNumber: "12345678",
    domainRegistrantSource: "contracting_party",
    billingAddress: {
      street: "Main Street",
      number: "10",
      suffix: null,
      zipcode: "1011AB",
      city: "Amsterdam",
      country: "NL",
      phoneCountryCode: "+31",
      phoneAreaCode: "20",
      phoneSubscriberNumber: "1234567",
    },
    createdAt: "2026-07-26T10:00:00.000Z",
  }
  const order = {
    id: 600,
    orderNumber: "SIAB-500-TEST",
    generationRun: 500,
    tenant: 1,
    state: "accepted",
    checkoutProfileKey: profile.profileKey,
    catalogVersion: "2026-07-26.1",
    ...(tldCapabilityVersion ? {
      quoteEvidence: {
        tldCapability: {
          tld: orderTld,
          capabilityVersion: tldCapabilityVersion,
          effectiveFrom: orderTld === "be"
            ? "2026-07-27T00:00:00.000Z"
            : "2026-01-01T00:00:00.000Z",
        },
      },
    } : {}),
    acceptedAt: "2026-07-27T10:00:00.000Z",
    packageCode: "siteinabox-monthly",
    billingPeriod: "monthly",
    customerName: "Ada Lovelace",
    customerEmail: "client@example.com",
    companyName: "Acme Studio",
    billingAddress: { country: "NL" },
    domain: orderDomain,
    subtotalNetMinor: netAmountMinor,
    vatAmountMinor,
    totalGrossMinor: grossAmountMinor,
    subtotalNet: netAmountMinor / 100,
    vatAmount: vatAmountMinor / 100,
    totalGross: grossAmountMinor / 100,
    netLineItems: [{
      code: "siteinabox-monthly",
      description: "Siteinabox maandabonnement",
      quantity: 1,
      netAmountMinor,
    }],
    lineItems: [],
    currency: "EUR",
    paymentStatus: "pending",
  }
  const acceptance = { id: 700, tenant: 1, actorEmail: "client@example.com", order: 600, acceptanceVersion: "platform-terms-2026-07-07" }
  const snapshots: MockDoc[] = []
  const billingAgreements: MockDoc[] = []
  const paymentAttempts: MockDoc[] = []
  const accountingDocuments: MockDoc[] = []
  const managedDomains: MockDoc[] = []
  const commerceNotifications: MockDoc[] = []
  const projection = overrides.payment as Record<string, unknown> | undefined
  if (projection?.externalReference) {
    const agreement = {
      id: 900,
      idempotencyKey: "mollie:billing-agreement:order:600:v1",
      originatingOrder: 600,
      checkoutProfile: profile.id,
      tenant: 1,
      state: projection.status === "completed" ? "active" : "mandate_pending",
      provider: "mollie",
      providerCustomerId: projection.mollieCustomerId ?? "cst_test_123",
      providerMandateId: projection.status === "completed" ? "mdt_test_123" : null,
      catalogVersion: "2026-07-26.1",
      packageCode: "siteinabox-monthly",
      billingPeriod: "monthly",
      currency: "EUR",
      recurringNetAmountMinor: 1_900,
      renewalIntent: true,
      reconciliationRequired: false,
      createdAt: "2026-07-26T10:00:00.000Z",
    }
    billingAgreements.push(agreement)
    paymentAttempts.push({
      id: 901,
      idempotencyKey: "mollie:first-payment:order:600:v1",
      order: 600,
      billingAgreement: agreement.id,
      tenant: 1,
      state: projection.status === "completed" ? "paid" : "pending_provider",
      purpose: "first_payment",
      sequenceType: "first",
      provider: "mollie",
      providerPaymentId: projection.externalReference,
      providerStatus: projection.providerStatus ?? "open",
      checkoutUrl: projection.checkoutUrl,
      currency: "EUR",
      netAmountMinor,
      vatAmountMinor,
      grossAmountMinor,
      reconciliationRequired: false,
      createdAt: "2026-07-26T10:00:00.000Z",
    })
  }
  const update = vi.fn(async ({ collection, id, data }: MockUpdateArgs) => {
    if (collection === "site-generation-runs") Object.assign(run, data)
    if (collection === "tenants") Object.assign(tenant, data)
    if (collection === "orders") {
      Object.assign(order, data)
      return { ...order }
    }
    if (collection === "published-site-snapshots") {
      const snapshot = snapshots.find((entry) => String(entry.id) === String(id))
      if (!snapshot) throw new Error(`Missing published-site-snapshots ${id}`)
      Object.assign(snapshot, data)
      return { ...snapshot }
    }
    for (const [slug, docs] of [
      ["payment-attempts", paymentAttempts],
      ["billing-agreements", billingAgreements],
      ["accounting-documents", accountingDocuments],
      ["managed-domains", managedDomains],
      ["commerce-notification-deliveries", commerceNotifications],
    ] as const) {
      if (collection !== slug) continue
      const doc = docs.find((entry) => String(entry.id) === String(id))
      if (!doc) throw new Error(`Missing ${collection} ${id}`)
      Object.assign(doc, data)
      return { ...doc }
    }
    if (collection === "tenants") return { ...tenant }
    return { ...run }
  })
  const payload = {
    findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
      if (collection === "site-generation-runs" && String(id) === "500") return run
      if (collection === "tenants" && String(id) === "1") return tenant
      if (collection === "orders" && String(id) === "600") return order
      if (collection === "checkout-profiles" && String(id) === String(profile.id)) return profile
      for (const [slug, docs] of [
        ["payment-attempts", paymentAttempts],
        ["billing-agreements", billingAgreements],
        ["accounting-documents", accountingDocuments],
        ["managed-domains", managedDomains],
        ["commerce-notification-deliveries", commerceNotifications],
      ] as const) {
        if (collection !== slug) continue
        const doc = docs.find((entry) => String(entry.id) === String(id))
        if (doc) return doc
      }
      if (collection === "published-site-snapshots") {
        const snapshot = snapshots.find((entry) => String(entry.id) === String(id))
        if (snapshot) return snapshot
      }
      throw new Error(`Missing ${collection} ${id}`)
    }),
    find: vi.fn(async ({ collection, where }: MockFindArgs) => {
      if (collection === "published-site-snapshots") {
        if (where?.and) {
          return { docs: snapshots.filter((snapshot) => matchesWhere(snapshot, where)) }
        }
        const clause = (where ?? {}) as MockWhere
        const sourceRun = asMockDoc(clause.sourceGenerationRun)?.equals
        if (sourceRun != null) {
          return { docs: snapshots.filter((snapshot) => String(snapshot.sourceGenerationRun) === String(sourceRun)) }
        }
        const tenantId = asMockDoc(clause.tenant)?.equals
        if (tenantId != null) {
          return { docs: snapshots.filter((snapshot) => String(snapshot.tenant) === String(tenantId)) }
        }
        return { docs: snapshots }
      }
      if (collection === "pages") return { docs: [page] }
      if (collection === "site-settings") return { docs: [settings] }
      if (collection === "agreement-acceptances") {
        const orderEquals = asMockDoc((where as MockWhere)?.order)?.equals
        if (orderEquals != null) {
          return { docs: String(acceptance.order) === String(orderEquals) ? [acceptance] : [] }
        }
        const clauses = (where as MockWhere)?.and
        if (!clauses) return { docs: [acceptance] }
        const tenantId = asMockDoc(clauses.find((clause) => clause.tenant)?.tenant)?.equals
        const actorEmail = asMockDoc(clauses.find((clause) => clause.actorEmail)?.actorEmail)?.equals
        if (tenantId != null && actorEmail != null) {
          return {
            docs: String(acceptance.tenant) === String(tenantId) && acceptance.actorEmail === actorEmail
              ? [acceptance]
              : [],
          }
        }
        return { docs: [acceptance] }
      }
      if (collection === "checkout-profiles") {
        return { docs: matchesWhere(profile, where) ? [profile] : [] }
      }
      for (const [slug, docs] of [
        ["payment-attempts", paymentAttempts],
        ["billing-agreements", billingAgreements],
        ["accounting-documents", accountingDocuments],
        ["managed-domains", managedDomains],
        ["commerce-notification-deliveries", commerceNotifications],
      ] as const) {
        if (collection === slug) {
          return { docs: docs.filter((doc) => matchesWhere(doc, where)) }
        }
      }
      return { docs: [] }
    }),
    create: vi.fn(async ({ collection, data }: MockCreateArgs) => {
      if (collection === "published-site-snapshots") {
        const snapshot = { id: snapshots.length + 10, ...data }
        snapshots.unshift(snapshot)
        return snapshot
      }
      if (collection === "site-settings") return settings
      for (const [slug, docs, base] of [
        ["payment-attempts", paymentAttempts, 1_000],
        ["billing-agreements", billingAgreements, 1_100],
        ["accounting-documents", accountingDocuments, 1_200],
        ["managed-domains", managedDomains, 1_300],
        ["commerce-notification-deliveries", commerceNotifications, 1_400],
      ] as const) {
        if (collection !== slug) continue
        const doc = { id: base + docs.length, ...data }
        docs.push(doc)
        return doc
      }
      throw new Error(`Unexpected create ${collection}`)
    }),
    jobs: { queue: vi.fn(async () => ({ id: 1 })) },
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    update,
  }
  vi.mocked(getPayload).mockResolvedValue(asPayload(payload))
  return {
    payload: asPayload(payload),
    run,
    tenant,
    order,
    update,
    snapshots,
    billingAgreements,
    paymentAttempts,
    accountingDocuments,
    managedDomains,
    queue: payload.jobs.queue,
  }
}

describe("Mollie payment flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("MOLLIE_API_KEY", "test_xxx")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_AMOUNT", "499.00")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_CURRENCY", "EUR")
    vi.stubEnv("SITE_URL", "https://admin.siteinabox.nl")
    vi.stubEnv("MOLLIE_WEBHOOK_BASE_URL", "")
    vi.stubEnv("MOLLIE_WEBHOOK_SIGNING_SECRET", "")
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "https://api.mollie.com/v2/customers") {
        return new Response(JSON.stringify({ id: "cst_test_123", name: "Acme Studio", email: "client@example.com" }), { status: 201 })
      }
      return new Response(JSON.stringify({
        id: "tr_test_123",
        status: "open",
        amount: { currency: "EUR", value: "499.00" },
        metadata: {
          generationRunId: 500,
          tenantId: 1,
          orderId: 600,
          customerEmail: "client@example.com",
          clientSlug: "acme",
        },
        _links: { checkout: { href: "https://www.mollie.com/checkout/test" } },
      }), { status: 201 })
    }))
  })

  it("creates approved-run checkout with run, tenant, customer, and idempotency metadata", async () => {
    vi.stubEnv("MOLLIE_SITE_PAYMENT_AMOUNT", "0.01")
    const { payload, update } = createPayloadStub()

    const result = await createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: " Client@Example.com ",
      clientSlug: "acme",
      actor: 42,
    })

    expect(result.checkoutUrl).toBe("https://www.mollie.com/checkout/test")
    expect(result.reused).toBe(false)
    expect(fetch).toHaveBeenCalledWith("https://api.mollie.com/v2/customers", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer test_xxx",
        "Idempotency-Key": "mollie:billing-agreement:order:600:v1:customer",
      }),
    }))
    expect(fetch).toHaveBeenCalledWith("https://api.mollie.com/v2/payments", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer test_xxx",
        "Idempotency-Key": "mollie:first-payment:order:600:v1",
      }),
    }))
    const request = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      amount: { currency: "EUR", value: "499.00" },
      sequenceType: "first",
      customerId: "cst_test_123",
      redirectUrl: "https://preview.siteinabox.nl/acme/checkout?payment=return",
      webhookUrl: "https://admin.siteinabox.nl/api/payments/mollie/webhook",
      metadata: {
        generationRunId: 500,
        tenantId: 1,
          orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "acme.test",
        idempotencyKey: "mollie:first-payment:order:600:v1",
        mollieCustomerId: "cst_test_123",
        sequenceType: "first",
      },
    })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "site-generation-runs",
      id: 500,
      data: {
        payment: expect.objectContaining({
          status: "pending_provider",
          provider: "mollie",
          externalReference: "tr_test_123",
          customerEmail: "client@example.com",
          checkoutUrl: "https://www.mollie.com/checkout/test",
          mollieCustomerId: "cst_test_123",
          mollieSequenceType: "first",
          renewalInterval: "1 month",
        }),
      },
    }))
  })

  it("adds the selected domain extra fee to the first Mollie payment amount", async () => {
    const { payload } = createPayloadStub({
      domainOrder: {
        status: "ready_to_register",
        domain: "acme.nl",
        providerPriceAmount: "12.50",
        providerPriceCurrency: "EUR",
        maxProviderPriceAmount: "10.00",
        maxProviderPriceCurrency: "EUR",
      },
    })

    await createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
      selectedDomain: "acme.nl",
    })

    const request = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      amount: { currency: "EUR", value: "501.50" },
    })
  })

  it("reuses an existing matching pending Mollie checkout", async () => {
    const { payload, update } = createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test_123",
        checkoutUrl: "https://www.mollie.com/checkout/test",
        customerEmail: "client@example.com",
        clientSlug: "acme",
      },
    })

    const result = await createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
      clientSlug: "acme",
    })

    expect(result.reused).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("blocks checkout before preview approval", async () => {
    const { payload } = createPayloadStub({ clientApproval: { status: "pending" } })

    await expect(createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
      orderId: 600,
      customerEmail: "client@example.com",
    })).rejects.toThrow("approved preview")
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ["paid", "paid", "completed"],
    ["canceled", "cancelled", "canceled"],
    ["pending", "pending_provider", "pending_provider"],
    ["failed", "failed", "failed"],
    ["expired", "expired", "expired"],
  ])("maps synchronized Mollie status %s to attempt state %s", async (
    mollieStatus,
    expectedState,
    expectedProjectionStatus,
  ) => {
    const { payload, run, update } = createPayloadStub({
      payment: { status: "pending_provider", provider: "mollie", externalReference: "tr_test_123" },
    })

    const result = await applyMollieWebhookPayment(payload, "tr_test_123", async () => ({
      id: "tr_test_123",
      status: mollieStatus,
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
          orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
      },
    }))

    expect(result.state).toBe(expectedState)
    expect(run.payment).toMatchObject({
      status: expectedProjectionStatus,
      provider: "mollie",
      externalReference: "tr_test_123",
      providerStatus: mollieStatus,
    })
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "tenants" }))
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "published-site-snapshots" }))
    expect(run.errors).toBeNull()
  })

  it("reports duplicate webhook delivery while keeping the operation idempotent", async () => {
    const { payload } = createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_test_123",
        providerStatus: "paid",
        mollieCustomerId: "cst_test_123",
      },
    })

    const result = await applyMollieWebhookPayment(payload, "tr_test_123", async () => ({
      id: "tr_test_123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: { generationRunId: 500, tenantId: 1, orderId: 600 },
    }))

    expect(result).toMatchObject({ ok: true, state: "paid", duplicate: true })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("creates application-owned recurring payments against a valid Mollie mandate", async () => {
    const { payload, billingAgreements, paymentAttempts } = createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_first_123",
        providerStatus: "paid",
        mollieCustomerId: "cst_test_123",
      },
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/customers/cst_test_123/mandates/mdt_test_123")) {
        return new Response(JSON.stringify({
          id: "mdt_test_123",
          status: "valid",
          method: "directdebit",
        }), { status: 200 })
      }
      if (url === "https://api.mollie.com/v2/payments") {
        const body = JSON.parse(String(init?.body))
        expect(body).toMatchObject({
          customerId: "cst_test_123",
          sequenceType: "recurring",
          webhookUrl: "https://admin.siteinabox.nl/api/payments/mollie/webhook",
          metadata: {
            billingAgreementId: billingAgreements[0]?.id,
            mandateId: "mdt_test_123",
            sequenceType: "recurring",
            orderId: 600,
          },
        })
        expect(body).not.toHaveProperty("redirectUrl")
        return new Response(JSON.stringify({
          id: "tr_recurring_123",
          status: "pending",
        }), { status: 201 })
      }
      throw new Error(`Unexpected provider request ${url}`)
    }))

    const result = await createApplicationRecurringMolliePayment(payload, {
      billingAgreementId: String(billingAgreements[0]?.id),
      orderId: 600,
    })

    expect(result.reused).toBe(false)
    expect(result.paymentAttempt).toMatchObject({
      state: "pending_provider",
      purpose: "recurring",
      sequenceType: "recurring",
      providerPaymentId: "tr_recurring_123",
    })
    expect(paymentAttempts).toHaveLength(2)
    expect(vi.mocked(fetch).mock.calls.some(([url]) =>
      String(url).includes("/subscriptions"),
    )).toBe(false)
  })

  it("reconciles a full refund into one issued credit note and remains duplicate-safe", async () => {
    const {
      payload,
      paymentAttempts,
      accountingDocuments,
    } = createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refund_123",
        providerStatus: "paid",
        mollieCustomerId: "cst_test_123",
      },
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toBe("https://api.mollie.com/v2/payments/tr_refund_123/refunds")
      return new Response(JSON.stringify({
        id: "re_test_123",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
      }), { status: 201 })
    }))

    const requested = await requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit",
    })
    expect(requested).toMatchObject({
      providerRefundId: "re_test_123",
      reused: false,
      document: {
        documentType: "credit_note",
        state: "pending_provider",
      },
    })
    expect(accountingDocuments).toHaveLength(2)

    const providerPayment = {
      id: "tr_refund_123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      customerId: "cst_test_123",
      mandateId: "mdt_test_123",
      sequenceType: "first",
      paidAt: "2026-07-26T12:00:00.000Z",
      metadata: {
        paymentAttemptId: paymentAttempts[0]?.id,
        orderId: 600,
      },
      _embedded: {
        refunds: [{
          id: "re_test_123",
          status: "refunded",
          amount: { currency: "EUR", value: "499.00" },
          createdAt: "2026-07-26T12:05:00.000Z",
        }],
        chargebacks: [],
      },
    }
    const first = await applyMollieWebhookPayment(
      payload,
      "tr_refund_123",
      async () => providerPayment,
    )
    const duplicate = await applyMollieWebhookPayment(
      payload,
      "tr_refund_123",
      async () => providerPayment,
    )

    expect(first.state).toBe("refunded")
    expect(duplicate).toMatchObject({ state: "refunded", duplicate: true })
    expect(accountingDocuments).toHaveLength(2)
    expect(accountingDocuments.find((document) =>
      document.documentType === "credit_note",
    )).toMatchObject({
      state: "issued",
      providerOperationId: "re_test_123",
      grossAmountMinor: 49_900,
    })
  })

  it("reconciles an indeterminate refund response into its pending credit note", async () => {
    const {
      payload,
      paymentAttempts,
      accountingDocuments,
    } = createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_refund_indeterminate",
        providerStatus: "paid",
        mollieCustomerId: "cst_test_123",
      },
    })
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Provider response connection closed.")
    }))

    await expect(requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "unfulfillable_before_provider_commit",
    })).rejects.toThrow("connection closed")

    const pendingDocument = accountingDocuments.find((document) =>
      document.documentType === "credit_note",
    )
    expect(pendingDocument).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
    })
    expect(pendingDocument?.providerOperationId).toBeUndefined()

    const result = await applyMollieWebhookPayment(
      payload,
      "tr_refund_indeterminate",
      async () => ({
        id: "tr_refund_indeterminate",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test_123",
        mandateId: "mdt_test_123",
        sequenceType: "first",
        paidAt: "2026-07-26T12:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: {
          refunds: [{
            id: "re_discovered_after_timeout",
            status: "refunded",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-07-26T12:05:00.000Z",
            metadata: { accountingDocumentId: pendingDocument?.id },
          }],
          chargebacks: [],
        },
      }),
    )

    expect(result.state).toBe("refunded")
    expect(accountingDocuments).toHaveLength(2)
    expect(pendingDocument).toMatchObject({
      state: "issued",
      reconciliationRequired: false,
      providerOperationId: "re_discovered_after_timeout",
    })
  })

  it("keeps a chargeback terminal when a later synchronization sees an older pending state", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      accountingDocuments,
    } = createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_chargeback_123",
        providerStatus: "paid",
        mollieCustomerId: "cst_test_123",
      },
    })
    const chargeback = await applyMollieWebhookPayment(
      payload,
      "tr_chargeback_123",
      async () => ({
        id: "tr_chargeback_123",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test_123",
        mandateId: "mdt_test_123",
        sequenceType: "first",
        paidAt: "2026-07-26T12:00:00.000Z",
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
        _embedded: {
          refunds: [],
          chargebacks: [{
            id: "chb_test_123",
            amount: { currency: "EUR", value: "499.00" },
            createdAt: "2026-07-27T12:00:00.000Z",
          }],
        },
      }),
    )
    const stale = await applyMollieWebhookPayment(
      payload,
      "tr_chargeback_123",
      async () => ({
        id: "tr_chargeback_123",
        status: "pending",
        amount: { currency: "EUR", value: "499.00" },
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )

    expect(chargeback.state).toBe("chargeback")
    expect(stale.state).toBe("chargeback")
    expect(paymentAttempts[0]).toMatchObject({
      state: "chargeback",
      reconciliationRequired: true,
      chargebackAmountMinor: 49_900,
    })
    expect(billingAgreements[0]).toMatchObject({ state: "past_due" })
    expect(accountingDocuments.some((document) =>
      document.providerOperationId === "chb_test_123" &&
      document.documentType === "credit_note",
    )).toBe(true)
  })

  it("restores only the tenant suspension owned by the paid billing agreement", async () => {
    const {
      payload,
      paymentAttempts,
      billingAgreements,
      order,
      tenant,
    } = createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_recurring_restore",
        providerStatus: "open",
        mollieCustomerId: "cst_test_123",
      },
    })
    Object.assign(order, {
      state: "accepted",
      paymentStatus: "open",
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
    })
    Object.assign(paymentAttempts[0]!, {
      purpose: "recurring",
      sequenceType: "recurring",
      state: "pending_provider",
      providerStatus: "open",
    })
    Object.assign(billingAgreements[0]!, {
      state: "suspended",
      serviceSuspensionStatus: "billing_suspended",
      suspendedAt: "2026-08-15T10:00:00.000Z",
      currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
    })
    Object.assign(tenant, {
      status: "suspended",
      billingSuspensionAgreement: billingAgreements[0]!.id,
      billingSuspendedAt: "2026-08-15T10:00:00.000Z",
    })

    await applyMollieWebhookPayment(
      payload,
      "tr_recurring_restore",
      async () => ({
        id: "tr_recurring_restore",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        customerId: "cst_test_123",
        mandateId: "mdt_test_123",
        sequenceType: "recurring",
        paidAt: "2026-08-16T10:00:00.000Z",
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          orderId: 600,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )

    expect(billingAgreements[0]).toMatchObject({
      state: "active",
      serviceSuspensionStatus: "none",
      currentPeriodStartsAt: "2026-08-01T10:00:00.000Z",
      currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
      nextChargeAt: "2026-09-01T10:00:00.000Z",
      graceStartedAt: null,
      graceEndsAt: null,
    })
    expect(tenant).toMatchObject({
      status: "active",
      billingSuspensionAgreement: null,
      billingSuspendedAt: null,
    })
    expect(order).toMatchObject({ state: "fulfilled", paymentStatus: "paid" })
  })

  it("marks a provider amount mismatch for reconciliation without satisfying the order", async () => {
    const { payload, paymentAttempts, order } = createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_amount_mismatch",
        providerStatus: "open",
      },
    })

    await expect(applyMollieWebhookPayment(
      payload,
      "tr_amount_mismatch",
      async () => ({
        id: "tr_amount_mismatch",
        status: "paid",
        amount: { currency: "EUR", value: "498.00" },
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
      }),
    )).rejects.toThrow("does not match")

    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_amount_mismatch",
    })
    expect(order).toMatchObject({ paymentStatus: "pending", state: "accepted" })
  })

  it("requires provider amount evidence before satisfying the order", async () => {
    const { payload, paymentAttempts, order } = createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_amount_missing",
        providerStatus: "open",
      },
    })

    await expect(applyMollieWebhookPayment(
      payload,
      "tr_amount_missing",
      async () => ({
        id: "tr_amount_missing",
        status: "paid",
        metadata: { paymentAttemptId: paymentAttempts[0]?.id, orderId: 600 },
      }),
    )).rejects.toThrow("does not match")

    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_amount_mismatch",
    })
    expect(order).toMatchObject({ paymentStatus: "pending", state: "accepted" })
  })

  it.each([
    {
      label: "order",
      payment: {
        customerId: "cst_test_123",
        sequenceType: "first" as const,
        metadata: { orderId: 601 },
      },
    },
    {
      label: "customer",
      payment: {
        customerId: "cst_other",
        sequenceType: "first" as const,
        metadata: { orderId: 600 },
      },
    },
    {
      label: "sequence",
      payment: {
        customerId: "cst_test_123",
        sequenceType: "recurring" as const,
        metadata: { orderId: 600 },
      },
    },
  ])("blocks a mismatched Mollie $label authority before state advancement", async ({ payment }) => {
    const { payload, paymentAttempts, order } = createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_authority_mismatch",
        providerStatus: "open",
      },
    })

    await expect(applyMollieWebhookPayment(
      payload,
      "tr_authority_mismatch",
      async () => ({
        id: "tr_authority_mismatch",
        status: "paid",
        amount: { currency: "EUR", value: "499.00" },
        ...payment,
        metadata: {
          paymentAttemptId: paymentAttempts[0]?.id,
          ...payment.metadata,
        },
      }),
    )).rejects.toThrow("does not match")

    expect(paymentAttempts[0]).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
      failureCode: "provider_authority_mismatch",
    })
    expect(order).toMatchObject({ paymentStatus: "pending", state: "accepted" })
  })

  it("does not automate refund scenarios that the decision matrix assigns to review", async () => {
    const { payload, paymentAttempts, accountingDocuments } = createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_manual_review",
        providerStatus: "paid",
      },
    })

    await expect(requestMollieRefund(payload, {
      paymentAttemptId: String(paymentAttempts[0]?.id),
      scenario: "customer_cancellation_after_provider_commit",
    })).rejects.toThrow("manual review")
    expect(accountingDocuments).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("coalesces pending synchronization jobs by Mollie payment id", () => {
    expect(syncMolliePaymentTask.concurrency).toMatchObject({
      exclusive: true,
      supersedes: true,
    })
    const concurrency = syncMolliePaymentTask.concurrency
    if (!concurrency || typeof concurrency === "function") {
      throw new Error("Expected object concurrency configuration.")
    }
    expect(concurrency.key({
      input: { paymentId: "tr_test_123" },
      queue: "default",
    })).toBe("mollie-payment:tr_test_123")
  })

  it("serializes all refund scenarios for one captured payment", () => {
    const concurrency = requestMollieRefundTask.concurrency
    if (!concurrency || typeof concurrency === "function") {
      throw new Error("Expected object concurrency configuration.")
    }
    expect(concurrency).toMatchObject({ exclusive: true })
    expect(concurrency.supersedes).not.toBe(true)
    expect(concurrency.key({
      input: {
        paymentAttemptId: "901",
        scenario: "duplicate_payment",
      },
      queue: "default",
    })).toBe("mollie-refund:901")
    expect(concurrency.key({
      input: {
        paymentAttemptId: "901",
        scenario: "unfulfillable_before_provider_commit",
      },
      queue: "default",
    })).toBe("mollie-refund:901")
  })

  it("serializes and coalesces duplicate fulfillment workers for one paid order", () => {
    const concurrency = fulfillOrderTask.concurrency
    if (!concurrency || typeof concurrency === "function") {
      throw new Error("Expected object concurrency configuration.")
    }
    expect(concurrency).toMatchObject({ exclusive: true, supersedes: true })
    expect(concurrency.key({
      input: { orderId: "600", paymentAttemptId: "901" },
      queue: "default",
    })).toBe("fulfill-order:600")
  })

  it("completes a test-mode paid checkout without creating a subscription or provisioning a domain", async () => {
    const { payload, run, tenant } = createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test_123",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      throw new Error(`Unexpected provider fetch ${url}`)
    }))

    const result = await applyMollieWebhookPayment(payload, "tr_test_123", async () => ({
      id: "tr_test_123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
          orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test_123",
        sequenceType: "first",
      },
    }))

    expect(result.state).toBe("paid")
    expect(result.fulfillmentRequired).toBe(true)
    expect(mollieApiKeyMode()).toBe("test")
    expect(mollieDomainProvisioningEnabled()).toBe(false)
    expect(run.payment).toMatchObject({
      status: "completed",
      selectedDomain: "clientsite.nl",
      mollieSubscriptionId: null,
      note: "Mollie payment synchronized; fulfillment is queued separately.",
    })
    const fulfillment = await fulfillPaidOrder(payload, {
      orderId: result.orderId,
      paymentAttemptId: result.paymentAttemptId,
    })
    expect(fulfillment.status).toBe("waiting")
    expect(run.errors).toMatchObject({
      postPaymentAutomation: {
        status: "blocked",
        step: "activation_gate",
        message: "Activation requires verified domain ownership.",
      },
    })
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      domain: "clientsite.nl",
    })
    expect(tenant).toMatchObject({
      domain: "acme.test",
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("fails closed for .be fulfillment without frozen capability evidence", async () => {
    const { payload, run, order } = createPayloadStub({
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.be",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    Object.assign(order, { quoteEvidence: undefined })

    await expect(provisionPaidDomainOrder(payload, cast(run), {
      order: cast(order),
      selectedDomain: "clientsite.be",
    })).rejects.toThrow("frozen TLD capability evidence")
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(["nl", "be"] as const)(
    "starts .%s domain provisioning after a live paid checkout",
    async (tld) => {
    const selectedDomain = `clientsite.${tld}`
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    vi.stubEnv("OPENPROVIDER_USERNAME", "user")
    vi.stubEnv("OPENPROVIDER_PASSWORD", "pass")
    vi.stubEnv("OPENPROVIDER_ADMIN_HANDLE", "ADMIN-NL")
    vi.stubEnv("OPENPROVIDER_TECH_HANDLE", "TECH-NL")
    vi.stubEnv("OPENPROVIDER_BILLING_HANDLE", "BILL-NL")
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-account")
    vi.stubEnv("SIAB_RENDERER_TARGET_HOST", "renderer.siteinabox.nl")
    const { payload, run, tenant, snapshots, managedDomains } = createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test_123",
        selectedDomain,
      },
      domainOrder: {
        status: "ready_to_register",
        domain: selectedDomain,
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    let cloudflareZoneCreated = false
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/email/sending/subdomains")) {
        if (url.endsWith("/email/sending/subdomains/subdomain_123")) {
          return new Response(JSON.stringify({
            success: true,
            result: {
              enabled: true,
              name: `mail.${selectedDomain}`,
              tag: "subdomain_123",
              dkim_selector: "cf-bounce",
              return_path_domain: `cf-bounce.mail.${selectedDomain}`,
            },
          }), { status: 200 })
        }
        if (url.endsWith("/email/sending/subdomains")) {
          return new Response(JSON.stringify({
            success: true,
            result: [{
              enabled: true,
              name: `mail.${selectedDomain}`,
              tag: "subdomain_123",
              dkim_selector: "cf-bounce",
              return_path_domain: `cf-bounce.mail.${selectedDomain}`,
            }],
          }), { status: 200 })
        }
        throw new Error(`Unexpected fetch ${url}`)
      }
      if (url.includes("/ssl/verification")) {
        return new Response(JSON.stringify({
          success: true,
          result: [{ certificate_status: "active" }],
        }), { status: 200 })
      }
      if (url.includes("api.cloudflare.com/client/v4/zones?") && !url.includes("dns_records")) {
        return new Response(JSON.stringify({
          success: true,
          result: cloudflareZoneCreated
            ? [{
                id: "zone_123",
                name: selectedDomain,
                status: "active",
                name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
              }]
            : [],
        }), { status: 200 })
      }
      if (url.includes("api.cloudflare.com/client/v4/zones") && !url.includes("dns_records")) {
        cloudflareZoneCreated = true
        return new Response(JSON.stringify({
          success: true,
          result: {
            id: "zone_123",
            name: selectedDomain,
            status: "active",
            name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          },
        }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/auth/login")) {
        return new Response(JSON.stringify({ data: { token: "op-token" } }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/domains/check")) {
        return new Response(JSON.stringify({
          data: { results: [{ domain: selectedDomain, status: "free" }] },
        }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/customers")) {
        if (init?.method === "GET") {
          return new Response(JSON.stringify({ data: { results: [] } }), { status: 200 })
        }
        return new Response(JSON.stringify({ data: { handle: "OWNER-CLIENT" } }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/domains")) {
        if (init?.method === "GET") {
          return new Response(JSON.stringify({ data: { results: [] } }), { status: 200 })
        }
        return new Response(JSON.stringify({ code: 0, data: { id: 9001, status: "ACT" } }), { status: 200 })
      }
      if (url.includes("dns_records")) {
        if (init?.method === "GET") {
          return new Response(JSON.stringify({ success: true, result: [] }), { status: 200 })
        }
        return new Response(JSON.stringify({
          success: true,
          result: { id: "record_123", name: selectedDomain, content: "renderer.siteinabox.nl", proxied: true },
        }), { status: 200 })
      }
      throw new Error(`Unexpected fetch ${url}`)
    }))

    const result = await applyMollieWebhookPayment(payload, "tr_test_123", async () => ({
      id: "tr_test_123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
          orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain,
        mollieCustomerId: "cst_test_123",
        sequenceType: "first",
      },
    }))

    expect(result.state).toBe("paid")
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      domain: selectedDomain,
    })
    const fulfillment = await fulfillPaidOrder(payload, {
      orderId: result.orderId,
      paymentAttemptId: result.paymentAttemptId,
    })
    expect(fulfillment.status).toBe("fulfilled")
    expect(mollieApiKeyMode()).toBe("live")
    expect(mollieDomainProvisioningEnabled()).toBe(true)
    expect(run.payment).toMatchObject({
      status: "completed",
      selectedDomain,
      mollieCustomerId: "cst_test_123",
      mollieSubscriptionId: null,
    })
    expect(run.domainOrder).toMatchObject({
      status: "registered",
      domain: selectedDomain,
      providerReference: "9001",
      cloudflareZoneId: "zone_123",
      ownerHandle: "OWNER-CLIENT",
      adminHandle: null,
      emailSending: {
        provider: "cloudflare",
        mode: "subdomain",
        status: "verified",
        sendingDomain: `mail.${selectedDomain}`,
        senderEmail: `noreply@mail.${selectedDomain}`,
        cloudflareZoneId: "zone_123",
        cloudflareSubdomainId: "subdomain_123",
        returnPathDomain: `cf-bounce.mail.${selectedDomain}`,
        dkimSelector: "cf-bounce",
        lastError: null,
      },
    })
    expect(run.errors).toMatchObject({
      postPaymentAutomation: {
        status: "activated",
        step: "publish_activate",
        message: "Published and activated automatically after completed payment and provisioning.",
        snapshotId: 10,
      },
    })
    expect(tenant).toMatchObject({
      domain: selectedDomain,
      status: "active",
      activeSnapshot: 10,
      domainVerification: expect.objectContaining({ status: "verified" }),
      emailSending: expect.objectContaining({
        provider: "cloudflare",
        mode: "subdomain",
        status: "verified",
        sendingDomain: `mail.${selectedDomain}`,
        senderEmail: `noreply@mail.${selectedDomain}`,
        cloudflareZoneId: "zone_123",
        cloudflareSubdomainId: "subdomain_123",
        returnPathDomain: `cf-bounce.mail.${selectedDomain}`,
        dkimSelector: "cf-bounce",
        lastError: null,
      }),
    })
    expect(snapshots[0]).toMatchObject({
      id: 10,
      status: "active",
      tenant: 1,
      sourceGenerationRun: 500,
      domain: selectedDomain,
    })
    expect(managedDomains).toContainEqual(expect.objectContaining({
      domainNameAscii: selectedDomain,
      tld,
      state: "active",
      providerDomainId: "9001",
      providerRegistrationState: "confirmed",
      registrantVerificationStatus: "not_required",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      entitlementStatus: "active",
      customerStatus: "active",
    }))
    const subscriptionCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/subscriptions"))
    expect(subscriptionCall).toBeUndefined()
    await expect(fulfillPaidOrder(payload, {
      orderId: result.orderId,
      paymentAttemptId: result.paymentAttemptId,
    })).resolves.toMatchObject({ status: "fulfilled" })
    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      String(url).endsWith("/v1beta/domains") && init?.method === "POST")).toHaveLength(1)
    const registrationRequest = vi.mocked(fetch).mock.calls.find(([url, init]) =>
      String(url).endsWith("/v1beta/domains") && init?.method === "POST")
    expect(JSON.parse(String(registrationRequest?.[1]?.body))).toMatchObject({
      owner_handle: "OWNER-CLIENT",
      admin_handle: "ADMIN-NL",
      tech_handle: "TECH-NL",
      billing_handle: "BILL-NL",
    })
    },
  )

  it("queues the governed full refund when a paid .nl domain loses the availability race", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    vi.stubEnv("OPENPROVIDER_USERNAME", "user")
    vi.stubEnv("OPENPROVIDER_PASSWORD", "pass")
    const { payload, managedDomains, queue } = createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test_123",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/auth/login")) {
        return Response.json({ data: { token: "op-token" } })
      }
      if (url.includes("/domains?") && init?.method === "GET") {
        return Response.json({ data: { results: [] } })
      }
      if (url.includes("/domains/check")) {
        return Response.json({
          data: { results: [{ domain: "clientsite.nl", status: "active" }] },
        })
      }
      throw new Error(`Unexpected provider fetch ${url}`)
    }))
    const synchronized = await applyMollieWebhookPayment(payload, "tr_test_123", async () => ({
      id: "tr_test_123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
        orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test_123",
        sequenceType: "first",
      },
    }))

    await expect(fulfillPaidOrder(payload, {
      orderId: synchronized.orderId,
      paymentAttemptId: synchronized.paymentAttemptId,
    })).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("refund was queued"),
    })
    expect(managedDomains[0]).toMatchObject({
      state: "manual_review",
      customerStatus: "manual_review",
      failureReason: "paid_domain_became_unavailable_before_provider_commit",
    })
    expect(queue).toHaveBeenCalledWith(expect.objectContaining({
      task: "request-mollie-refund",
      input: {
        paymentAttemptId: "901",
        scenario: "unfulfillable_before_provider_commit",
      },
    }))
    expect(vi.mocked(fetch).mock.calls.some(([url, init]) =>
      init?.method === "POST" && (
        String(url).endsWith("/customers") ||
        String(url).endsWith("/domains") ||
        String(url).includes("api.cloudflare.com")
      ))).toBe(false)
  })

  it("adopts a delayed Cloudflare zone after an indeterminate create without a duplicate write", async () => {
    const { payload, run, order, managedDomains } = createPayloadStub({
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    const zone = {
      id: "zone_123",
      name: "clientsite.nl",
      status: "active" as const,
      nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      raw: {},
    }
    const createZone = vi.fn()
      .mockRejectedValue(new CloudflareIndeterminateWriteError("Cloudflare zone creation"))
    const listZones = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([zone])
    const registerDomain = vi.fn(async () => ({
      id: 9001,
      domain: "clientsite.nl",
      status: "requested" as const,
      raw: {},
    }))
    const dependencies = {
      now: () => "2026-07-26T12:00:00.000Z",
      loginOpenProvider: vi.fn(async () => "op-token"),
      findOpenProviderDomain: vi.fn(async () => null),
      checkOpenProviderDomainAvailability: vi.fn(async () => ({
        status: "available" as const,
        domain: "clientsite.nl",
        available: true,
        premium: false,
        price: null,
        internalReason: null,
      })),
      findOpenProviderCustomerByReference: vi.fn(async () => ({
        handle: "OWNER-CLIENT",
        comments: "domain-registration:order:600:v1",
        raw: {},
      })),
      createOpenProviderCustomerHandle: vi.fn(),
      createOrReuseCloudflareZone: createZone,
      listCloudflareZones: listZones,
      registerOpenProviderDomain: registerDomain,
    }

    await expect(provisionPaidDomainOrder(payload, cast(run), {
      order: cast(order),
      selectedDomain: "clientsite.nl",
      dependencies,
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("awaiting reconciliation"),
    })
    await expect(provisionPaidDomainOrder(payload, cast(run), {
      order: cast(order),
      selectedDomain: "clientsite.nl",
      dependencies,
    })).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("still processing"),
    })

    expect(createZone).toHaveBeenCalledTimes(1)
    expect(registerDomain).toHaveBeenCalledTimes(1)
    expect(managedDomains[0]).toMatchObject({
      cloudflareZoneId: "zone_123",
      cloudflareZoneStatus: "active",
      providerRegistrationState: "confirmed",
      reconciliationRequired: true,
    })
  })

  it("persists an indeterminate registration and never blindly repeats the provider POST", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    vi.stubEnv("OPENPROVIDER_USERNAME", "user")
    vi.stubEnv("OPENPROVIDER_PASSWORD", "pass")
    vi.stubEnv("OPENPROVIDER_ADMIN_HANDLE", "ADMIN-NL")
    vi.stubEnv("OPENPROVIDER_TECH_HANDLE", "TECH-NL")
    vi.stubEnv("OPENPROVIDER_BILLING_HANDLE", "BILL-NL")
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-account")
    vi.stubEnv("SIAB_RENDERER_TARGET_HOST", "renderer.siteinabox.nl")
    const { payload, managedDomains } = createPayloadStub({
      payment: {
        status: "pending_provider",
        provider: "mollie",
        externalReference: "tr_test_123",
        selectedDomain: "clientsite.nl",
      },
      domainOrder: {
        status: "ready_to_register",
        domain: "clientsite.nl",
        fixedPriceAmount: "499.00",
        fixedPriceCurrency: "EUR",
        registrant,
      },
    })
    let cloudflareZoneCreated = false
    let registrationPosts = 0
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/auth/login")) return Response.json({ data: { token: "op-token" } })
      if (url.includes("/domains/check")) {
        return Response.json({ data: { results: [{ domain: "clientsite.nl", status: "free" }] } })
      }
      if (url.includes("/domains?") && init?.method === "GET") {
        return Response.json({ data: { results: [] } })
      }
      if (url.includes("/customers?") && init?.method === "GET") {
        return Response.json({ data: { results: [] } })
      }
      if (url.endsWith("/customers") && init?.method === "POST") {
        return Response.json({ data: { handle: "OWNER-CLIENT" } })
      }
      if (url.includes("api.cloudflare.com/client/v4/zones?")) {
        return Response.json({
          success: true,
          result: cloudflareZoneCreated
            ? [{
                id: "zone_123",
                name: "clientsite.nl",
                status: "active",
                name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
              }]
            : [],
        })
      }
      if (url.endsWith("/client/v4/zones") && init?.method === "POST") {
        cloudflareZoneCreated = true
        return Response.json({
          success: true,
          result: {
            id: "zone_123",
            name: "clientsite.nl",
            status: "active",
            name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          },
        })
      }
      if (url.endsWith("/v1beta/domains") && init?.method === "POST") {
        registrationPosts += 1
        throw new TypeError("socket closed after dispatch")
      }
      throw new Error(`Unexpected provider fetch ${url}`)
    }))
    const synchronized = await applyMollieWebhookPayment(payload, "tr_test_123", async () => ({
      id: "tr_test_123",
      status: "paid",
      amount: { currency: "EUR", value: "499.00" },
      metadata: {
        generationRunId: 500,
        tenantId: 1,
        orderId: 600,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test_123",
        sequenceType: "first",
      },
    }))
    const input = {
      orderId: synchronized.orderId,
      paymentAttemptId: synchronized.paymentAttemptId,
    }

    await expect(fulfillPaidOrder(payload, input)).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("no retry was sent"),
    })
    await expect(fulfillPaidOrder(payload, input)).resolves.toMatchObject({
      status: "waiting",
      message: expect.stringContaining("no registration retry was sent"),
    })
    expect(registrationPosts).toBe(1)
    expect(managedDomains[0]).toMatchObject({
      state: "registration_pending",
      providerRegistrationState: "indeterminate",
      reconciliationRequired: true,
      failureReason: "openprovider_registration_indeterminate",
    })
  })

  it("blocks the legacy operator subscription retry without a provider request", async () => {
    const { payload, run } = createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_test_123",
        mollieCustomerId: "cst_test_123",
      },
    })

    const result = await retryPostPaymentAutomation(payload, 500, "mollie_subscription")

    expect(result).toEqual({
      status: "blocked",
      message: "Long-lived Mollie subscription creation is disabled.",
    })
    expect(run.errors).toMatchObject({
      postPaymentAutomation: {
        status: "blocked",
        step: "mollie_subscription",
        message: "Long-lived Mollie subscription creation is disabled.",
      },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects invalid webhook payloads and invalid optional signatures", async () => {
    const invalidBodyResponse = await mollieWebhookPOST(asNextRequest(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      body: "not-an-id=1",
    })))
    expect(invalidBodyResponse.status).toBe(400)

    const raw = "id=tr_test_123"
    vi.stubEnv("MOLLIE_WEBHOOK_SIGNING_SECRET", "secret")
    expect(verifyMollieWebhookSignature(raw, null)).toBe(false)
    expect(verifyMollieWebhookSignature(raw, "bad-signature")).toBe(false)

    const missingSignatureResponse = await mollieWebhookPOST(asNextRequest(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      body: raw,
    })))
    expect(missingSignatureResponse.status).toBe(401)

    const signature = crypto.createHmac("sha256", "secret").update(raw).digest("hex")
    const { payload } = createPayloadStub({
      payment: { status: "pending_provider", provider: "mollie", externalReference: "tr_test_123" },
    })
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "tr_test_123",
      status: "paid",
      metadata: { generationRunId: 500, tenantId: 1, orderId: 600 },
    }), { status: 200 })))

    const okResponse = await mollieWebhookPOST(asNextRequest(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      headers: { "x-mollie-signature": signature },
      body: raw,
    })))
    expect(okResponse.status).toBe(200)
    expect(await okResponse.json()).toEqual({ ok: true })
  })

  it("fails closed without a Mollie webhook signing secret in production", () => {
    expect(verifyMollieWebhookSignature("id=tr_test_123", null, {
      NODE_ENV: "production",
      MOLLIE_WEBHOOK_SIGNING_SECRET: "",
    } as NodeJS.ProcessEnv)).toBe(false)
    expect(verifyMollieWebhookSignature("id=tr_test_123", null, {
      NODE_ENV: "test",
      MOLLIE_WEBHOOK_SIGNING_SECRET: "",
    } as NodeJS.ProcessEnv)).toBe(true)
  })

  it("queues unknown webhook ids without provider lookup or internal-state disclosure", async () => {
    const { payload, update, queue } = createPayloadStub({
      payment: { status: "pending_provider", provider: "mollie", externalReference: "tr_expected" },
    })
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "tr_unknown",
      status: "paid",
      metadata: { generationRunId: 500, tenantId: 1, orderId: 600 },
    }), { status: 200 })))

    const response = await mollieWebhookPOST(asNextRequest(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      body: "id=tr_unknown",
    })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(update).not.toHaveBeenCalled()
    expect(queue).toHaveBeenCalledWith({
      task: "sync-mollie-payment",
      input: { paymentId: "tr_unknown" },
      queue: "default",
      overrideAccess: true,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("returns after enqueueing and never performs a Mollie lookup in the route", async () => {
    const { payload, update, queue } = createPayloadStub()
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not found", { status: 404 })))

    const response = await mollieWebhookPOST(asNextRequest(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      body: "id=tr_missing",
    })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(update).not.toHaveBeenCalled()
    expect(queue).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
  })
})
