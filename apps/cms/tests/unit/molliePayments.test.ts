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
import { verifyMollieWebhookSignature } from "@/lib/payments/mollieAdapter"
import { POST as mollieWebhookPOST } from "@/app/(payload)/api/payments/mollie/webhook/route"

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
    vi.stubEnv("SITE_URL", "https://admin.siteinabox.nl")
    vi.stubEnv("MOLLIE_WEBHOOK_BASE_URL", "")
    vi.stubEnv("MOLLIE_WEBHOOK_SIGNING_SECRET", "")
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
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
    }), { status: 201 })))
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
    expect(fetch).toHaveBeenCalledWith("https://api.mollie.com/v2/payments", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer test_xxx",
        "Idempotency-Key": "siab-run-500-customer-client@example.com",
      }),
    }))
    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      redirectUrl: "https://preview.siteinabox.nl/acme?payment=return",
      webhookUrl: "https://admin.siteinabox.nl/api/payments/mollie/webhook",
      metadata: {
        generationRunId: 500,
        tenantId: 1,
        customerEmail: "client@example.com",
        clientSlug: "acme",
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
        }),
      },
    }))
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

  it("rejects invalid webhook payloads and invalid optional signatures", async () => {
    const invalidBodyResponse = await mollieWebhookPOST(new Request("https://admin.siteinabox.nl/api/payments/mollie/webhook", {
      method: "POST",
      body: "not-an-id=1",
    }) as any)
    expect(invalidBodyResponse.status).toBe(400)

    const raw = "id=tr_test_123"
    vi.stubEnv("MOLLIE_WEBHOOK_SIGNING_SECRET", "secret")
    expect(verifyMollieWebhookSignature(raw, "bad-signature")).toBe(false)

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
