import { beforeEach, describe, expect, it, vi } from "vitest"
import { asPayload, type MockDoc, type MockFindArgs, type MockUpdateArgs } from "../_helpers/mockPayload"

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
}))

import {
  normalizeOpenProviderRenewalDate,
  reconcileManagedDomainRenewal,
} from "@/lib/domains/renewal"
import {
  OpenProviderIndeterminateWriteError,
  type OpenProviderAutorenewResult,
} from "@/lib/domains/openprovider"
import { createApplicationRecurringMolliePayment } from "@/lib/payments/molliePayments"
import { ensureCommerceNotification } from "@/lib/commerce/notifications"
import { recordCommerceAdminException } from "@/lib/commerce/alerts"

const compare = (actual: unknown, condition: Record<string, unknown>): boolean => {
  if ("equals" in condition) return String(actual) === String(condition.equals)
  if ("in" in condition) return (condition.in as unknown[]).map(String).includes(String(actual))
  if ("not_in" in condition) return !(condition.not_in as unknown[]).map(String).includes(String(actual))
  if ("exists" in condition) return condition.exists ? actual != null : actual == null
  if ("less_than_equal" in condition) return String(actual) <= String(condition.less_than_equal)
  if ("greater_than_equal" in condition) return String(actual) >= String(condition.greater_than_equal)
  return false
}

const matches = (doc: MockDoc, where: Record<string, unknown> | undefined): boolean => {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((entry) => matches(doc, entry as Record<string, unknown>))
  }
  if (Array.isArray(where.or)) {
    return where.or.some((entry) => matches(doc, entry as Record<string, unknown>))
  }
  return Object.entries(where).every(([field, condition]) => {
    if (field === "and" || field === "or") return true
    return condition && typeof condition === "object"
      ? compare(doc[field], condition as Record<string, unknown>)
      : doc[field] === condition
  })
}

const baseDomain = {
  id: 950,
  domainNameAscii: "example.nl",
  tld: "nl",
  provisioningIdempotencyKey: "domain-registration:order:600:v1",
  originatingOrder: 600,
  registrantProfile: 800,
  tenant: 1,
  state: "active",
  initialOperation: "registration",
  registrantOwnership: "customer",
  provider: "openprovider",
  providerDomainId: "9001",
  providerRegistrationState: "confirmed",
  registrantVerificationStatus: "verified",
  authoritativeDnsStatus: "verified",
  httpsStatus: "verified",
  entitlementStatus: "active",
  customerStatus: "active",
  renewalIntent: true,
  providerAutorenew: "on",
  reconciliationRequired: false,
  stateHistory: [],
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
  packageCode: "siteinabox-annual",
  billingPeriod: "annual",
  currency: "EUR",
  recurringNetAmountMinor: 19_000,
  renewalIntent: true,
  nextChargeAt: "2027-08-01T00:00:00.000Z",
  currentPeriodStartsAt: "2026-08-01T00:00:00.000Z",
  currentPeriodEndsAt: "2027-08-01T00:00:00.000Z",
  serviceSuspensionStatus: "none",
  reconciliationRequired: false,
  stateHistory: [],
  createdAt: "2026-08-01T00:00:00.000Z",
}

const baseOrder = {
  id: 600,
  orderNumber: "SIAB-500-TEST",
  tenant: 1,
  generationRun: 500,
  state: "fulfilled",
  checkoutProfileKey: "profile-1",
  catalogVersion: "2026-07-26.1",
  contractingPartyProfileVersion: 1,
  termsVersion: "terms-v1",
  privacyVersion: "privacy-v1",
  businessUseDeclarationVersion: "business-v1",
  customerName: "Ada Lovelace",
  customerEmail: "client@example.com",
  companyName: "Acme Studio",
  billingAddress: { country: "NL" },
  packageCode: "siteinabox-annual",
  billingPeriod: "annual",
  renewalTerms: "Renews annually.",
  lineItems: [],
  currency: "EUR",
  subtotalNet: 190,
  vatAmount: 39.9,
  totalGross: 229.9,
  domain: "example.nl",
  domainRegistrant: { email: "client@example.com" },
  legalDocuments: [10, 11],
  paymentStatus: "paid",
  paymentProvider: "mollie",
  createdAt: "2026-08-01T00:00:00.000Z",
}

const createStore = (input: {
  domain?: Record<string, unknown>
  agreement?: Record<string, unknown>
  cycles?: MockDoc[]
  orders?: MockDoc[]
  attempts?: MockDoc[]
} = {}) => {
  const domain = { ...baseDomain, ...input.domain }
  const agreement = { ...baseAgreement, ...input.agreement }
  const cycles = input.cycles ?? []
  const orders: MockDoc[] = [{ ...baseOrder }, ...(input.orders ?? [])]
  const attempts = input.attempts ?? []
  const collections: Record<string, MockDoc[]> = {
    "managed-domains": [domain],
    "billing-agreements": [agreement],
    "domain-renewal-cycles": cycles,
    orders,
    "payment-attempts": attempts,
  }
  let nextId = 1_000
  const find = vi.fn(async ({ collection, where, sort }: MockFindArgs) => {
    let docs = (collections[collection] ?? []).filter((doc) => matches(doc, where))
    if (sort === "providerRenewalDate") {
      docs = [...docs].sort(
        (a, b) => String(a.providerRenewalDate).localeCompare(String(b.providerRenewalDate)),
      )
    }
    if (sort === "-createdAt") {
      docs = [...docs].sort(
        (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
      )
    }
    if (sort === "attemptNumber") {
      docs = [...docs].sort(
        (a, b) => Number(a.attemptNumber ?? 0) - Number(b.attemptNumber ?? 0),
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
    if (collection === "domain-renewal-cycles") {
      const duplicate = cycles.find((entry) =>
        String(entry.managedDomain) === String(data.managedDomain) &&
        entry.providerRenewalDate === data.providerRenewalDate)
      if (duplicate) throw new Error("unique violation")
    }
    const doc = { id: nextId++, ...data }
    ;(collections[collection] ??= []).push(doc)
    return doc
  })
  const update = vi.fn(async ({ collection, id, data }: MockUpdateArgs) => {
    const doc = (collections[collection] ?? []).find((entry) => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    Object.assign(doc, data)
    return doc
  })
  return {
    domain,
    agreement,
    cycles,
    orders,
    attempts,
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

const providerRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 9001,
  domain: "example.nl",
  status: "ACT",
  ownerHandle: "OWNER-CLIENT",
  adminHandle: "ADMIN",
  nameServers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
  renewalDate: "2027-07-26 00:00:00",
  autorenew: "on" as const,
  verificationEmailStatus: "verified",
  verificationEmailDescription: null,
  raw: {},
  ...overrides,
})

type SetAutorenew = (
  id: number | string,
  autorenew: "on" | "off",
) => Promise<OpenProviderAutorenewResult>

const dependencies = (input: {
  now: string
  providerReadsAllowed?: boolean
  providerWritesAllowed?: boolean
  provider?: Record<string, unknown>
  priceNetMinor?: number
  setAutorenew?: ReturnType<typeof vi.fn<SetAutorenew>>
}) => {
  const setAutorenew = input.setAutorenew ?? vi.fn<SetAutorenew>(
    async (id, autorenew) => ({
      id,
      autorenew,
      status: "ACT",
      raw: {},
    }),
  )
  return {
    deps: {
      now: () => new Date(input.now),
      providerReadsAllowed: () => input.providerReadsAllowed ?? true,
      providerWritesAllowed: () => input.providerWritesAllowed ?? true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain: vi.fn(async () => providerRecord(input.provider)),
      getOpenProviderDomainRenewalPrice: vi.fn(async () => ({
        domain: "example.nl",
        operation: "renew" as const,
        currency: "EUR",
        netAmountMinor: input.priceNetMinor ?? 800,
        premium: false,
        raw: {},
      })),
      setOpenProviderDomainAutorenew: setAutorenew,
    },
    setAutorenew,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Openprovider renewal_date cycles", () => {
  it("normalizes provider dates as UTC instead of machine-local time", () => {
    expect(normalizeOpenProviderRenewalDate("2027-07-26 00:00:00"))
      .toBe("2027-07-26T00:00:00.000Z")
  })

  it("blocks disabled-stage discovery but permits committed-cycle safety reconciliation", async () => {
    const uncommittedStore = createStore()
    const blocked = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      providerReadsAllowed: false,
    })
    await expect(reconcileManagedDomainRenewal(
      uncommittedStore.payload,
      950,
      blocked.deps,
    )).resolves.toEqual({ status: "release_blocked" })
    expect(blocked.deps.loginOpenProvider).not.toHaveBeenCalled()
    expect(recordCommerceAdminException).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "renewal_reconciliation_release_blocked",
        severity: "critical",
      }),
    )

    const committedStore = createStore({
      cycles: [{
        id: 960,
        managedDomain: 950,
        state: "payment_committed",
        paymentSecuredAt: "2027-06-25T00:00:00.000Z",
        providerRenewalDate: "2027-07-26T00:00:00.000Z",
      }],
    })
    const safety = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      providerReadsAllowed: false,
    })
    await reconcileManagedDomainRenewal(committedStore.payload, 950, safety.deps)
    expect(safety.deps.loginOpenProvider).toHaveBeenCalledOnce()
  })

  it("creates one allowance-covered .nl cycle and commits autorenew at the safe cutoff", async () => {
    const store = createStore()
    const first = dependencies({ now: "2027-06-26T00:00:00.000Z" })
    const result = await reconcileManagedDomainRenewal(store.payload, 950, first.deps)
    expect(result.status).toBe("payment_committed")
    expect(store.cycles).toHaveLength(1)
    expect(store.cycles[0]).toMatchObject({
      providerRenewalDate: "2027-07-26T00:00:00.000Z",
      providerSafeCutoffAt: "2027-07-24T00:00:00.000Z",
      state: "payment_committed",
      providerRenewalMode: "autorenew",
      financialCoverageState: "payment_secured",
      providerOperationPriceNetMinor: 800,
      includedAllowanceNetMinor: 1_000,
      surchargeNetMinor: 0,
    })
    expect(first.setAutorenew).not.toHaveBeenCalled()

    const cutoff = dependencies({ now: "2027-07-24T00:00:00.000Z" })
    const committed = await reconcileManagedDomainRenewal(store.payload, 950, cutoff.deps)
    expect(committed.status).toBe("provider_requested")
    expect(store.cycles[0]).toMatchObject({
      state: "provider_requested",
      financialCoverageState: "provider_committed",
    })
    expect(cutoff.setAutorenew).not.toHaveBeenCalled()
  })

  it("uses the effective .be autorenew and renewal_date capability", async () => {
    const store = createStore({
      domain: {
        domainNameAscii: "example.be",
        tld: "be",
      },
    })
    const fixture = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      provider: { domain: "example.be" },
    })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(result.status).toBe("payment_committed")
    expect(store.cycles).toHaveLength(1)
    expect(store.cycles[0]).toMatchObject({
      providerRenewalDate: "2027-07-26T00:00:00.000Z",
      providerSafeCutoffAt: "2027-07-24T00:00:00.000Z",
      providerRenewalMode: "autorenew",
      state: "payment_committed",
      pricingEvidence: {
        tld: "be",
        tldCapabilityVersion: "tld-be-2026-07-27.1",
      },
    })
  })

  it("turns autorenew off while a surcharge is uncovered and creates a recurring Mollie attempt", async () => {
    const store = createStore({
      agreement: {
        currentPeriodEndsAt: "2027-07-01T00:00:00.000Z",
        nextChargeAt: "2027-07-01T00:00:00.000Z",
      },
    })
    const fixture = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      priceNetMinor: 1_250,
    })
    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)
    expect(result.status).toBe("payment_required")
    expect(store.cycles[0]).toMatchObject({
      state: "payment_required",
      financialCoverageState: "payment_pending",
      surchargeNetMinor: 250,
      providerAutorenew: "off",
    })
    expect(store.orders[1]).toMatchObject({
      orderKind: "domain_renewal",
      subtotalNetMinor: 250,
      vatAmountMinor: 53,
      totalGrossMinor: 303,
    })
    expect(createApplicationRecurringMolliePayment).toHaveBeenCalledWith(
      store.payload,
      expect.objectContaining({ purpose: "domain_renewal" }),
    )
    expect(fixture.setAutorenew).toHaveBeenCalledOnce()
    expect(fixture.setAutorenew).toHaveBeenCalledWith(9001, "off", { token: "token" })
  })

  it("stops at an admin exception when autorenew is on without coverage at the cutoff", async () => {
    const cycle = {
      id: 960,
      idempotencyKey: "cycle-960",
      managedDomain: 950,
      billingAgreement: 900,
      tenant: 1,
      state: "payment_required",
      coverageStartsAt: "2027-07-26T00:00:00.000Z",
      coverageEndsAt: "2028-07-26T00:00:00.000Z",
      providerRenewalDate: "2027-07-26T00:00:00.000Z",
      providerSafeCutoffAt: "2027-07-24T00:00:00.000Z",
      renewalIntentSnapshot: true,
      providerRenewalMode: "autorenew",
      providerAutorenew: "on",
      providerWriteState: "not_required",
      currency: "EUR",
      providerOperationPriceNetMinor: 1_250,
      includedAllowanceNetMinor: 1_000,
      surchargeNetMinor: 250,
      financialCoverageState: "payment_pending",
      pricingEvidence: {},
      netAmountMinor: 250,
      vatAmountMinor: 53,
      grossAmountMinor: 303,
      reconciliationRequired: false,
      stateHistory: [],
      createdAt: "2027-06-01T00:00:00.000Z",
    }
    const store = createStore({ cycles: [cycle] })
    const fixture = dependencies({ now: "2027-07-24T00:00:00.000Z" })
    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)
    expect(result.status).toBe("manual_review")
    expect(cycle).toMatchObject({
      state: "manual_review",
      adminExceptionCode: "autorenew_on_without_coverage_at_cutoff",
    })
    expect(fixture.setAutorenew).not.toHaveBeenCalled()
    expect(recordCommerceAdminException).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "autorenew_on_without_coverage_at_cutoff",
        severity: "critical",
      }),
    )
  })

  it("reconciles an indeterminate autorenew write before retrying", async () => {
    const store = createStore({ domain: { renewalIntent: false } })
    const indeterminateWrite = vi.fn<SetAutorenew>(async () => {
      throw new OpenProviderIndeterminateWriteError("test timeout")
    })
    const first = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      setAutorenew: indeterminateWrite,
    })
    const waiting = await reconcileManagedDomainRenewal(store.payload, 950, first.deps)
    expect(waiting.status).toBe("waiting")
    expect(store.cycles[0]).toMatchObject({
      state: "cancelled",
      providerWriteState: "indeterminate",
      reconciliationRequired: true,
    })

    const reconciled = dependencies({
      now: "2027-06-26T00:15:00.000Z",
      provider: { autorenew: "off" },
    })
    const result = await reconcileManagedDomainRenewal(store.payload, 950, reconciled.deps)
    expect(result.status).toBe("cancelled")
    expect(reconciled.setAutorenew).not.toHaveBeenCalled()
    expect(indeterminateWrite).toHaveBeenCalledOnce()
    expect(store.cycles[0]).toMatchObject({
      providerWriteState: "confirmed",
      providerAutorenew: "off",
      reconciliationRequired: false,
    })
  })

  it("detects renewal only when renewal_date advances and never sends an explicit renewal", async () => {
    const oldCycle = {
      id: 960,
      idempotencyKey: "cycle-960",
      managedDomain: 950,
      billingAgreement: 900,
      tenant: 1,
      state: "provider_requested",
      coverageStartsAt: "2027-07-26T00:00:00.000Z",
      coverageEndsAt: "2028-07-26T00:00:00.000Z",
      providerRenewalDate: "2027-07-26T00:00:00.000Z",
      providerSafeCutoffAt: "2027-07-24T00:00:00.000Z",
      renewalIntentSnapshot: true,
      providerRenewalMode: "autorenew",
      providerAutorenew: "on",
      providerWriteState: "confirmed",
      currency: "EUR",
      providerOperationPriceNetMinor: 800,
      includedAllowanceNetMinor: 1_000,
      surchargeNetMinor: 0,
      financialCoverageState: "provider_committed",
      pricingEvidence: {},
      netAmountMinor: 0,
      vatAmountMinor: 0,
      grossAmountMinor: 0,
      paymentSecuredAt: "2027-06-01T00:00:00.000Z",
      providerCommittedAt: "2027-07-24T00:00:00.000Z",
      reconciliationRequired: false,
      stateHistory: [],
      createdAt: "2027-06-01T00:00:00.000Z",
    }
    const store = createStore({ cycles: [oldCycle] })
    const fixture = dependencies({
      now: "2027-07-26T01:00:00.000Z",
      provider: { renewalDate: "2028-07-26 00:00:00" },
    })
    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)
    expect(result.status).toBe("not_due")
    expect(oldCycle).toMatchObject({
      state: "renewed",
      financialCoverageState: "covered",
    })
    expect(store.domain).toMatchObject({
      state: "active",
      expiresAt: "2028-07-26T00:00:00.000Z",
    })
    expect(fixture.setAutorenew).not.toHaveBeenCalled()
    expect(ensureCommerceNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "domain_renewed" }),
    )
  })

  it("completes a financially committed cycle after subscription cancellation", async () => {
    const committedCycle = {
      id: 960,
      idempotencyKey: "cycle-960",
      managedDomain: 950,
      billingAgreement: 900,
      tenant: 1,
      state: "payment_committed",
      coverageStartsAt: "2027-07-26T00:00:00.000Z",
      coverageEndsAt: "2028-07-26T00:00:00.000Z",
      providerRenewalDate: "2027-07-26T00:00:00.000Z",
      providerSafeCutoffAt: "2027-07-24T00:00:00.000Z",
      renewalIntentSnapshot: true,
      providerRenewalMode: "autorenew",
      providerAutorenew: "on",
      providerWriteState: "confirmed",
      currency: "EUR",
      providerOperationPriceNetMinor: 800,
      includedAllowanceNetMinor: 1_000,
      surchargeNetMinor: 0,
      financialCoverageState: "payment_secured",
      pricingEvidence: {},
      netAmountMinor: 0,
      vatAmountMinor: 0,
      grossAmountMinor: 0,
      paymentSecuredAt: "2027-06-01T00:00:00.000Z",
      reconciliationRequired: false,
      stateHistory: [],
      createdAt: "2027-06-01T00:00:00.000Z",
    }
    const store = createStore({
      domain: { renewalIntent: false },
      agreement: {
        state: "cancellation_scheduled",
        renewalIntent: false,
        cancelAt: "2027-07-01T00:00:00.000Z",
      },
      cycles: [committedCycle],
    })
    const fixture = dependencies({ now: "2027-07-24T00:00:00.000Z" })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(result.status).toBe("provider_requested")
    expect(committedCycle).toMatchObject({
      state: "provider_requested",
      financialCoverageState: "provider_committed",
    })
    expect(fixture.setAutorenew).not.toHaveBeenCalled()
  })

  it("completes a committed cycle even while new provider writes are release-blocked", async () => {
    const committedCycle = {
      id: 960,
      idempotencyKey: "cycle-960",
      managedDomain: 950,
      billingAgreement: 900,
      tenant: 1,
      state: "payment_committed",
      coverageStartsAt: "2027-07-26T00:00:00.000Z",
      coverageEndsAt: "2028-07-26T00:00:00.000Z",
      providerRenewalDate: "2027-07-26T00:00:00.000Z",
      providerSafeCutoffAt: "2027-07-24T00:00:00.000Z",
      renewalIntentSnapshot: true,
      providerRenewalMode: "autorenew",
      providerAutorenew: "off",
      providerWriteState: "confirmed",
      currency: "EUR",
      providerOperationPriceNetMinor: 800,
      includedAllowanceNetMinor: 1_000,
      surchargeNetMinor: 0,
      financialCoverageState: "payment_secured",
      pricingEvidence: {},
      netAmountMinor: 0,
      vatAmountMinor: 0,
      grossAmountMinor: 0,
      paymentSecuredAt: "2027-06-01T00:00:00.000Z",
      reconciliationRequired: false,
      stateHistory: [],
      createdAt: "2027-06-01T00:00:00.000Z",
    }
    const store = createStore({ cycles: [committedCycle] })
    const fixture = dependencies({
      now: "2027-07-24T00:00:00.000Z",
      provider: { autorenew: "off" },
      providerWritesAllowed: false,
    })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(result.status).toBe("provider_requested")
    expect(fixture.setAutorenew).toHaveBeenCalledWith(9001, "on", { token: "token" })
  })

  it("blocks an uncovered autorenew write when the release stage is read-only", async () => {
    const store = createStore({
      agreement: { renewalIntent: false },
      domain: { renewalIntent: false },
    })
    const fixture = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      providerWritesAllowed: false,
    })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(result.status).toBe("release_blocked")
    expect(fixture.setAutorenew).not.toHaveBeenCalled()
    expect(recordCommerceAdminException).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "release_gate_blocked_autorenew_safety_write",
        severity: "critical",
      }),
    )
  })

  it("records every governed domain reminder offset", async () => {
    const store = createStore()
    const fixture = dependencies({ now: "2027-07-25T00:00:00.000Z" })

    await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(vi.mocked(ensureCommerceNotification).mock.calls.map(
      ([notification]) => notification.kind,
    )).toEqual([
      "domain_renewal_60d",
      "domain_renewal_30d",
      "domain_renewal_14d",
      "domain_renewal_7d",
      "domain_renewal_1d",
    ])
  })
})
