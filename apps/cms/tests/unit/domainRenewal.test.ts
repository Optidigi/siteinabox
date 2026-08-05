import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createMutablePayloadStore,
  type MockDoc,
} from "../_helpers/mockPayload"
import {
  validBillingAgreement,
  validManagedDomain,
  validOrder,
} from "../_helpers/commerceBuilders"

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
  decideRenewalCancellationObligation,
  normalizeOpenProviderRenewalDate,
  PROVIDER_RENEWAL_ADVANCE_GRACE_MS,
  PROVIDER_WRITE_RECONCILIATION_GRACE_MS,
  reconcileManagedDomainRenewal,
} from "@/lib/domains/renewal"
import {
  OpenProviderIndeterminateWriteError,
  type OpenProviderAutorenewResult,
} from "@/lib/domains/openprovider"
import { createApplicationRecurringMolliePayment } from "@/lib/payments/molliePayments"
import { ensureCommerceNotification } from "@/lib/commerce/notifications"
import { recordCommerceAdminException } from "@/lib/commerce/alerts"

const baseDomain = validManagedDomain({
  provisioningIdempotencyKey: "domain-registration:order:600:v1",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
})

const baseAgreement = validBillingAgreement({
  idempotencyKey: "agreement-900",
  state: "active",
  providerCustomerId: "cst_test",
  providerMandateId: "mdt_test",
  packageCode: "siteinabox-annual",
  billingPeriod: "annual",
  recurringNetAmountMinor: 19_000,
  nextChargeAt: "2027-08-01T00:00:00.000Z",
  currentPeriodStartsAt: "2026-08-01T00:00:00.000Z",
  currentPeriodEndsAt: "2027-08-01T00:00:00.000Z",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
})

const baseOrder = validOrder({
  state: "fulfilled",
  checkoutProfileKey: "profile-1",
  termsVersion: "terms-v1",
  privacyVersion: "privacy-v1",
  businessUseDeclarationVersion: "business-v1",
  packageCode: "siteinabox-annual",
  billingPeriod: "annual",
  renewalTerms: "Renews annually.",
  subtotalNetMinor: 19_000,
  vatAmountMinor: 3_990,
  totalGrossMinor: 22_990,
  subtotalNet: 190,
  vatAmount: 39.9,
  totalGross: 229.9,
  domainRegistrant: { email: "client@example.com" },
  paymentStatus: "paid",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
})

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
  const store = createMutablePayloadStore({
    collections,
    nextId: 1_000,
    unique: [{
      collection: "domain-renewal-cycles",
      fields: ["managedDomain", "providerRenewalDate"],
    }],
  })
  return {
    domain,
    agreement,
    cycles,
    orders,
    attempts,
    payload: store.payload,
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
type FindProviderDomain = () => Promise<ReturnType<typeof providerRecord> | null>

const dependencies = (input: {
  now: string
  providerReadsAllowed?: boolean
  providerWritesAllowed?: boolean
  productionOperationAllowed?: boolean
  provider?: Record<string, unknown>
  priceNetMinor?: number
  balanceAvailableAmount?: number
  providerWriteApplied?: boolean
  findProviderDomain?: ReturnType<typeof vi.fn<FindProviderDomain>>
  setAutorenew?: ReturnType<typeof vi.fn<SetAutorenew>>
}) => {
  let providerAutorenew = (input.provider?.autorenew ?? "on") as "on" | "off"
  const providerWrite = input.setAutorenew ?? vi.fn<SetAutorenew>(
    async (id, autorenew) => ({
      id,
      autorenew,
      status: "ACT",
      raw: {},
    }),
  )
  const setAutorenew = vi.fn<SetAutorenew>(async (id, autorenew) => {
    const result = await providerWrite(id, autorenew)
    if (input.providerWriteApplied !== false) providerAutorenew = result.autorenew
    return result
  })
  return {
    deps: {
      now: () => new Date(input.now),
      productionOperationAllowed: () => input.productionOperationAllowed ?? true,
      providerReadsAllowed: () => input.providerReadsAllowed ?? true,
      providerWritesAllowed: () => input.providerWritesAllowed ?? true,
      loginOpenProvider: vi.fn(async () => "token"),
      findOpenProviderDomain: input.findProviderDomain ?? vi.fn(async () => providerRecord({
          ...input.provider,
          autorenew: providerAutorenew,
        })),
      getOpenProviderDomainRenewalPrice: vi.fn(async () => ({
        domain: "example.nl",
        operation: "renew" as const,
        currency: "EUR",
        netAmountMinor: input.priceNetMinor ?? 800,
        premium: false,
        raw: {},
      })),
      getOpenProviderResellerBalance: vi.fn(async () => ({
        availableAmount: input.balanceAvailableAmount ?? 1_000,
        reservedAmount: 0,
        currency: "EUR",
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

  it.each([
    {
      label: "uncovered active renewal",
      input: {
        cycleState: "scheduled" as const,
        paymentSecuredAt: null,
        domainRenewalIntent: true,
        agreementState: "active" as const,
        agreementRenewalIntent: true,
        cutoffReached: false,
        providerAutorenew: "on" as const,
      },
      expected: {
        paymentRequestEligible: true,
        obligation: {
          outcome: "disable_autorenew",
          renewalCancelled: false,
          cancelCycleAfterAutorenewOff: false,
          settledStatus: "payment_required",
        },
      },
    },
    {
      label: "cancelled uncovered future cycle",
      input: {
        cycleState: "scheduled" as const,
        paymentSecuredAt: null,
        domainRenewalIntent: false,
        agreementState: "cancellation_scheduled" as const,
        agreementRenewalIntent: false,
        cutoffReached: false,
        providerAutorenew: "on" as const,
      },
      expected: {
        paymentRequestEligible: false,
        obligation: {
          outcome: "disable_autorenew",
          renewalCancelled: true,
          cancelCycleAfterAutorenewOff: true,
          settledStatus: "cancelled",
        },
      },
    },
    ...(["payment_committed", "provider_requested"] as const).map(
      (cycleState) => ({
        label: `${cycleState} obligation after cancellation`,
        input: {
          cycleState,
          paymentSecuredAt: null,
          domainRenewalIntent: false,
          agreementState: "cancellation_scheduled" as const,
          agreementRenewalIntent: false,
          cutoffReached: true,
          providerAutorenew: "off" as const,
        },
        expected: {
          paymentRequestEligible: false,
          obligation: { outcome: "continue_committed_obligation" },
        },
      }),
    ),
    {
      label: "paid obligation after cancellation",
      input: {
        cycleState: "payment_required" as const,
        paymentSecuredAt: "2027-06-01T00:00:00.000Z",
        domainRenewalIntent: false,
        agreementState: "cancellation_scheduled" as const,
        agreementRenewalIntent: false,
        cutoffReached: true,
        providerAutorenew: "off" as const,
      },
      expected: {
        paymentRequestEligible: false,
        obligation: { outcome: "continue_committed_obligation" },
      },
    },
    {
      label: "uncovered cutoff with autorenew on",
      input: {
        cycleState: "payment_required" as const,
        paymentSecuredAt: null,
        domainRenewalIntent: true,
        agreementState: "active" as const,
        agreementRenewalIntent: true,
        cutoffReached: true,
        providerAutorenew: "on" as const,
      },
      expected: {
        paymentRequestEligible: false,
        obligation: {
          outcome: "manual_review_uncovered_at_cutoff",
        },
      },
    },
  ])("decides $label without effects", ({ input, expected }) => {
    expect(decideRenewalCancellationObligation(input)).toEqual(expected)
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
      providerRenewalMode: "provider_autorenew",
      financialCoverageState: "payment_secured",
      providerOperationPriceNetMinor: 800,
      includedAllowanceNetMinor: 0,
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

  it("looks ahead 90 days so the indicative notice cycle exists on time", async () => {
    const store = createStore({
      domain: {
        domainNameAscii: "example.eu",
        tld: "eu",
      },
    })
    const before = dependencies({ now: "2027-04-26T23:59:59.999Z" })
    await expect(reconcileManagedDomainRenewal(store.payload, 950, before.deps))
      .resolves.toEqual({ status: "not_due" })
    expect(store.cycles).toHaveLength(0)

    const due = dependencies({
      now: "2027-04-27T00:00:00.000Z",
      provider: {
        domain: "example.eu",
      },
    })
    await reconcileManagedDomainRenewal(store.payload, 950, due.deps)
    expect(store.cycles).toHaveLength(1)
    expect(ensureCommerceNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "domain_renewal_90d" }),
    )
  })

  it("replaces indicative pricing with the actionable quote without changing renewal authority", async () => {
    const store = createStore({
      domain: {
        domainNameAscii: "example.eu",
        tld: "eu",
      },
    })
    const indicative = dependencies({
      now: "2027-04-27T00:00:00.000Z",
      priceNetMinor: 1_250,
      provider: {
        domain: "example.eu",
      },
    })

    await reconcileManagedDomainRenewal(store.payload, 950, indicative.deps)

    expect(store.cycles[0]).toMatchObject({
      state: "scheduled",
      paymentChargeAt: "2027-05-27T00:00:00.000Z",
      renewalIntentSnapshot: true,
      financialCoverageState: "payment_pending",
      providerOperationPriceNetMinor: 1_250,
      includedAllowanceNetMinor: 0,
      surchargeNetMinor: 1364,
      netAmountMinor: 1364,
      vatAmountMinor: 286,
      grossAmountMinor: 1650,
      pricingEvidence: {
        operation: "renew",
        quotedAt: "2027-04-27T00:00:00.000Z",
        providerOperationPriceNetMinor: 1_250,
        includedAllowanceNetMinor: 0,
        surchargeNetMinor: 1364,
      },
    })

    const actionable = dependencies({
      now: "2027-05-27T00:00:00.000Z",
      priceNetMinor: 800,
      provider: {
        domain: "example.eu",
      },
    })
    await reconcileManagedDomainRenewal(store.payload, 950, actionable.deps)

    expect(store.cycles[0]).toMatchObject({
      state: "payment_required",
      paymentChargeAt: "2027-05-27T00:00:00.000Z",
      renewalIntentSnapshot: true,
      financialCoverageState: "payment_pending",
      providerOperationPriceNetMinor: 800,
      includedAllowanceNetMinor: 0,
      surchargeNetMinor: 868,
      netAmountMinor: 868,
      vatAmountMinor: 182,
      grossAmountMinor: 1050,
      pricingEvidence: {
        operation: "renew",
        quotedAt: "2027-05-27T00:00:00.000Z",
        providerOperationPriceNetMinor: 800,
        includedAllowanceNetMinor: 0,
        surchargeNetMinor: 868,
      },
    })
  })

  it("fails closed for a modeled TLD whose production gate is disabled", async () => {
    const store = createStore({
      domain: {
        domainNameAscii: "example.be",
        tld: "be",
      },
    })
    const fixture = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      provider: { domain: "example.be" },
      productionOperationAllowed: false,
    })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(result.status).toBe("not_applicable")
    expect(store.cycles).toHaveLength(0)
    expect(fixture.deps.loginOpenProvider).not.toHaveBeenCalled()
  })

  it("fails closed when frozen accepted capability evidence is invalid", async () => {
    const store = createStore()
    store.orders[0]!.quoteEvidence = {
      tldCapability: {
        tld: "nl",
        capabilityVersion: "tld-nl-unknown",
      },
    }
    const fixture = dependencies({ now: "2027-06-26T00:00:00.000Z" })

    await expect(reconcileManagedDomainRenewal(store.payload, 950, fixture.deps))
      .resolves.toEqual({ status: "not_applicable" })
    expect(fixture.deps.loginOpenProvider).not.toHaveBeenCalled()
  })

  it("continues a .eu renewal obligation accepted under its historical enabled capability", async () => {
    const store = createStore({
      domain: {
        domainNameAscii: "example.eu",
        tld: "eu",
      },
    })
    store.orders[0]!.quoteEvidence = {
      tldCapability: {
        tld: "eu",
        capabilityVersion: "tld-eu-2026-07-28.1",
      },
    }
    const fixture = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      provider: {
        domain: "example.eu",
      },
    })
    
    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)
    
    expect(result.status).toBe("payment_required")
    expect(store.cycles[0]).toMatchObject({
      providerRenewalMode: "provider_autorenew",
      financialCoverageState: "payment_pending",
      state: "payment_required",
      pricingEvidence: {
        tld: "eu",
        tldCapabilityVersion: "tld-eu-2026-07-28.1",
      },
    })
  })

  it("does not let a registration-only capability create a renewal commitment", async () => {
    const store = createStore()
    store.orders[0]!.quoteEvidence = {
      tldCapability: {
        tld: "nl",
        capabilityVersion: "tld-nl-2026-07-29.1",
      },
    }
    const fixture = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      productionOperationAllowed: false,
      provider: { autorenew: "off" },
    })

    const result = await reconcileManagedDomainRenewal(
      store.payload,
      950,
      fixture.deps,
    )

    expect(result.status).toBe("not_applicable")
    expect(store.cycles).toHaveLength(0)
    expect(fixture.deps.loginOpenProvider).not.toHaveBeenCalled()
  })

  it("keeps an accepted historical capability authoritative after a newer version is enabled", async () => {
    const store = createStore()
    store.orders[0]!.quoteEvidence = {
      tldCapability: {
        tld: "nl",
        capabilityVersion: "tld-nl-2026-07-26.1",
      },
    }
    const fixture = dependencies({ now: "2027-06-26T00:00:00.000Z" })

    await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(store.cycles[0]).toMatchObject({
      pricingEvidence: {
        tld: "nl",
        tldCapabilityVersion: "tld-nl-2026-07-26.1",
      },
    })
  })

  it("does not commit an uncovered cycle after agreement renewal intent is cancelled", async () => {
    const store = createStore({
      agreement: {
        state: "cancellation_scheduled",
        renewalIntent: false,
      },
    })
    const fixture = dependencies({ now: "2027-05-27T00:00:00.000Z" })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(result.status).toBe("cancelled")
    expect(store.cycles[0]).toMatchObject({
      state: "cancelled",
      renewalIntentSnapshot: false,
      failureReason: "renewal_intent_off",
      providerAutorenew: "off",
    })
    expect(createApplicationRecurringMolliePayment).not.toHaveBeenCalled()
    expect(fixture.setAutorenew).toHaveBeenCalledOnce()
    expect(ensureCommerceNotification).not.toHaveBeenCalled()
  })

  it("turns autorenew off while a surcharge is uncovered and creates a recurring Mollie attempt", async () => {
    const store = createStore({
      domain: {
        domainNameAscii: "example.eu",
        tld: "eu",
      },
      cycles: [
        {
          id: 1000,
          managedDomain: 950,
          providerRenewalDate: "2027-07-26T00:00:00.000Z",
          providerSafeCutoffAt: "2027-07-24T00:00:00.000Z",
          state: "scheduled",
          providerRenewalMode: "provider_autorenew",
          providerAutorenew: "on",
          financialCoverageState: "payment_pending",
          providerOperationPriceNetMinor: 1_250,
          includedAllowanceNetMinor: 0,
          surchargeNetMinor: 1364,
          pricingEvidence: {
            version: 1,
            provider: "openprovider",
            tld: "eu",
            tldCapabilityVersion: "2024-11-20.1",
            operation: "renew",
            quotedAt: "2027-04-27T00:00:00.000Z",
            premium: false,
            currency: "EUR",
            providerOperationPriceNetMinor: 1_250,
            includedAllowanceNetMinor: 0,
            surchargeNetMinor: 1364,
          },
          netAmountMinor: 1364,
          vatAmountMinor: 286,
          grossAmountMinor: 1650,
          paymentChargeAt: "2027-05-27T00:00:00.000Z",
          renewalIntentSnapshot: true,
          providerEvidence: null,
          paymentSecuredAt: null,
          tenant: 1,
        },
      ],
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
      providerAutorenew: "off",
      surchargeNetMinor: 1364,
    })
    expect(store.orders[1]).toMatchObject({
      orderKind: "domain_renewal",
      subtotalNetMinor: 1364,
      vatAmountMinor: 286,
      totalGrossMinor: 1650,
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
      providerRenewalMode: "provider_autorenew",
      providerAutorenew: "on",
      providerWriteState: "not_required",
      currency: "EUR",
      providerOperationPriceNetMinor: 1_250,
      includedAllowanceNetMinor: 0,
      surchargeNetMinor: 1364,
      financialCoverageState: "payment_pending",
      pricingEvidence: {},
      netAmountMinor: 1364,
      vatAmountMinor: 286,
      grossAmountMinor: 1650,
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

  it("halts a covered renewal when the provider balance cannot fund it", async () => {
    const cycle = {
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
      providerRenewalMode: "provider_autorenew",
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
    const store = createStore({ cycles: [cycle] })
    const fixture = dependencies({
      now: "2027-07-24T00:00:00.000Z",
      balanceAvailableAmount: 7.99,
    })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(result.status).toBe("manual_review")
    expect(cycle).toMatchObject({
      state: "manual_review",
      adminExceptionCode: "provider_balance_insufficient",
    })
    expect(recordCommerceAdminException).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "provider_balance_insufficient",
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

  it("restarts a prepared autorenew operation only after exact absence and its grace boundary", async () => {
    const requestedAt = "2027-06-26T00:00:00.000Z"
    const preparedCycle = {
      id: 960,
      idempotencyKey: "cycle-960",
      managedDomain: 950,
      billingAgreement: 900,
      tenant: 1,
      state: "cancelled",
      coverageStartsAt: "2027-07-26T00:00:00.000Z",
      coverageEndsAt: "2028-07-26T00:00:00.000Z",
      providerRenewalDate: "2027-07-26T00:00:00.000Z",
      providerSafeCutoffAt: "2027-07-24T00:00:00.000Z",
      renewalIntentSnapshot: false,
      providerRenewalMode: "provider_autorenew",
      providerAutorenew: "on",
      providerOperationId:
        "openprovider:domain:9001:autorenew:off:renewal:2027-07-26T00:00:00.000Z",
      providerWriteState: "prepared",
      providerWriteRequestedAt: requestedAt,
      currency: "EUR",
      providerOperationPriceNetMinor: 800,
      includedAllowanceNetMinor: 1_000,
      surchargeNetMinor: 0,
      financialCoverageState: "uncovered",
      pricingEvidence: {},
      netAmountMinor: 0,
      vatAmountMinor: 0,
      grossAmountMinor: 0,
      cancelledAt: requestedAt,
      reconciliationRequired: true,
      stateHistory: [],
      createdAt: "2027-06-01T00:00:00.000Z",
    }
    const store = createStore({
      domain: { renewalIntent: false },
      agreement: { state: "cancellation_scheduled", renewalIntent: false },
      cycles: [preparedCycle],
    })
    const beforeGrace = dependencies({
      now: new Date(
        Date.parse(requestedAt) + PROVIDER_WRITE_RECONCILIATION_GRACE_MS - 1,
      ).toISOString(),
      provider: { autorenew: "on" },
    })

    await expect(reconcileManagedDomainRenewal(
      store.payload,
      950,
      beforeGrace.deps,
    )).resolves.toMatchObject({ status: "waiting", cycleId: 960 })
    expect(beforeGrace.deps.findOpenProviderDomain).toHaveBeenCalledOnce()
    expect(beforeGrace.setAutorenew).not.toHaveBeenCalled()
    expect(preparedCycle).toMatchObject({
      providerWriteState: "prepared",
      providerAutorenew: "on",
      reconciliationRequired: true,
    })

    const atGrace = dependencies({
      now: new Date(
        Date.parse(requestedAt) + PROVIDER_WRITE_RECONCILIATION_GRACE_MS,
      ).toISOString(),
      provider: { autorenew: "on" },
    })
    await expect(reconcileManagedDomainRenewal(
      store.payload,
      950,
      atGrace.deps,
    )).resolves.toMatchObject({ status: "cancelled", cycleId: 960 })

    expect(atGrace.setAutorenew).toHaveBeenCalledOnce()
    expect(atGrace.setAutorenew).toHaveBeenCalledWith(9001, "off", {
      token: "token",
    })
    expect(atGrace.deps.findOpenProviderDomain).toHaveBeenCalledTimes(2)
    expect(preparedCycle).toMatchObject({
      providerWriteState: "confirmed",
      providerAutorenew: "off",
      reconciliationRequired: false,
      failureReason: null,
    })
  })

  it("coalesces one retry after an indeterminate autorenew write remains unapplied", async () => {
    const store = createStore({
      domain: { renewalIntent: false },
      agreement: { state: "cancellation_scheduled", renewalIntent: false },
    })
    const initialWrite = vi.fn<SetAutorenew>(async () => {
      throw new OpenProviderIndeterminateWriteError("test timeout")
    })
    const first = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      setAutorenew: initialWrite,
    })
    await expect(reconcileManagedDomainRenewal(store.payload, 950, first.deps))
      .resolves.toMatchObject({ status: "waiting" })

    const beforeGrace = dependencies({
      now: new Date(
        Date.parse("2027-06-26T00:00:00.000Z") +
          PROVIDER_WRITE_RECONCILIATION_GRACE_MS - 1,
      ).toISOString(),
      provider: { autorenew: "on" },
    })
    await expect(reconcileManagedDomainRenewal(store.payload, 950, beforeGrace.deps))
      .resolves.toMatchObject({ status: "waiting" })
    expect(beforeGrace.setAutorenew).not.toHaveBeenCalled()

    let resolveRetry: ((value: OpenProviderAutorenewResult) => void) | undefined
    const retryWrite = vi.fn<SetAutorenew>((id, autorenew) => new Promise((resolve) => {
      resolveRetry = resolve
    }))
    const afterGrace = dependencies({
      now: new Date(
        Date.parse("2027-06-26T00:00:00.000Z") +
          PROVIDER_WRITE_RECONCILIATION_GRACE_MS,
      ).toISOString(),
      provider: { autorenew: "on" },
      setAutorenew: retryWrite,
    })

    const retry = reconcileManagedDomainRenewal(store.payload, 950, afterGrace.deps)
    await vi.waitFor(() => expect(retryWrite).toHaveBeenCalledOnce())
    const coalesced = await reconcileManagedDomainRenewal(store.payload, 950, afterGrace.deps)

    expect(coalesced.status).toBe("waiting")
    expect(retryWrite).toHaveBeenCalledOnce()
    resolveRetry?.({ id: 9001, autorenew: "off", status: "ACT", raw: {} })
    await expect(retry).resolves.toMatchObject({ status: "cancelled" })
    expect(initialWrite).toHaveBeenCalledOnce()
    expect(store.cycles[0]).toMatchObject({
      providerWriteState: "confirmed",
      providerAutorenew: "off",
      reconciliationRequired: false,
    })
  })

  it("atomically coalesces concurrent workers before an autorenew provider write", async () => {
    const store = createStore({
      domain: { renewalIntent: false },
      agreement: { state: "cancellation_scheduled", renewalIntent: false },
    })
    let resolveWrite: ((value: OpenProviderAutorenewResult) => void) | undefined
    const setAutorenew = vi.fn<SetAutorenew>((id, autorenew) => new Promise((resolve) => {
      resolveWrite = resolve
    }))
    const fixture = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      setAutorenew,
    })

    const first = reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)
    await vi.waitFor(() => expect(setAutorenew).toHaveBeenCalledOnce())
    const second = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(second.status).toBe("waiting")
    expect(setAutorenew).toHaveBeenCalledOnce()
    resolveWrite?.({ id: 9001, autorenew: "off", status: "ACT", raw: {} })
    await expect(first).resolves.toMatchObject({ status: "cancelled" })
    expect(store.cycles[0]).toMatchObject({
      providerWriteState: "confirmed",
      providerAutorenew: "off",
    })
  })

  it("does not commit an autorenew change until an authoritative provider read proves it", async () => {
    const store = createStore({
      domain: { renewalIntent: false },
      agreement: { state: "cancellation_scheduled", renewalIntent: false },
    })
    const unconfirmed = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      providerWriteApplied: false,
    })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, unconfirmed.deps)

    expect(result.status).toBe("waiting")
    expect(unconfirmed.setAutorenew).toHaveBeenCalledOnce()
    expect(unconfirmed.deps.findOpenProviderDomain).toHaveBeenCalledTimes(2)
    expect(store.cycles[0]).toMatchObject({
      providerAutorenew: "on",
      providerWriteState: "indeterminate",
      reconciliationRequired: true,
      failureReason: "openprovider_autorenew_write_unconfirmed",
    })

    const reconciled = dependencies({
      now: "2027-06-26T00:15:00.000Z",
      provider: { autorenew: "off" },
    })
    await expect(reconcileManagedDomainRenewal(store.payload, 950, reconciled.deps))
      .resolves.toMatchObject({ status: "cancelled" })
    expect(reconciled.setAutorenew).not.toHaveBeenCalled()
    expect(store.cycles[0]).toMatchObject({
      providerAutorenew: "off",
      providerWriteState: "confirmed",
      reconciliationRequired: false,
      failureReason: null,
    })
  })

  it("treats a failed read after a successful autorenew write as indeterminate", async () => {
    const store = createStore({
      domain: { renewalIntent: false },
      agreement: { state: "cancellation_scheduled", renewalIntent: false },
    })
    const findProviderDomain = vi.fn<FindProviderDomain>()
      .mockResolvedValueOnce(providerRecord({ autorenew: "on" }))
      .mockRejectedValueOnce(new Error("provider read unavailable"))
    const fixture = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      findProviderDomain,
    })

    await expect(reconcileManagedDomainRenewal(store.payload, 950, fixture.deps))
      .resolves.toMatchObject({ status: "waiting" })

    expect(fixture.setAutorenew).toHaveBeenCalledOnce()
    expect(findProviderDomain).toHaveBeenCalledTimes(2)
    expect(store.cycles[0]).toMatchObject({
      providerWriteState: "indeterminate",
      reconciliationRequired: true,
      failureReason: "openprovider_autorenew_write_unconfirmed",
    })
    expect(recordCommerceAdminException).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "openprovider_autorenew_write_rejected" }),
    )
  })

  it("records a definitive autorenew rejection and reconciles without a permanent prepared claim", async () => {
    const store = createStore({
      domain: { renewalIntent: false },
      agreement: { state: "cancellation_scheduled", renewalIntent: false },
    })
    const rejectedWrite = vi.fn<SetAutorenew>(async () => {
      throw new Error("provider rejected request")
    })
    const rejected = dependencies({
      now: "2027-06-26T00:00:00.000Z",
      setAutorenew: rejectedWrite,
    })

    await expect(reconcileManagedDomainRenewal(store.payload, 950, rejected.deps))
      .rejects.toThrow("provider rejected request")
    expect(store.cycles[0]).toMatchObject({
      providerWriteState: "failed",
      failureReason: "openprovider_autorenew_write_rejected",
      reconciliationRequired: true,
    })
    expect(recordCommerceAdminException).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "openprovider_autorenew_write_rejected",
        severity: "critical",
      }),
    )

    const reconciled = dependencies({
      now: "2027-06-26T00:15:00.000Z",
      provider: { autorenew: "off" },
    })
    await expect(reconcileManagedDomainRenewal(store.payload, 950, reconciled.deps))
      .resolves.toMatchObject({ status: "cancelled" })
    expect(reconciled.setAutorenew).not.toHaveBeenCalled()
    expect(store.cycles[0]).toMatchObject({
      providerWriteState: "confirmed",
      providerAutorenew: "off",
      reconciliationRequired: false,
    })
  })

  it("reconciles a prepared opposite operation before applying changed renewal intent", async () => {
    const cycle = {
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
      providerRenewalMode: "provider_autorenew",
      providerAutorenew: "off",
      providerOperationId: "openprovider:domain:9001:autorenew:off:renewal:2027-07-26T00:00:00.000Z",
      providerWriteState: "prepared",
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
      reconciliationRequired: true,
      stateHistory: [],
      createdAt: "2027-06-01T00:00:00.000Z",
    }
    const store = createStore({ cycles: [cycle] })
    const fixture = dependencies({
      now: "2027-07-24T00:00:00.000Z",
      provider: { autorenew: "off" },
    })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(result.status).toBe("provider_requested")
    expect(fixture.setAutorenew).toHaveBeenCalledTimes(1)
    expect(fixture.setAutorenew).toHaveBeenCalledWith(9001, "on", { token: "token" })
    expect(cycle).toMatchObject({
      providerWriteState: "confirmed",
      providerAutorenew: "on",
      state: "provider_requested",
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
      providerRenewalMode: "provider_autorenew",
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

  it("waits through the provider renewal-date processing window before raising a risk", async () => {
    const cycle = {
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
      providerRenewalMode: "provider_autorenew",
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
    const store = createStore({ cycles: [cycle] })
    const processing = dependencies({ now: "2027-07-26T00:00:00.001Z" })
    await expect(reconcileManagedDomainRenewal(store.payload, 950, processing.deps))
      .resolves.toMatchObject({ status: "provider_requested" })
    expect(cycle.state).toBe("provider_requested")

    const fixture = dependencies({
      now: new Date(
        new Date("2027-07-26T00:00:00.000Z").getTime() +
          PROVIDER_RENEWAL_ADVANCE_GRACE_MS +
          1,
      ).toISOString(),
    })

    const result = await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    expect(result.status).toBe("manual_review")
    expect(cycle).toMatchObject({
      state: "manual_review",
      adminExceptionCode: "provider_renewal_date_did_not_advance",
    })
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
      providerRenewalMode: "provider_autorenew",
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
      providerRenewalMode: "provider_autorenew",
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

  it.each([
    [90, "2027-04-27T00:00:00.000Z"],
    [60, "2027-05-27T00:00:00.000Z"],
    [30, "2027-06-26T00:00:00.000Z"],
    [14, "2027-07-12T00:00:00.000Z"],
    [7, "2027-07-19T00:00:00.000Z"],
    [1, "2027-07-25T00:00:00.000Z"],
  ])("records only the current governed %i-day reminder", async (offset, now) => {
    vi.mocked(ensureCommerceNotification).mockClear()
    const store = createStore()
    const fixture = dependencies({ now })

    await reconcileManagedDomainRenewal(store.payload, 950, fixture.deps)

    const kinds = vi.mocked(ensureCommerceNotification).mock.calls.map(
      ([notification]) => notification.kind,
    )
    expect(kinds).toEqual(offset === 7
      ? ["domain_renewal_7d", "domain_renewal_admin_7d"]
      : [`domain_renewal_${offset}d`])
    if (offset === 7) {
      expect(store.cycles[0]).toMatchObject({
        providerBalanceAvailableMinor: 100_000,
        providerBalanceReservedMinor: 0,
        providerBalanceCurrency: "EUR",
        providerBalanceCheckedAt: now,
      })
    }
  })
})
