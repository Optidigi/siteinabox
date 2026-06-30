import crypto from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("payload", () => ({
  getPayload: vi.fn(),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

import { getPayload } from "payload"
import { createMollieCheckoutForGenerationRun, applyMollieWebhookPayment } from "@/lib/payments/molliePayments"
import { mollieApiKeyMode, mollieDomainProvisioningEnabled, mollieRenewalAmountFromEnv, verifyMollieWebhookSignature } from "@/lib/payments/mollieAdapter"
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
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  }
  const update = vi.fn(async ({ collection, data }: any) => {
    if (collection === "site-generation-runs") Object.assign(run, data)
    if (collection === "tenants") Object.assign(tenant, data)
    if (collection === "tenants") return { ...tenant }
    return { ...run }
  })
  const payload = {
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection === "site-generation-runs" && String(id) === "500") return run
      if (collection === "tenants" && String(id) === "1") return tenant
      throw new Error(`Missing ${collection} ${id}`)
    }),
    update,
  }
  return { payload: payload as any, run, tenant, update }
}

describe("Mollie payment flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("MOLLIE_API_KEY", "test_xxx")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_AMOUNT", "499.00")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_CURRENCY", "EUR")
    vi.stubEnv("MOLLIE_SITE_RENEWAL_AMOUNT", "49.00")
    vi.stubEnv("MOLLIE_SITE_RENEWAL_CURRENCY", "EUR")
    vi.stubEnv("MOLLIE_SITE_SUBSCRIPTION_INTERVAL", "1 month")
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
          customerEmail: "client@example.com",
          clientSlug: "acme",
        },
        _links: { checkout: { href: "https://www.mollie.com/checkout/test" } },
      }), { status: 201 })
    }))
  })

  it("creates approved-run checkout with run, tenant, customer, and idempotency metadata", async () => {
    const { payload, update } = createPayloadStub()

    const result = await createMollieCheckoutForGenerationRun(payload, {
      runId: 500,
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
        "Idempotency-Key": "siab-run-500-customer-client@example.com-mollie-customer",
      }),
    }))
    expect(fetch).toHaveBeenCalledWith("https://api.mollie.com/v2/customers/cst_test_123/payments", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer test_xxx",
        "Idempotency-Key": "siab-run-500-customer-client@example.com",
      }),
    }))
    const request = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      sequenceType: "first",
      redirectUrl: "https://preview.siteinabox.nl/acme?payment=return",
      webhookUrl: "https://admin.siteinabox.nl/api/payments/mollie/webhook",
      metadata: {
        generationRunId: 500,
        tenantId: 1,
        customerEmail: "client@example.com",
        clientSlug: "acme",
        mollieCustomerId: "cst_test_123",
        sequenceType: "first",
        renewalInterval: "1 month",
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
      customerEmail: "client@example.com",
    })).rejects.toThrow("approved preview")
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ["paid", "completed"],
    ["canceled", "canceled"],
    ["pending", "pending_provider"],
    ["failed", "failed"],
    ["expired", "expired"],
  ])("maps webhook Mollie status %s to local status %s without publishing or activating", async (mollieStatus, expectedStatus) => {
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
        customerEmail: "client@example.com",
        clientSlug: "acme",
      },
    }))

    expect(result.status).toBe(expectedStatus)
    expect(run.payment).toMatchObject({
      status: expectedStatus,
      provider: "mollie",
      externalReference: "tr_test_123",
      providerStatus: mollieStatus,
    })
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "tenants" }))
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "published-site-snapshots" }))
  })

  it("reports duplicate webhook delivery while keeping the operation idempotent", async () => {
    const { payload } = createPayloadStub({
      payment: {
        status: "completed",
        provider: "mollie",
        externalReference: "tr_test_123",
        providerStatus: "paid",
      },
    })

    const result = await applyMollieWebhookPayment(payload, "tr_test_123", async () => ({
      id: "tr_test_123",
      status: "paid",
      metadata: { generationRunId: 500, tenantId: 1 },
    }))

    expect(result).toMatchObject({ ok: true, status: "completed", duplicate: true })
  })

  it("does not provision domains after a test-mode paid checkout", async () => {
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
      if (url.includes("api.mollie.com/v2/customers/cst_test_123/subscriptions")) {
        return new Response(JSON.stringify({ id: "sub_test_123", status: "active" }), { status: 201 })
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
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test_123",
        sequenceType: "first",
      },
    }))

    expect(result.status).toBe("completed")
    expect(mollieApiKeyMode()).toBe("test")
    expect(mollieDomainProvisioningEnabled()).toBe(false)
    expect(run.payment).toMatchObject({
      status: "completed",
      selectedDomain: "clientsite.nl",
      mollieSubscriptionId: "sub_test_123",
      note: "Mollie payment completed in non-live mode; domain provisioning was skipped.",
    })
    expect(run.domainOrder).toMatchObject({
      status: "ready_to_register",
      domain: "clientsite.nl",
    })
    expect(tenant).toMatchObject({
      domain: "acme.test",
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("starts domain provisioning after a live paid checkout with a selected domain", async () => {
    vi.stubEnv("MOLLIE_API_KEY", "live_xxx")
    vi.stubEnv("OPENPROVIDER_USERNAME", "user")
    vi.stubEnv("OPENPROVIDER_PASSWORD", "pass")
    vi.stubEnv("OPENPROVIDER_TECH_HANDLE", "TECH-NL")
    vi.stubEnv("OPENPROVIDER_BILLING_HANDLE", "BILL-NL")
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-account")
    vi.stubEnv("SIAB_RENDERER_TARGET_HOST", "renderer.siteinabox.nl")
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
      if (url.includes("api.mollie.com/v2/customers/cst_test_123/subscriptions")) {
        return new Response(JSON.stringify({ id: "sub_test_123", status: "active" }), { status: 201 })
      }
      if (url.includes("api.cloudflare.com/client/v4/zones") && !url.includes("dns_records")) {
        return new Response(JSON.stringify({
          success: true,
          result: {
            id: "zone_123",
            name: "clientsite.nl",
            name_servers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
          },
        }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/auth/login")) {
        return new Response(JSON.stringify({ data: { token: "op-token" } }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/customers")) {
        return new Response(JSON.stringify({ data: { handle: "OWNER-CLIENT" } }), { status: 200 })
      }
      if (url.includes("api.openprovider.eu/v1beta/domains")) {
        return new Response(JSON.stringify({ code: 0, data: { id: 9001, status: "ACT" } }), { status: 200 })
      }
      if (url.includes("dns_records")) {
        return new Response(JSON.stringify({
          success: true,
          result: { id: "record_123", name: "clientsite.nl", content: "renderer.siteinabox.nl", proxied: true },
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
        customerEmail: "client@example.com",
        clientSlug: "acme",
        selectedDomain: "clientsite.nl",
        mollieCustomerId: "cst_test_123",
        sequenceType: "first",
      },
    }))

    expect(result.status).toBe("completed")
    expect(mollieApiKeyMode()).toBe("live")
    expect(mollieDomainProvisioningEnabled()).toBe(true)
    expect(run.payment).toMatchObject({
      status: "completed",
      selectedDomain: "clientsite.nl",
      mollieCustomerId: "cst_test_123",
      mollieSubscriptionId: "sub_test_123",
    })
    expect(run.domainOrder).toMatchObject({
      status: "registered",
      domain: "clientsite.nl",
      providerReference: "9001",
      cloudflareZoneId: "zone_123",
      ownerHandle: "OWNER-CLIENT",
      adminHandle: "OWNER-CLIENT",
    })
    expect(tenant).toMatchObject({
      domain: "clientsite.nl",
      domainVerification: expect.objectContaining({ status: "verified" }),
    })
    const subscriptionCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/subscriptions"))
    expect(subscriptionCall).toBeDefined()
    expect(JSON.parse(String((subscriptionCall?.[1] as RequestInit).body))).toMatchObject({
      amount: { currency: "EUR", value: "49.00" },
      interval: "1 month",
      description: "Site in a Box monthly renewal clientsite.nl",
      metadata: expect.objectContaining({ renewalInterval: "1 month" }),
    })
  })

  it("derives monthly renewal amount from the annual first-year price when no explicit renewal amount is configured", () => {
    vi.stubEnv("MOLLIE_SITE_PAYMENT_AMOUNT", "228.00")
    vi.stubEnv("MOLLIE_SITE_PAYMENT_CURRENCY", "EUR")
    vi.stubEnv("MOLLIE_SITE_RENEWAL_AMOUNT", "")
    vi.stubEnv("MOLLIE_SITE_RENEWAL_CURRENCY", "")

    expect(mollieRenewalAmountFromEnv()).toEqual({ currency: "EUR", value: "19.00" })
  })

  it("rejects invalid webhook payloads and invalid optional signatures", async () => {
    const invalidBodyResponse = await mollieWebhookPOST(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      body: "not-an-id=1",
    }) as any)
    expect(invalidBodyResponse.status).toBe(400)

    const raw = "id=tr_test_123"
    vi.stubEnv("MOLLIE_WEBHOOK_SIGNING_SECRET", "secret")
    expect(verifyMollieWebhookSignature(raw, null)).toBe(false)
    expect(verifyMollieWebhookSignature(raw, "bad-signature")).toBe(false)

    const missingSignatureResponse = await mollieWebhookPOST(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      body: raw,
    }) as any)
    expect(missingSignatureResponse.status).toBe(401)

    const signature = crypto.createHmac("sha256", "secret").update(raw).digest("hex")
    const { payload } = createPayloadStub({
      payment: { status: "pending_provider", provider: "mollie", externalReference: "tr_test_123" },
    })
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "tr_test_123",
      status: "paid",
      metadata: { generationRunId: 500, tenantId: 1 },
    }), { status: 200 })))

    const okResponse = await mollieWebhookPOST(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      headers: { "x-mollie-signature": signature },
      body: raw,
    }) as any)
    expect(okResponse.status).toBe(200)
    expect(await okResponse.json()).toEqual({ ok: true })
  })

  it("acknowledges unknown or mismatched Mollie webhook ids without leaking internal state", async () => {
    const { payload, update } = createPayloadStub({
      payment: { status: "pending_provider", provider: "mollie", externalReference: "tr_expected" },
    })
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "tr_unknown",
      status: "paid",
      metadata: { generationRunId: 500, tenantId: 1 },
    }), { status: 200 })))

    const response = await mollieWebhookPOST(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      body: "id=tr_unknown",
    }) as any)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(update).not.toHaveBeenCalled()
  })

  it("acknowledges Mollie lookup 404 responses without exposing whether a payment is known", async () => {
    const { payload, update } = createPayloadStub()
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not found", { status: 404 })))

    const response = await mollieWebhookPOST(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      body: "id=tr_missing",
    }) as any)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(update).not.toHaveBeenCalled()
  })
})
