import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  asPayload,
  matchesWhere,
  type MockDoc,
  type MockFindArgs,
  type MockUpdateArgs,
} from "../_helpers/mockPayload"

const { createMolliePayment } = vi.hoisted(() => ({
  createMolliePayment: vi.fn(),
}))

vi.mock("@/lib/payments/mollieAdapter", () => ({
  MollieApiError: class MollieApiError extends Error {
    status = 500
  },
  createMollieCustomer: vi.fn(),
  createMolliePayment,
  createMollieRefund: vi.fn(),
  publicCmsOrigin: () => "https://cms.siteinabox.nl",
  retrieveMollieMandate: vi.fn(),
  retrieveMolliePayment: vi.fn(),
}))

import { createSupplementalMigrationMollieCheckout } from "@/lib/payments/molliePayments"

describe("supplemental assisted-migration Mollie payment", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("MOLLIE_API_KEY", "test_xxx")
    vi.stubEnv("COMMERCE_RELEASE_STAGE", "sandbox")
    vi.stubEnv("COMMERCE_RELEASE_EVIDENCE_VERSION", "phase11-2026-07-27.1")
    vi.stubEnv("COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED", "1")
    vi.stubEnv("OPENPROVIDER_API_BASE_URL", "https://sandbox.openprovider.test/v1beta")
    vi.stubEnv("CLOUDFLARE_API_BASE_URL", "https://sandbox.cloudflare.test/client/v4")
  })

  it("creates one idempotent one-off attempt from the frozen supplemental order", async () => {
    const collections: Record<string, MockDoc[]> = {
      orders: [{
        id: 70,
        orderNumber: "SIAB-MIG-SUP-10-1",
        tenant: 1,
        state: "accepted",
        orderKind: "migration_supplemental",
        supplementalForMigration: 10,
        quoteEvidence: {
          schemaVersion: 1,
          kind: "migration_assisted_standard_supplemental",
          migrationId: 10,
          originatingOrderId: 20,
          catalogVersion: "2026-07-26.1",
          classification: "assisted_standard",
          workCause: "customer_migration",
          workScope: "Import complete zone.",
          domain: "example.nl",
          unit: "per_domain",
          quantity: 1,
          lineItemCode: "migration-assisted-standard-per-domain",
          amount: {
            currency: "EUR",
            netAmountMinor: 4_900,
            vatAmountMinor: 1_029,
            grossAmountMinor: 5_929,
          },
          acceptedAt: "2026-07-28T10:00:00.000Z",
        },
        currency: "EUR",
        subtotalNetMinor: 4_900,
        vatAmountMinor: 1_029,
        totalGrossMinor: 5_929,
        domain: "example.nl",
        paymentStatus: "pending",
      }],
      "payment-attempts": [],
    }
    let nextId = 100
    const find = vi.fn(async ({ collection, where }: MockFindArgs) => {
      const docs = (collections[collection] ?? []).filter((doc) =>
        matchesWhere(doc, where),
      )
      return { docs, totalDocs: docs.length }
    })
    const findByID = vi.fn(async ({
      collection,
      id,
    }: {
      collection: string
      id: string | number
    }) => {
      const doc = (collections[collection] ?? []).find(
        (entry) => String(entry.id) === String(id),
      )
      if (!doc) throw new Error(`Missing ${collection} ${id}`)
      return doc
    })
    const create = vi.fn(async ({
      collection,
      data,
    }: {
      collection: string
      data: Record<string, unknown>
    }) => {
      const doc = { id: nextId++, ...data }
      ;(collections[collection] ??= []).push(doc)
      return doc
    })
    const update = vi.fn(async ({ collection, id, data }: MockUpdateArgs) => {
      const doc = (collections[collection] ?? []).find(
        (entry) => String(entry.id) === String(id),
      )
      if (!doc) throw new Error(`Missing ${collection} ${id}`)
      Object.assign(doc, data)
      return doc
    })
    const payload = asPayload({ find, findByID, create, update })
    createMolliePayment.mockResolvedValue({
      id: "tr_supplemental",
      status: "open",
      _links: { checkout: { href: "https://www.mollie.com/checkout/test" } },
    })

    const first = await createSupplementalMigrationMollieCheckout(payload, {
      orderId: 70,
      redirectUrl: "https://cms.siteinabox.nl/migrations/10",
    })
    const second = await createSupplementalMigrationMollieCheckout(payload, {
      orderId: 70,
      redirectUrl: "https://cms.siteinabox.nl/migrations/10",
    })

    expect(first).toMatchObject({
      checkoutUrl: "https://www.mollie.com/checkout/test",
      reused: false,
      paymentAttempt: {
        purpose: "supplemental",
        sequenceType: "oneoff",
        netAmountMinor: 4_900,
        vatAmountMinor: 1_029,
        grossAmountMinor: 5_929,
      },
    })
    expect(second.reused).toBe(true)
    expect(createMolliePayment).toHaveBeenCalledTimes(1)
    expect(createMolliePayment).toHaveBeenCalledWith(expect.objectContaining({
      sequenceType: "oneoff",
      idempotencyKey: "mollie:supplemental:order:70:authority-v3:attempt-1",
      metadata: expect.objectContaining({ migrationId: 10, orderId: 70 }),
    }))
    expect(collections.orders![0]).toMatchObject({
      paymentStatus: "open",
      providerPaymentId: "tr_supplemental",
    })

    Object.assign(first.paymentAttempt, {
      state: "cancelled",
      reconciliationRequired: false,
      checkoutUrl: null,
    })
    Object.assign(collections.orders![0]!, {
      paymentStatus: "cancelled",
      providerPaymentId: null,
    })
    createMolliePayment.mockResolvedValueOnce({
      id: "tr_supplemental_retry",
      status: "open",
      _links: { checkout: { href: "https://www.mollie.com/checkout/retry" } },
    })
    const retry = await createSupplementalMigrationMollieCheckout(payload, {
      orderId: 70,
      redirectUrl: "https://cms.siteinabox.nl/migrations/10",
    })
    expect(retry).toMatchObject({
      reused: false,
      checkoutUrl: "https://www.mollie.com/checkout/retry",
      paymentAttempt: {
        attemptNumber: 2,
        idempotencyKey:
          "mollie:supplemental:order:70:authority-v3:attempt-2",
      },
    })
    expect(collections["payment-attempts"]).toHaveLength(2)
    expect(createMolliePayment).toHaveBeenCalledTimes(2)
  })
})
