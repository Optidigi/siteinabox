import type { PaymentAttempt, BillingAgreement, ManagedDomain, OperationalAlert } from "@/payload-types"
import { createGeneratedPayloadStore } from "../_helpers/generatedPayloadStore"
import { createPayloadFixture, type PayloadFixtureMethod } from "../_helpers/payloadFixture"
import { payloadUpdateFixture, type PayloadUpdateOptions } from "../_helpers/payloadUpdateFixture"
import { paymentAttemptFixture, billingAgreementFixture, managedDomainFixture, operationalAlertFixture, paginatedFixture } from "../_helpers/generatedDocs"
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
  matchesWhere,
  type MockDoc,
  type MockUpdateArgs,
} from "../_helpers/mockPayload"

const NOW = new Date("2026-07-28T12:00:00.000Z")

const paymentAttempt = (): PaymentAttempt => paymentAttemptFixture({
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

const createPayloadStore = async (input?: { attempts?: PaymentAttempt[]; agreements?: BillingAgreement[]; domains?: ManagedDomain[] }) => {
  const collections: { "payment-attempts": PaymentAttempt[]; "billing-agreements": BillingAgreement[]; "managed-domains": ManagedDomain[]; "operational-alerts": OperationalAlert[] } = {
    "payment-attempts": input?.attempts ?? [], "billing-agreements": input?.agreements ?? [], "managed-domains": input?.domains ?? [], "operational-alerts": [],
  }
  const store = await createGeneratedPayloadStore({ collections, nextId: 100 })
  return { ...store, collections }
}

describe("Phase 11 commerce failure rehearsals", () => {
  it("recovers an indeterminate Mollie customer before retrying creation", async () => {
    const agreement = billingAgreementFixture({
      id: 40,
      idempotencyKey: "billing-agreement:order:20:v1",
      originatingOrder: 20,
      tenant: 1,
      provider: "mollie",
      state: "pending_first_payment",
      reconciliationRequired: true,
    })
    const store = await createPayloadStore({ agreements: [agreement] })

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

  it("keeps an indeterminate Mollie customer blocked when recovery proves no match", async () => {
    const agreement = billingAgreementFixture({
      id: 40,
      idempotencyKey: "billing-agreement:order:20:v1",
      originatingOrder: 20,
      tenant: 1,
      provider: "mollie",
      state: "pending_first_payment",
      reconciliationRequired: true,
      failureReason: "A Mollie customer provider write is in progress.",
    })
    const store = await createPayloadStore({ agreements: [agreement] })

    await expect(recoverMissingMollieCustomerReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMollieCustomers: vi.fn(async () => []),
    }, NOW.toISOString())).resolves.toEqual({ examined: 1, recovered: 0 })

    expect(agreement).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A Mollie customer provider write is in progress.",
    })
    expect(agreement).not.toHaveProperty("providerCustomerId")
    expect(store.collections["operational-alerts"]).toContainEqual(
      expect.objectContaining({
        severity: "error",
        dedupeKey:
          "commerce:payments:missing_mollie_customer_reference:40",
        metadata: { matchCount: 0 },
      }),
    )
  })

  it("requires critical manual review for ambiguous Mollie customer recovery", async () => {
    const agreement = billingAgreementFixture({
      id: 40,
      idempotencyKey: "billing-agreement:order:20:v1",
      originatingOrder: 20,
      tenant: 1,
      provider: "mollie",
      state: "pending_first_payment",
      reconciliationRequired: true,
      failureReason: "A Mollie customer provider write is in progress.",
    })
    const store = await createPayloadStore({ agreements: [agreement] })
    const matchingMetadata = {
      billingAgreementId: 40,
      orderId: 20,
      tenantId: 1,
    }

    await expect(recoverMissingMollieCustomerReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMollieCustomers: vi.fn(async () => [{
        id: "cst_ambiguous_1",
        metadata: matchingMetadata,
      }, {
        id: "cst_ambiguous_2",
        metadata: matchingMetadata,
      }]),
    }, NOW.toISOString())).resolves.toEqual({ examined: 1, recovered: 0 })

    expect(agreement).toMatchObject({
      reconciliationRequired: true,
      failureReason: "A Mollie customer provider write is in progress.",
    })
    expect(agreement).not.toHaveProperty("providerCustomerId")
    expect(store.collections["operational-alerts"]).toContainEqual(
      expect.objectContaining({
        severity: "critical",
        dedupeKey:
          "commerce:payments:duplicate_provider_customers_for_agreement:40",
        metadata: { matchCount: 2 },
      }),
    )
  })

  it("reports an internally owned customer reference and continues later recovery", async () => {
    const conflicted = billingAgreementFixture({
      id: 40,
      originatingOrder: 20,
      tenant: 1,
      provider: "mollie",
      state: "pending_first_payment",
      reconciliationRequired: true,
    })
    const later = billingAgreementFixture({
      ...conflicted,
      id: 41,
      originatingOrder: 21,
      tenant: 2,
    })
    const existingOwner = billingAgreementFixture({
      ...conflicted,
      id: 42,
      originatingOrder: 22,
      providerCustomerId: "cst_owned",
      reconciliationRequired: false,
    })
    const store = await createPayloadStore({
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
    const store = await createPayloadStore({ attempts: [attempt] })
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

  it("keeps an indeterminate payment blocked when provider recovery finds zero matches", async () => {
    const attempt = paymentAttempt()
    const store = await createPayloadStore({ attempts: [attempt] })

    await expect(recoverMissingMolliePaymentReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments: vi.fn(async () => []),
    }, NOW)).resolves.toEqual({
      examined: 1,
      recoveredPaymentIds: [],
    })

    expect(attempt).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: true,
    })
    expect(attempt).not.toHaveProperty("providerPaymentId")
    expect(store.collections["operational-alerts"]).toContainEqual(
      expect.objectContaining({
        severity: "error",
        dedupeKey:
          "commerce:payments:missing_mollie_webhook_or_reference:10",
        metadata: {},
      }),
    )
  })

  it("halts on duplicate provider matches instead of attaching an arbitrary payment", async () => {
    const attempt = paymentAttempt()
    const store = await createPayloadStore({ attempts: [attempt] })
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

  it.each([
    ["payment-attempt id", { paymentAttemptId: 999 }, {}],
    ["idempotency key", { idempotencyKey: "wrong-key" }, {}],
    ["order", { orderId: 999 }, {}],
    ["purpose", { purpose: "domain_renewal" }, {}],
    ["metadata sequence", { sequenceType: "first" }, {}],
    ["provider sequence", {}, { sequenceType: "first" }],
    ["billing agreement", { billingAgreementId: 999 }, {}],
    ["customer metadata", { mollieCustomerId: "cst_wrong" }, {}],
    ["provider customer", {}, { customerId: "cst_wrong" }],
    ["mandate metadata", { mandateId: "mdt_wrong" }, {}],
    ["provider mandate", {}, { mandateId: "mdt_wrong" }],
    ["amount", {}, { amount: { currency: "EUR", value: "23.00" } }],
    ["currency", {}, { amount: { currency: "USD", value: "22.99" } }],
  ])(
    "keeps a current recurring write blocked when related provider %s mismatches",
    async (_label, metadataOverride, paymentOverride) => {
      const attempt = paymentAttemptFixture({
        ...paymentAttempt(),
        idempotencyKey:
          "mollie:recurring:order:20:authority-v2:attempt-1",
        billingAgreement: 40,
        purpose: "recurring",
        sequenceType: "recurring",
      })
      const agreement = billingAgreementFixture({
        id: 40,
        tenant: 1,
        provider: "mollie",
        state: "active",
        providerCustomerId: "cst_expected",
        providerMandateId: "mdt_expected",
        renewalIntent: true,
        reconciliationRequired: true,
        lastPaymentAttemptAt: attempt.createdAt,
        updatedAt: "2026-07-28T11:00:01.000Z",
      })
      const store = await createPayloadStore({
        attempts: [attempt],
        agreements: [agreement],
      })
      const metadata = {
        paymentAttemptId: 10,
        orderId: 20,
        idempotencyKey: attempt.idempotencyKey,
        purpose: "recurring",
        sequenceType: "recurring",
        billingAgreementId: 40,
        mollieCustomerId: "cst_expected",
        mandateId: "mdt_expected",
        ...metadataOverride,
      }

      await expect(recoverMissingMolliePaymentReferences(store.payload, {
        providerReadsAllowed: () => true,
        listRecentMolliePayments: vi.fn(async () => [{
          id: "tr_related_mismatch",
          status: "open",
          amount: { currency: "EUR", value: "22.99" },
          customerId: "cst_expected",
          mandateId: "mdt_expected",
          sequenceType: "recurring",
          metadata,
          ...paymentOverride,
        }]),
      }, NOW)).resolves.toEqual({
        examined: 1,
        recoveredPaymentIds: [],
      })

      expect(attempt).toMatchObject({
        reconciliationRequired: true,
      })
      expect(attempt).not.toHaveProperty("providerPaymentId")
      expect(agreement).toMatchObject({
        reconciliationRequired: true,
        lastPaymentAttemptAt: attempt.createdAt,
      })
      expect(store.collections["operational-alerts"]).toContainEqual(
        expect.objectContaining({
          severity: "critical",
          dedupeKey:
            "commerce:payments:mollie_payment_recovery_authority_ambiguous:10",
          metadata: {
            exactMatchCount: 0,
            relatedCandidateCount: 1,
          },
        }),
      )
    },
  )

  it("recovers one current recurring payment only when its complete frozen authority matches", async () => {
    const attempt = paymentAttemptFixture({
      ...paymentAttempt(),
      idempotencyKey:
        "mollie:recurring:order:20:authority-v2:attempt-1",
      billingAgreement: 40,
      purpose: "recurring",
      sequenceType: "recurring",
    })
    const agreement = billingAgreementFixture({
      id: 40,
      tenant: 1,
      provider: "mollie",
      state: "active",
      providerCustomerId: "cst_expected",
      providerMandateId: "mdt_expected",
      renewalIntent: true,
      reconciliationRequired: true,
      lastPaymentAttemptAt: attempt.createdAt,
      updatedAt: "2026-07-28T11:00:01.000Z",
    })
    const store = await createPayloadStore({
      attempts: [attempt],
      agreements: [agreement],
    })

    await expect(recoverMissingMolliePaymentReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments: vi.fn(async () => [{
        id: "tr_exact",
        status: "open",
        amount: { currency: "EUR", value: "22.99" },
        customerId: "cst_expected",
        mandateId: "mdt_expected",
        sequenceType: "recurring",
        metadata: {
          paymentAttemptId: 10,
          orderId: 20,
          idempotencyKey: attempt.idempotencyKey,
          purpose: "recurring",
          sequenceType: "recurring",
          billingAgreementId: 40,
          mollieCustomerId: "cst_expected",
          mandateId: "mdt_expected",
        },
      }]),
    }, NOW)).resolves.toEqual({
      examined: 1,
      recoveredPaymentIds: ["tr_exact"],
    })

    expect(attempt).toMatchObject({
      providerPaymentId: "tr_exact",
      reconciliationRequired: true,
    })
    expect(store.collections["operational-alerts"]).toHaveLength(0)
  })

  it("opens a recurring retry only when the provider result is truly absent", async () => {
    const attempt = paymentAttemptFixture({
      ...paymentAttempt(),
      idempotencyKey:
        "mollie:recurring:order:20:authority-v2:attempt-1",
      billingAgreement: 40,
      purpose: "recurring",
      sequenceType: "recurring",
    })
    const agreement = billingAgreementFixture({
      id: 40,
      tenant: 1,
      provider: "mollie",
      state: "active",
      providerCustomerId: "cst_expected",
      providerMandateId: "mdt_expected",
      renewalIntent: true,
      reconciliationRequired: true,
      lastPaymentAttemptAt: attempt.createdAt,
      updatedAt: "2026-07-28T11:00:01.000Z",
    })
    const store = await createPayloadStore({
      attempts: [attempt],
      agreements: [agreement],
    })

    await expect(recoverMissingMolliePaymentReferences(store.payload, {
      providerReadsAllowed: () => true,
      listRecentMolliePayments: vi.fn(async () => []),
    }, NOW)).resolves.toEqual({
      examined: 1,
      recoveredPaymentIds: [],
    })

    expect(attempt).toMatchObject({
      state: "pending_provider",
      reconciliationRequired: false,
      failureCode: "provider_absence_reconciled",
    })
    expect(agreement).toMatchObject({
      reconciliationRequired: false,
      lastPaymentAttemptAt: null,
    })
  })

  it("reports an internally owned payment reference and continues later recovery", async () => {
    const conflicted = paymentAttempt()
    const later = paymentAttemptFixture({
      ...paymentAttempt(),
      id: 11,
      idempotencyKey: "mollie:first-payment:order:21:v1",
      order: 21,
    })
    const existingOwner = {
      ...paymentAttempt(),
      id: 12,
      idempotencyKey: "existing-owner",
      order: 22,
      providerPaymentId: "tr_owned",
      reconciliationRequired: false,
    }
    const store = await createPayloadStore({
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
    const store = await createPayloadStore({ attempts: [attempt] })
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
    const store = await createPayloadStore({ attempts: [attempt] })

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
    const store = await createPayloadStore({
      domains: [managedDomainFixture({
        id: 30,
        tenant: 1,
        state: "active",
        custodyStatus: "managed",
        expiresAt: "2026-08-02T12:00:00.000Z",
        renewalIntent: true,
      })],
    })

    await expect(reconcileOpenProviderBalanceAlert(store.payload, {
      providerReadsAllowed: () => true,
      loginOpenProvider: vi.fn(async () => "token"),
      getOpenProviderResellerBalance: vi.fn(async () => ({
        availableAmount: 25,
        reservedAmount: 5,
        currency: "EUR",
      })),
    }, { NODE_ENV: "test",
      OPENPROVIDER_MIN_BALANCE_EUR: "100",
    } satisfies NodeJS.ProcessEnv, NOW.toISOString()))
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
    const store = await createPayloadStore()

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
    const alert = operationalAlertFixture({
      id: 90,
      dedupeKey: "commerce:payments:stale_mollie_synchronization:10",
      occurrenceCount: 1,
      status: "open",
    })
    let findCount = 0
    const update = vi.fn(async ({ data }: PayloadUpdateOptions) => Object.assign(alert, data))
    const payload = createPayloadFixture({
      find: vi.fn<PayloadFixtureMethod<"find">>(async () => {
        findCount += 1
        return paginatedFixture(findCount === 1 ? [] : [alert])
      }),
      create: vi.fn(async () => {
        const error = new Error(
          "duplicate key value violates unique constraint operational_alerts_dedupe_key_idx",
        ) as Error & { code: string }
        error.code = "23505"
        throw error
      }),
      update: payloadUpdateFixture(update),
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
