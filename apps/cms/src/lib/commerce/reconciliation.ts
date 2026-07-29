import "server-only"

import type { Payload } from "payload"
import type {
  BillingAgreement,
  ManagedDomain,
  PaymentAttempt,
} from "@/payload-types"

import {
  recordCommerceAdminException,
  resolveCommerceAdminException,
} from "@/lib/commerce/alerts"
import {
  commerceProviderReadsAllowed,
} from "@/lib/commerce/releaseGate"
import { reconcileDomainTransferOut } from "@/lib/domains/offboarding"
import {
  getOpenProviderResellerBalance,
  loginOpenProvider,
} from "@/lib/domains/openprovider"
import {
  listRecentMolliePayments,
  listRecentMollieCustomers,
  type MollieCustomer,
  type MolliePayment,
} from "@/lib/payments/mollieAdapter"
import { relationshipId } from "@/lib/relationshipId"

const MINIMUM_PAYMENT_RECOVERY_AGE_MS = 2 * 60_000
const STALE_WEBHOOK_ALERT_AGE_MS = 30 * 60_000
const DEFAULT_OPENPROVIDER_BALANCE_THRESHOLD_EUR = 0
const DAY_MS = 24 * 60 * 60_000

type ReconciliationDependencies = {
  providerReadsAllowed: () => boolean
  listRecentMolliePayments: typeof listRecentMolliePayments
  listRecentMollieCustomers: typeof listRecentMollieCustomers
  loginOpenProvider: typeof loginOpenProvider
  getOpenProviderResellerBalance: typeof getOpenProviderResellerBalance
  reconcileDomainTransferOut: typeof reconcileDomainTransferOut
}

const defaultDependencies: ReconciliationDependencies = {
  providerReadsAllowed: commerceProviderReadsAllowed,
  listRecentMolliePayments,
  listRecentMollieCustomers,
  loginOpenProvider,
  getOpenProviderResellerBalance,
  reconcileDomainTransferOut,
}

const metadataId = (
  payment: MolliePayment,
  field: string,
): string | null => {
  const value = payment.metadata?.[field]
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null
}

const mollieAmountMinor = (payment: MolliePayment): number | null => {
  const value = payment.amount?.value
  if (!value || !/^\d+\.\d{2}$/.test(value)) return null
  const [whole, cents] = value.split(".")
  const amount = Number(whole) * 100 + Number(cents)
  return Number.isSafeInteger(amount) ? amount : null
}

const customerMetadataId = (
  customer: MollieCustomer,
  field: string,
): string | null => {
  const value = customer.metadata?.[field]
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null
}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Error &&
  (
    (error as Error & { code?: unknown }).code === "23505" ||
    /duplicate|unique/i.test(error.message)
  )

const providerReferenceOwner = async (
  payload: Payload,
  collection: "billing-agreements" | "payment-attempts",
  field: "providerCustomerId" | "providerPaymentId",
  providerReference: string,
): Promise<string | number | null> => {
  const result = await payload.find({
    collection,
    where: { [field]: { equals: providerReference } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  const owner = result.docs.find(
    (doc) => (doc as unknown as Record<string, unknown>)[field] === providerReference,
  )
  return owner?.id ?? null
}

export async function recoverMissingMollieCustomerReferences(
  payload: Payload,
  dependencies: Partial<ReconciliationDependencies> = {},
  now = new Date().toISOString(),
): Promise<{ examined: number; recovered: number }> {
  const deps = { ...defaultDependencies, ...dependencies }
  if (!deps.providerReadsAllowed()) return { examined: 0, recovered: 0 }
  const result = await payload.find({
    collection: "billing-agreements",
    where: {
      and: [
        { provider: { equals: "mollie" } },
        { providerCustomerId: { exists: false } },
        { reconciliationRequired: { equals: true } },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const agreements = result.docs as BillingAgreement[]
  if (agreements.length === 0) return { examined: 0, recovered: 0 }
  let customers: MollieCustomer[]
  try {
    customers = await deps.listRecentMollieCustomers(250)
  } catch {
    await recordCommerceAdminException({
      payload,
      source: "payments",
      code: "mollie_customer_list_recovery_failed",
      message: "Mollie customer-list recovery failed; no replacement customer was created.",
      subjectId: "mollie-account",
      severity: "error",
      now,
    })
    return { examined: agreements.length, recovered: 0 }
  }
  let recovered = 0
  for (const agreement of agreements) {
    const orderId = relationshipId(agreement.originatingOrder)
    const tenantId = relationshipId(agreement.tenant)
    const matches = customers.filter((customer) =>
      customerMetadataId(customer, "billingAgreementId") === String(agreement.id) &&
      customerMetadataId(customer, "orderId") === String(orderId) &&
      customerMetadataId(customer, "tenantId") === String(tenantId))
    if (matches.length !== 1) {
      await recordCommerceAdminException({
        payload,
        source: "payments",
        code: matches.length > 1
          ? "duplicate_provider_customers_for_agreement"
          : "missing_mollie_customer_reference",
        message: matches.length > 1
          ? "Multiple Mollie customers match one billing agreement."
          : "An indeterminate Mollie customer has no recoverable provider reference.",
        tenant: agreement.tenant,
        subjectId: agreement.id,
        severity: matches.length > 1 ? "critical" : "error",
        metadata: { matchCount: matches.length },
        now,
      })
      continue
    }
    const providerCustomerId = matches[0]!.id
    const existingOwner = await providerReferenceOwner(
      payload,
      "billing-agreements",
      "providerCustomerId",
      providerCustomerId,
    )
    if (existingOwner != null && String(existingOwner) !== String(agreement.id)) {
      await recordCommerceAdminException({
        payload,
        source: "payments",
        code: "provider_customer_reference_owned_elsewhere",
        message: "A recovered Mollie customer reference is already owned by another billing agreement.",
        tenant: agreement.tenant,
        subjectId: agreement.id,
        severity: "critical",
        metadata: { conflictingOwnerId: existingOwner },
        now,
      })
      continue
    }
    try {
      await payload.update({
        collection: "billing-agreements",
        id: agreement.id,
        data: {
          providerCustomerId,
          reconciliationRequired: false,
          failureReason: null,
          lastSyncedAt: now,
        },
        depth: 0,
        overrideAccess: true,
        context: { billingAgreementLifecycleMutation: true },
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const racedOwner = await providerReferenceOwner(
        payload,
        "billing-agreements",
        "providerCustomerId",
        providerCustomerId,
      )
      if (racedOwner == null) throw error
      if (String(racedOwner) === String(agreement.id)) {
        await resolveCommerceAdminException({
          payload,
          source: "payments",
          code: "missing_mollie_customer_reference",
          subjectId: agreement.id,
          now,
        })
        recovered += 1
        continue
      }
      await recordCommerceAdminException({
        payload,
        source: "payments",
        code: "provider_customer_reference_owned_elsewhere",
        message: "A concurrent recovery attached the Mollie customer reference elsewhere.",
        tenant: agreement.tenant,
        subjectId: agreement.id,
        severity: "critical",
        metadata: { conflictingOwnerId: racedOwner },
        now,
      })
      continue
    }
    await resolveCommerceAdminException({
      payload,
      source: "payments",
      code: "missing_mollie_customer_reference",
      subjectId: agreement.id,
      now,
    })
    recovered += 1
  }
  return { examined: agreements.length, recovered }
}

const paymentMatchesAttempt = (
  payment: MolliePayment,
  attempt: PaymentAttempt,
): boolean => {
  const attemptId = metadataId(payment, "paymentAttemptId")
  const idempotencyKey = metadataId(payment, "idempotencyKey")
  const orderId = relationshipId(attempt.order)
  const metadataOrderId = metadataId(payment, "orderId")
  return (
    (
      attemptId === String(attempt.id) ||
      idempotencyKey === attempt.idempotencyKey
    ) &&
    metadataOrderId === String(orderId) &&
    mollieAmountMinor(payment) === attempt.grossAmountMinor &&
    payment.amount?.currency === attempt.currency
  )
}

export async function recoverMissingMolliePaymentReferences(
  payload: Payload,
  dependencies: Partial<ReconciliationDependencies> = {},
  nowDate = new Date(),
): Promise<{ examined: number; recoveredPaymentIds: string[] }> {
  const deps = { ...defaultDependencies, ...dependencies }
  if (!deps.providerReadsAllowed()) {
    return { examined: 0, recoveredPaymentIds: [] }
  }
  const recoveryBefore = new Date(
    nowDate.getTime() - MINIMUM_PAYMENT_RECOVERY_AGE_MS,
  ).toISOString()
  const result = await payload.find({
    collection: "payment-attempts",
    where: {
      and: [
        { provider: { equals: "mollie" } },
        { providerPaymentId: { exists: false } },
        { reconciliationRequired: { equals: true } },
        { state: { in: ["pending_provider", "authorized"] } },
        { createdAt: { less_than_equal: recoveryBefore } },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const attempts = result.docs as PaymentAttempt[]
  if (attempts.length === 0) {
    return { examined: 0, recoveredPaymentIds: [] }
  }
  let payments: MolliePayment[]
  try {
    payments = await deps.listRecentMolliePayments(250)
    await resolveCommerceAdminException({
      payload,
      source: "payments",
      code: "mollie_payment_list_recovery_failed",
      subjectId: "mollie-account",
      now: nowDate.toISOString(),
    })
  } catch {
    await recordCommerceAdminException({
      payload,
      source: "payments",
      code: "mollie_payment_list_recovery_failed",
      message: "Mollie payment-list recovery failed; no replacement payment was created.",
      subjectId: "mollie-account",
      severity: "error",
      now: nowDate.toISOString(),
    })
    return { examined: attempts.length, recoveredPaymentIds: [] }
  }
  const recoveredPaymentIds: string[] = []
  for (const attempt of attempts) {
    const matches = payments.filter((payment) =>
      paymentMatchesAttempt(payment, attempt),
    )
    if (matches.length > 1) {
      await recordCommerceAdminException({
        payload,
        source: "payments",
        code: "duplicate_provider_payments_for_attempt",
        message: "Multiple Mollie payments match one internal idempotency authority.",
        tenant: attempt.tenant,
        subjectId: attempt.id,
        metadata: { matchCount: matches.length },
        severity: "critical",
        now: nowDate.toISOString(),
      })
      continue
    }
    const match = matches[0]
    if (match) {
      const existingOwner = await providerReferenceOwner(
        payload,
        "payment-attempts",
        "providerPaymentId",
        match.id,
      )
      if (existingOwner != null && String(existingOwner) !== String(attempt.id)) {
        await recordCommerceAdminException({
          payload,
          source: "payments",
          code: "provider_payment_reference_owned_elsewhere",
          message: "A recovered Mollie payment reference is already owned by another payment attempt.",
          tenant: attempt.tenant,
          subjectId: attempt.id,
          severity: "critical",
          metadata: { conflictingOwnerId: existingOwner },
          now: nowDate.toISOString(),
        })
        continue
      }
      try {
        await payload.update({
          collection: "payment-attempts",
          id: attempt.id,
          data: {
            providerPaymentId: match.id,
            providerStatus: match.status,
            checkoutUrl: match._links?.checkout?.href,
            reconciliationRequired: true,
            lastSyncedAt: nowDate.toISOString(),
            stateHistory: [
              ...(Array.isArray(attempt.stateHistory) ? attempt.stateHistory : []),
              {
                state: attempt.state,
                at: nowDate.toISOString(),
                providerStatus: match.status,
                reason: "missing_webhook_provider_reference_recovered",
              },
            ],
          },
          depth: 0,
          overrideAccess: true,
          context: { paymentAttemptLifecycleMutation: true },
        })
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        const racedOwner = await providerReferenceOwner(
          payload,
          "payment-attempts",
          "providerPaymentId",
          match.id,
        )
        if (racedOwner == null) throw error
        if (String(racedOwner) === String(attempt.id)) {
          await resolveCommerceAdminException({
            payload,
            source: "payments",
            code: "missing_mollie_webhook_or_reference",
            subjectId: attempt.id,
            now: nowDate.toISOString(),
          })
          recoveredPaymentIds.push(match.id)
          continue
        }
        await recordCommerceAdminException({
          payload,
          source: "payments",
          code: "provider_payment_reference_owned_elsewhere",
          message: "A concurrent recovery attached the Mollie payment reference elsewhere.",
          tenant: attempt.tenant,
          subjectId: attempt.id,
          severity: "critical",
          metadata: { conflictingOwnerId: racedOwner },
          now: nowDate.toISOString(),
        })
        continue
      }
      await resolveCommerceAdminException({
        payload,
        source: "payments",
        code: "missing_mollie_webhook_or_reference",
        subjectId: attempt.id,
        now: nowDate.toISOString(),
      })
      recoveredPaymentIds.push(match.id)
      continue
    }
    if (
      attempt.sequenceType === "recurring" &&
      attempt.state === "pending_provider"
    ) {
      const agreementId = relationshipId(attempt.billingAgreement)
      if (agreementId) {
        const agreement = await payload.findByID({
          collection: "billing-agreements",
          id: agreementId,
          depth: 0,
          overrideAccess: true,
        }) as BillingAgreement
        let currentAgreement = agreement
        if (
          agreement.lastPaymentAttemptAt === attempt.createdAt &&
          agreement.updatedAt
        ) {
          const cancellationScheduled =
            agreement.state === "cancellation_scheduled"
          const agreementResult = await payload.update({
            collection: "billing-agreements",
            where: {
              and: [
                { id: { equals: agreement.id } },
                { updatedAt: { equals: agreement.updatedAt } },
                { lastPaymentAttemptAt: { equals: attempt.createdAt } },
              ],
            },
            data: {
              lastPaymentAttemptAt: null,
              ...(cancellationScheduled
                ? { cancelAt: agreement.currentPeriodEndsAt ?? agreement.cancelAt }
                : {}),
            },
            depth: 0,
            overrideAccess: true,
            context: { billingAgreementLifecycleMutation: true },
          })
          const updated = Array.isArray(agreementResult.docs)
            ? agreementResult.docs[0] as BillingAgreement | undefined
            : undefined
          if (!updated) continue
          currentAgreement = updated
        }
        const cancellationWon =
          currentAgreement.state === "cancellation_scheduled" ||
          !currentAgreement.renewalIntent
        const attemptResult = await payload.update({
          collection: "payment-attempts",
          where: {
            and: [
              { id: { equals: attempt.id } },
              { providerPaymentId: { exists: false } },
              { state: { equals: "pending_provider" } },
              { reconciliationRequired: { equals: true } },
            ],
          },
          data: cancellationWon
            ? {
                state: "cancelled",
                reconciliationRequired: false,
                failureCode: "collection_cancelled_after_provider_reconciliation",
                failureMessage:
                  "No Mollie payment existed when cancellation was reconciled.",
                stateHistory: [
                  ...(Array.isArray(attempt.stateHistory)
                    ? attempt.stateHistory
                    : []),
                  {
                    state: "cancelled",
                    at: nowDate.toISOString(),
                    reason: "billing_cancellation_after_provider_absence",
                  },
                ],
              }
            : {
                reconciliationRequired: false,
                failureCode: "provider_absence_reconciled",
                failureMessage:
                  "No Mollie payment matched the durable recurring-payment authority.",
                lastSyncedAt: nowDate.toISOString(),
                stateHistory: [
                  ...(Array.isArray(attempt.stateHistory)
                    ? attempt.stateHistory
                    : []),
                  {
                    state: "pending_provider",
                    at: nowDate.toISOString(),
                    reason: "provider_absence_reconciled_for_safe_retry",
                  },
                ],
              },
          depth: 0,
          overrideAccess: true,
          context: { paymentAttemptLifecycleMutation: true },
        })
        if (Array.isArray(attemptResult.docs) && attemptResult.docs[0]) {
          continue
        }
      }
    }
    if (
      nowDate.getTime() - new Date(attempt.createdAt).getTime() >=
      STALE_WEBHOOK_ALERT_AGE_MS
    ) {
      await recordCommerceAdminException({
        payload,
        source: "payments",
        code: "missing_mollie_webhook_or_reference",
        message: "An indeterminate Mollie payment has no recoverable provider reference.",
        tenant: attempt.tenant,
        subjectId: attempt.id,
        severity: "error",
        now: nowDate.toISOString(),
      })
    }
  }
  return { examined: attempts.length, recoveredPaymentIds }
}

export async function alertOnStaleMollieSynchronization(
  payload: Payload,
  attempts: PaymentAttempt[],
  nowDate = new Date(),
): Promise<number> {
  let alerts = 0
  for (const attempt of attempts) {
    const referenceAt = attempt.lastSyncedAt ?? attempt.createdAt
    const stale =
      nowDate.getTime() - new Date(referenceAt).getTime() >=
      STALE_WEBHOOK_ALERT_AGE_MS
    if (stale) {
      await recordCommerceAdminException({
        payload,
        source: "payments",
        code: "stale_mollie_synchronization",
        message: "Mollie synchronization is stale; polling recovery remains queued.",
        tenant: attempt.tenant,
        subjectId: attempt.id,
        severity: "warning",
        now: nowDate.toISOString(),
      })
      alerts += 1
    } else {
      await resolveCommerceAdminException({
        payload,
        source: "payments",
        code: "stale_mollie_synchronization",
        subjectId: attempt.id,
        now: nowDate.toISOString(),
      })
    }
  }
  return alerts
}

export async function resolveHealthyMollieSynchronizationAlerts(
  payload: Payload,
  now = new Date().toISOString(),
): Promise<number> {
  const prefix = "commerce:payments:stale_mollie_synchronization:"
  const result = await payload.find({
    collection: "operational-alerts",
    where: {
      and: [
        { source: { equals: "payments" } },
        { status: { not_equals: "resolved" } },
        { dedupeKey: { contains: prefix } },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  let resolved = 0
  for (const alert of result.docs) {
    if (!alert.dedupeKey.startsWith(prefix)) continue
    const attemptId = alert.dedupeKey.slice(prefix.length)
    if (!attemptId) continue
    try {
      const attempt = await payload.findByID({
        collection: "payment-attempts",
        id: attemptId,
        depth: 0,
        overrideAccess: true,
      }) as PaymentAttempt
      if (attempt.reconciliationRequired) continue
      await resolveCommerceAdminException({
        payload,
        source: "payments",
        code: "stale_mollie_synchronization",
        subjectId: attempt.id,
        now,
      })
      resolved += 1
    } catch {
      // Retain the alert when its subject cannot be proven healthy.
    }
  }
  return resolved
}

const balanceThreshold = (env: NodeJS.ProcessEnv): number => {
  const configured = env.OPENPROVIDER_MIN_BALANCE_EUR?.trim()
  if (!configured) return DEFAULT_OPENPROVIDER_BALANCE_THRESHOLD_EUR
  const parsed = Number(configured)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("OPENPROVIDER_MIN_BALANCE_EUR must be a non-negative number.")
  }
  return parsed
}

export async function reconcileOpenProviderBalanceAlert(
  payload: Payload,
  dependencies: Partial<ReconciliationDependencies> = {},
  env: NodeJS.ProcessEnv = process.env,
  now = new Date().toISOString(),
): Promise<"skipped" | "healthy" | "low" | "failed"> {
  const deps = { ...defaultDependencies, ...dependencies }
  if (!deps.providerReadsAllowed()) return "skipped"
  try {
    const token = await deps.loginOpenProvider()
    const balance = await deps.getOpenProviderResellerBalance({ token })
    const threshold = balanceThreshold(env)
    await resolveCommerceAdminException({
      payload,
      source: "domains",
      code: "openprovider_balance_check_failed",
      subjectId: "openprovider-account",
      now,
    })
    if (balance.currency !== "EUR" || balance.availableAmount < threshold) {
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "openprovider_balance_low",
        message: "Openprovider available balance is below the configured safety threshold.",
        subjectId: "openprovider-account",
        metadata: {
          availableAmount: balance.availableAmount,
          reservedAmount: balance.reservedAmount,
          currency: balance.currency,
          threshold,
        },
        severity: "critical",
        now,
      })
      return "low"
    }
    await resolveCommerceAdminException({
      payload,
      source: "domains",
      code: "openprovider_balance_low",
      subjectId: "openprovider-account",
      now,
    })
    return "healthy"
  } catch {
    await recordCommerceAdminException({
      payload,
      source: "domains",
      code: "openprovider_balance_check_failed",
      message: "Openprovider balance could not be checked.",
      subjectId: "openprovider-account",
      severity: "error",
      now,
    })
    return "failed"
  }
}

const expirySeverity = (
  expiresAt: string,
  nowDate: Date,
): "warning" | "error" | "critical" | null => {
  const remaining = new Date(expiresAt).getTime() - nowDate.getTime()
  if (remaining <= 7 * DAY_MS) return "critical"
  if (remaining <= 14 * DAY_MS) return "error"
  if (remaining <= 30 * DAY_MS) return "warning"
  return null
}

export async function reconcileDomainExpiryAlerts(
  payload: Payload,
  nowDate = new Date(),
): Promise<{ examined: number; alerts: number }> {
  const result = await payload.find({
    collection: "managed-domains",
    where: {
      and: [
        {
          state: {
            in: [
              "active",
              "renewal_pending",
              "provider_hold",
              "expired",
              "manual_review",
            ],
          },
        },
        { custodyStatus: { not_in: ["transferred_out"] } },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  let alerts = 0
  for (const domain of result.docs as ManagedDomain[]) {
    if (!domain.expiresAt) {
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "domain_expiry_unknown",
        message: "A managed customer domain has no reconciled provider expiry date.",
        tenant: domain.tenant,
        subjectId: domain.id,
        severity: "critical",
        now: nowDate.toISOString(),
      })
      alerts += 1
      continue
    }
    await resolveCommerceAdminException({
      payload,
      source: "domains",
      code: "domain_expiry_unknown",
      subjectId: domain.id,
      now: nowDate.toISOString(),
    })
    const severity = expirySeverity(domain.expiresAt, nowDate)
    if (severity) {
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "domain_expiry_risk",
        message: "A customer-owned domain is approaching provider expiry.",
        tenant: domain.tenant,
        subjectId: domain.id,
        metadata: {
          expiresAt: domain.expiresAt,
          custodyStatus: domain.custodyStatus,
          renewalIntent: domain.renewalIntent,
        },
        severity,
        now: nowDate.toISOString(),
      })
      alerts += 1
    } else {
      await resolveCommerceAdminException({
        payload,
        source: "domains",
        code: "domain_expiry_risk",
        subjectId: domain.id,
        now: nowDate.toISOString(),
      })
    }
  }
  return { examined: result.docs.length, alerts }
}

export async function reconcilePendingTransferOuts(
  payload: Payload,
  dependencies: Partial<ReconciliationDependencies> = {},
  nowDate = new Date(),
): Promise<{ examined: number; confirmed: number }> {
  const deps = { ...defaultDependencies, ...dependencies }
  if (!deps.providerReadsAllowed()) return { examined: 0, confirmed: 0 }
  const result = await payload.find({
    collection: "managed-domains",
    where: { custodyStatus: { equals: "transfer_pending" } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  let confirmed = 0
  for (const domain of result.docs as ManagedDomain[]) {
    try {
      const outcome = await deps.reconcileDomainTransferOut(
        payload,
        domain.id,
        {
          providerReadsAllowed: deps.providerReadsAllowed,
          loginOpenProvider: deps.loginOpenProvider,
        },
        nowDate,
      )
      await resolveCommerceAdminException({
        payload,
        source: "domains",
        code: "transfer_out_reconciliation_failed",
        subjectId: domain.id,
        now: nowDate.toISOString(),
      })
      if (outcome.status === "transferred_out") {
        confirmed += 1
        await Promise.all([
          resolveCommerceAdminException({
            payload,
            source: "domains",
            code: "domain_expiry_unknown",
            subjectId: domain.id,
            now: nowDate.toISOString(),
          }),
          resolveCommerceAdminException({
            payload,
            source: "domains",
            code: "domain_expiry_risk",
            subjectId: domain.id,
            now: nowDate.toISOString(),
          }),
        ])
      }
    } catch {
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "transfer_out_reconciliation_failed",
        message: "Pending domain transfer-out reconciliation failed.",
        tenant: domain.tenant,
        subjectId: domain.id,
        severity: "error",
        now: nowDate.toISOString(),
      })
    }
  }
  return { examined: result.docs.length, confirmed }
}
