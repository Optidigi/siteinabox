import "server-only"

import {
  DOMAIN_RENEWAL_REMINDER_OFFSETS_DAYS,
  addBillingPeriod,
  assertExclusiveProviderRenewalExecution,
  commercialAmountFromNet,
  providerSafeCutoffAt,
  renewalFinancialCoverage,
} from "@siteinabox/contracts/commerce"
import {
  getTldCapabilityForProductionOperation,
  getTldCapabilityByVersion,
  tldCapabilityAt,
  type TldCapability,
  type TldProductionOperation,
} from "@siteinabox/contracts/tld-capabilities"
import type { Payload, Where } from "payload"
import type {
  BillingAgreement,
  DomainRenewalCycle,
  ManagedDomain,
  Order,
  PaymentAttempt,
} from "@/payload-types"

import { recordCommerceAdminException } from "@/lib/commerce/alerts"
import {
  commerceProviderReadsAllowed,
  commerceProviderWritesAllowed,
} from "@/lib/commerce/releaseGate"
import { ensureCommerceNotification } from "@/lib/commerce/notifications"
import { PLATFORM_CONTACT_RECIPIENT } from "@/lib/contact/platformContact"
import {
  OpenProviderIndeterminateWriteError,
  findOpenProviderDomain,
  getOpenProviderDomainRenewalPrice,
  getOpenProviderResellerBalance,
  loginOpenProvider,
  normalizeOpenProviderTimestamp,
  setOpenProviderDomainAutorenew,
  type OpenProviderAutorenewResult,
  type OpenProviderDomainPrice,
  type OpenProviderDomainRecord,
} from "@/lib/domains/openprovider"
import { createApplicationRecurringMolliePayment } from "@/lib/payments/molliePayments"
import { findOneDoc } from "@/lib/payloadCollection"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"

const DAY_MS = 24 * 60 * 60_000
export const PROVIDER_RENEWAL_ADVANCE_GRACE_MS = DAY_MS
export const PROVIDER_WRITE_RECONCILIATION_GRACE_MS = 15 * 60_000
export const PROVIDER_RENEWAL_LOOKAHEAD_DAYS = Math.max(
  ...DOMAIN_RENEWAL_REMINDER_OFFSETS_DAYS,
)
const TERMINAL_ATTEMPT_STATES = ["failed", "cancelled", "expired", "chargeback"]

type RenewalDependencies = {
  now: () => Date
  productionOperationAllowed: (
    tld: string,
    operation: Extract<
      TldProductionOperation,
      "renewal_provider_autorenew" | "renewal_explicit"
    >,
    effectiveAt: Date,
  ) => boolean
  providerReadsAllowed: () => boolean
  providerWritesAllowed: () => boolean
  loginOpenProvider: typeof loginOpenProvider
  findOpenProviderDomain: typeof findOpenProviderDomain
  getOpenProviderDomainRenewalPrice: typeof getOpenProviderDomainRenewalPrice
  getOpenProviderResellerBalance: typeof getOpenProviderResellerBalance
  setOpenProviderDomainAutorenew: typeof setOpenProviderDomainAutorenew
}

const defaultDependencies: RenewalDependencies = {
  now: () => new Date(),
  productionOperationAllowed: (tld, operation, effectiveAt) =>
    getTldCapabilityForProductionOperation(tld, operation, effectiveAt) !== null,
  providerReadsAllowed: commerceProviderReadsAllowed,
  providerWritesAllowed: commerceProviderWritesAllowed,
  loginOpenProvider,
  findOpenProviderDomain,
  getOpenProviderDomainRenewalPrice,
  getOpenProviderResellerBalance,
  setOpenProviderDomainAutorenew,
}

const numericRelationshipId = (
  value: Parameters<typeof relationshipId>[0],
): number | undefined => {
  const id = relationshipId(value)
  if (id == null) return undefined
  const numeric = Number(id)
  if (!Number.isSafeInteger(numeric)) throw new Error("Expected a numeric Payload relationship id.")
  return numeric
}

const relationIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const id = numericRelationshipId(entry)
    return id == null ? [] : [id]
  })
}

export function normalizeOpenProviderRenewalDate(value: string): string {
  const normalized = normalizeOpenProviderTimestamp(value)
  if (!normalized) throw new Error("Openprovider renewal_date is invalid.")
  return normalized
}

const cycleHistory = (
  cycle: DomainRenewalCycle | null,
  state: DomainRenewalCycle["state"],
  at: string,
  reason: string,
) => [
  ...(cycle && Array.isArray(cycle.stateHistory) ? cycle.stateHistory : []),
  { state, at, reason },
]

const updateManagedDomain = (
  payload: Payload,
  domain: ManagedDomain,
  data: Partial<ManagedDomain>,
): Promise<ManagedDomain> => payload.update({
  collection: "managed-domains",
  id: domain.id,
  data,
  depth: 0,
  overrideAccess: true,
  context: { managedDomainLifecycleMutation: true },
}) as Promise<ManagedDomain>

const updateCycle = (
  payload: Payload,
  cycle: DomainRenewalCycle,
  data: Partial<DomainRenewalCycle>,
): Promise<DomainRenewalCycle> => payload.update({
  collection: "domain-renewal-cycles",
  id: cycle.id,
  data,
  depth: 0,
  overrideAccess: true,
  context: { domainRenewalCycleLifecycleMutation: true },
}) as Promise<DomainRenewalCycle>

const providerWriteAwaitingReconciliation = (
  cycle: DomainRenewalCycle,
): boolean => ["prepared", "indeterminate"].includes(cycle.providerWriteState)

async function claimAutorenewWrite(
  payload: Payload,
  cycle: DomainRenewalCycle,
  data: Partial<DomainRenewalCycle>,
): Promise<DomainRenewalCycle | null> {
  const claimed = await payload.update({
    collection: "domain-renewal-cycles",
    where: {
      and: [
        { id: { equals: cycle.id } },
        { providerWriteState: { not_in: ["prepared", "indeterminate"] } },
      ],
    },
    data,
    depth: 0,
    overrideAccess: true,
    context: { domainRenewalCycleLifecycleMutation: true },
  })
  return Array.isArray(claimed.docs)
    ? claimed.docs[0] as DomainRenewalCycle | undefined ?? null
    : null
}

async function reclaimStaleAutorenewWrite(
  payload: Payload,
  cycle: DomainRenewalCycle,
  operationId: string,
  data: Partial<DomainRenewalCycle>,
  now: string,
): Promise<DomainRenewalCycle | null> {
  const reconciliationCutoff = new Date(
    new Date(now).getTime() - PROVIDER_WRITE_RECONCILIATION_GRACE_MS,
  ).toISOString()
  const claimed = await payload.update({
    collection: "domain-renewal-cycles",
    where: {
      and: [
        { id: { equals: cycle.id } },
        { providerOperationId: { equals: operationId } },
        { providerWriteState: { in: ["prepared", "indeterminate"] } },
        {
          or: [
            { providerWriteRequestedAt: { exists: false } },
            { providerWriteRequestedAt: { less_than_equal: reconciliationCutoff } },
          ],
        },
      ],
    },
    data,
    depth: 0,
    overrideAccess: true,
    context: { domainRenewalCycleLifecycleMutation: true },
  })
  return Array.isArray(claimed.docs)
    ? claimed.docs[0] as DomainRenewalCycle | undefined ?? null
    : null
}

async function findBillingAgreement(
  payload: Payload,
  domain: ManagedDomain,
): Promise<BillingAgreement | null> {
  const tenantId = relationshipId(domain.tenant)
  if (!tenantId) return null
  const result = await payload.find({
    collection: "billing-agreements",
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { state: { in: ["active", "past_due", "suspended", "cancellation_scheduled"] } },
      ],
    },
    sort: "-createdAt",
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (result.docs.length > 1) {
    await recordCommerceAdminException({
      payload,
      source: "payments",
      code: "multiple_current_billing_agreements",
      message: "Managed domain has more than one current billing agreement.",
      tenant: domain.tenant,
      subjectId: domain.id,
    })
  }
  return result.docs[0] as BillingAgreement | undefined ?? null
}

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

async function renewalCapabilityForManagedDomain(
  payload: Payload,
  domain: ManagedDomain,
  now: Date,
): Promise<{
  capability: TldCapability
  acceptedObligation: boolean
} | null> {
  const orderId = relationshipId(domain.originatingOrder)
  if (orderId) {
    const order = await payload.findByID({
      collection: "orders",
      id: orderId,
      depth: 0,
      overrideAccess: true,
    }) as Order
    const quoteEvidence = objectValue(order.quoteEvidence)
    const hasAcceptedCapabilityEvidence = Object.hasOwn(
      quoteEvidence,
      "tldCapability",
    )
    const tldEvidence = objectValue(quoteEvidence.tldCapability)
    const capabilityVersion = typeof tldEvidence.capabilityVersion === "string"
      ? tldEvidence.capabilityVersion
      : ""
    const acceptedCapability = getTldCapabilityByVersion(capabilityVersion)
    if (
      acceptedCapability &&
      acceptedCapability.tld === domain.tld &&
      tldEvidence.tld === domain.tld
    ) {
      return {
        capability: acceptedCapability,
        acceptedObligation: true,
      }
    }
    if (hasAcceptedCapabilityEvidence) return null
  }
  const capability = tldCapabilityAt(domain.tld, now)
  return capability
    ? { capability, acceptedObligation: false }
    : null
}

const renewalProductionOperation = (
  capability: TldCapability,
): Extract<
  TldProductionOperation,
  "renewal_provider_autorenew" | "renewal_explicit"
> => capability.renewal.executionMode === "provider_autorenew"
  ? "renewal_provider_autorenew"
  : "renewal_explicit"

async function findCycle(
  payload: Payload,
  domain: ManagedDomain,
  providerRenewalDate: string,
): Promise<DomainRenewalCycle | null> {
  return findOneDoc(payload, "domain-renewal-cycles", {
    and: [
      { managedDomain: { equals: domain.id } },
      { providerRenewalDate: { equals: providerRenewalDate } },
    ],
  } satisfies Where)
}

async function createCycle(input: {
  payload: Payload
  domain: ManagedDomain
  agreement: BillingAgreement | null
  providerDomain: OpenProviderDomainRecord
  price: OpenProviderDomainPrice
  providerRenewalDate: string
  capability: TldCapability
  now: string
}): Promise<DomainRenewalCycle> {
  if (input.price.currency !== "EUR") {
    throw new Error("Openprovider renewal price must be quoted in EUR.")
  }
  const financial = renewalFinancialCoverage(input.price.netAmountMinor)
  const providerSafeCutoff = providerSafeCutoffAt(
    input.providerRenewalDate,
    input.capability.renewal.providerSafeCutoffLeadDays,
  )
  const sixtyDayChargeAt = new Date(
    new Date(input.providerRenewalDate).getTime() - 60 * DAY_MS,
  ).toISOString()
  const paymentChargeAt = new Date(
    Math.min(
      new Date(sixtyDayChargeAt).getTime(),
      new Date(providerSafeCutoff).getTime(),
    ),
  ).toISOString()
  const registryExpiryDate = normalizeOpenProviderTimestamp(
    input.providerDomain.registryExpiryDate,
  ) ?? undefined
  const coverageEndsAt = addBillingPeriod(input.providerRenewalDate, "annual")
  const paidSubscriptionCoversRenewal = Boolean(
    input.agreement &&
    input.agreement.currentPeriodEndsAt &&
    new Date(input.agreement.currentPeriodEndsAt) >= new Date(input.providerRenewalDate) &&
    ["active", "cancellation_scheduled"].includes(input.agreement.state),
  )
  const pricingIsActionable = new Date(input.now) >= new Date(paymentChargeAt)
  const allowanceSecured = pricingIsActionable &&
    financial.surchargeNetMinor === 0 &&
    paidSubscriptionCoversRenewal
  const renewalIntent = input.domain.renewalIntent &&
    input.agreement?.renewalIntent !== false
  const state: DomainRenewalCycle["state"] = !renewalIntent
    ? "cancelled"
    : !pricingIsActionable
      ? "scheduled"
      : allowanceSecured ? "payment_committed" : "payment_required"
  const idempotencyKey = `openprovider:renewal:${input.domain.id}:${input.providerRenewalDate}`
  try {
    return await input.payload.create({
      collection: "domain-renewal-cycles",
      data: {
        idempotencyKey,
        managedDomain: Number(input.domain.id),
        billingAgreement: input.agreement ? Number(input.agreement.id) : undefined,
        tenant: numericRelationshipId(input.domain.tenant),
        state,
        coverageStartsAt: input.providerRenewalDate,
        coverageEndsAt,
        providerRenewalDate: input.providerRenewalDate,
        registryExpiryDate,
        registrarSafeCutoffAt: providerSafeCutoff,
        paymentChargeAt,
        providerSafeCutoffAt: providerSafeCutoff,
        renewalIntentSnapshot: renewalIntent,
        providerRenewalMode: input.capability.renewal.executionMode,
        providerAutorenew: input.providerDomain.autorenew,
        providerWriteState: "not_required",
        currency: "EUR",
        providerOperationPriceNetMinor: financial.providerOperationPriceNetMinor,
        includedAllowanceNetMinor: financial.includedAllowanceNetMinor,
        surchargeNetMinor: financial.surchargeNetMinor,
        financialCoverageState: allowanceSecured
          ? "payment_secured"
          : financial.initialState,
        pricingEvidence: {
          version: 1,
          provider: "openprovider",
          tld: input.capability.tld,
          tldCapabilityVersion: input.capability.capabilityVersion,
          operation: "renew",
          quotedAt: input.now,
          premium: input.price.premium,
          currency: input.price.currency,
          providerOperationPriceNetMinor: input.price.netAmountMinor,
          includedAllowanceNetMinor: financial.includedAllowanceNetMinor,
          surchargeNetMinor: financial.surchargeNetMinor,
        },
        netAmountMinor: financial.surchargeNetMinor,
        vatAmountMinor: commercialAmountFromNet(financial.surchargeNetMinor).vatAmountMinor,
        grossAmountMinor: commercialAmountFromNet(financial.surchargeNetMinor).grossAmountMinor,
        paymentSecuredAt: allowanceSecured ? input.now : undefined,
        cancelledAt: state === "cancelled" ? input.now : undefined,
        failureReason: state === "cancelled" ? "renewal_intent_off" : undefined,
        reconciliationRequired: false,
        lastSyncedAt: input.now,
        stateHistory: cycleHistory(null, state, input.now, allowanceSecured
          ? "paid_subscription_included_allowance"
          : state === "cancelled"
            ? "renewal_intent_off"
            : state === "scheduled"
              ? "indicative_renewal_price_recorded"
              : "financial_coverage_required"),
        createdAt: input.now,
      },
      depth: 0,
      overrideAccess: true,
    }) as DomainRenewalCycle
  } catch (error) {
    const raced = await findCycle(
      input.payload,
      input.domain,
      input.providerRenewalDate,
    )
    if (raced) return raced
    throw error
  }
}

async function activateScheduledCycle(input: {
  payload: Payload
  cycle: DomainRenewalCycle
  domain: ManagedDomain
  agreement: BillingAgreement | null
  capability: TldCapability
  token: string
  dependencies: RenewalDependencies
  now: string
}): Promise<DomainRenewalCycle> {
  if (
    input.cycle.state !== "scheduled" ||
    !input.cycle.paymentChargeAt ||
    new Date(input.now) < new Date(input.cycle.paymentChargeAt)
  ) {
    return input.cycle
  }
  const price = await input.dependencies.getOpenProviderDomainRenewalPrice(
    input.domain.domainNameAscii,
    { token: input.token },
  )
  if (price.currency !== "EUR") {
    throw new Error("Openprovider renewal price must be quoted in EUR.")
  }
  const financial = renewalFinancialCoverage(price.netAmountMinor)
  const amount = commercialAmountFromNet(financial.surchargeNetMinor)
  const paidSubscriptionCoversRenewal = Boolean(
    input.agreement &&
    input.agreement.currentPeriodEndsAt &&
    new Date(input.agreement.currentPeriodEndsAt) >= new Date(input.cycle.providerRenewalDate) &&
    ["active", "cancellation_scheduled"].includes(input.agreement.state),
  )
  const allowanceSecured = financial.surchargeNetMinor === 0 && paidSubscriptionCoversRenewal
  const renewalIntent = input.domain.renewalIntent &&
    input.agreement?.renewalIntent !== false
  const state: DomainRenewalCycle["state"] = !renewalIntent
    ? "cancelled"
    : allowanceSecured ? "payment_committed" : "payment_required"
  await updateManagedDomain(input.payload, input.domain, {
    providerRenewalPriceNetMinor: price.netAmountMinor,
    providerRenewalPriceCurrency: price.currency,
    providerRenewalPriceQuotedAt: input.now,
  })
  return updateCycle(input.payload, input.cycle, {
    state,
    providerOperationPriceNetMinor: financial.providerOperationPriceNetMinor,
    includedAllowanceNetMinor: financial.includedAllowanceNetMinor,
    surchargeNetMinor: financial.surchargeNetMinor,
    financialCoverageState: allowanceSecured ? "payment_secured" : financial.initialState,
    pricingEvidence: {
      version: 1,
      provider: "openprovider",
      tld: input.capability.tld,
      tldCapabilityVersion: input.capability.capabilityVersion,
      operation: "renew",
      quotedAt: input.now,
      premium: price.premium,
      currency: price.currency,
      providerOperationPriceNetMinor: price.netAmountMinor,
      includedAllowanceNetMinor: financial.includedAllowanceNetMinor,
      surchargeNetMinor: financial.surchargeNetMinor,
    },
    netAmountMinor: amount.netAmountMinor,
    vatAmountMinor: amount.vatAmountMinor,
    grossAmountMinor: amount.grossAmountMinor,
    paymentSecuredAt: allowanceSecured ? input.now : null,
    cancelledAt: state === "cancelled" ? input.now : null,
    failureReason: state === "cancelled" ? "renewal_intent_off" : null,
    lastSyncedAt: input.now,
    stateHistory: cycleHistory(
      input.cycle,
      state,
      input.now,
      allowanceSecured
        ? "actionable_price_with_paid_subscription_allowance"
        : state === "cancelled"
          ? "renewal_intent_off"
          : "actionable_price_requires_financial_coverage",
    ),
  })
}

async function originatingOrder(
  payload: Payload,
  agreement: BillingAgreement,
): Promise<Order> {
  const orderId = relationshipId(agreement.originatingOrder)
  if (!orderId) throw new Error("Billing agreement is missing its originating order.")
  return payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as Promise<Order>
}

async function ensureDomainRenewalOrder(input: {
  payload: Payload
  agreement: BillingAgreement
  cycle: DomainRenewalCycle
  domain: ManagedDomain
}): Promise<Order> {
  const billingCycleKey = `domain-renewal-cycle:${input.cycle.id}`
  const existing = await findOneDoc(input.payload, "orders", {
    billingCycleKey: { equals: billingCycleKey },
  })
  if (existing) return existing
  const origin = await originatingOrder(input.payload, input.agreement)
  const amount = commercialAmountFromNet(input.cycle.surchargeNetMinor)
  const now = new Date().toISOString()
  const lineItems = [{
    code: "domain-renewal-surcharge",
    description: `Domeinverlengingstoeslag ${input.domain.domainNameAscii}`,
    quantity: 1,
    netAmountMinor: input.cycle.surchargeNetMinor,
  }]
  try {
    return await input.payload.create({
      collection: "orders",
      data: {
        orderNumber: `SIAB-DREN-${input.cycle.id}`,
        tenant: numericRelationshipId(input.agreement.tenant),
        generationRun: numericRelationshipId(origin.generationRun),
        state: "accepted",
        checkoutProfileKey: origin.checkoutProfileKey,
        catalogVersion: input.agreement.catalogVersion,
        billingCycleKey,
        billingAgreement: Number(input.agreement.id),
        renewalCycle: Number(input.cycle.id),
        orderKind: "domain_renewal",
        servicePeriodStartsAt: input.cycle.coverageStartsAt,
        servicePeriodEndsAt: input.cycle.coverageEndsAt,
        quoteEvidence: {
          schemaVersion: 1,
          kind: "application_created_domain_renewal",
          originatingOrderId: origin.id,
          billingAgreementId: input.agreement.id,
          renewalCycleId: input.cycle.id,
          providerRenewalDate: input.cycle.providerRenewalDate,
          pricingEvidence: input.cycle.pricingEvidence,
        },
        netLineItems: lineItems,
        vatRateBasisPoints: 2_100,
        subtotalNetMinor: amount.netAmountMinor,
        vatAmountMinor: amount.vatAmountMinor,
        totalGrossMinor: amount.grossAmountMinor,
        contractingPartyProfileVersion: origin.contractingPartyProfileVersion,
        termsVersion: origin.termsVersion,
        privacyVersion: origin.privacyVersion,
        businessUseDeclarationVersion: origin.businessUseDeclarationVersion,
        acceptedAt: now,
        customerName: origin.customerName,
        customerEmail: origin.customerEmail,
        companyName: origin.companyName,
        billingAddress: origin.billingAddress,
        packageCode: "domain-renewal-surcharge",
        billingPeriod: "one_time",
        renewalTerms: origin.renewalTerms,
        lineItems,
        currency: amount.currency,
        subtotalNet: amount.netAmountMinor / 100,
        vatAmount: amount.vatAmountMinor / 100,
        totalGross: amount.grossAmountMinor / 100,
        domain: input.domain.domainNameAscii,
        domainRegistrant: origin.domainRegistrant,
        legalDocuments: relationIds(origin.legalDocuments),
        paymentStatus: "pending",
        paymentProvider: "mollie",
        createdAt: now,
      },
      depth: 0,
      overrideAccess: true,
    }) as Order
  } catch (error) {
    const raced = await findOneDoc(input.payload, "orders", {
      billingCycleKey: { equals: billingCycleKey },
    })
    if (raced) return raced
    throw error
  }
}

const elapsedReminderCount = (renewalDate: string, now: Date): number =>
  DOMAIN_RENEWAL_REMINDER_OFFSETS_DAYS.filter(
    (offset) => now.getTime() >= new Date(renewalDate).getTime() - offset * DAY_MS,
  ).length

const currentRenewalReminderOffset = (
  renewalDate: string,
  now: Date,
): (typeof DOMAIN_RENEWAL_REMINDER_OFFSETS_DAYS)[number] | null => {
  const renewalAt = new Date(renewalDate).getTime()
  if (now.getTime() > renewalAt) return null
  for (const offset of [...DOMAIN_RENEWAL_REMINDER_OFFSETS_DAYS].reverse()) {
    if (now.getTime() >= renewalAt - offset * DAY_MS) return offset
  }
  return null
}

const providerAmountMinor = (value: number): number => {
  const minor = Math.round(value * 100)
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error("Openprovider balance amount is invalid.")
  }
  return minor
}

async function ensureDomainPayment(input: {
  payload: Payload
  agreement: BillingAgreement
  cycle: DomainRenewalCycle
  domain: ManagedDomain
  now: Date
}): Promise<DomainRenewalCycle> {
  if (input.cycle.surchargeNetMinor === 0) return input.cycle
  const order = await ensureDomainRenewalOrder(input)
  let cycle = input.cycle
  if (!sameRelationshipId(cycle.order, order.id)) {
    cycle = await updateCycle(input.payload, cycle, {
      order: order.id,
      financialCoverageState: "payment_pending",
    })
  }
  const attemptsResult = await input.payload.find({
    collection: "payment-attempts",
    where: {
      and: [
        { order: { equals: order.id } },
        { purpose: { equals: "domain_renewal" } },
      ],
    },
    sort: "attemptNumber",
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  const attempts = attemptsResult.docs as PaymentAttempt[]
  const latest = attempts.at(-1)
  if (latest && !TERMINAL_ATTEMPT_STATES.includes(latest.state)) return cycle
  const attemptNumber = Math.max(1, elapsedReminderCount(cycle.providerRenewalDate, input.now))
  if (attempts.some((attempt) => attempt.attemptNumber === attemptNumber)) return cycle
  await createApplicationRecurringMolliePayment(input.payload, {
    billingAgreementId: input.agreement.id,
    orderId: order.id,
    purpose: "domain_renewal",
    attemptNumber,
  })
  return cycle
}

async function ensureRenewalNotifications(input: {
  payload: Payload
  cycle: DomainRenewalCycle
  domain: ManagedDomain
  agreement: BillingAgreement | null
  now: Date
}) {
  const tenantId = relationshipId(input.domain.tenant)
  if (
    !tenantId ||
    !input.agreement ||
    input.cycle.state === "cancelled" ||
    !input.cycle.renewalIntentSnapshot
  ) return
  const origin = await originatingOrder(input.payload, input.agreement)
  const offset = currentRenewalReminderOffset(input.cycle.providerRenewalDate, input.now)
  if (offset == null) return
  await ensureCommerceNotification({
    payload: input.payload,
    kind: `domain_renewal_${offset}d`,
    tenantId,
    recipient: origin.customerEmail,
    eventAt: input.cycle.providerRenewalDate,
    renewalCycleId: input.cycle.id,
  })
  if (offset === 7) {
    await ensureCommerceNotification({
      payload: input.payload,
      kind: "domain_renewal_admin_7d",
      tenantId,
      recipient: PLATFORM_CONTACT_RECIPIENT,
      eventAt: input.cycle.providerRenewalDate,
      renewalCycleId: input.cycle.id,
    })
  }
}

async function setAutorenew(input: {
  payload: Payload
  cycle: DomainRenewalCycle
  domain: ManagedDomain
  desired: "on" | "off"
  providerDomain: OpenProviderDomainRecord
  token: string
  dependencies: RenewalDependencies
  now: string
}): Promise<DomainRenewalCycle> {
  assertExclusiveProviderRenewalExecution({
    mode: input.cycle.providerRenewalMode,
    providerAutorenewEnabled: input.desired === "on",
    explicitRenewalRequested: false,
  })
  let cycle = input.cycle
  if (input.providerDomain.autorenew === input.desired) {
    return updateCycle(input.payload, input.cycle, {
      providerAutorenew: input.desired,
      providerWriteState: "confirmed",
      reconciliationRequired: false,
      lastSyncedAt: input.now,
    })
  }
  const operationId = [
    "openprovider",
    "domain",
    input.providerDomain.id,
    "autorenew",
    input.desired,
    "renewal",
    input.cycle.providerRenewalDate,
  ].join(":")
  let claimedCycle: DomainRenewalCycle | null = null
  if (providerWriteAwaitingReconciliation(cycle)) {
    if (cycle.providerOperationId === operationId) {
      const requestedAt = cycle.providerWriteRequestedAt
        ? new Date(cycle.providerWriteRequestedAt).getTime()
        : Number.NaN
      if (
        Number.isFinite(requestedAt) &&
        new Date(input.now).getTime() - requestedAt < PROVIDER_WRITE_RECONCILIATION_GRACE_MS
      ) {
        return cycle
      }
      claimedCycle = await reclaimStaleAutorenewWrite(
        input.payload,
        cycle,
        operationId,
        {
          providerWriteState: "prepared",
          providerWriteRequestedAt: input.now,
          providerAutorenew: input.providerDomain.autorenew,
          reconciliationRequired: true,
          failureReason: null,
          lastSyncedAt: input.now,
          stateHistory: cycleHistory(
            cycle,
            cycle.state,
            input.now,
            "stale_provider_write_reconciled_before_retry",
          ),
        },
        input.now,
      )
      if (!claimedCycle) {
        return input.payload.findByID({
          collection: "domain-renewal-cycles",
          id: cycle.id,
          depth: 0,
          overrideAccess: true,
        }) as Promise<DomainRenewalCycle>
      }
    } else {
      cycle = await updateCycle(input.payload, cycle, {
        providerAutorenew: input.providerDomain.autorenew,
        providerWriteState: "confirmed",
        reconciliationRequired: false,
        failureReason: null,
        lastSyncedAt: input.now,
        stateHistory: cycleHistory(
          cycle,
          cycle.state,
          input.now,
          "prior_provider_write_reconciled_before_opposite_intent",
        ),
      })
    }
  }
  claimedCycle ??= await claimAutorenewWrite(input.payload, cycle, {
    providerOperationId: operationId,
    providerWriteState: "prepared",
    providerWriteRequestedAt: input.now,
    providerAutorenew: input.providerDomain.autorenew,
    reconciliationRequired: true,
    lastSyncedAt: input.now,
  })
  if (!claimedCycle) {
    return input.payload.findByID({
      collection: "domain-renewal-cycles",
      id: cycle.id,
      depth: 0,
      overrideAccess: true,
    }) as Promise<DomainRenewalCycle>
  }
  cycle = claimedCycle
  try {
    const result: OpenProviderAutorenewResult = await input.dependencies.setOpenProviderDomainAutorenew(
      input.providerDomain.id,
      input.desired,
      { token: input.token },
    )
    cycle = await updateCycle(input.payload, cycle, {
      providerStatus: result.status ?? input.providerDomain.status,
      providerAutorenew: input.desired,
      providerWriteState: "confirmed",
      reconciliationRequired: false,
      lastSyncedAt: input.now,
      stateHistory: cycleHistory(cycle, cycle.state, input.now, `provider_autorenew_${input.desired}`),
    })
    await updateManagedDomain(input.payload, input.domain, {
      providerAutorenew: input.desired,
      providerAutorenewCheckedAt: input.now,
      lastSyncedAt: input.now,
    })
    return cycle
  } catch (error) {
    if (error instanceof OpenProviderIndeterminateWriteError) {
      return updateCycle(input.payload, cycle, {
        providerWriteState: "indeterminate",
        reconciliationRequired: true,
        failureReason: "openprovider_autorenew_write_indeterminate",
        lastSyncedAt: input.now,
      })
    }
    cycle = await updateCycle(input.payload, cycle, {
      providerWriteState: "failed",
      reconciliationRequired: true,
      failureReason: "openprovider_autorenew_write_rejected",
      adminExceptionCode: "openprovider_autorenew_write_rejected",
      adminExceptionAt: input.now,
      lastSyncedAt: input.now,
    })
    await recordCommerceAdminException({
      payload: input.payload,
      source: "domains",
      code: "openprovider_autorenew_write_rejected",
      message: "Openprovider rejected a domain autorenew state change.",
      tenant: input.domain.tenant,
      subjectId: cycle.id,
      severity: "critical",
      now: input.now,
    })
    throw error
  }
}

async function completeAdvancedCycle(input: {
  payload: Payload
  cycle: DomainRenewalCycle
  domain: ManagedDomain
  providerDomain: OpenProviderDomainRecord
  advancedRenewalDate: string
  capability: TldCapability
  now: string
}): Promise<void> {
  const hadFinancialCoverage = Boolean(input.cycle.paymentSecuredAt) ||
    ["payment_committed", "provider_requested", "renewed"].includes(input.cycle.state)
  await updateCycle(input.payload, input.cycle, {
    state: "renewed",
    providerStatus: input.providerDomain.status,
    providerAutorenew: input.providerDomain.autorenew,
    renewedAt: input.now,
    financialCoverageState: "covered",
    reconciliationRequired: !hadFinancialCoverage,
    failureReason: hadFinancialCoverage ? null : "provider_renewed_without_financial_coverage",
    adminExceptionCode: hadFinancialCoverage ? null : "uncovered_provider_renewal",
    adminExceptionAt: hadFinancialCoverage ? null : input.now,
    lastSyncedAt: input.now,
    stateHistory: cycleHistory(input.cycle, "renewed", input.now, "provider_renewal_date_advanced"),
  })
  await updateManagedDomain(input.payload, input.domain, {
    state: "active",
    expiresAt: input.advancedRenewalDate,
    providerRenewalDate: input.advancedRenewalDate,
    registryExpiryDate: input.providerDomain.registryExpiryDate
      ? normalizeOpenProviderRenewalDate(input.providerDomain.registryExpiryDate)
      : input.domain.registryExpiryDate,
    registrarSafeCutoffAt: providerSafeCutoffAt(
      input.advancedRenewalDate,
      input.capability.renewal.providerSafeCutoffLeadDays,
    ),
    providerSafeRenewalCutoffAt: providerSafeCutoffAt(
      input.advancedRenewalDate,
      input.capability.renewal.providerSafeCutoffLeadDays,
    ),
    providerAutorenew: input.providerDomain.autorenew,
    providerAutorenewCheckedAt: input.now,
    reconciliationRequired: !hadFinancialCoverage,
    lastSyncedAt: input.now,
  })
  if (!hadFinancialCoverage) {
    await recordCommerceAdminException({
      payload: input.payload,
      source: "domains",
      code: "uncovered_provider_renewal",
      message: "Openprovider renewed a customer domain without recorded financial coverage.",
      tenant: input.domain.tenant,
      subjectId: input.cycle.id,
      severity: "critical",
      now: input.now,
    })
  }
  const agreementId = relationshipId(input.cycle.billingAgreement)
  if (agreementId) {
    const agreement = await input.payload.findByID({
      collection: "billing-agreements",
      id: agreementId,
      depth: 0,
      overrideAccess: true,
    }) as BillingAgreement
    const origin = await originatingOrder(input.payload, agreement)
    const tenantId = relationshipId(input.domain.tenant)
    if (tenantId) {
      await ensureCommerceNotification({
        payload: input.payload,
        kind: "domain_renewed",
        tenantId,
        recipient: origin.customerEmail,
        eventAt: input.now,
        renewalCycleId: input.cycle.id,
      })
    }
  }
}

export async function reconcileManagedDomainRenewal(
  payload: Payload,
  managedDomainId: string | number,
  dependencies: Partial<RenewalDependencies> = {},
): Promise<{ status: string; cycleId?: string | number }> {
  const deps = { ...defaultDependencies, ...dependencies }
  const nowDate = deps.now()
  const now = nowDate.toISOString()
  let domain = await payload.findByID({
    collection: "managed-domains",
    id: managedDomainId,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  const capabilityResolution = await renewalCapabilityForManagedDomain(
    payload,
    domain,
    nowDate,
  )
  const capability = capabilityResolution?.capability ?? null
  if (
    domain.custodyStatus === "transferred_out" ||
    domain.provider !== "openprovider" ||
    !domain.providerDomainId ||
    !capability ||
    capability.provider !== "openprovider" ||
    capability.renewal.executionMode !== "provider_autorenew"
  ) {
    return { status: "not_applicable" }
  }
  // Operation flags govern new commitments. A domain already frozen into an
  // accepted order remains a customer obligation and must keep its renewal
  // safety reconciliation when launch scope is rolled back.
  const productionOperationAllowed = Boolean(
    capabilityResolution?.acceptedObligation,
  ) || deps.productionOperationAllowed(
    domain.tld,
    renewalProductionOperation(capability),
    nowDate,
  )
  if (!productionOperationAllowed) {
    const existingCycles = await payload.find({
      collection: "domain-renewal-cycles",
      where: { managedDomain: { equals: domain.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existingCycles.docs.length === 0) return { status: "not_applicable" }
  }
  if (!deps.providerReadsAllowed()) {
    const committedCycles = await payload.find({
      collection: "domain-renewal-cycles",
      where: {
        and: [
          { managedDomain: { equals: domain.id } },
          {
            or: [
              {
                state: {
                  in: ["payment_committed", "provider_requested"],
                },
              },
              { paymentSecuredAt: { exists: true } },
              { providerWriteState: { equals: "indeterminate" } },
            ],
          },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (committedCycles.docs.length === 0) {
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "renewal_reconciliation_release_blocked",
        message: "Domain renewal reconciliation is blocked until provider reads are enabled.",
        tenant: domain.tenant,
        subjectId: domain.id,
        severity: domain.providerAutorenew === "on" ? "critical" : "error",
        now,
      })
      return { status: "release_blocked" }
    }
  }
  const token = await deps.loginOpenProvider()
  const providerDomain = await deps.findOpenProviderDomain(domain.domainNameAscii, { token })
  if (!providerDomain || String(providerDomain.id) !== String(domain.providerDomainId)) {
    await recordCommerceAdminException({
      payload,
      source: "domains",
      code: "provider_domain_missing_for_renewal",
      message: "Managed domain could not be reconciled to its Openprovider domain id.",
      tenant: domain.tenant,
      subjectId: domain.id,
      now,
    })
    await updateManagedDomain(payload, domain, {
      state: "manual_review",
      reconciliationRequired: true,
      failureReason: "provider_domain_missing_for_renewal",
      lastSyncedAt: now,
    })
    return { status: "manual_review" }
  }
  if (!providerDomain.renewalDate) {
    await recordCommerceAdminException({
      payload,
      source: "domains",
      code: "provider_renewal_date_missing",
      message: "Openprovider domain response has no renewal_date.",
      tenant: domain.tenant,
      subjectId: domain.id,
      now,
    })
    await updateManagedDomain(payload, domain, {
      reconciliationRequired: true,
      failureReason: "provider_renewal_date_missing",
      lastSyncedAt: now,
    })
    return { status: "admin_exception" }
  }
  const providerRenewalDate = normalizeOpenProviderRenewalDate(providerDomain.renewalDate)
  const openCycles = await payload.find({
    collection: "domain-renewal-cycles",
    where: {
      and: [
        { managedDomain: { equals: domain.id } },
        { state: { not_in: ["renewed", "cancelled"] } },
      ],
    },
    sort: "providerRenewalDate",
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  for (const existing of openCycles.docs as DomainRenewalCycle[]) {
    if (new Date(providerRenewalDate) > new Date(existing.providerRenewalDate)) {
      await completeAdvancedCycle({
        payload,
        cycle: existing,
        domain,
        providerDomain,
        advancedRenewalDate: providerRenewalDate,
        capability,
        now,
      })
    }
  }
  domain = await updateManagedDomain(payload, domain, {
    expiresAt: providerRenewalDate,
    providerRenewalDate,
    registryExpiryDate: providerDomain.registryExpiryDate
      ? normalizeOpenProviderRenewalDate(providerDomain.registryExpiryDate)
      : domain.registryExpiryDate,
    registrarSafeCutoffAt: providerSafeCutoffAt(
      providerRenewalDate,
      capability.renewal.providerSafeCutoffLeadDays,
    ),
    paymentChargeAt: new Date(Math.min(
      new Date(providerRenewalDate).getTime() - 60 * DAY_MS,
      new Date(providerSafeCutoffAt(
        providerRenewalDate,
        capability.renewal.providerSafeCutoffLeadDays,
      )).getTime(),
    )).toISOString(),
    providerSafeRenewalCutoffAt: providerSafeCutoffAt(
      providerRenewalDate,
      capability.renewal.providerSafeCutoffLeadDays,
    ),
    providerAutorenew: providerDomain.autorenew,
    providerAutorenewCheckedAt: now,
    lastSyncedAt: now,
  })
  const lookaheadAt = new Date(providerRenewalDate).getTime() -
    PROVIDER_RENEWAL_LOOKAHEAD_DAYS * DAY_MS
  if (nowDate.getTime() < lookaheadAt) return { status: "not_due" }
  const agreement = await findBillingAgreement(payload, domain)
  let cycle = await findCycle(payload, domain, providerRenewalDate)
  if (!cycle) {
    if (!productionOperationAllowed) {
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "tld_renewal_production_gate_blocked",
        message: `A new .${domain.tld} renewal cycle is blocked pending operation-specific production evidence.`,
        tenant: domain.tenant,
        subjectId: domain.id,
        severity: domain.providerAutorenew === "on" ? "critical" : "error",
        now,
      })
      return { status: "release_blocked" }
    }
    const price = await deps.getOpenProviderDomainRenewalPrice(domain.domainNameAscii, { token })
    domain = await updateManagedDomain(payload, domain, {
      providerRenewalPriceNetMinor: price.netAmountMinor,
      providerRenewalPriceCurrency: price.currency,
      providerRenewalPriceQuotedAt: now,
    })
    cycle = await createCycle({
      payload,
      domain,
      agreement,
      providerDomain,
      price,
      providerRenewalDate,
      capability,
      now,
    })
  }
  cycle = await activateScheduledCycle({
    payload,
    cycle,
    domain,
    agreement,
    capability,
    token,
    dependencies: deps,
    now,
  })
  if (
    currentRenewalReminderOffset(cycle.providerRenewalDate, nowDate) === 7 &&
    !cycle.providerBalanceCheckedAt
  ) {
    const balance = await deps.getOpenProviderResellerBalance({ token })
    cycle = await updateCycle(payload, cycle, {
      providerBalanceAvailableMinor: providerAmountMinor(balance.availableAmount),
      providerBalanceReservedMinor: providerAmountMinor(balance.reservedAmount),
      providerBalanceCurrency: balance.currency,
      providerBalanceCheckedAt: now,
      lastSyncedAt: now,
    })
  }
  await ensureRenewalNotifications({ payload, cycle, domain, agreement, now: nowDate })
  const cutoffReached = nowDate >= new Date(cycle.providerSafeCutoffAt)
  if (
    cycle.state === "provider_requested" &&
    nowDate.getTime() >
      new Date(cycle.providerRenewalDate).getTime() + PROVIDER_RENEWAL_ADVANCE_GRACE_MS
  ) {
    cycle = await updateCycle(payload, cycle, {
      state: "manual_review",
      adminExceptionCode: "provider_renewal_date_did_not_advance",
      adminExceptionAt: now,
      reconciliationRequired: true,
      failureReason: "provider_renewal_date_did_not_advance",
      lastSyncedAt: now,
      stateHistory: cycleHistory(
        cycle,
        "manual_review",
        now,
        "provider_renewal_date_did_not_advance",
      ),
    })
    await recordCommerceAdminException({
      payload,
      source: "domains",
      code: "provider_renewal_date_did_not_advance",
      message: "Openprovider did not advance the operational renewal date after commitment.",
      tenant: domain.tenant,
      subjectId: cycle.id,
      severity: "critical",
      now,
    })
    return { status: "manual_review", cycleId: cycle.id }
  }
  const paymentSecured = Boolean(cycle.paymentSecuredAt) ||
    ["payment_committed", "provider_requested", "renewed"].includes(cycle.state)
  if (!paymentSecured && cycle.state !== "cancelled" && agreement && agreement.renewalIntent) {
    if (
      deps.providerWritesAllowed() &&
      !cutoffReached &&
      ["active", "past_due"].includes(agreement.state)
    ) {
      cycle = await ensureDomainPayment({ payload, agreement, cycle, domain, now: nowDate })
    }
  }
  // The current cycle's financial/provider commitment outranks future renewal
  // intent. Cancellation stops an uncovered future cycle, but it must never
  // undo a cycle the customer already paid for or that was committed at the
  // provider-safe cutoff.
  const shouldRenew = cycle.state !== "cancelled" &&
    (Boolean(cycle.paymentSecuredAt) || ["payment_committed", "provider_requested"].includes(cycle.state))
  if (!shouldRenew) {
    if (cutoffReached && providerDomain.autorenew !== "off") {
      cycle = await updateCycle(payload, cycle, {
        state: "manual_review",
        adminExceptionCode: "autorenew_on_without_coverage_at_cutoff",
        adminExceptionAt: now,
        reconciliationRequired: true,
        failureReason: "provider_safe_cutoff_reached",
        lastSyncedAt: now,
        stateHistory: cycleHistory(cycle, "manual_review", now, "provider_safe_cutoff_reached"),
      })
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "autorenew_on_without_coverage_at_cutoff",
        message: "Openprovider autorenew is still on without financial coverage at the safe cutoff.",
        tenant: domain.tenant,
        subjectId: cycle.id,
        severity: "critical",
        now,
      })
      return { status: "manual_review", cycleId: cycle.id }
    }
    if (
      providerDomain.autorenew !== "off" &&
      !deps.providerWritesAllowed()
    ) {
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "release_gate_blocked_autorenew_safety_write",
        message: "The staged release gate blocked disabling autorenew for an uncovered renewal.",
        tenant: domain.tenant,
        subjectId: cycle.id,
        severity: "critical",
        now,
      })
      cycle = await updateCycle(payload, cycle, {
        reconciliationRequired: true,
        failureReason: "release_gate_blocked_autorenew_safety_write",
        lastSyncedAt: now,
      })
      return { status: "release_blocked", cycleId: cycle.id }
    }
    cycle = await setAutorenew({
      payload,
      cycle,
      domain,
      desired: "off",
      providerDomain,
      token,
      dependencies: deps,
      now,
    })
    const renewalCancelled = !domain.renewalIntent ||
      agreement?.renewalIntent === false ||
      cutoffReached
    if (renewalCancelled && cycle.state !== "cancelled" && !cycle.paymentSecuredAt) {
      cycle = await updateCycle(payload, cycle, {
        state: "cancelled",
        cancelledAt: now,
        failureReason: "renewal_not_financially_covered_before_cutoff",
        stateHistory: cycleHistory(cycle, "cancelled", now, "renewal_uncovered"),
      })
    }
    return {
      status: providerWriteAwaitingReconciliation(cycle)
        ? "waiting"
        : renewalCancelled ? "cancelled" : "payment_required",
      cycleId: cycle.id,
    }
  }
  if (cutoffReached) {
    const balance = await deps.getOpenProviderResellerBalance({ token })
    cycle = await updateCycle(payload, cycle, {
      providerBalanceAvailableMinor: providerAmountMinor(balance.availableAmount),
      providerBalanceReservedMinor: providerAmountMinor(balance.reservedAmount),
      providerBalanceCurrency: balance.currency,
      providerBalanceCheckedAt: now,
      lastSyncedAt: now,
    })
    const requiredProviderAmount = cycle.providerOperationPriceNetMinor / 100
    if (
      balance.currency !== cycle.currency ||
      balance.availableAmount < requiredProviderAmount
    ) {
      cycle = await updateCycle(payload, cycle, {
        state: "manual_review",
        adminExceptionCode: "provider_balance_insufficient",
        adminExceptionAt: now,
        reconciliationRequired: true,
        failureReason: "provider_balance_insufficient",
        lastSyncedAt: now,
        stateHistory: cycleHistory(
          cycle,
          "manual_review",
          now,
          "provider_balance_insufficient",
        ),
      })
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "provider_balance_insufficient",
        message: "Openprovider balance is insufficient or uses the wrong currency for a covered renewal.",
        tenant: domain.tenant,
        subjectId: cycle.id,
        severity: "critical",
        now,
      })
      return { status: "manual_review", cycleId: cycle.id }
    }
  }
  // A financially paid or committed cycle is an existing customer obligation.
  // It must complete even when the release gate is rolled back.
  cycle = await setAutorenew({
    payload,
    cycle,
    domain,
    desired: "on",
    providerDomain,
    token,
    dependencies: deps,
    now,
  })
  if (providerWriteAwaitingReconciliation(cycle)) {
    return { status: "waiting", cycleId: cycle.id }
  }
  if (cutoffReached && cycle.state === "payment_committed") {
    cycle = await updateCycle(payload, cycle, {
      state: "provider_requested",
      providerCommittedAt: now,
      financialCoverageState: "provider_committed",
      stateHistory: cycleHistory(cycle, "provider_requested", now, "provider_autorenew_committed"),
    })
  }
  return { status: cycle.state, cycleId: cycle.id }
}
