import "server-only"

import {
  addBillingPeriod,
  billingDunningStage,
  billingGraceEndsAt,
  commercialAmountFromNet,
  decideRenewalCancellation,
  getCommercialCatalog,
  type BillingDunningStage,
} from "@siteinabox/contracts/commerce"
import type { Payload, Where } from "payload"
import type {
  BillingAgreement,
  DomainRenewalCycle,
  ManagedDomain,
  Order,
  PaymentAttempt,
  Tenant,
} from "@/payload-types"

import { ensureCommerceNotification } from "@/lib/commerce/notifications"
import {
  recordCommerceAdminException,
  resolveCommerceAdminException,
} from "@/lib/commerce/alerts"
import { commerceProviderWritesAllowed } from "@/lib/commerce/releaseGate"
import { createApplicationRecurringMolliePayment } from "@/lib/payments/molliePayments"
import { findOneDoc } from "@/lib/payloadCollection"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"

const DAY_MS = 24 * 60 * 60_000
const TERMINAL_ATTEMPT_STATES = ["failed", "cancelled", "expired", "chargeback"]

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

const agreementHistory = (
  agreement: BillingAgreement,
  state: BillingAgreement["state"],
  at: string,
  reason: string,
) => [
  ...(Array.isArray(agreement.stateHistory) ? agreement.stateHistory : []),
  { state, at, reason },
]

const updateAgreement = (
  payload: Payload,
  agreement: BillingAgreement,
  data: Partial<BillingAgreement>,
): Promise<BillingAgreement> => payload.update({
  collection: "billing-agreements",
  id: agreement.id,
  data,
  depth: 0,
  overrideAccess: true,
  context: { billingAgreementLifecycleMutation: true },
}) as Promise<BillingAgreement>

const claimAgreementUpdate = async (
  payload: Payload,
  agreement: BillingAgreement,
  data: Partial<BillingAgreement>,
): Promise<BillingAgreement | null> => {
  if (!agreement.updatedAt) {
    throw new Error("Billing agreement is missing its concurrency version.")
  }
  const result = await payload.update({
    collection: "billing-agreements",
    where: {
      and: [
        { id: { equals: agreement.id } },
        { updatedAt: { equals: agreement.updatedAt } },
        { state: { equals: agreement.state } },
      ],
    },
    data,
    depth: 0,
    overrideAccess: true,
    context: { billingAgreementLifecycleMutation: true },
  })
  return Array.isArray(result.docs)
    ? (result.docs[0] as BillingAgreement | undefined) ?? null
    : null
}

const loadOriginatingOrder = async (
  payload: Payload,
  agreement: BillingAgreement,
): Promise<Order> => {
  const orderId = relationshipId(agreement.originatingOrder)
  if (!orderId) throw new Error("Billing agreement is missing its originating order.")
  return payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as Promise<Order>
}

const recurringOrderNumber = (
  agreement: BillingAgreement,
  periodEndsAt: string,
) => `SIAB-R-${agreement.id}-${periodEndsAt.replace(/\D/g, "").slice(0, 14)}`

async function attachIncludedRenewalCycles(input: {
  payload: Payload
  agreement: BillingAgreement
  order: Order
  periodStartsAt: string
  periodEndsAt: string
}): Promise<void> {
  const cycles = await input.payload.find({
    collection: "domain-renewal-cycles",
    where: {
      and: [
        { billingAgreement: { equals: input.agreement.id } },
        { state: { equals: "payment_required" } },
        { surchargeNetMinor: { equals: 0 } },
        { providerRenewalDate: { greater_than_equal: input.periodStartsAt } },
        { providerRenewalDate: { less_than_equal: input.periodEndsAt } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const cycle of cycles.docs as DomainRenewalCycle[]) {
    if (cycle.order && !sameRelationshipId(cycle.order, input.order.id)) {
      await recordCommerceAdminException({
        payload: input.payload,
        source: "domains",
        code: "renewal_cycle_order_conflict",
        message: "Included renewal cycle is already linked to another billing order.",
        tenant: cycle.tenant,
        subjectId: cycle.id,
      })
      continue
    }
    await input.payload.update({
      collection: "domain-renewal-cycles",
      id: cycle.id,
      data: {
        order: input.order.id,
        financialCoverageState: "payment_pending",
      },
      depth: 0,
      overrideAccess: true,
      context: { domainRenewalCycleLifecycleMutation: true },
    })
  }
}

export async function ensureSubscriptionRenewalOrder(input: {
  payload: Payload
  agreement: BillingAgreement
}): Promise<Order> {
  const periodStartsAt = input.agreement.currentPeriodEndsAt ?? input.agreement.nextChargeAt
  if (!periodStartsAt) throw new Error("Billing agreement is missing its current period end.")
  const periodEndsAt = addBillingPeriod(periodStartsAt, input.agreement.billingPeriod)
  const billingCycleKey = `billing-agreement:${input.agreement.id}:period-end:${periodEndsAt}`
  const existing = await findOneDoc(input.payload, "orders", {
    billingCycleKey: { equals: billingCycleKey },
  } satisfies Where)
  if (existing) {
    await attachIncludedRenewalCycles({
      payload: input.payload,
      agreement: input.agreement,
      order: existing,
      periodStartsAt,
      periodEndsAt,
    })
    return existing
  }
  const origin = await loadOriginatingOrder(input.payload, input.agreement)
  const catalog = getCommercialCatalog(input.agreement.catalogVersion)
  const subscription = input.agreement.billingPeriod === "annual"
    ? catalog.subscriptions.annual
    : catalog.subscriptions.monthly
  if (
    subscription.code !== input.agreement.packageCode ||
    subscription.netAmountMinor !== input.agreement.recurringNetAmountMinor
  ) {
    throw new Error("Billing agreement no longer matches its frozen commercial catalog.")
  }
  const amounts = commercialAmountFromNet(subscription.netAmountMinor)
  const now = new Date().toISOString()
  const data = {
    orderNumber: recurringOrderNumber(input.agreement, periodEndsAt),
    tenant: numericRelationshipId(input.agreement.tenant),
    generationRun: numericRelationshipId(origin.generationRun),
    state: "accepted" as const,
    checkoutProfileKey: origin.checkoutProfileKey,
    catalogVersion: input.agreement.catalogVersion,
    billingCycleKey,
    billingAgreement: Number(input.agreement.id),
    orderKind: "subscription_renewal" as const,
    servicePeriodStartsAt: periodStartsAt,
    servicePeriodEndsAt: periodEndsAt,
    quoteEvidence: {
      schemaVersion: 1,
      kind: "application_created_subscription_renewal",
      originatingOrderId: origin.id,
      billingAgreementId: input.agreement.id,
      servicePeriodStartsAt: periodStartsAt,
      servicePeriodEndsAt: periodEndsAt,
      catalogVersion: input.agreement.catalogVersion,
    },
    netLineItems: [{
      code: subscription.code,
      description: input.agreement.billingPeriod === "annual"
        ? "Siteinabox jaarabonnement"
        : "Siteinabox maandabonnement",
      quantity: 1,
      netAmountMinor: subscription.netAmountMinor,
    }],
    vatRateBasisPoints: catalog.vat.rateBasisPoints,
    subtotalNetMinor: amounts.netAmountMinor,
    vatAmountMinor: amounts.vatAmountMinor,
    totalGrossMinor: amounts.grossAmountMinor,
    contractingPartyProfileVersion: origin.contractingPartyProfileVersion,
    termsVersion: origin.termsVersion,
    privacyVersion: origin.privacyVersion,
    businessUseDeclarationVersion: origin.businessUseDeclarationVersion,
    acceptedAt: now,
    customerName: origin.customerName,
    customerEmail: origin.customerEmail,
    companyName: origin.companyName,
    billingAddress: origin.billingAddress,
    packageCode: subscription.code,
    billingPeriod: input.agreement.billingPeriod,
    renewalTerms: origin.renewalTerms,
    lineItems: [{
      code: subscription.code,
      description: input.agreement.billingPeriod === "annual"
        ? "Siteinabox jaarabonnement"
        : "Siteinabox maandabonnement",
      quantity: 1,
      netAmountMinor: subscription.netAmountMinor,
    }],
    currency: amounts.currency,
    subtotalNet: amounts.netAmountMinor / 100,
    vatAmount: amounts.vatAmountMinor / 100,
    totalGross: amounts.grossAmountMinor / 100,
    domain: origin.domain,
    domainRegistrant: origin.domainRegistrant,
    legalDocuments: relationIds(origin.legalDocuments),
    paymentStatus: "pending" as const,
    paymentProvider: "mollie" as const,
    createdAt: now,
  }
  try {
    const created = await input.payload.create({
      collection: "orders",
      data,
      depth: 0,
      overrideAccess: true,
    }) as Order
    await attachIncludedRenewalCycles({
      payload: input.payload,
      agreement: input.agreement,
      order: created,
      periodStartsAt,
      periodEndsAt,
    })
    return created
  } catch (error) {
    const raced = await findOneDoc(input.payload, "orders", {
      billingCycleKey: { equals: billingCycleKey },
    } satisfies Where)
    if (raced) {
      await attachIncludedRenewalCycles({
        payload: input.payload,
        agreement: input.agreement,
        order: raced,
        periodStartsAt,
        periodEndsAt,
      })
      return raced
    }
    throw error
  }
}

const dunningAttemptNumber = (stage: BillingDunningStage): number => {
  if (stage === "retry_3d") return 2
  if (stage === "retry_7d") return 3
  if (stage === "retry_13d") return 4
  return 1
}

const dunningNotificationKind = (stage: BillingDunningStage) => {
  if (stage === "retry_3d") return "payment_overdue_3d" as const
  if (stage === "retry_7d") return "payment_overdue_7d" as const
  if (stage === "retry_13d") return "payment_overdue_13d" as const
  return "payment_failed_0d" as const
}

async function loadPaymentAttempts(
  payload: Payload,
  order: Order,
): Promise<PaymentAttempt[]> {
  const result = await payload.find({
    collection: "payment-attempts",
    where: {
      and: [
        { order: { equals: order.id } },
        { purpose: { equals: "recurring" } },
      ],
    },
    sort: "attemptNumber",
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs as PaymentAttempt[]
}

async function ensureRecurringAttempt(input: {
  payload: Payload
  agreement: BillingAgreement
  order: Order
  attemptNumber: number
  now: string
}): Promise<void> {
  const attempts = await loadPaymentAttempts(input.payload, input.order)
  const existing = attempts.find((attempt) => attempt.attemptNumber === input.attemptNumber)
  if (existing) {
    const providerAbsenceReconciled =
      existing.state === "pending_provider" &&
      !existing.providerPaymentId &&
      !existing.reconciliationRequired &&
      existing.failureCode === "provider_absence_reconciled"
    if (!providerAbsenceReconciled) return
    await createApplicationRecurringMolliePayment(input.payload, {
      billingAgreementId: input.agreement.id,
      orderId: input.order.id,
      purpose: "recurring",
      attemptNumber: input.attemptNumber,
    })
    return
  }
  const latest = attempts.at(-1)
  if (latest && !TERMINAL_ATTEMPT_STATES.includes(latest.state)) return
  await createApplicationRecurringMolliePayment(input.payload, {
    billingAgreementId: input.agreement.id,
    orderId: input.order.id,
    purpose: "recurring",
    attemptNumber: input.attemptNumber,
  })
}

async function ensureBillingNotification(input: {
  payload: Payload
  agreement: BillingAgreement
  order: Order
  kind: Parameters<typeof ensureCommerceNotification>[0]["kind"]
  eventAt: string
}) {
  const tenantId = relationshipId(input.agreement.tenant)
  if (!tenantId) throw new Error("Billing agreement is missing a tenant.")
  return ensureCommerceNotification({
    payload: input.payload,
    kind: input.kind,
    tenantId,
    recipient: input.order.customerEmail,
    eventAt: input.eventAt,
    billingAgreementId: input.agreement.id,
  })
}

async function suspendForNonPayment(input: {
  payload: Payload
  agreement: BillingAgreement
  order: Order
  now: string
}): Promise<BillingAgreement> {
  const claimedAgreement = await claimAgreementUpdate(input.payload, input.agreement, {
    state: "suspended",
    suspendedAt: input.now,
    serviceSuspensionStatus: "billing_suspended",
    stateHistory: agreementHistory(input.agreement, "suspended", input.now, "grace_expired"),
  })
  if (!claimedAgreement) {
    return input.payload.findByID({
      collection: "billing-agreements",
      id: input.agreement.id,
      depth: 0,
      overrideAccess: true,
    }) as Promise<BillingAgreement>
  }
  const tenantId = relationshipId(input.agreement.tenant)
  if (!tenantId) throw new Error("Billing agreement is missing a tenant.")
  const tenant = await input.payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  if (tenant.status === "archived") {
    await recordCommerceAdminException({
      payload: input.payload,
      source: "payments",
      code: "billing_suspension_tenant_archived",
      message: "Billing suspension was not applied because the tenant is archived.",
      tenant,
      subjectId: input.agreement.id,
      now: input.now,
    })
    return updateAgreement(input.payload, claimedAgreement, {
      adminExceptionCode: "billing_suspension_tenant_archived",
      adminExceptionAt: input.now,
      serviceSuspensionStatus: "restoration_blocked",
    })
  }
  if (
    tenant.status === "suspended" &&
    !sameRelationshipId(tenant.billingSuspensionAgreement, input.agreement.id)
  ) {
    await recordCommerceAdminException({
      payload: input.payload,
      source: "payments",
      code: "tenant_already_operator_suspended",
      message: "Billing reached suspension while the tenant already had an operator-owned suspension.",
      tenant,
      subjectId: input.agreement.id,
      now: input.now,
    })
    return updateAgreement(input.payload, claimedAgreement, {
      serviceSuspensionStatus: "restoration_blocked",
      adminExceptionCode: "tenant_already_operator_suspended",
      adminExceptionAt: input.now,
    })
  }
  if (tenant.status !== "suspended") {
    await input.payload.update({
      collection: "tenants",
      id: tenant.id,
      data: {
        status: "suspended",
        billingSuspensionAgreement: Number(input.agreement.id),
        billingSuspendedAt: input.now,
      },
      depth: 0,
      overrideAccess: true,
      context: { billingTenantLifecycleMutation: true },
    })
  }
  const currentAgreement = await input.payload.findByID({
    collection: "billing-agreements",
    id: claimedAgreement.id,
    depth: 0,
    overrideAccess: true,
  }) as BillingAgreement
  if (
    currentAgreement.state !== "suspended" ||
    currentAgreement.serviceSuspensionStatus !== "billing_suspended"
  ) {
    const currentTenant = await input.payload.findByID({
      collection: "tenants",
      id: tenant.id,
      depth: 0,
      overrideAccess: true,
    }) as Tenant
    if (
      currentTenant.status === "suspended" &&
      sameRelationshipId(currentTenant.billingSuspensionAgreement, claimedAgreement.id)
    ) {
      await input.payload.update({
        collection: "tenants",
        id: currentTenant.id,
        data: {
          status: "active",
          billingSuspensionAgreement: null,
          billingSuspendedAt: null,
        },
        depth: 0,
        overrideAccess: true,
        context: { billingTenantLifecycleMutation: true },
      })
    }
    return currentAgreement
  }
  await ensureBillingNotification({
    payload: input.payload,
    agreement: claimedAgreement,
    order: input.order,
    kind: "service_suspended_14d",
    eventAt: input.now,
  })
  return claimedAgreement
}

export async function processBillingAgreement(input: {
  payload: Payload
  agreement: BillingAgreement
  now?: Date
  providerWritesAllowed?: () => boolean
}): Promise<{ status: string; paymentRequested: boolean }> {
  const nowDate = input.now ?? new Date()
  const now = nowDate.toISOString()
  let agreement = input.agreement
  const origin = await loadOriginatingOrder(input.payload, agreement)
  if (agreement.state === "cancelled" || agreement.state === "suspended") {
    return { status: agreement.state, paymentRequested: false }
  }
  if (agreement.state === "cancellation_scheduled") {
    if (!agreement.cancelAt || new Date(agreement.cancelAt) > nowDate) {
      return { status: "cancellation_scheduled", paymentRequested: false }
    }
    const committedCoverageEnd = await pendingCommittedCoverageEnd(
      input.payload,
      agreement,
    )
    if (
      committedCoverageEnd &&
      new Date(committedCoverageEnd) > new Date(agreement.cancelAt)
    ) {
      const extended = await claimAgreementUpdate(input.payload, agreement, {
        cancelAt: committedCoverageEnd,
      })
      return {
        status: extended ? "cancellation_scheduled" : "concurrent_update",
        paymentRequested: false,
      }
    }
    agreement = await finalizeCancellation({
      payload: input.payload,
      agreement,
      origin,
      now,
    })
    return { status: agreement.state, paymentRequested: false }
  }
  // Reconciliation owns indeterminate and conflicting provider state. In
  // particular, a chargeback on already-recorded coverage must not cause the
  // regular scheduler to collect the following period early.
  if (agreement.reconciliationRequired) {
    return { status: "waiting_reconciliation", paymentRequested: false }
  }
  if (!agreement.nextChargeAt) {
    await recordCommerceAdminException({
      payload: input.payload,
      source: "payments",
      code: "billing_next_charge_missing",
      message: "Active billing agreement is missing nextChargeAt.",
      tenant: agreement.tenant,
      subjectId: agreement.id,
      now,
    })
    await claimAgreementUpdate(input.payload, agreement, {
      reconciliationRequired: true,
      adminExceptionCode: "billing_next_charge_missing",
      adminExceptionAt: now,
    })
    return { status: "admin_exception", paymentRequested: false }
  }
  const dueAt = agreement.nextChargeAt
  const untilDue = new Date(dueAt).getTime() - nowDate.getTime()
  if (agreement.state === "active" && untilDue > 0) {
    if (untilDue <= 7 * DAY_MS) {
      await ensureBillingNotification({
        payload: input.payload,
        agreement,
        order: origin,
        kind: "upcoming_charge_7d",
        eventAt: dueAt,
      })
    }
    return { status: "not_due", paymentRequested: false }
  }
  const order = await ensureSubscriptionRenewalOrder({
    payload: input.payload,
    agreement,
  })
  const existingAttempts = await loadPaymentAttempts(input.payload, order)
  const collectionStarted = existingAttempts.length > 0
  const providerWritesAllowed =
    input.providerWritesAllowed ?? commerceProviderWritesAllowed
  if (!collectionStarted && !providerWritesAllowed()) {
    await recordCommerceAdminException({
      payload: input.payload,
      source: "payments",
      code: "billing_collection_release_blocked",
      message: "Recurring collection is waiting for the staged provider-write release gate.",
      tenant: agreement.tenant,
      subjectId: agreement.id,
      severity: "warning",
      now,
    })
    return { status: "waiting_release", paymentRequested: false }
  }
  await resolveCommerceAdminException({
    payload: input.payload,
    source: "payments",
    code: "billing_collection_release_blocked",
    subjectId: agreement.id,
    now,
  })
  const dunningStarted = collectionStarted || Boolean(agreement.graceStartedAt)
  const graceAnchor = agreement.graceStartedAt ??
    (collectionStarted ? dueAt : now)
  const stage = dunningStarted
    ? billingDunningStage(graceAnchor, nowDate)
    : "due"
  if (stage === "suspend") {
    agreement = await suspendForNonPayment({
      payload: input.payload,
      agreement,
      order: origin,
      now,
    })
    return { status: agreement.state, paymentRequested: false }
  }
  if (!agreement.graceStartedAt || !agreement.graceEndsAt) {
    const claimedAgreement = await claimAgreementUpdate(input.payload, agreement, {
      state: "past_due",
      graceStartedAt: graceAnchor,
      graceEndsAt: billingGraceEndsAt(graceAnchor),
      failureReason: agreement.failureReason ?? "Recurring payment is due.",
      stateHistory: agreement.state === "past_due"
        ? agreement.stateHistory
        : agreementHistory(agreement, "past_due", now, "payment_due"),
    })
    if (!claimedAgreement) {
      return { status: "concurrent_update", paymentRequested: false }
    }
    agreement = claimedAgreement
  }
  const attemptNumber = dunningAttemptNumber(stage)
  await ensureRecurringAttempt({
    payload: input.payload,
    agreement,
    order,
    attemptNumber,
    now,
  })
  const attempts = await loadPaymentAttempts(input.payload, order)
  if (attempts.some((attempt) => TERMINAL_ATTEMPT_STATES.includes(attempt.state))) {
    await ensureBillingNotification({
      payload: input.payload,
      agreement,
      order: origin,
      kind: dunningNotificationKind(stage),
      eventAt: dueAt,
    })
  }
  return { status: stage, paymentRequested: true }
}

async function cancelUncoveredRenewals(
  payload: Payload,
  agreement: BillingAgreement,
  now: string,
): Promise<void> {
  const domains = await payload.find({
    collection: "managed-domains",
    where: { tenant: { equals: relationshipId(agreement.tenant) } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const domain of domains.docs as ManagedDomain[]) {
    await payload.update({
      collection: "managed-domains",
      id: domain.id,
      data: { renewalIntent: false },
      depth: 0,
      overrideAccess: true,
      context: { managedDomainLifecycleMutation: true },
    })
    const cycles = await payload.find({
      collection: "domain-renewal-cycles",
      where: { managedDomain: { equals: domain.id } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    for (const cycle of cycles.docs as DomainRenewalCycle[]) {
      const decision = decideRenewalCancellation({
        cycleState: cycle.state,
        billingAgreementCancelled: true,
        paymentSecured: Boolean(cycle.paymentSecuredAt),
        providerSafeCutoffReached: new Date(cycle.providerSafeCutoffAt) <= new Date(now),
      })
      if (
        decision !== "cancel_uncovered_cycle" ||
        ["cancelled", "renewed"].includes(cycle.state)
      ) continue
      await payload.update({
        collection: "domain-renewal-cycles",
        id: cycle.id,
        data: {
          state: "cancelled",
          cancelledAt: now,
          failureReason: "billing_agreement_cancelled_before_financial_commitment",
          stateHistory: [
            ...(Array.isArray(cycle.stateHistory) ? cycle.stateHistory : []),
            { state: "cancelled", at: now, reason: "billing_agreement_cancelled" },
          ],
        },
        depth: 0,
        overrideAccess: true,
        context: { domainRenewalCycleLifecycleMutation: true },
      })
    }
  }
}

async function pendingCommittedCoverageEnd(
  payload: Payload,
  agreement: BillingAgreement,
): Promise<string | null> {
  const orders = await payload.find({
    collection: "orders",
    where: {
      and: [
        { billingAgreement: { equals: agreement.id } },
        { orderKind: { equals: "subscription_renewal" } },
        { state: { in: ["accepted", "fulfillment_pending", "fulfilled"] } },
      ],
    },
    sort: "-servicePeriodEndsAt",
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  for (const order of orders.docs as Order[]) {
    if (!order.servicePeriodEndsAt) continue
    const attempts = await payload.find({
      collection: "payment-attempts",
      where: {
        and: [
          { order: { equals: order.id } },
          { state: { in: ["created", "pending_provider", "authorized", "paid"] } },
        ],
      },
      sort: "-createdAt",
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    const financiallyCommitted = (attempts.docs as PaymentAttempt[]).some((attempt) => {
      if (["authorized", "paid"].includes(attempt.state)) return true
      if (attempt.providerPaymentId && attempt.state === "pending_provider") return true
      return (
        attempt.state === "pending_provider" &&
        attempt.reconciliationRequired &&
        agreement.lastPaymentAttemptAt === attempt.createdAt
      )
    })
    if (financiallyCommitted) return order.servicePeriodEndsAt
  }
  return null
}

export async function scheduleCancellationAtPeriodEnd(input: {
  payload: Payload
  agreementId: string | number
  tenantId: string | number
  actorUserId: string | number
  actorEmail: string
  requestId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  now?: Date
}): Promise<BillingAgreement> {
  const now = (input.now ?? new Date()).toISOString()
  let agreement: BillingAgreement | null = null
  for (let retry = 0; retry < 5; retry += 1) {
    const candidate = await input.payload.findByID({
      collection: "billing-agreements",
      id: input.agreementId,
      depth: 0,
      overrideAccess: true,
    }) as BillingAgreement
    if (!sameRelationshipId(candidate.tenant, input.tenantId)) {
      throw new Error("Billing agreement does not belong to the authenticated tenant.")
    }
    if (
      candidate.state === "cancelled" ||
      candidate.state === "cancellation_scheduled"
    ) return candidate
    if (!["active", "past_due", "suspended"].includes(candidate.state)) {
      throw new Error("Billing agreement cannot be cancelled in its current state.")
    }
    if (!candidate.updatedAt) {
      throw new Error("Billing agreement is missing its concurrency version.")
    }
    const pendingCoverageEnd = await pendingCommittedCoverageEnd(
      input.payload,
      candidate,
    )
    const cancelAt = [candidate.currentPeriodEndsAt, pendingCoverageEnd]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1)
    if (!cancelAt) throw new Error("Billing agreement is missing paid period coverage.")
    const result = await input.payload.update({
      collection: "billing-agreements",
      where: {
        and: [
          { id: { equals: candidate.id } },
          { updatedAt: { equals: candidate.updatedAt } },
          { state: { equals: candidate.state } },
        ],
      },
      data: {
        state: "cancellation_scheduled",
        renewalIntent: false,
        cancelAt,
        cancellationEvidence: {
          version: 1,
          actorUserId: input.actorUserId,
          actorEmail: input.actorEmail.trim().toLowerCase(),
          requestedAt: now,
          requestId: input.requestId ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          cancelAt,
        },
        stateHistory: agreementHistory(
          candidate,
          "cancellation_scheduled",
          now,
          "customer_request",
        ),
      },
      depth: 0,
      overrideAccess: true,
      context: { billingAgreementLifecycleMutation: true },
    })
    const claimed = Array.isArray(result.docs)
      ? result.docs[0] as BillingAgreement | undefined
      : undefined
    if (claimed) {
      agreement = claimed
      break
    }
  }
  if (!agreement) {
    throw new Error("Billing cancellation conflicted with concurrent collection; retry safely.")
  }
  if (!agreement.cancelAt) {
    throw new Error("Claimed billing cancellation is missing its effective date.")
  }
  await cancelUncoveredRenewals(input.payload, agreement, now)
  const origin = await loadOriginatingOrder(input.payload, agreement)
  await ensureBillingNotification({
    payload: input.payload,
    agreement,
    order: origin,
    kind: "cancellation_scheduled",
    eventAt: agreement.cancelAt,
  })
  return agreement
}

async function finalizeCancellation(input: {
  payload: Payload
  agreement: BillingAgreement
  origin: Order
  now: string
}): Promise<BillingAgreement> {
  const agreement = await claimAgreementUpdate(input.payload, input.agreement, {
    state: "cancelled",
    renewalIntent: false,
    cancelledAt: input.now,
    endedAt: input.now,
    stateHistory: agreementHistory(input.agreement, "cancelled", input.now, "period_end"),
  })
  if (!agreement) {
    return input.payload.findByID({
      collection: "billing-agreements",
      id: input.agreement.id,
      depth: 0,
      overrideAccess: true,
    }) as Promise<BillingAgreement>
  }
  const tenantId = relationshipId(input.agreement.tenant)
  if (tenantId) {
    const tenant = await input.payload.findByID({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    }) as Tenant
    if (tenant.status === "active") {
      await input.payload.update({
        collection: "tenants",
        id: tenant.id,
        data: {
          status: "suspended",
          billingSuspensionAgreement: null,
          billingSuspendedAt: null,
        },
        depth: 0,
        overrideAccess: true,
        context: { billingTenantLifecycleMutation: true },
      })
    }
  }
  await cancelUncoveredRenewals(input.payload, agreement, input.now)
  await ensureBillingNotification({
    payload: input.payload,
    agreement,
    order: input.origin,
    kind: "cancellation_effective",
    eventAt: input.now,
  })
  return agreement
}
