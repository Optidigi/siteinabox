import { describe, expect, it, vi } from "vitest"

import {
  recordCommerceAdminException,
  sanitizeCommerceAlertMetadata,
} from "@/lib/commerce/alerts"
import {
  reconcileDomainExpiryAlerts,
  reconcileOpenProviderBalanceAlert,
  recoverMissingMollieCustomerReferences,
  recoverMissingMolliePaymentReferences,
} from "@/lib/commerce/reconciliation"
import {
  asPayload,
  matchesWhere,
  type MockCreateArgs,
  type MockDoc,
  type MockFindArgs,
  type MockUpdateArgs,
} from "../_helpers/mockPayload"

const NOW = new Date("2026-07-28T12:00:00.000Z")

const paymentAttempt = (): MockDoc => ({
  id: 10,
  idempotencyKey: "mollie:first-payment:order:20:v1",
  order: 20,
  tenant: 1,
  attemptNumber: 1,
  state: "pending_provider",
  purpose: "first_payment",
  provider: "mollie",
  currency: "EUR",
  netAmountMinor: 1_900,
  vatAmountMinor: 399,
  grossAmountMinor: 2_299,
  reconciliationRequired: true,
  stateHistory: [],
  createdAt: "2026-07-28T11:00:00.000Z",
})

const createPayloadStore = (input?: {
  attempts?: MockDoc[]
  agreements?: MockDoc[]
  domains?: MockDoc[]
}) => {
  const collections: Record<string, MockDoc[]> = {
    "payment-attempts": input?.attempts ?? [],
    "billing-agreements": input?.agreements ?? [],
    "managed-domains": input?.domains ?? [],
    "operational-alerts": [],
  }
  let nextId = 100
  const find = vi.fn(async ({ collection, where }: MockFindArgs) => {
    const docs = (collections[collection] ?? []).filter((doc) =>
      matchesWhere(doc, where)
    )
    return { docs, totalDocs: docs.length }
  })
  const create = vi.fn(async ({ collection, data }: MockCreateArgs) => {
    const doc = { id: nextId++, ...data }
    ;(collections[collection] ??= []).push(doc)
    return doc
  })
  const update = vi.fn(async ({ collection, id, data }: MockUpdateArgs) => {
    const doc = (collections[collection] ?? []).find(
      (candidate) => String(candidate.id) === String(id),
    )
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    Object.assign(doc, data)
    return doc
  })
  return {
    collections,
    find,
    create,
    update,
    payload: asPayload({ find, create, update }),
  }
}

describe("Phase 11 commerce failure rehearsals", () => {
  it("recovers an indeterminate Mollie customer before retrying creation", async () => {
    const agreement: MockDoc = {
      id: 40,
      idempotencyKey: "billing-agreement:order:20:v1",
      originatingOrder: 20,
      tenant: 1,
      provider: "mollie",
      state: "pending_first_payment",
      reconciliationRequired: true,
    }
    const store = createPayloadStore({ agreements: [agreement] })

    await expect(recoverMissingMollieCustomerReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMollieCustomers: vi.fn(async () => [{
        id: "cst_recovered",
        metadata: {
          billingAgreementId: 40,
          orderId: 20,
          tenantId: 1,
        },
      }]),
    }, NOW.toISOString())).resolves.toEqual({ examined: 1, recovered: 1 })

    expect(agreement).toMatchObject({
      providerCustomerId: "cst_recovered",
      reconciliationRequired: false,
      failureReason: null,
    })
  })

  it("reports an internally owned customer reference and continues later recovery", async () => {
    const conflicted: MockDoc = {
      id: 40,
      originatingOrder: 20,
      tenant: 1,
      provider: "mollie",
      state: "pending_first_payment",
      reconciliationRequired: true,
    }
    const later: MockDoc = {
      ...conflicted,
      id: 41,
      originatingOrder: 21,
      tenant: 2,
    }
    const existingOwner: MockDoc = {
      ...conflicted,
      id: 42,
      originatingOrder: 22,
      providerCustomerId: "cst_owned",
      reconciliationRequired: false,
    }
    const store = createPayloadStore({
      agreements: [conflicted, later, existingOwner],
    })
    await expect(recoverMissingMollieCustomerReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMollieCustomers: vi.fn(async () => [{
        id: "cst_owned",
        metadata: {
          billingAgreementId: 40,
          orderId: 20,
          tenantId: 1,
        },
      }, {
        id: "cst_later",
        metadata: {
          billingAgreementId: 41,
          orderId: 21,
          tenantId: 2,
        },
      }]),
    }, NOW.toISOString())).resolves.toEqual({ examined: 2, recovered: 1 })
    expect(conflicted).not.toHaveProperty("providerCustomerId")
    expect(existingOwner.providerCustomerId).toBe("cst_owned")
    expect(later.providerCustomerId).toBe("cst_later")
    expect(store.collections["operational-alerts"]).toContainEqual(
      expect.objectContaining({
        severity: "critical",
        dedupeKey:
          "commerce:payments:provider_customer_reference_owned_elsewhere:40",
      }),
    )
  })

  it("recovers a missing webhook/provider reference without creating another payment", async () => {
    const attempt = paymentAttempt()
    const store = createPayloadStore({ attempts: [attempt] })
    const listRecentMolliePayments = vi.fn(async () => [{
      id: "tr_recovered",
      status: "paid",
      amount: { currency: "EUR", value: "22.99" },
      metadata: {
        paymentAttemptId: 10,
        orderId: 20,
        idempotencyKey: "mollie:first-payment:order:20:v1",
      },
    }])

    const result = await recoverMissingMolliePaymentReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments,
    }, NOW)

    expect(result).toEqual({
      examined: 1,
      recoveredPaymentIds: ["tr_recovered"],
    })
    expect(attempt).toMatchObject({
      providerPaymentId: "tr_recovered",
      providerStatus: "paid",
      reconciliationRequired: true,
    })
    expect(listRecentMolliePayments).toHaveBeenCalledTimes(1)
    expect(store.create).not.toHaveBeenCalledWith(expect.objectContaining({
      collection: "payment-attempts",
    }))
  })

  it("halts on duplicate provider matches instead of attaching an arbitrary payment", async () => {
    const attempt = paymentAttempt()
    const store = createPayloadStore({ attempts: [attempt] })
    const matchingPayment = (id: string) => ({
      id,
      status: "open",
      amount: { currency: "EUR", value: "22.99" },
      metadata: {
        paymentAttemptId: 10,
        orderId: 20,
        idempotencyKey: "mollie:first-payment:order:20:v1",
      },
    })

    const result = await recoverMissingMolliePaymentReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments: vi.fn(async () => [
        matchingPayment("tr_duplicate_1"),
        matchingPayment("tr_duplicate_2"),
      ]),
    }, NOW)

    expect(result.recoveredPaymentIds).toEqual([])
    expect(attempt).not.toHaveProperty("providerPaymentId")
    expect(store.collections["operational-alerts"]).toContainEqual(
      expect.objectContaining({
        severity: "critical",
        dedupeKey:
          "commerce:payments:duplicate_provider_payments_for_attempt:10",
        metadata: { matchCount: 2 },
      }),
    )
  })

  it("reports an internally owned payment reference and continues later recovery", async () => {
    const conflicted = paymentAttempt()
    const later: MockDoc = {
      ...paymentAttempt(),
      id: 11,
      idempotencyKey: "mollie:first-payment:order:21:v1",
      order: 21,
    }
    const existingOwner = {
      ...paymentAttempt(),
      id: 12,
      idempotencyKey: "existing-owner",
      order: 22,
      providerPaymentId: "tr_owned",
      reconciliationRequired: false,
    }
    const store = createPayloadStore({
      attempts: [conflicted, later, existingOwner],
    })
    const result = await recoverMissingMolliePaymentReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments: vi.fn(async () => [{
        id: "tr_owned",
        status: "open",
        amount: { currency: "EUR", value: "22.99" },
        metadata: {
          paymentAttemptId: 10,
          orderId: 20,
          idempotencyKey: conflicted.idempotencyKey,
        },
      }, {
        id: "tr_later",
        status: "paid",
        amount: { currency: "EUR", value: "22.99" },
        metadata: {
          paymentAttemptId: 11,
          orderId: 21,
          idempotencyKey: later.idempotencyKey,
        },
      }]),
    }, NOW)
    expect(result).toEqual({
      examined: 2,
      recoveredPaymentIds: ["tr_later"],
    })
    expect(conflicted).not.toHaveProperty("providerPaymentId")
    expect(existingOwner.providerPaymentId).toBe("tr_owned")
    expect(later.providerPaymentId).toBe("tr_later")
    expect(store.collections["operational-alerts"]).toContainEqual(
      expect.objectContaining({
        severity: "critical",
        dedupeKey:
          "commerce:payments:provider_payment_reference_owned_elsewhere:10",
      }),
    )
  })

  it("re-reads ownership after a concurrent payment-reference unique race", async () => {
    const attempt = paymentAttempt()
    const store = createPayloadStore({ attempts: [attempt] })
    store.update.mockImplementationOnce(async () => {
      attempt.providerPaymentId = "tr_raced"
      const error = new Error("duplicate key value violates unique constraint") as
        Error & { code: string }
      error.code = "23505"
      throw error
    })
    await expect(recoverMissingMolliePaymentReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments: vi.fn(async () => [{
        id: "tr_raced",
        status: "open",
        amount: { currency: "EUR", value: "22.99" },
        metadata: {
          paymentAttemptId: 10,
          orderId: 20,
          idempotencyKey: attempt.idempotencyKey,
        },
      }]),
    }, NOW)).resolves.toEqual({
      examined: 1,
      recoveredPaymentIds: ["tr_raced"],
    })
    expect(store.collections["operational-alerts"]).toHaveLength(0)
  })

  it("fails open to later reconciliation work when Mollie listing is unavailable", async () => {
    const attempt = paymentAttempt()
    const store = createPayloadStore({ attempts: [attempt] })

    await expect(recoverMissingMolliePaymentReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments: vi.fn(async () => {
        throw new Error("provider unavailable")
      }),
    }, NOW)).resolves.toEqual({
      examined: 1,
      recoveredPaymentIds: [],
    })
    expect(attempt).not.toHaveProperty("providerPaymentId")
    expect(store.collections["operational-alerts"]).toContainEqual(
      expect.objectContaining({
        dedupeKey:
          "commerce:payments:mollie_payment_list_recovery_failed:mollie-account",
        severity: "error",
      }),
    )
  })

  it("raises low provider-balance and imminent domain-expiry alerts without PII", async () => {
    const store = createPayloadStore({
      domains: [{
        id: 30,
        tenant: 1,
        state: "active",
        custodyStatus: "managed",
        expiresAt: "2026-08-02T12:00:00.000Z",
        renewalIntent: true,
      }],
    })

    await expect(reconcileOpenProviderBalanceAlert(store.payload, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      getOpenProviderResellerBalance: vi.fn(async () => ({
        availableAmount: 25,
        reservedAmount: 5,
        currency: "EUR",
      })),
    }, {
      OPENPROVIDER_MIN_BALANCE_EUR: "100",
    } as unknown as NodeJS.ProcessEnv, NOW.toISOString()))
      .resolves.toBe("low")
    await expect(reconcileDomainExpiryAlerts(store.payload, NOW))
      .resolves.toEqual({ examined: 1, alerts: 1 })

    expect(store.collections["operational-alerts"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dedupeKey: "commerce:domains:openprovider_balance_low:openprovider-account",
          severity: "critical",
        }),
        expect.objectContaining({
          dedupeKey: "commerce:domains:domain_expiry_risk:30",
          severity: "critical",
        }),
      ]),
    )
    expect(sanitizeCommerceAlertMetadata({
      customerEmail: "customer@example.com",
      error: "Failed for customer@example.com",
      token: "secret",
      count: 2,
    })).toEqual({
      error: "Failed for [redacted-email]",
      count: 2,
    })
  })

  it("uses zero as the default operational balance alert threshold", async () => {
    const store = createPayloadStore()

    await expect(reconcileOpenProviderBalanceAlert(store.payload, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      getOpenProviderResellerBalance: vi.fn(async () => ({
        availableAmount: 0,
        reservedAmount: 0,
        currency: "EUR",
      })),
    }, {} as NodeJS.ProcessEnv, NOW.toISOString())).resolves.toBe("healthy")

    expect(store.collections["operational-alerts"]).toHaveLength(0)
  })

  it("coalesces a concurrent alert-create race on the unique dedupe key", async () => {
    const alert: MockDoc = {
      id: 90,
      dedupeKey: "commerce:payments:stale_mollie_synchronization:10",
      occurrenceCount: 1,
      status: "open",
    }
    let findCount = 0
    const update = vi.fn(async ({ data }: MockUpdateArgs) => ({
      ...alert,
      ...data,
    }))
    const payload = asPayload({
      find: vi.fn(async () => {
        findCount += 1
        return {
          docs: findCount === 1 ? [] : [alert],
          totalDocs: findCount === 1 ? 0 : 1,
        }
      }),
      create: vi.fn(async () => {
        const error = new Error(
          "duplicate key value violates unique constraint operational_alerts_dedupe_key_idx",
        ) as Error & { code: string }
        error.code = "23505"
        throw error
      }),
      update,
    })

    await expect(recordCommerceAdminException({
      payload,
      source: "payments",
      code: "stale_mollie_synchronization",
      message: "Mollie synchronization remains stale.",
      subjectId: 10,
      now: NOW.toISOString(),
    })).resolves.toBeUndefined()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "operational-alerts",
      id: 90,
      data: expect.objectContaining({ occurrenceCount: 2 }),
    }))
  })
})
