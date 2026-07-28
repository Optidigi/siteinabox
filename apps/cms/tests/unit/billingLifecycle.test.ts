import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  asPayload,
  matchesWhere,
  type MockDoc,
  type MockFindArgs,
  type MockUpdateArgs,
  type MockWhere,
} from "../_helpers/mockPayload"

vi.mock("@/lib/payments/molliePayments", () => ({
  createApplicationRecurringMolliePayment: vi.fn(async () => ({
    paymentAttempt: { id: 1 },
    reused: false,
  })),
}))
vi.mock("@/lib/commerce/notifications", () => ({
  ensureCommerceNotification: vi.fn(async (input: Record<string, unknown>) => ({
    id: 1,
    ...input,
  })),
}))
vi.mock("@/lib/commerce/alerts", () => ({
  recordCommerceAdminException: vi.fn(async () => undefined),
  resolveCommerceAdminException: vi.fn(async () => undefined),
}))
vi.mock("@/lib/commerce/releaseGate", () => ({
  commerceProviderWritesAllowed: vi.fn(() => true),
}))

import {
  ensureSubscriptionRenewalOrder,
  processBillingAgreement,
  scheduleCancellationAtPeriodEnd,
} from "@/lib/billing/billingLifecycle"
import { createApplicationRecurringMolliePayment } from "@/lib/payments/molliePayments"
import { ensureCommerceNotification } from "@/lib/commerce/notifications"

const baseOrigin = {
  id: 600,
  orderNumber: "SIAB-500-TEST",
  tenant: 1,
  generationRun: 500,
  state: "fulfilled",
  checkoutProfileKey: "run:500:checkout-profile:1",
  catalogVersion: "2026-07-26.1",
  contractingPartyProfileVersion: 1,
  termsVersion: "terms-v1",
  privacyVersion: "privacy-v1",
  businessUseDeclarationVersion: "business-v1",
  customerName: "Ada Lovelace",
  customerEmail: "client@example.com",
  companyName: "Acme Studio",
  billingAddress: { country: "NL" },
  packageCode: "siteinabox-monthly",
  billingPeriod: "monthly",
  renewalTerms: "Renews monthly.",
  lineItems: [],
  currency: "EUR",
  subtotalNet: 19,
  vatAmount: 3.99,
  totalGross: 22.99,
  domain: "example.nl",
  domainRegistrant: { email: "client@example.com" },
  legalDocuments: [10, 11],
  paymentStatus: "paid",
  paymentProvider: "mollie",
  createdAt: "2026-07-01T00:00:00.000Z",
}

const baseAgreement = {
  id: 900,
  idempotencyKey: "agreement-900",
  originatingOrder: 600,
  checkoutProfile: 800,
  tenant: 1,
  state: "active",
  provider: "mollie",
  providerCustomerId: "cst_test",
  providerMandateId: "mdt_test",
  catalogVersion: "2026-07-26.1",
  packageCode: "siteinabox-monthly",
  billingPeriod: "monthly",
  currency: "EUR",
  recurringNetAmountMinor: 1_900,
  renewalIntent: true,
  nextChargeAt: "2026-08-01T10:00:00.000Z",
  currentPeriodStartsAt: "2026-07-01T10:00:00.000Z",
  currentPeriodEndsAt: "2026-08-01T10:00:00.000Z",
  serviceSuspensionStatus: "none",
  reconciliationRequired: false,
  stateHistory: [{ state: "active", at: "2026-07-01T10:00:00.000Z" }],
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
}

const createStore = (input: {
  agreement?: Record<string, unknown>
  origin?: Record<string, unknown>
  tenant?: Record<string, unknown>
  orders?: MockDoc[]
  attempts?: MockDoc[]
  domains?: MockDoc[]
  cycles?: MockDoc[]
  beforeAgreementConditionalUpdate?: (state: {
    agreement: MockDoc
    orders: MockDoc[]
    attempts: MockDoc[]
  }) => void
} = {}) => {
  const agreement = { ...baseAgreement, ...input.agreement }
  const tenant = {
    id: 1,
    name: "Acme Studio",
    status: "active",
    ...input.tenant,
  }
  const orders: MockDoc[] = [{ ...baseOrigin, ...input.origin }, ...(input.orders ?? [])]
  const attempts = input.attempts ?? []
  const domains = input.domains ?? []
  const cycles = input.cycles ?? []
  const collections: Record<string, MockDoc[]> = {
    orders,
    "billing-agreements": [agreement],
    "payment-attempts": attempts,
    "managed-domains": domains,
    "domain-renewal-cycles": cycles,
    tenants: [tenant],
  }
  let nextId = 1_000
  const find = vi.fn(async ({ collection, where, sort }: MockFindArgs) => {
    let docs = (collections[collection] ?? []).filter((doc) => matchesWhere(doc, where))
    if (sort === "attemptNumber") {
      docs = [...docs].sort(
        (a, b) => Number(a.attemptNumber ?? 0) - Number(b.attemptNumber ?? 0),
      )
    }
    if (sort === "-servicePeriodEndsAt") {
      docs = [...docs].sort(
        (a, b) => String(b.servicePeriodEndsAt).localeCompare(String(a.servicePeriodEndsAt)),
      )
    }
    return { docs, totalDocs: docs.length }
  })
  const findByID = vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => {
    const doc = (collections[collection] ?? []).find((entry) => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    return doc
  })
  const create = vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    const duplicate = collection === "orders" && (collections.orders ?? []).find(
      (entry) => entry.billingCycleKey && entry.billingCycleKey === data.billingCycleKey,
    )
    if (duplicate) throw new Error("unique violation")
    const doc = { id: nextId++, ...data }
    ;(collections[collection] ??= []).push(doc)
    return doc
  })
  let conditionalHookPending = Boolean(input.beforeAgreementConditionalUpdate)
  const update = vi.fn(async ({
    collection,
    id,
    where,
    data,
  }: MockUpdateArgs & { where?: MockWhere }) => {
    if (collection === "billing-agreements" && where) {
      if (conditionalHookPending) {
        conditionalHookPending = false
        input.beforeAgreementConditionalUpdate?.({
          agreement,
          orders,
          attempts,
        })
      }
      const docs = (collections["billing-agreements"] ?? []).filter((doc) =>
        matchesWhere(doc, where)
      )
      for (const doc of docs) {
        Object.assign(doc, data)
        doc.updatedAt = new Date(
          new Date(String(doc.updatedAt)).getTime() + 1,
        ).toISOString()
      }
      return { docs, totalDocs: docs.length }
    }
    const doc = (collections[collection] ?? []).find((entry) => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    Object.assign(doc, data)
    return doc
  })
  return {
    agreement,
    tenant,
    orders,
    attempts,
    domains,
    cycles,
    update,
    payload: asPayload({
      find,
      findByID,
      create,
      update,
      jobs: { queue: vi.fn() },
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("application-created recurring billing", () => {
  it("freezes a monthly renewal order and starts exactly one first recurring attempt", async () => {
    const store = createStore()
    const result = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement as never,
      now: new Date("2026-08-01T10:00:00.000Z"),
    })

    expect(result).toEqual({ status: "due", paymentRequested: true })
    expect(store.orders[1]).toMatchObject({
      billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      subtotalNetMinor: 1_900,
      vatAmountMinor: 399,
      totalGrossMinor: 2_299,
      checkoutProfileKey: "run:500:checkout-profile:1",
      paymentStatus: "pending",
    })
    expect(store.agreement).toMatchObject({
      state: "past_due",
      graceStartedAt: "2026-08-01T10:00:00.000Z",
      graceEndsAt: "2026-08-15T10:00:00.000Z",
    })
    expect(createApplicationRecurringMolliePayment).toHaveBeenCalledOnce()
    expect(createApplicationRecurringMolliePayment).toHaveBeenCalledWith(
      store.payload,
      expect.objectContaining({ purpose: "recurring", attemptNumber: 1 }),
    )
    expect(ensureCommerceNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "payment_failed_0d" }),
    )
  })

  it("sends the day-zero failure notice only after Mollie reports a terminal attempt", async () => {
    const renewalOrder = {
      ...baseOrigin,
      id: 601,
      billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
      billingAgreement: 900,
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      state: "accepted",
      paymentStatus: "failed",
    }
    const store = createStore({
      agreement: {
        state: "past_due",
        graceStartedAt: "2026-08-01T10:00:00.000Z",
        graceEndsAt: "2026-08-15T10:00:00.000Z",
      },
      orders: [renewalOrder],
      attempts: [{
        id: 700,
        order: 601,
        purpose: "recurring",
        attemptNumber: 1,
        state: "failed",
      }],
    })

    await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement as never,
      now: new Date("2026-08-01T10:15:00.000Z"),
    })

    expect(ensureCommerceNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "payment_failed_0d",
        eventAt: "2026-08-01T10:00:00.000Z",
      }),
    )
  })

  it("freezes annual coverage at EUR 190 excl. VAT", async () => {
    const store = createStore({
      agreement: {
        packageCode: "siteinabox-annual",
        billingPeriod: "annual",
        recurringNetAmountMinor: 19_000,
        nextChargeAt: "2027-07-01T10:00:00.000Z",
        currentPeriodEndsAt: "2027-07-01T10:00:00.000Z",
      },
      origin: {
        packageCode: "siteinabox-annual",
        billingPeriod: "annual",
      },
    })
    const order = await ensureSubscriptionRenewalOrder({
      payload: store.payload,
      agreement: store.agreement as never,
    })
    expect(order).toMatchObject({
      servicePeriodEndsAt: "2028-07-01T10:00:00.000Z",
      subtotalNetMinor: 19_000,
      vatAmountMinor: 3_990,
      totalGrossMinor: 22_990,
    })
  })

  it("does not collect a future period while provider state requires reconciliation", async () => {
    const store = createStore({
      agreement: {
        state: "past_due",
        reconciliationRequired: true,
        failureReason: "Mollie payment state is chargeback.",
      },
    })

    const result = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement as never,
      now: new Date("2026-07-27T10:00:00.000Z"),
    })

    expect(result).toEqual({
      status: "waiting_reconciliation",
      paymentRequested: false,
    })
    expect(store.orders).toHaveLength(1)
    expect(createApplicationRecurringMolliePayment).not.toHaveBeenCalled()
  })

  it("is idempotent under duplicate workers and retries only at the governed dunning offset", async () => {
    const renewalOrder = {
      ...baseOrigin,
      id: 601,
      billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
      billingAgreement: 900,
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      state: "accepted",
      paymentStatus: "failed",
    }
    const store = createStore({
      agreement: {
        state: "past_due",
        graceStartedAt: "2026-08-01T10:00:00.000Z",
        graceEndsAt: "2026-08-15T10:00:00.000Z",
      },
      orders: [renewalOrder],
      attempts: [{
        id: 700,
        order: 601,
        purpose: "recurring",
        attemptNumber: 1,
        state: "failed",
      }],
    })
    vi.mocked(createApplicationRecurringMolliePayment).mockImplementationOnce(async (_payload, call) => {
      store.attempts.push({
        id: 701,
        order: 601,
        purpose: "recurring",
        attemptNumber: call.attemptNumber ?? 1,
        state: "pending_provider",
      })
      return { paymentAttempt: store.attempts.at(-1) as never, reused: false }
    })
    await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement as never,
      now: new Date("2026-08-04T10:00:00.000Z"),
    })
    await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement as never,
      now: new Date("2026-08-04T10:05:00.000Z"),
    })

    expect(createApplicationRecurringMolliePayment).toHaveBeenCalledTimes(1)
    expect(createApplicationRecurringMolliePayment).toHaveBeenCalledWith(
      store.payload,
      expect.objectContaining({ attemptNumber: 2 }),
    )
  })

  it("suspends after 14 days without mutating the customer-owned domain", async () => {
    const renewalOrder = {
      ...baseOrigin,
      id: 601,
      billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
      billingAgreement: 900,
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      state: "accepted",
      paymentStatus: "failed",
    }
    const domain = {
      id: 950,
      tenant: 1,
      domainNameAscii: "example.nl",
      state: "active",
      entitlementStatus: "active",
      authoritativeDnsStatus: "verified",
      cloudflareZoneId: "zone-example",
      cloudflareDnsRecordIds: ["mx", "spf", "dkim", "website"],
      renewalIntent: true,
    }
    const store = createStore({
      agreement: {
        state: "past_due",
        graceStartedAt: "2026-08-01T10:00:00.000Z",
        graceEndsAt: "2026-08-15T10:00:00.000Z",
      },
      orders: [renewalOrder],
      attempts: [{
        id: 700,
        order: 601,
        purpose: "recurring",
        attemptNumber: 1,
        state: "failed",
      }],
      domains: [domain],
    })
    await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement as never,
      now: new Date("2026-08-15T10:00:00.000Z"),
    })
    expect(store.tenant).toMatchObject({
      status: "suspended",
      billingSuspensionAgreement: 900,
    })
    expect(store.agreement).toMatchObject({
      state: "suspended",
      serviceSuspensionStatus: "billing_suspended",
    })
    expect(domain).toMatchObject({
      state: "active",
      entitlementStatus: "active",
      authoritativeDnsStatus: "verified",
      cloudflareZoneId: "zone-example",
      cloudflareDnsRecordIds: ["mx", "spf", "dkim", "website"],
      renewalIntent: true,
    })
    expect(ensureCommerceNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "service_suspended_14d" }),
    )
  })

  it("does not start dunning while provider writes are release-blocked", async () => {
    const store = createStore()
    const blocked = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement as never,
      now: new Date("2026-08-15T10:00:00.000Z"),
      providerWritesAllowed: () => false,
    })
    expect(blocked).toEqual({
      status: "waiting_release",
      paymentRequested: false,
    })
    expect(store.agreement).toMatchObject({
      state: "active",
      serviceSuspensionStatus: "none",
    })
    expect(store.agreement).not.toHaveProperty("graceStartedAt")
    expect(store.agreement).not.toHaveProperty("graceEndsAt")
    expect(createApplicationRecurringMolliePayment).not.toHaveBeenCalled()

    const enabled = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement as never,
      now: new Date("2026-08-15T10:05:00.000Z"),
      providerWritesAllowed: () => true,
    })
    expect(enabled).toEqual({ status: "due", paymentRequested: true })
    expect(store.agreement).toMatchObject({
      state: "past_due",
      graceStartedAt: "2026-08-15T10:05:00.000Z",
      graceEndsAt: "2026-08-29T10:05:00.000Z",
      serviceSuspensionStatus: "none",
    })
    expect(createApplicationRecurringMolliePayment).toHaveBeenCalledOnce()
  })

  it("schedules cancellation at paid period end and preserves a committed domain cycle", async () => {
    const domain = {
      id: 950,
      tenant: 1,
      domainNameAscii: "example.nl",
      state: "active",
      renewalIntent: true,
    }
    const uncovered = {
      id: 960,
      managedDomain: 950,
      billingAgreement: 900,
      state: "payment_required",
      providerSafeCutoffAt: "2027-01-01T00:00:00.000Z",
      paymentSecuredAt: null,
      stateHistory: [],
    }
    const committed = {
      id: 961,
      managedDomain: 950,
      billingAgreement: 900,
      state: "payment_committed",
      providerSafeCutoffAt: "2027-01-01T00:00:00.000Z",
      paymentSecuredAt: "2026-07-20T00:00:00.000Z",
      stateHistory: [],
    }
    const store = createStore({ domains: [domain], cycles: [uncovered, committed] })
    await scheduleCancellationAtPeriodEnd({
      payload: store.payload,
      agreementId: 900,
      tenantId: 1,
      actorUserId: 10,
      actorEmail: "owner@example.com",
      requestId: "req-1",
      now: new Date("2026-07-27T10:00:00.000Z"),
    })
    expect(store.agreement).toMatchObject({
      state: "cancellation_scheduled",
      renewalIntent: false,
      cancelAt: "2026-08-01T10:00:00.000Z",
    })
    expect(domain).toMatchObject({ renewalIntent: false, state: "active" })
    expect(uncovered).toMatchObject({ state: "cancelled" })
    expect(committed).toMatchObject({ state: "payment_committed" })
  })

  it("linearizes concurrent cancellation after a recurring collection claim", async () => {
    const claimAt = "2026-07-27T10:00:00.000Z"
    const store = createStore({
      beforeAgreementConditionalUpdate: ({ agreement, orders, attempts }) => {
        orders.push({
          ...baseOrigin,
          id: 601,
          billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
          billingAgreement: 900,
          orderKind: "subscription_renewal",
          servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
          servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
          state: "accepted",
          paymentStatus: "pending",
        })
        attempts.push({
          id: 700,
          order: 601,
          purpose: "recurring",
          attemptNumber: 1,
          state: "pending_provider",
          reconciliationRequired: true,
          createdAt: claimAt,
        })
        agreement.lastPaymentAttemptAt = claimAt
        agreement.updatedAt = "2026-07-27T10:00:00.000Z"
      },
    })

    const cancelled = await scheduleCancellationAtPeriodEnd({
      payload: store.payload,
      agreementId: 900,
      tenantId: 1,
      actorUserId: 10,
      actorEmail: "owner@example.com",
      requestId: "req-concurrent",
      now: new Date("2026-07-27T10:00:01.000Z"),
    })

    expect(store.update).toHaveBeenCalledTimes(2)
    expect(cancelled).toMatchObject({
      state: "cancellation_scheduled",
      renewalIntent: false,
      cancelAt: "2026-09-01T10:00:00.000Z",
    })
  })
})
