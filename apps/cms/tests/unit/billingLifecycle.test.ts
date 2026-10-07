import { paymentAttemptFixture, tenantFixture, orderFixture, managedDomainFixture } from "../_helpers/generatedDocs"
import { validRenewalCycle } from "../_helpers/commerceBuilders"
import { createInitializedTestPayload } from "../_helpers/testPayload"
import { payloadUpdateFixture, type PayloadUpdateOptions } from "../_helpers/payloadUpdateFixture"
import { asDocRecord } from "../_helpers/payloadApi"
import { paginatedFixture } from "../_helpers/generatedDocs"
import type { Payload } from "payload"
import type { BillingAgreement, Order, PaymentAttempt, ManagedDomain, DomainRenewalCycle, Tenant } from "@/payload-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
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

const baseOrigin = orderFixture({
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
})

const baseAgreement: BillingAgreement = {
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

const createStore = async (input: {
  agreement?: Partial<BillingAgreement>
  origin?: Partial<Order>
  tenant?: Partial<Tenant>
  orders?: Order[]
  attempts?: PaymentAttempt[]
  domains?: ManagedDomain[]
  cycles?: DomainRenewalCycle[]
  beforeAgreementConditionalUpdate?: (state: {
    agreement: BillingAgreement
    orders: Order[]
    attempts: PaymentAttempt[]
  }) => void
  beforeRenewalCycleConditionalUpdate?: (state: {
    cycles: DomainRenewalCycle[]
  }) => void
  failManagedDomainUpdateOnce?: boolean
} = {}) => {
  const agreement = { ...baseAgreement, ...input.agreement }
  const tenant = tenantFixture({
    id: 1,
    name: "Acme Studio",
    status: "active",
    ...input.tenant,
  })
  const orders: Order[] = [orderFixture({ ...baseOrigin, ...input.origin }), ...(input.orders ?? [])]
  const attempts = input.attempts ?? []
  const domains = input.domains ?? []
  const cycles = input.cycles ?? []
  type Doc = Order | BillingAgreement | PaymentAttempt | ManagedDomain | DomainRenewalCycle | Tenant
  const collections: Record<string, Doc[]> = {
    orders,
    "billing-agreements": [agreement],
    "payment-attempts": attempts,
    "managed-domains": domains,
    "domain-renewal-cycles": cycles,
    tenants: [tenant],
  }
  let nextId = 1_000
  const find = vi.fn(async ({ collection, where, sort }: Parameters<Payload["find"]>[0]) => {
    let docs = (collections[collection] ?? []).filter((doc) => matchesWhere(asDocRecord(doc), where))
    if (sort === "attemptNumber") {
      docs = [...docs].sort(
        (a, b) => Number(asDocRecord(a).attemptNumber ?? 0) - Number(asDocRecord(b).attemptNumber ?? 0),
      )
    }
    if (sort === "-servicePeriodEndsAt") {
      docs = [...docs].sort(
        (a, b) => String(asDocRecord(b).servicePeriodEndsAt).localeCompare(String(asDocRecord(a).servicePeriodEndsAt)),
      )
    }
    return paginatedFixture(docs, { totalDocs: docs.length })
  })
  const findByID = vi.fn(async ({ collection, id }: Parameters<Payload["findByID"]>[0]) => {
    const doc = (collections[collection] ?? []).find((entry) => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    return doc
  })
  const create = vi.fn(async ({ collection, data }: Parameters<Payload["create"]>[0]) => {
    if (collection !== "orders") throw new Error("Unexpected create " + collection)
    const key = asDocRecord(data).billingCycleKey
    if (orders.some(entry => entry.billingCycleKey && entry.billingCycleKey === key)) throw new Error("unique violation")
    const doc = orderFixture({ id: nextId++ })
    Object.assign(doc, data)
    orders.push(doc)
    return doc
  })
  let conditionalHookPending = Boolean(input.beforeAgreementConditionalUpdate)
  let renewalCycleHookPending = Boolean(input.beforeRenewalCycleConditionalUpdate)
  let managedDomainFailurePending = Boolean(input.failManagedDomainUpdateOnce)
  const update = vi.fn(async ({
    collection,
    id,
    where,
    data,
  }: PayloadUpdateOptions) => {
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
        matchesWhere(asDocRecord(doc), where)
      )
      for (const doc of docs) {
        Object.assign(doc, data)
        doc.updatedAt = new Date(
          new Date(String(doc.updatedAt)).getTime() + 1,
        ).toISOString()
      }
      return { docs, errors: [], totalDocs: docs.length }
    }
    if (collection === "domain-renewal-cycles" && where) {
      if (renewalCycleHookPending) {
        renewalCycleHookPending = false
        input.beforeRenewalCycleConditionalUpdate?.({ cycles })
      }
      const docs = cycles.filter((doc) => matchesWhere(asDocRecord(doc), where))
      for (const doc of docs) Object.assign(doc, data)
      return { docs, errors: [], totalDocs: docs.length }
    }
    if (collection === "managed-domains" && managedDomainFailurePending) {
      managedDomainFailurePending = false
      throw new Error("injected managed-domain update failure")
    }
    const doc = (collections[collection] ?? []).find((entry) => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    Object.assign(doc, data)
    return doc
  })
  const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(find)
  vi.spyOn(payload, "findByID").mockImplementation(findByID)
  vi.spyOn(payload, "create").mockImplementation(create)
  vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(update))
  vi.spyOn(payload.jobs, "queue").mockResolvedValue({ id: 1, input: {}, totalTried: 0, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" })
  for (const method of ["warn", "error", "info"] as const) vi.spyOn(payload.logger, method)
  return { agreement, tenant, orders, attempts, domains, cycles, update, payload }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("application-created recurring billing", () => {
  it("freezes a monthly renewal order and starts exactly one first recurring attempt", async () => {
    const store = await createStore()
    const result = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
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
    const renewalOrder = orderFixture({
      ...baseOrigin,
      id: 601,
      billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
      billingAgreement: 900,
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      state: "accepted",
      paymentStatus: "failed",
    })
    const store = await createStore({
      agreement: {
        state: "past_due",
        graceStartedAt: "2026-08-01T10:00:00.000Z",
        graceEndsAt: "2026-08-15T10:00:00.000Z",
      },
      orders: [renewalOrder],
      attempts: [paymentAttemptFixture({
        id: 700,
        order: 601,
        purpose: "recurring",
        attemptNumber: 1,
        state: "failed",
      })],
    })

    await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
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
    const store = await createStore({
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
      agreement: store.agreement,
    })
    expect(order).toMatchObject({
      servicePeriodEndsAt: "2028-07-01T10:00:00.000Z",
      subtotalNetMinor: 19_000,
      vatAmountMinor: 3_990,
      totalGrossMinor: 22_990,
    })
  })

  it("does not collect a future period while provider state requires reconciliation", async () => {
    const store = await createStore({
      agreement: {
        state: "past_due",
        reconciliationRequired: true,
        failureReason: "Mollie payment state is chargeback.",
      },
    })

    const result = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
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
    const renewalOrder = orderFixture({
      ...baseOrigin,
      id: 601,
      billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
      billingAgreement: 900,
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      state: "accepted",
      paymentStatus: "failed",
    })
    const store = await createStore({
      agreement: {
        state: "past_due",
        graceStartedAt: "2026-08-01T10:00:00.000Z",
        graceEndsAt: "2026-08-15T10:00:00.000Z",
      },
      orders: [renewalOrder],
      attempts: [paymentAttemptFixture({
        id: 700,
        order: 601,
        purpose: "recurring",
        attemptNumber: 1,
        state: "failed",
      })],
    })
    vi.mocked(createApplicationRecurringMolliePayment).mockImplementationOnce(async (_payload, call) => {
      const paymentAttempt = paymentAttemptFixture({
        id: 701,
        order: 601,
        purpose: "recurring",
        attemptNumber: call.attemptNumber ?? 1,
        state: "pending_provider",
      })
      store.attempts.push(paymentAttemptFixture({ ...paymentAttempt }))
      return { paymentAttempt, reused: false }
    })
    await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
      now: new Date("2026-08-04T10:00:00.000Z"),
    })
    await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
      now: new Date("2026-08-04T10:05:00.000Z"),
    })

    expect(createApplicationRecurringMolliePayment).toHaveBeenCalledTimes(1)
    expect(createApplicationRecurringMolliePayment).toHaveBeenCalledWith(
      store.payload,
      expect.objectContaining({ attemptNumber: 2 }),
    )
  })

  it("suspends after 14 days without mutating the customer-owned domain", async () => {
    const renewalOrder = orderFixture({
      ...baseOrigin,
      id: 601,
      billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
      billingAgreement: 900,
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      state: "accepted",
      paymentStatus: "failed",
    })
    const domain = managedDomainFixture({
      id: 950,
      tenant: 1,
      domainNameAscii: "example.nl",
      state: "active",
      entitlementStatus: "active",
      authoritativeDnsStatus: "verified",
      cloudflareZoneId: "zone-example",
      cloudflareDnsRecordIds: ["mx", "spf", "dkim", "website"],
      renewalIntent: true,
    })
    const store = await createStore({
      agreement: {
        state: "past_due",
        graceStartedAt: "2026-08-01T10:00:00.000Z",
        graceEndsAt: "2026-08-15T10:00:00.000Z",
      },
      orders: [renewalOrder],
      attempts: [paymentAttemptFixture({
        id: 700,
        order: 601,
        purpose: "recurring",
        attemptNumber: 1,
        state: "failed",
      })],
      domains: [domain],
    })
    await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
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
    const store = await createStore()
    const blocked = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
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
      agreement: store.agreement,
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
    const domain = managedDomainFixture({
      id: 950,
      tenant: 1,
      domainNameAscii: "example.nl",
      state: "active",
      renewalIntent: true,
    })
    const uncovered = validRenewalCycle({
      id: 960,
      managedDomain: 950,
      billingAgreement: 900,
      state: "payment_required",
      providerSafeCutoffAt: "2027-01-01T00:00:00.000Z",
      paymentSecuredAt: null,
      stateHistory: [],
    })
    const committed = validRenewalCycle({
      id: 961,
      managedDomain: 950,
      billingAgreement: 900,
      state: "payment_committed",
      providerSafeCutoffAt: "2027-01-01T00:00:00.000Z",
      paymentSecuredAt: "2026-07-20T00:00:00.000Z",
      stateHistory: [],
    })
    const store = await createStore({ domains: [domain], cycles: [uncovered, committed] })
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
    const store = await createStore({
      beforeAgreementConditionalUpdate: ({ agreement, orders, attempts }) => {
        orders.push(orderFixture({
          ...baseOrigin,
          id: 601,
          billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
          billingAgreement: 900,
          orderKind: "subscription_renewal",
          servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
          servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
          state: "accepted",
          paymentStatus: "pending",
        }))
        attempts.push(paymentAttemptFixture({
          id: 700,
          order: 601,
          purpose: "recurring",
          attemptNumber: 1,
          state: "pending_provider",
          reconciliationRequired: true,
          createdAt: claimAt,
        }))
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

  it("preserves a renewal cycle committed concurrently with cancellation", async () => {
    const domain = managedDomainFixture({
      id: 950,
      tenant: 1,
      domainNameAscii: "example.nl",
      state: "active",
      renewalIntent: true,
    })
    const cycle = validRenewalCycle({
      id: 960,
      managedDomain: 950,
      billingAgreement: 900,
      state: "payment_required",
      providerSafeCutoffAt: "2027-01-01T00:00:00.000Z",
      paymentSecuredAt: null,
      stateHistory: [],
    })
    const store = await createStore({
      domains: [domain],
      cycles: [cycle],
      beforeRenewalCycleConditionalUpdate: ({ cycles }) => {
        const concurrentCycle = cycles[0]
        if (!concurrentCycle) throw new Error("Missing renewal cycle fixture")
        Object.assign(concurrentCycle, {
          state: "payment_committed",
          paymentSecuredAt: "2026-07-27T10:00:00.500Z",
        })
      },
    })

    await expect(scheduleCancellationAtPeriodEnd({
      payload: store.payload,
      agreementId: 900,
      tenantId: 1,
      actorUserId: 10,
      actorEmail: "owner@example.com",
      now: new Date("2026-07-27T10:00:00.000Z"),
    })).resolves.toMatchObject({ state: "cancellation_scheduled" })
    expect(cycle).toMatchObject({
      state: "payment_committed",
      paymentSecuredAt: "2026-07-27T10:00:00.500Z",
    })
    expect(ensureCommerceNotification).toHaveBeenCalledOnce()
  })

  it("resumes cancellation cleanup and notification after a partial failure", async () => {
    const domain = managedDomainFixture({
      id: 950,
      tenant: 1,
      domainNameAscii: "example.nl",
      state: "active",
      renewalIntent: true,
    })
    const cycle = validRenewalCycle({
      id: 960,
      managedDomain: 950,
      billingAgreement: 900,
      state: "payment_required",
      providerSafeCutoffAt: "2027-01-01T00:00:00.000Z",
      paymentSecuredAt: null,
      stateHistory: [],
    })
    const store = await createStore({
      domains: [domain],
      cycles: [cycle],
      failManagedDomainUpdateOnce: true,
    })
    const cancellationInput = {
      payload: store.payload,
      agreementId: 900,
      tenantId: 1,
      actorUserId: 10,
      actorEmail: "owner@example.com",
      now: new Date("2026-07-27T10:00:00.000Z"),
    }

    await expect(scheduleCancellationAtPeriodEnd(cancellationInput))
      .rejects.toThrow("injected managed-domain update failure")
    expect(store.agreement).toMatchObject({ state: "cancellation_scheduled" })
    expect(domain).toMatchObject({ renewalIntent: true })

    await expect(scheduleCancellationAtPeriodEnd(cancellationInput))
      .resolves.toMatchObject({ state: "cancellation_scheduled" })
    expect(domain).toMatchObject({ renewalIntent: false })
    expect(cycle).toMatchObject({ state: "cancelled" })
    expect(ensureCommerceNotification).toHaveBeenCalledOnce()
  })

  it("repairs effective cancellation side effects after the agreement was committed", async () => {
    const domain = managedDomainFixture({
      id: 950,
      tenant: 1,
      domainNameAscii: "example.nl",
      state: "active",
      renewalIntent: true,
    })
    const uncovered = validRenewalCycle({
      id: 960,
      managedDomain: 950,
      billingAgreement: 900,
      state: "payment_required",
      providerSafeCutoffAt: "2027-01-01T00:00:00.000Z",
      paymentSecuredAt: null,
      stateHistory: [],
    })
    const committed = validRenewalCycle({
      id: 961,
      managedDomain: 950,
      billingAgreement: 900,
      state: "payment_committed",
      providerSafeCutoffAt: "2027-01-01T00:00:00.000Z",
      paymentSecuredAt: "2026-07-20T00:00:00.000Z",
      stateHistory: [],
    })
    const store = await createStore({
      agreement: {
        state: "cancellation_scheduled",
        renewalIntent: false,
        cancelAt: "2026-08-01T10:00:00.000Z",
      },
      domains: [domain],
      cycles: [uncovered, committed],
      failManagedDomainUpdateOnce: true,
    })
    const processInput = {
      payload: store.payload,
      agreement: store.agreement,
      now: new Date("2026-08-01T10:00:00.000Z"),
    }

    await expect(processBillingAgreement(processInput))
      .rejects.toThrow("injected managed-domain update failure")
    expect(store.agreement).toMatchObject({
      state: "cancelled",
      cancelledAt: "2026-08-01T10:00:00.000Z",
    })

    await expect(processBillingAgreement(processInput)).resolves.toEqual({
      status: "cancelled",
      paymentRequested: false,
    })
    expect(domain).toMatchObject({ renewalIntent: false })
    expect(uncovered).toMatchObject({ state: "cancelled" })
    expect(committed).toMatchObject({ state: "payment_committed" })
    expect(ensureCommerceNotification).toHaveBeenCalledOnce()
    expect(ensureCommerceNotification).toHaveBeenCalledWith(expect.objectContaining({
      kind: "cancellation_effective",
      eventAt: "2026-08-01T10:00:00.000Z",
    }))
  })

  it("does not regress a concurrently paid agreement back to past due", async () => {
    const store = await createStore({
      beforeAgreementConditionalUpdate: ({ agreement }) => {
        Object.assign(agreement, {
          state: "active",
          nextChargeAt: "2026-09-01T10:00:00.000Z",
          currentPeriodStartsAt: "2026-08-01T10:00:00.000Z",
          currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
          graceStartedAt: null,
          graceEndsAt: null,
          failureReason: null,
          updatedAt: "2026-08-01T10:00:01.000Z",
        })
      },
    })

    const result = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
      now: new Date("2026-08-01T10:00:00.000Z"),
    })

    expect(result).toEqual({
      status: "concurrent_update",
      paymentRequested: false,
    })
    expect(store.agreement).toMatchObject({
      state: "active",
      nextChargeAt: "2026-09-01T10:00:00.000Z",
      graceStartedAt: null,
      graceEndsAt: null,
    })
    expect(createApplicationRecurringMolliePayment).not.toHaveBeenCalled()
  })

  it("does not suspend a tenant after a concurrent paid synchronization", async () => {
    const store = await createStore({
      agreement: {
        state: "past_due",
        graceStartedAt: "2026-08-01T10:00:00.000Z",
        graceEndsAt: "2026-08-15T10:00:00.000Z",
      },
      beforeAgreementConditionalUpdate: ({ agreement }) => {
        Object.assign(agreement, {
          state: "active",
          nextChargeAt: "2026-09-01T10:00:00.000Z",
          currentPeriodStartsAt: "2026-08-01T10:00:00.000Z",
          currentPeriodEndsAt: "2026-09-01T10:00:00.000Z",
          graceStartedAt: null,
          graceEndsAt: null,
          serviceSuspensionStatus: "none",
          updatedAt: "2026-08-15T10:00:01.000Z",
        })
      },
    })

    const result = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
      now: new Date("2026-08-15T10:00:00.000Z"),
    })

    expect(result).toEqual({ status: "active", paymentRequested: false })
    expect(store.tenant).toMatchObject({ status: "active" })
    expect(store.agreement).toMatchObject({
      state: "active",
      serviceSuspensionStatus: "none",
    })
    expect(ensureCommerceNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "service_suspended_14d" }),
    )
  })

  it("extends cancellation through a provider-committed in-flight renewal", async () => {
    const renewalOrder = orderFixture({
      ...baseOrigin,
      id: 601,
      billingCycleKey: "billing-agreement:900:period-end:2026-09-01T10:00:00.000Z",
      billingAgreement: 900,
      orderKind: "subscription_renewal",
      servicePeriodStartsAt: "2026-08-01T10:00:00.000Z",
      servicePeriodEndsAt: "2026-09-01T10:00:00.000Z",
      state: "accepted",
      paymentStatus: "open",
    })
    const store = await createStore({
      agreement: {
        state: "cancellation_scheduled",
        renewalIntent: false,
        cancelAt: "2026-08-01T10:00:00.000Z",
      },
      orders: [renewalOrder],
      attempts: [paymentAttemptFixture({
        id: 700,
        order: 601,
        purpose: "recurring",
        attemptNumber: 1,
        state: "pending_provider",
        providerPaymentId: "tr_in_flight",
        reconciliationRequired: false,
      })],
    })

    const result = await processBillingAgreement({
      payload: store.payload,
      agreement: store.agreement,
      now: new Date("2026-08-01T10:00:00.000Z"),
    })

    expect(result).toEqual({
      status: "cancellation_scheduled",
      paymentRequested: false,
    })
    expect(store.agreement).toMatchObject({
      state: "cancellation_scheduled",
      cancelAt: "2026-09-01T10:00:00.000Z",
    })
    expect(store.tenant).toMatchObject({ status: "active" })
  })
})
