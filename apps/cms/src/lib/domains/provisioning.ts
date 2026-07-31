import "server-only"

import {
  getTldCapabilityForProductionOperation,
  getTldCapabilityByVersion,
  tldCapabilityAt,
  tldCapabilityOperationFlagEnabled,
  type TldCapability,
  validateTldRegistrationLabel,
  validateTldRegistrantPrerequisites,
} from "@siteinabox/contracts/tld-capabilities"
import type { Payload } from "payload"
import type {
  CheckoutProfile,
  ManagedDomain,
  Order,
  PaymentAttempt,
  SiteGenerationRun,
  Tenant,
} from "@/payload-types"
import { recordCommerceAdminException } from "@/lib/commerce/alerts"
import {
  ensureCommerceNotification,
  queueCommerceNotification,
} from "@/lib/commerce/notifications"
import {
  buildCloudflareDnsRecordRequests,
  classifyCloudflareZoneLookup,
  createCloudflareZoneDnsRecords,
  createOrReuseCloudflareZone,
  CloudflareApiError,
  getCloudflareSslVerification,
  listCloudflareDnsRecords,
  listCloudflareZones,
  type CloudflareZoneResult,
} from "@/lib/domains/cloudflare"
import {
  checkOpenProviderDomainAvailability,
  createOpenProviderCustomerHandle,
  findOpenProviderCustomerByReference,
  findOpenProviderDomain,
  loginOpenProvider,
  normalizeOpenProviderTimestamp,
  OpenProviderAmbiguousCustomerReferenceLookupError,
  OpenProviderAmbiguousDomainLookupError,
  OpenProviderApiError,
  OpenProviderIndeterminateWriteError,
  registerOpenProviderDomain,
  type OpenProviderDomainRecord,
} from "@/lib/domains/openprovider"
import {
  createDomainOrderState,
  normalizeDomainOrderState,
  normalizeDomainRegistrantDetails,
  type DomainRegistrantDetails,
} from "@/lib/domains/orderState"
import {
  normalizeDomain,
  type NormalizedDomain,
} from "@/lib/domains/normalize"
import type { domainRegistrantFromCheckoutProfile } from "@/lib/checkout/checkoutProfile"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import {
  buildDefaultTenantEmailSending,
  type TenantEmailSendingState,
} from "@/lib/tenants/emailSending"
import {
  initialPaymentBlocksNewFulfillment,
  initialPaymentIsFinanciallySecured,
  registrarCommitStarted,
} from "@/lib/payments/initialPaymentPolicy"
import {
  verifyAuthoritativeDns,
  verifyHttpsEndpoint,
  type AuthoritativeDnsVerification,
  type HttpsVerification,
} from "@/lib/domains/verification"
import { queueCommerceReconciliation } from "@/lib/jobs/queueCommerceReconciliation"
import {
  registrationRegistrantVerification,
  storedRegistrantVerification,
} from "@/lib/domains/registrantVerification"

type ManagedDomainLifecycleData = Partial<ManagedDomain> & Record<string, unknown>

export type ProvisionPaidDomainResult = {
  status: "ready_for_activation" | "already_active" | "waiting" | "unfulfillable"
  domain: string
  run: SiteGenerationRun
  managedDomain: ManagedDomain
  message?: string
}

export type InitialDomainFinancialAuthority = "paid" | "custody_only"

type ProvisionPaidDomainInput = {
  order: Order
  paymentAttemptId: string | number
  selectedDomain?: string | null
  dependencies?: Partial<ProvisioningDependencies>
}

type ProvisioningInitialAuthorityContext = {
  order: Order
  normalized: Extract<NormalizedDomain, { ok: true }>
  capability: TldCapability
  tenantId: string | number
  tenant: Tenant
  registrant: DomainRegistrantDetails
  managedDomain: ManagedDomain
  initialProviderRegistrationState: ManagedDomain["providerRegistrationState"]
  initialFailureReason: ManagedDomain["failureReason"]
  now: string
}

type ProvisioningInitialAuthorityOutcome =
  | { outcome: "continue"; context: ProvisioningInitialAuthorityContext }
  | {
      outcome: "waiting" | "unfulfillable" | "completed"
      result: ProvisionPaidDomainResult
    }

type OpenProviderCustomerReconciliationOutcome =
  | {
      outcome: "continue"
      customerHandle: string
      managedDomain: ManagedDomain
    }
  | {
      outcome:
        | "provider_reconciliation_required"
        | "manual_review"
        | "unfulfillable"
      result: ProvisionPaidDomainResult
    }

type OpenProviderCustomerReferenceLookup =
  | { outcome: "absent" }
  | {
      outcome: "exact"
      customer: NonNullable<Awaited<ReturnType<
        ProvisioningDependencies["findOpenProviderCustomerByReference"]
      >>>
    }
  | { outcome: "ambiguous" }

type CloudflareZoneReconciliationOutcome =
  | {
      outcome: "continue"
      zone: CloudflareZoneResult
      managedDomain: ManagedDomain
    }
  | {
      outcome: "provider_reconciliation_required" | "manual_review"
      result: ProvisionPaidDomainResult
    }

type RegistrarRegistrationOutcome =
  | {
      outcome: "continue"
      providerDomain: OpenProviderDomainRecord
      managedDomain: ManagedDomain
    }
  | {
      outcome:
        | "waiting"
        | "provider_reconciliation_required"
        | "manual_review"
        | "unfulfillable"
      result: ProvisionPaidDomainResult
    }

type RegistrantVerificationPhaseOutcome =
  | { outcome: "continue"; managedDomain: ManagedDomain }
  | {
      outcome: "customer_action_required"
      result: ProvisionPaidDomainResult
    }

type ProvisioningReadinessPhaseOutcome =
  | {
      outcome: "continue"
      managedDomain: ManagedDomain
      zone: CloudflareZoneResult
    }
  | { outcome: "waiting"; result: ProvisionPaidDomainResult }

type ProvisioningActivationPhaseOutcome =
  | { outcome: "completed"; result: ProvisionPaidDomainResult }
  | { outcome: "waiting"; result: ProvisionPaidDomainResult }

type RegistrarWriteErrorClassification = "rejected" | "indeterminate"

type OpenProviderCustomerWriteErrorClassification =
  | "rejected"
  | "indeterminate"

type CloudflareZoneWriteErrorClassification = "rejected" | "indeterminate"

const OPENPROVIDER_CUSTOMER_WRITE_CLAIM_LEASE_MS = 5 * 60_000
const CLOUDFLARE_ZONE_WRITE_CLAIM_LEASE_MS = 5 * 60_000

const customerWriteCheckpointReasons = new Set([
  "openprovider_customer_handle_claimed",
  "openprovider_customer_handle_indeterminate",
  "openprovider_customer_handle_readback_indeterminate",
  "openprovider_customer_handle_readback_pending",
])

const latestCustomerWriteCheckpointAt = (
  domain: ManagedDomain,
): string | null => {
  const history = Array.isArray(domain.stateHistory) ? domain.stateHistory : []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = readObject(history[index])
    const reason = typeof entry?.reason === "string" ? entry.reason : null
    const at = typeof entry?.at === "string" ? entry.at : null
    if (reason && at && customerWriteCheckpointReasons.has(reason)) return at
  }
  return null
}

const customerWriteAbsenceLeaseExpired = (
  domain: ManagedDomain,
  now: string,
): boolean => {
  const checkpointAt = latestCustomerWriteCheckpointAt(domain)
  if (!checkpointAt) return false
  const checkpointTime = new Date(checkpointAt).getTime()
  const currentTime = new Date(now).getTime()
  return Number.isFinite(checkpointTime) &&
    Number.isFinite(currentTime) &&
    currentTime - checkpointTime >= OPENPROVIDER_CUSTOMER_WRITE_CLAIM_LEASE_MS
}

const classifyOpenProviderCustomerWriteError = (
  error: unknown,
): OpenProviderCustomerWriteErrorClassification =>
  error instanceof OpenProviderApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
    ? "rejected"
    : "indeterminate"

const classifyCloudflareZoneWriteError = (
  error: unknown,
): CloudflareZoneWriteErrorClassification =>
  error instanceof CloudflareApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
    ? "rejected"
    : "indeterminate"

const cloudflareZoneWriteCheckpointReasons = new Set([
  "cloudflare_zone_creation_claimed",
  "cloudflare_zone_creation_indeterminate",
  "cloudflare_zone_creation_readback_indeterminate",
  "cloudflare_zone_creation_readback_pending",
])

const cloudflareZoneWriteAbsenceLeaseExpired = (
  domain: ManagedDomain,
  now: string,
): boolean => {
  const history = Array.isArray(domain.stateHistory) ? domain.stateHistory : []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = readObject(history[index])
    const reason = typeof entry?.reason === "string" ? entry.reason : null
    const at = typeof entry?.at === "string" ? entry.at : null
    if (!reason || !at || !cloudflareZoneWriteCheckpointReasons.has(reason)) {
      continue
    }
    const checkpointTime = new Date(at).getTime()
    const currentTime = new Date(now).getTime()
    return Number.isFinite(checkpointTime) &&
      Number.isFinite(currentTime) &&
      currentTime - checkpointTime >= CLOUDFLARE_ZONE_WRITE_CLAIM_LEASE_MS
  }
  return false
}

const classifyRegistrarWriteError = (
  error: unknown,
): RegistrarWriteErrorClassification =>
  error instanceof OpenProviderApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
    ? "rejected"
    : "indeterminate"

type ProvisioningDependencies = {
  now: () => string
  loginOpenProvider: typeof loginOpenProvider
  checkOpenProviderDomainAvailability: typeof checkOpenProviderDomainAvailability
  findOpenProviderDomain: typeof findOpenProviderDomain
  findOpenProviderCustomerByReference: typeof findOpenProviderCustomerByReference
  createOpenProviderCustomerHandle: typeof createOpenProviderCustomerHandle
  registerOpenProviderDomain: typeof registerOpenProviderDomain
  createOrReuseCloudflareZone: typeof createOrReuseCloudflareZone
  listCloudflareZones: typeof listCloudflareZones
  createCloudflareZoneDnsRecords: typeof createCloudflareZoneDnsRecords
  listCloudflareDnsRecords: typeof listCloudflareDnsRecords
  buildCloudflareDnsRecordRequests: typeof buildCloudflareDnsRecordRequests
  getCloudflareSslVerification: typeof getCloudflareSslVerification
  verifyAuthoritativeDns: (
    domain: string,
    expectedNameServers: string[],
  ) => Promise<AuthoritativeDnsVerification>
  verifyHttpsEndpoint: (domain: string) => Promise<HttpsVerification>
}

const defaultDependencies: ProvisioningDependencies = {
  now: () => new Date().toISOString(),
  loginOpenProvider,
  checkOpenProviderDomainAvailability,
  findOpenProviderDomain,
  findOpenProviderCustomerByReference,
  createOpenProviderCustomerHandle,
  registerOpenProviderDomain,
  createOrReuseCloudflareZone,
  listCloudflareZones,
  createCloudflareZoneDnsRecords,
  listCloudflareDnsRecords,
  buildCloudflareDnsRecordRequests,
  getCloudflareSslVerification,
  verifyAuthoritativeDns,
  verifyHttpsEndpoint,
}

const readObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

async function assertInitialDomainFinancialAuthority(
  payload: Payload,
  input: {
    orderId: string | number
    paymentAttemptId: string | number
  },
): Promise<{
  authority: InitialDomainFinancialAuthority
  order: Order
}> {
  const [order, attempt, domains] = await Promise.all([
    payload.findByID({
      collection: "orders",
      id: input.orderId,
      depth: 0,
      overrideAccess: true,
    }) as Promise<Order>,
    payload.findByID({
      collection: "payment-attempts",
      id: input.paymentAttemptId,
      depth: 0,
      overrideAccess: true,
    }) as Promise<PaymentAttempt>,
    payload.find({
      collection: "managed-domains",
      where: { originatingOrder: { equals: input.orderId } },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  if (
    attempt.purpose !== "first_payment" ||
    !sameRelationshipId(attempt.order, order.id)
  ) {
    throw new Error("Domain provisioning requires its order-bound first payment attempt.")
  }
  const managedDomain = domains.docs.length === 1
    ? domains.docs[0] as ManagedDomain
    : null
  if (
    initialPaymentIsFinanciallySecured(order, attempt) &&
    (
      order.state === "fulfillment_pending" ||
      registrarCommitStarted(managedDomain)
    )
  ) {
    return { authority: "paid", order }
  }
  if (
    initialPaymentBlocksNewFulfillment(attempt) &&
    registrarCommitStarted(managedDomain)
  ) {
    return { authority: "custody_only", order }
  }
  throw new Error(
    "Domain provisioning is blocked without a financially secured order; no provider write was attempted.",
  )
}

const capabilityForAcceptedOrder = (
  order: Order,
  tld: string,
): TldCapability => {
  const quoteEvidence = readObject(order.quoteEvidence)
  const evidence = readObject(quoteEvidence?.tldCapability)
  const capabilityVersion = typeof evidence?.capabilityVersion === "string"
    ? evidence.capabilityVersion
    : null
  if (capabilityVersion) {
    const capability = getTldCapabilityByVersion(capabilityVersion)
    if (
      !capability ||
      capability.tld !== tld ||
      evidence?.tld !== tld ||
      !tldCapabilityOperationFlagEnabled(capability, "registration")
    ) {
      throw new Error("Accepted-order TLD capability evidence is invalid.")
    }
    return capability
  }
  if (tld !== "nl") {
    throw new Error(`Paid .${tld} fulfillment requires frozen TLD capability evidence.`)
  }
  const legacyCapability = getTldCapabilityForProductionOperation(
    tld,
    "registration",
    order.acceptedAt ?? order.createdAt,
  )
  if (!legacyCapability) {
    throw new Error("Legacy .nl order has no applicable TLD capability.")
  }
  return legacyCapability
}

const historyWith = (
  domain: ManagedDomain,
  at: string,
  state: string,
  reason: string,
): Array<Record<string, string>> => [
  ...(Array.isArray(domain.stateHistory)
    ? domain.stateHistory.filter(
      (entry): entry is Record<string, string> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    )
    : []),
  { at, state, reason },
]

async function updateManagedDomain(
  payload: Payload,
  domain: ManagedDomain,
  data: ManagedDomainLifecycleData,
  reason?: string,
  now?: string,
): Promise<ManagedDomain> {
  const at = now ?? new Date().toISOString()
  const state = typeof data.state === "string" ? data.state : domain.state
  return payload.update({
    collection: "managed-domains",
    id: domain.id,
    data: {
      ...data,
      ...(reason ? { stateHistory: historyWith(domain, at, state, reason) } : {}),
    },
    depth: 0,
    overrideAccess: true,
    context: { managedDomainLifecycleMutation: true },
  }) as Promise<ManagedDomain>
}

async function claimRegistrarCommit(
  payload: Payload,
  input: {
    order: Order
    paymentAttemptId: string | number
    managedDomain: ManagedDomain
    now: string
  },
): Promise<ManagedDomain | null> {
  const transactionID = await payload.db.beginTransaction()
  if (!transactionID) {
    throw new Error("Registrar commitment requires a database transaction.")
  }
  const req = { transactionID }
  try {
    let attemptClaim = await payload.update({
      collection: "payment-attempts",
      where: {
        and: [
          { id: { equals: input.paymentAttemptId } },
          { order: { equals: input.order.id } },
          { purpose: { equals: "first_payment" } },
          { state: { equals: "paid" } },
        ],
      },
      data: { state: "paid" },
      depth: 0,
      overrideAccess: true,
      context: { paymentAttemptLifecycleMutation: true },
      req,
    })
    if (!Array.isArray(attemptClaim.docs) || attemptClaim.docs.length === 0) {
      attemptClaim = await payload.update({
        collection: "payment-attempts",
        where: {
          and: [
            { id: { equals: input.paymentAttemptId } },
            { order: { equals: input.order.id } },
            { purpose: { equals: "first_payment" } },
            { state: { equals: "refund_failed" } },
          ],
        },
        data: { state: "refund_failed" },
        depth: 0,
        overrideAccess: true,
        context: { paymentAttemptLifecycleMutation: true },
        req,
      })
    }
    const claimedAttempt = Array.isArray(attemptClaim.docs)
      ? attemptClaim.docs[0] as PaymentAttempt | undefined
      : undefined
    if (!claimedAttempt?.providerPaymentId) {
      await payload.db.rollbackTransaction(transactionID)
      return null
    }
    const orderClaim = await payload.update({
      collection: "orders",
      where: {
        and: [
          { id: { equals: input.order.id } },
          { state: { equals: "fulfillment_pending" } },
          { paymentStatus: { equals: "paid" } },
          { providerPaymentId: { equals: claimedAttempt.providerPaymentId } },
        ],
      },
      data: { paymentStatus: "paid" },
      depth: 0,
      overrideAccess: true,
      context: { legalOrderLifecycleMutation: true },
      req,
    })
    if (!Array.isArray(orderClaim.docs) || orderClaim.docs.length !== 1) {
      await payload.db.rollbackTransaction(transactionID)
      return null
    }
    const domainClaim = await payload.update({
      collection: "managed-domains",
      where: {
        and: [
          { id: { equals: input.managedDomain.id } },
          { originatingOrder: { equals: input.order.id } },
          { providerRegistrationState: { equals: "not_started" } },
        ],
      },
      data: {
        providerRegistrationState: "prepared",
        registrationRequestedAt: input.now,
        reconciliationRequired: true,
        failureReason: null,
        stateHistory: historyWith(
          input.managedDomain,
          input.now,
          input.managedDomain.state,
          "provider_registration_prepared",
        ),
      },
      depth: 0,
      overrideAccess: true,
      context: { managedDomainLifecycleMutation: true },
      req,
    })
    const claimedDomain = Array.isArray(domainClaim.docs)
      ? domainClaim.docs[0] as ManagedDomain | undefined
      : undefined
    if (!claimedDomain) {
      await payload.db.rollbackTransaction(transactionID)
      return null
    }
    await payload.db.commitTransaction(transactionID)
    return claimedDomain
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    throw error
  }
}

async function compatibilityProjection(
  payload: Payload,
  run: SiteGenerationRun,
  domain: ManagedDomain,
  status: "registration_requested" | "registered" | "failed",
  reason: string,
  registrant: ReturnType<typeof domainRegistrantFromCheckoutProfile>,
  emailSending?: TenantEmailSendingState,
): Promise<SiteGenerationRun> {
  const current = normalizeDomainOrderState(run.domainOrder)
  const now = new Date().toISOString()
  const projected = {
    ...createDomainOrderState({
      status,
      domain: domain.domainNameAscii,
      fixedPrice: current.fixedPriceAmount && current.fixedPriceCurrency
        ? { amount: current.fixedPriceAmount, currency: current.fixedPriceCurrency }
        : null,
      providerPrice: current.providerPriceAmount && current.providerPriceCurrency
        ? { amount: current.providerPriceAmount, currency: current.providerPriceCurrency }
        : null,
      providerReference: domain.providerDomainId ?? null,
      reason,
      registrant,
      ownerHandle: domain.providerCustomerHandle ?? null,
      // The customer is the registrant/owner. Siteinabox's configured
      // administrative contact is intentionally not projected as customer evidence.
      adminHandle: null,
      maxProviderPrice: current.maxProviderPriceAmount && current.maxProviderPriceCurrency
        ? { amount: current.maxProviderPriceAmount, currency: current.maxProviderPriceCurrency }
        : null,
      maxOfferPrice: current.maxOfferPriceAmount && current.maxOfferPriceCurrency
        ? { amount: current.maxOfferPriceAmount, currency: current.maxOfferPriceCurrency }
        : null,
      now,
    }),
    cloudflareZoneId: domain.cloudflareZoneId ?? null,
    cloudflareNameservers: domain.cloudflareNameservers ?? [],
    cloudflareDnsRecordIds: domain.cloudflareDnsRecordIds ?? [],
    ...(emailSending ? { emailSending } : {}),
  }
  return payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { domainOrder: projected },
    depth: 0,
    overrideAccess: true,
  }) as Promise<SiteGenerationRun>
}

async function checkoutProfileForOrder(payload: Payload, order: Order): Promise<CheckoutProfile> {
  if (!order.checkoutProfileKey) {
    throw new Error("Paid domain fulfillment requires an authoritative checkout profile.")
  }
  const result = await payload.find({
    collection: "checkout-profiles",
    where: { profileKey: { equals: order.checkoutProfileKey } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  const profile = result.docs[0] as CheckoutProfile | undefined
  if (!profile || result.docs.length !== 1) {
    throw new Error("Paid domain fulfillment could not resolve one authoritative checkout profile.")
  }
  if (!sameRelationshipId(profile.tenant, order.tenant)) {
    throw new Error("Checkout profile tenant does not match the paid order.")
  }
  return profile
}

async function getOrCreateManagedDomain(
  payload: Payload,
  input: {
    order: Order
    profile: CheckoutProfile
    domain: string
    tld: string
    now: string
  },
): Promise<ManagedDomain> {
  const existing = await payload.find({
    collection: "managed-domains",
    where: {
      or: [
        { domainNameAscii: { equals: input.domain } },
        { provisioningIdempotencyKey: { equals: `domain-registration:order:${input.order.id}:v1` } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) return existing.docs[0] as ManagedDomain

  try {
    return await payload.create({
      collection: "managed-domains",
      data: {
        domainNameAscii: input.domain,
        tld: input.tld,
        provisioningIdempotencyKey: `domain-registration:order:${input.order.id}:v1`,
        originatingOrder: input.order.id,
        registrantProfile: input.profile.id,
        tenant: relationshipId(input.order.tenant) == null
          ? undefined
          : Number(relationshipId(input.order.tenant)),
        state: "pending",
        custodyStatus: "managed",
        initialOperation: "registration",
        registrantOwnership: "customer",
        provider: "openprovider",
        providerRegistrationState: "not_started",
        registrantVerificationStatus: "not_checked",
        authoritativeDnsStatus: "pending",
        httpsStatus: "pending",
        edgeRoutingStatus: "pending",
        adminHttpsStatus: "pending",
        entitlementStatus: "pending",
        customerStatus: "provisioning",
        renewalIntent: true,
        providerAutorenew: "unknown",
        transferOutCodeDeliveryStatus: "not_requested",
        transferOutProviderMissingCount: 0,
        reconciliationRequired: false,
        stateHistory: [{ at: input.now, state: "pending", reason: "paid_order_accepted" }],
        createdAt: input.now,
      },
      depth: 0,
      overrideAccess: true,
    }) as ManagedDomain
  } catch {
    const raced = await payload.find({
      collection: "managed-domains",
      where: {
        or: [
          { domainNameAscii: { equals: input.domain } },
          { provisioningIdempotencyKey: { equals: `domain-registration:order:${input.order.id}:v1` } },
        ],
      },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    if (raced.docs[0]) return raced.docs[0] as ManagedDomain
    throw new Error("Managed-domain creation failed without a reconcilable record.")
  }
}

const registrationIsActive = (
  status: string,
  capability: TldCapability,
): boolean => capability.registration.confirmation.activeStatuses.includes(
  status.trim().toUpperCase(),
)

const canonicalDnsValue = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "")

const matchingDnsRecord = (
  records: Awaited<ReturnType<typeof listCloudflareDnsRecords>>,
  requested: ReturnType<typeof buildCloudflareDnsRecordRequests>[number],
) => records.find((record) =>
  record.type === requested.type &&
  canonicalDnsValue(record.name) === canonicalDnsValue(requested.name) &&
  canonicalDnsValue(record.content) === canonicalDnsValue(requested.content) &&
  record.proxied === requested.proxied)

const waiting = (
  domain: string,
  run: SiteGenerationRun,
  managedDomain: ManagedDomain,
  message: string,
): ProvisionPaidDomainResult => ({
  status: "waiting",
  domain,
  run,
  managedDomain,
  message,
})

const providerManualReconciliationCodes = new Set([
  "cloudflare_zone_creation_reconciliation_timeout",
  "cloudflare_zone_creation_write_rejected",
  "cloudflare_zone_lookup_ambiguous",
  "openprovider_customer_reference_ambiguous",
  "openprovider_customer_handle_reconciliation_timeout",
  "openprovider_domain_lookup_ambiguous",
])

async function stopProvisioningForProviderManualReview(
  payload: Payload,
  run: SiteGenerationRun,
  managedDomain: ManagedDomain,
  registrant: ReturnType<typeof domainRegistrantFromCheckoutProfile>,
  code: string,
  message: string,
  now: string,
): Promise<ProvisionPaidDomainResult> {
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    state: "manual_review",
    customerStatus: "manual_review",
    reconciliationRequired: true,
    failureReason: code,
  }, code, now)
  await recordCommerceAdminException({
    payload,
    source: "domains",
    code,
    message,
    tenant: managedDomain.tenant,
    subjectId: managedDomain.id,
    severity: "critical",
    now,
  })
  run = await compatibilityProjection(
    payload,
    run,
    managedDomain,
    "failed",
    code,
    registrant,
  )
  return waiting(
    managedDomain.domainNameAscii,
    run,
    managedDomain,
    message,
  )
}

async function loadAndClassifyProvisioningAuthorityPhase(
  payload: Payload,
  run: SiteGenerationRun,
  input: ProvisionPaidDomainInput,
  dependencies: ProvisioningDependencies,
): Promise<ProvisioningInitialAuthorityOutcome> {
  const financialAuthority = await assertInitialDomainFinancialAuthority(payload, {
    orderId: input.order.id,
    paymentAttemptId: input.paymentAttemptId,
  })
  input.order = financialAuthority.order
  const selectedDomain = input.selectedDomain ?? input.order.domain
  const normalized = normalizeDomain(selectedDomain)
  if (!normalized.ok) {
    throw new Error(`Cannot provision paid domain: ${normalized.reason}.`)
  }
  const capability = capabilityForAcceptedOrder(
    input.order,
    normalized.extension,
  )
  if (!validateTldRegistrationLabel(capability, normalized.name)) {
    throw new Error(`Domain label is not supported for .${normalized.extension}.`)
  }
  const orderDomain = normalizeDomain(input.order.domain)
  if (!orderDomain.ok || orderDomain.domain !== normalized.domain) {
    throw new Error("Paid order domain does not match the requested managed domain.")
  }

  const tenantId = relationshipId(run.tenant)
  if (!tenantId || !sameRelationshipId(input.order.tenant, tenantId)) {
    throw new Error("Paid order, generation run, and tenant must match.")
  }
  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  if (tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Cannot provision a paid domain for an unavailable tenant.")
  }

  const profile = await checkoutProfileForOrder(payload, input.order)
  const registrant = normalizeDomainRegistrantDetails(input.order.domainRegistrant)
  if (!registrant) {
    throw new Error(
      "Paid domain fulfillment requires the frozen accepted registrant evidence.",
    )
  }
  if (!capability.registrant.supportedPartyTypes.includes(profile.partyType)) {
    throw new Error(
      `Contracting-party type is not supported for .${capability.tld}.`,
    )
  }
  for (const field of capability.registrant.requiredFields) {
    if (!registrant[field]) {
      throw new Error(
        `Authoritative registrant field ${field} is required for .${capability.tld}.`,
      )
    }
  }
  if (profile.partyType === "registered_business" && !registrant.companyName) {
    throw new Error(
      `Authoritative registrant field companyName is required for .${capability.tld}.`,
    )
  }
  const now = dependencies.now()
  const currentSafetyCapability = tldCapabilityAt(capability.tld, now) ??
    capability
  const registrantPrerequisites = validateTldRegistrantPrerequisites(
    currentSafetyCapability,
    registrant,
  )
  let managedDomain = await getOrCreateManagedDomain(payload, {
    order: input.order,
    profile,
    domain: normalized.domain,
    tld: capability.tld,
    now,
  })
  if (
    managedDomain.domainNameAscii !== normalized.domain ||
    managedDomain.tld !== capability.tld ||
    managedDomain.provider !== "openprovider" ||
    managedDomain.initialOperation !== "registration" ||
    managedDomain.registrantOwnership !== "customer" ||
    !sameRelationshipId(managedDomain.tenant, tenantId) ||
    !sameRelationshipId(managedDomain.originatingOrder, input.order.id) ||
    !sameRelationshipId(managedDomain.registrantProfile, profile.id)
  ) {
    throw new Error(
      "Managed domain is already bound to different accepted evidence or ownership.",
    )
  }
  const initialProviderRegistrationState =
    managedDomain.providerRegistrationState
  const initialFailureReason = managedDomain.failureReason
  if (
    managedDomain.state === "manual_review" &&
    providerManualReconciliationCodes.has(initialFailureReason ?? "")
  ) {
    return {
      outcome: "waiting",
      result: waiting(
        normalized.domain,
        run,
        managedDomain,
        "Provider authority requires manual reconciliation.",
      ),
    }
  }
  if (
    managedDomain.state === "manual_review" &&
    (
      [
        "openprovider_customer_handle_write_rejected",
        "openprovider_registration_write_rejected",
        "paid_domain_became_unavailable_before_provider_commit",
        "provider_domain_owner_mismatch",
      ].includes(initialFailureReason ?? "") ||
      initialFailureReason?.startsWith(
        "current_tld_safety_contract_unmet:",
      ) === true
    )
  ) {
    run = await compatibilityProjection(
      payload,
      run,
      managedDomain,
      "failed",
      initialFailureReason ?? "managed_domain_manual_review",
      registrant,
    )
    return {
      outcome: "unfulfillable",
      result: {
        status: "unfulfillable",
        domain: normalized.domain,
        run,
        managedDomain,
        message: "The managed domain remains in terminal manual review.",
      },
    }
  }
  const currentSafetyFailure = !validateTldRegistrationLabel(
    currentSafetyCapability,
    normalized.name,
  )
    ? "current_tld_label_contract_unmet"
    : !registrantPrerequisites.valid
      ? registrantPrerequisites.reason
      : currentSafetyCapability.registration.preconfiguredAuthoritativeDns
        ? "preconfigured_authoritative_dns_not_proven"
        : null
  if (currentSafetyFailure) {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      state: "manual_review",
      customerStatus: "manual_review",
      reconciliationRequired: false,
      failureReason: `current_tld_safety_contract_unmet:${currentSafetyFailure}`,
    }, "current_tld_safety_contract_unmet", now)
    run = await compatibilityProjection(
      payload,
      run,
      managedDomain,
      "failed",
      currentSafetyFailure,
      registrant,
    )
    return {
      outcome: "unfulfillable",
      result: {
        status: "unfulfillable",
        domain: normalized.domain,
        run,
        managedDomain,
        message:
          "The accepted order no longer satisfies the current registry safety contract.",
      },
    }
  }
  if (
    managedDomain.state === "active" &&
    managedDomain.entitlementStatus === "active"
  ) {
    run = await compatibilityProjection(
      payload,
      run,
      managedDomain,
      "registered",
      "managed_domain_already_active",
      registrant,
    )
    return {
      outcome: "completed",
      result: {
        status: "already_active",
        domain: normalized.domain,
        run,
        managedDomain,
      },
    }
  }
  return {
    outcome: "continue",
    context: {
      order: input.order,
      normalized,
      capability,
      tenantId,
      tenant,
      registrant,
      managedDomain,
      initialProviderRegistrationState,
      initialFailureReason,
      now,
    },
  }
}

async function lookupOpenProviderCustomerReference(
  dependencies: ProvisioningDependencies,
  reference: string,
  token: string,
): Promise<OpenProviderCustomerReferenceLookup> {
  try {
    const customer = await dependencies.findOpenProviderCustomerByReference(
      reference,
      { token },
    )
    return customer
      ? { outcome: "exact", customer }
      : { outcome: "absent" }
  } catch (error) {
    if (error instanceof OpenProviderAmbiguousCustomerReferenceLookupError) {
      return { outcome: "ambiguous" }
    }
    throw error
  }
}

async function claimOpenProviderCustomerWrite(
  payload: Payload,
  domain: ManagedDomain,
  now: string,
): Promise<{ claimed: boolean; managedDomain: ManagedDomain }> {
  const currentFailureReason = domain.failureReason ?? null
  const claim = await payload.update({
    collection: "managed-domains",
    where: {
      and: [
        { id: { equals: domain.id } },
        { providerCustomerHandle: { exists: false } },
        {
          providerRegistrationState: {
            equals: domain.providerRegistrationState,
          },
        },
        currentFailureReason
          ? { failureReason: { equals: currentFailureReason } }
          : { failureReason: { exists: false } },
      ],
    },
    data: {
      providerRegistrationState: "prepared",
      reconciliationRequired: true,
      failureReason: "openprovider_customer_handle_prepared",
      stateHistory: historyWith(
        domain,
        now,
        domain.state,
        "openprovider_customer_handle_claimed",
      ),
    },
    depth: 0,
    overrideAccess: true,
    context: { managedDomainLifecycleMutation: true },
  })
  const claimedDomain = Array.isArray(claim.docs)
    ? claim.docs[0] as ManagedDomain | undefined
    : undefined
  if (claimedDomain) return { claimed: true, managedDomain: claimedDomain }
  const winner = await payload.findByID({
    collection: "managed-domains",
    id: domain.id,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  return { claimed: false, managedDomain: winner }
}

async function reconcileOpenProviderCustomerPhase(
  payload: Payload,
  run: SiteGenerationRun,
  input: ProvisionPaidDomainInput,
  dependencies: ProvisioningDependencies,
  context: {
    token: string
    normalized: Extract<NormalizedDomain, { ok: true }>
    registrant: DomainRegistrantDetails
    managedDomain: ManagedDomain
  },
): Promise<OpenProviderCustomerReconciliationOutcome> {
  let managedDomain = context.managedDomain
  let customerHandle = managedDomain.providerCustomerHandle ?? null
  if (customerHandle) {
    return { outcome: "continue", customerHandle, managedDomain }
  }

  const stopForAmbiguity = async (): Promise<OpenProviderCustomerReconciliationOutcome> => ({
    outcome: "manual_review",
    result: await stopProvisioningForProviderManualReview(
      payload,
      run,
      managedDomain,
      context.registrant,
      "openprovider_customer_reference_ambiguous",
      "Multiple exact Openprovider customers match the accepted registration reference.",
      dependencies.now(),
    ),
  })
  const persistExactCustomer = async (
    exactHandle: string,
  ): Promise<OpenProviderCustomerReconciliationOutcome> => {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      providerCustomerHandle: exactHandle,
      providerRegistrationState: "not_started",
      reconciliationRequired: false,
      failureReason: null,
    }, "provider_customer_handle_persisted", dependencies.now())
    return {
      outcome: "continue",
      customerHandle: exactHandle,
      managedDomain,
    }
  }
  const persistIndeterminate = async (
    reason: string,
    message: string,
  ): Promise<OpenProviderCustomerReconciliationOutcome> => {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      providerRegistrationState: "indeterminate",
      reconciliationRequired: true,
      failureReason: "openprovider_customer_handle_indeterminate",
    }, reason, dependencies.now())
    return {
      outcome: "provider_reconciliation_required",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        message,
      ),
    }
  }

  const initialLookup = await lookupOpenProviderCustomerReference(
    dependencies,
    managedDomain.provisioningIdempotencyKey,
    context.token,
  )
  if (initialLookup.outcome === "ambiguous") return stopForAmbiguity()
  if (initialLookup.outcome === "exact") {
    return persistExactCustomer(initialLookup.customer.handle)
  }

  const now = dependencies.now()
  const resumableCheckpoint =
    managedDomain.providerRegistrationState === "prepared" ||
    managedDomain.providerRegistrationState === "indeterminate"
  if (
    resumableCheckpoint &&
    !customerWriteAbsenceLeaseExpired(managedDomain, now)
  ) {
    return {
      outcome: "provider_reconciliation_required",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Openprovider customer-handle creation remains claimed or indeterminate; the exact-absence lease has not elapsed.",
      ),
    }
  }
  if (resumableCheckpoint) {
    return {
      outcome: "manual_review",
      result: await stopProvisioningForProviderManualReview(
        payload,
        run,
        managedDomain,
        context.registrant,
        "openprovider_customer_handle_reconciliation_timeout",
        "Openprovider customer-handle creation remains absent after the reconciliation timeout; operator review is required and no retry was sent.",
        now,
      ),
    }
  }
  if (
    managedDomain.providerRegistrationState !== "not_started"
  ) {
    return {
      outcome: "provider_reconciliation_required",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Openprovider customer-handle state requires reconciliation before creation.",
      ),
    }
  }

  await assertInitialDomainFinancialAuthority(payload, {
    orderId: input.order.id,
    paymentAttemptId: input.paymentAttemptId,
  })
  const claim = await claimOpenProviderCustomerWrite(payload, managedDomain, now)
  managedDomain = claim.managedDomain
  if (!claim.claimed) {
    if (managedDomain.providerCustomerHandle) {
      return {
        outcome: "continue",
        customerHandle: managedDomain.providerCustomerHandle,
        managedDomain,
      }
    }
    return {
      outcome: "provider_reconciliation_required",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Openprovider customer-handle creation is owned by another worker.",
      ),
    }
  }

  let writeFailed = false
  let writeError: unknown = null
  try {
    await dependencies.createOpenProviderCustomerHandle(
      context.registrant,
      {
        token: context.token,
        reference: managedDomain.provisioningIdempotencyKey,
      },
    )
  } catch (error) {
    writeFailed = true
    writeError = error
  }

  let readback: OpenProviderCustomerReferenceLookup | null = null
  try {
    readback = await lookupOpenProviderCustomerReference(
      dependencies,
      managedDomain.provisioningIdempotencyKey,
      context.token,
    )
  } catch {
    return persistIndeterminate(
      "openprovider_customer_handle_readback_indeterminate",
      "Openprovider customer-handle readback is awaiting reconciliation; no retry was sent.",
    )
  }
  if (readback.outcome === "ambiguous") return stopForAmbiguity()
  if (readback.outcome === "exact") {
    return persistExactCustomer(readback.customer.handle)
  }

  if (writeFailed) {
    if (classifyOpenProviderCustomerWriteError(writeError) === "rejected") {
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        state: "manual_review",
        customerStatus: "manual_review",
        providerRegistrationState: "not_started",
        reconciliationRequired: false,
        failureReason: "openprovider_customer_handle_write_rejected",
      }, "openprovider_customer_handle_write_rejected", dependencies.now())
      return {
        outcome: "unfulfillable",
        result: {
          status: "unfulfillable",
          domain: context.normalized.domain,
          run,
          managedDomain,
          message:
            "Openprovider deterministically rejected the customer-handle creation.",
        },
      }
    }
    return persistIndeterminate(
      "openprovider_customer_handle_indeterminate",
      "Openprovider customer-handle creation is awaiting reconciliation; no retry was sent.",
    )
  }

  managedDomain = await updateManagedDomain(payload, managedDomain, {
    providerRegistrationState: "prepared",
    reconciliationRequired: true,
    failureReason: "openprovider_customer_handle_readback_pending",
  }, "openprovider_customer_handle_readback_pending", dependencies.now())
  return {
    outcome: "provider_reconciliation_required",
    result: waiting(
      context.normalized.domain,
      run,
      managedDomain,
      "Openprovider accepted customer-handle creation but exact readback is still pending; no retry was sent.",
    ),
  }
}

async function claimCloudflareZoneWrite(
  payload: Payload,
  domain: ManagedDomain,
  now: string,
): Promise<{ claimed: boolean; managedDomain: ManagedDomain }> {
  const currentFailureReason = domain.failureReason ?? null
  const claim = await payload.update({
    collection: "managed-domains",
    where: {
      and: [
        { id: { equals: domain.id } },
        { cloudflareZoneId: { exists: false } },
        currentFailureReason
          ? { failureReason: { equals: currentFailureReason } }
          : { failureReason: { exists: false } },
      ],
    },
    data: {
      reconciliationRequired: true,
      failureReason: "cloudflare_zone_creation_prepared",
      stateHistory: historyWith(
        domain,
        now,
        domain.state,
        "cloudflare_zone_creation_claimed",
      ),
    },
    depth: 0,
    overrideAccess: true,
    context: { managedDomainLifecycleMutation: true },
  })
  const claimedDomain = Array.isArray(claim.docs)
    ? claim.docs[0] as ManagedDomain | undefined
    : undefined
  if (claimedDomain) return { claimed: true, managedDomain: claimedDomain }
  const winner = await payload.findByID({
    collection: "managed-domains",
    id: domain.id,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  return { claimed: false, managedDomain: winner }
}

async function reconcileCloudflareZonePhase(
  payload: Payload,
  run: SiteGenerationRun,
  input: ProvisionPaidDomainInput,
  dependencies: ProvisioningDependencies,
  context: {
    normalized: Extract<NormalizedDomain, { ok: true }>
    registrant: DomainRegistrantDetails
    managedDomain: ManagedDomain
  },
): Promise<CloudflareZoneReconciliationOutcome> {
  let managedDomain = context.managedDomain
  const stopForAmbiguity = async (): Promise<CloudflareZoneReconciliationOutcome> => ({
    outcome: "manual_review",
    result: await stopProvisioningForProviderManualReview(
      payload,
      run,
      managedDomain,
      context.registrant,
      "cloudflare_zone_lookup_ambiguous",
      "Multiple exact Cloudflare zones match the accepted registration authority.",
      dependencies.now(),
    ),
  })
  const persistExactZone = async (
    zone: CloudflareZoneResult,
  ): Promise<CloudflareZoneReconciliationOutcome> => {
    if (
      managedDomain.cloudflareZoneId !== zone.id ||
      managedDomain.cloudflareZoneStatus !== zone.status ||
      managedDomain.failureReason
    ) {
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        cloudflareZoneId: zone.id,
        cloudflareNameservers: zone.nameServers,
        cloudflareZoneStatus: zone.status,
        reconciliationRequired: false,
        failureReason: null,
      }, "cloudflare_zone_persisted", dependencies.now())
    }
    return {
      outcome: "continue",
      zone,
      managedDomain,
    }
  }
  const persistIndeterminate = async (
    reason: string,
    message: string,
  ): Promise<CloudflareZoneReconciliationOutcome> => {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      reconciliationRequired: true,
      failureReason: "cloudflare_zone_creation_indeterminate",
    }, reason, dependencies.now())
    return {
      outcome: "provider_reconciliation_required",
      result: waiting(context.normalized.domain, run, managedDomain, message),
    }
  }
  const classifyVisibleZones = (
    visibleZones: CloudflareZoneResult[],
  ): ReturnType<typeof classifyCloudflareZoneLookup> => {
    const persistedZones = managedDomain.cloudflareZoneId
      ? visibleZones.filter((candidate) =>
          candidate.id === managedDomain.cloudflareZoneId)
      : []
    return classifyCloudflareZoneLookup(
      context.normalized.domain,
      persistedZones.length > 0 ? persistedZones : visibleZones,
    )
  }

  const initialLookup = classifyVisibleZones(
    await dependencies.listCloudflareZones(context.normalized.domain),
  )
  if (initialLookup.outcome === "ambiguous") return stopForAmbiguity()
  if (initialLookup.outcome === "exact") {
    return persistExactZone(initialLookup.zone)
  }

  const now = dependencies.now()
  const unresolvedCheckpoint = [
    "cloudflare_zone_creation_prepared",
    "cloudflare_zone_creation_indeterminate",
    "cloudflare_zone_creation_readback_pending",
  ].includes(managedDomain.failureReason ?? "")
  if (
    unresolvedCheckpoint &&
    !cloudflareZoneWriteAbsenceLeaseExpired(managedDomain, now)
  ) {
    return {
      outcome: "provider_reconciliation_required",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Cloudflare zone creation remains prepared or indeterminate; no retry was sent.",
      ),
    }
  }
  if (unresolvedCheckpoint) {
    return {
      outcome: "manual_review",
      result: await stopProvisioningForProviderManualReview(
        payload,
        run,
        managedDomain,
        context.registrant,
        "cloudflare_zone_creation_reconciliation_timeout",
        "Cloudflare zone creation remains absent after the reconciliation timeout; operator review is required and no retry was sent.",
        now,
      ),
    }
  }

  await assertInitialDomainFinancialAuthority(payload, {
    orderId: input.order.id,
    paymentAttemptId: input.paymentAttemptId,
  })
  const claim = await claimCloudflareZoneWrite(payload, managedDomain, now)
  managedDomain = claim.managedDomain
  if (!claim.claimed) {
    return {
      outcome: "provider_reconciliation_required",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Cloudflare zone creation is owned by another worker.",
      ),
    }
  }

  let writeError: unknown = null
  try {
    await dependencies.createOrReuseCloudflareZone(context.normalized.domain)
  } catch (error) {
    writeError = error
  }

  let readback: ReturnType<typeof classifyCloudflareZoneLookup>
  try {
    readback = classifyVisibleZones(
      await dependencies.listCloudflareZones(context.normalized.domain),
    )
  } catch {
    return persistIndeterminate(
      "cloudflare_zone_creation_readback_indeterminate",
      "Cloudflare zone readback is awaiting reconciliation; no retry was sent.",
    )
  }
  if (readback.outcome === "ambiguous") return stopForAmbiguity()
  if (readback.outcome === "exact") return persistExactZone(readback.zone)

  if (writeError) {
    if (classifyCloudflareZoneWriteError(writeError) === "rejected") {
      const code = "cloudflare_zone_creation_write_rejected"
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        state: "manual_review",
        customerStatus: "manual_review",
        reconciliationRequired: false,
        failureReason: code,
      }, code, dependencies.now())
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code,
        message: "Cloudflare deterministically rejected zone creation.",
        tenant: managedDomain.tenant,
        subjectId: managedDomain.id,
        severity: "critical",
        now: dependencies.now(),
      })
      run = await compatibilityProjection(
        payload,
        run,
        managedDomain,
        "failed",
        code,
        context.registrant,
      )
      return {
        outcome: "manual_review",
        result: waiting(
          context.normalized.domain,
          run,
          managedDomain,
          "Cloudflare deterministically rejected zone creation; operator review is required.",
        ),
      }
    }
    return persistIndeterminate(
      "cloudflare_zone_creation_indeterminate",
      "Cloudflare zone creation is awaiting reconciliation; no retry was sent.",
    )
  }

  managedDomain = await updateManagedDomain(payload, managedDomain, {
    reconciliationRequired: true,
    failureReason: "cloudflare_zone_creation_readback_pending",
  }, "cloudflare_zone_creation_readback_pending", dependencies.now())
  return {
    outcome: "provider_reconciliation_required",
    result: waiting(
      context.normalized.domain,
      run,
      managedDomain,
      "Cloudflare accepted zone creation but exact readback is still pending; no retry was sent.",
    ),
  }
}

async function claimAndReconcileRegistrarRegistrationPhase(
  payload: Payload,
  run: SiteGenerationRun,
  input: ProvisionPaidDomainInput,
  dependencies: ProvisioningDependencies,
  context: {
    token: string
    normalized: Extract<NormalizedDomain, { ok: true }>
    capability: TldCapability
    registrant: DomainRegistrantDetails
    managedDomain: ManagedDomain
    providerDomain: OpenProviderDomainRecord | null
    customerHandle: string
    zone: CloudflareZoneResult
  },
): Promise<RegistrarRegistrationOutcome> {
  let managedDomain = context.managedDomain
  let providerDomain = context.providerDomain
  if (!providerDomain) {
    const claimedAt = dependencies.now()
    const claimedDomain = await claimRegistrarCommit(payload, {
      order: input.order,
      paymentAttemptId: input.paymentAttemptId,
      managedDomain,
      now: claimedAt,
    })
    if (!claimedDomain) {
      return {
        outcome: "waiting",
        result: waiting(
          context.normalized.domain,
          run,
          managedDomain,
          "Payment authority changed before registrar commitment; no registration was sent.",
        ),
      }
    }
    managedDomain = claimedDomain
    let registrationFailed = false
    let registrationError: unknown = null
    try {
      const registration = await dependencies.registerOpenProviderDomain(
        context.normalized.domain,
        {
          token: context.token,
          ownerHandle: context.customerHandle,
          nameServers: context.zone.nameServers.map((name) => ({ name })),
          nsGroup: null,
          period: context.capability.registration.periodYears,
          autorenew:
            context.capability.renewal.executionMode ===
              "provider_autorenew" &&
            tldCapabilityOperationFlagEnabled(
              context.capability,
              "renewal_provider_autorenew",
            )
              ? "on"
              : "off",
          reference: managedDomain.provisioningIdempotencyKey,
          acceptedCapabilityVersion: context.capability.capabilityVersion,
        },
      )
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        providerDomainId: registration.id == null
          ? managedDomain.providerDomainId
          : String(registration.id),
        providerRegistrationState: "prepared",
        reconciliationRequired: true,
        failureReason: "openprovider_registration_readback_pending",
      }, `provider_registration_response_${registration.status}`, dependencies.now())
      // A successful POST is not registrant-verification evidence. Always
      // reconcile through OpenProvider's authoritative domain read before DNS
      // or publication may advance.
      try {
        providerDomain = await dependencies.findOpenProviderDomain(
          context.normalized.domain,
          { token: context.token },
        )
      } catch (readError) {
        if (readError instanceof OpenProviderAmbiguousDomainLookupError) {
          return {
            outcome: "manual_review",
            result: await stopProvisioningForProviderManualReview(
              payload,
              run,
              managedDomain,
              context.registrant,
              "openprovider_domain_lookup_ambiguous",
              "Multiple exact Openprovider domains match the accepted registration authority.",
              dependencies.now(),
            ),
          }
        }
        managedDomain = await updateManagedDomain(payload, managedDomain, {
          providerRegistrationState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_registration_indeterminate",
        }, "openprovider_registration_readback_indeterminate", dependencies.now())
        return {
          outcome: "provider_reconciliation_required",
          result: waiting(
            context.normalized.domain,
            run,
            managedDomain,
            "Openprovider registration readback is awaiting reconciliation; no retry was sent.",
          ),
        }
      }
    } catch (error) {
      registrationFailed = true
      registrationError = error
    }
    if (registrationFailed) {
      let reconciled: OpenProviderDomainRecord | null = null
      let reconciliationReadFailed = false
      let reconciliationError: unknown = null
      try {
        reconciled = await dependencies.findOpenProviderDomain(
          context.normalized.domain,
          { token: context.token },
        )
      } catch (readError) {
        // The original indeterminate write remains authoritative until a read succeeds.
        reconciliationReadFailed = true
        reconciliationError = readError
      }
      if (reconciliationError instanceof OpenProviderAmbiguousDomainLookupError) {
        return {
          outcome: "manual_review",
          result: await stopProvisioningForProviderManualReview(
            payload,
            run,
            managedDomain,
            context.registrant,
            "openprovider_domain_lookup_ambiguous",
            "Multiple exact Openprovider domains match the accepted registration authority.",
            dependencies.now(),
          ),
        }
      }
      if (reconciliationReadFailed) {
        managedDomain = await updateManagedDomain(payload, managedDomain, {
          providerRegistrationState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_registration_indeterminate",
        }, "openprovider_registration_readback_indeterminate", dependencies.now())
        return {
          outcome: "provider_reconciliation_required",
          result: waiting(
            context.normalized.domain,
            run,
            managedDomain,
            "Openprovider registration readback is awaiting reconciliation; no retry was sent.",
          ),
        }
      }
      if (reconciled) {
        providerDomain = reconciled
      } else if (classifyRegistrarWriteError(registrationError) === "rejected") {
        managedDomain = await updateManagedDomain(payload, managedDomain, {
          state: "manual_review",
          customerStatus: "manual_review",
          providerRegistrationState: "not_started",
          reconciliationRequired: false,
          failureReason: "openprovider_registration_write_rejected",
        }, "openprovider_registration_write_rejected", dependencies.now())
        return {
          outcome: "unfulfillable",
          result: {
            status: "unfulfillable",
            domain: context.normalized.domain,
            run,
            managedDomain,
            message: "Openprovider deterministically rejected the domain registration.",
          },
        }
      } else {
        managedDomain = await updateManagedDomain(payload, managedDomain, {
          providerRegistrationState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_registration_indeterminate",
        }, "openprovider_registration_indeterminate", dependencies.now())
        return {
          outcome: "provider_reconciliation_required",
          result: waiting(
            context.normalized.domain,
            run,
            managedDomain,
            "Openprovider registration is awaiting reconciliation; no retry was sent.",
          ),
        }
      }
    }
  }

  if (!providerDomain) {
    return {
      outcome: "waiting",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Openprovider is still processing the domain registration.",
      ),
    }
  }
  if (providerDomain.ownerHandle !== context.customerHandle) {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      state: "manual_review",
      customerStatus: "manual_review",
      reconciliationRequired: false,
      failureReason: "provider_domain_owner_mismatch",
    }, "provider_domain_owner_mismatch", dependencies.now())
    return {
      outcome: "unfulfillable",
      result: {
        status: "unfulfillable",
        domain: context.normalized.domain,
        run,
        managedDomain,
        message:
          "Openprovider returned the domain under a different registrant handle.",
      },
    }
  }
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    providerDomainId: String(providerDomain.id),
    providerRegistrationState: "confirmed",
    expiresAt: normalizeOpenProviderTimestamp(providerDomain.renewalDate),
    providerRenewalDate: normalizeOpenProviderTimestamp(
      providerDomain.renewalDate,
    ),
    registryExpiryDate: normalizeOpenProviderTimestamp(
      providerDomain.registryExpiryDate,
    ),
    registeredAt: registrationIsActive(providerDomain.status, context.capability)
      ? managedDomain.registeredAt ?? dependencies.now()
      : managedDomain.registeredAt,
    reconciliationRequired: !registrationIsActive(
      providerDomain.status,
      context.capability,
    ),
    failureReason: null,
  }, "provider_registration_reconciled", dependencies.now())
  if (!registrationIsActive(providerDomain.status, context.capability)) {
    return {
      outcome: "waiting",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Openprovider has accepted the registration and is still processing it.",
      ),
    }
  }

  return {
    outcome: "continue",
    providerDomain,
    managedDomain,
  }
}

async function projectRegistrantVerificationPhase(
  payload: Payload,
  run: SiteGenerationRun,
  input: ProvisionPaidDomainInput,
  dependencies: ProvisioningDependencies,
  context: {
    normalized: Extract<NormalizedDomain, { ok: true }>
    capability: TldCapability
    tenantId: string | number
    managedDomain: ManagedDomain
    providerDomain: OpenProviderDomainRecord
  },
): Promise<RegistrantVerificationPhaseOutcome> {
  const verification = registrationRegistrantVerification(
    context.providerDomain,
    context.capability.tld,
  )
  const storedVerification = storedRegistrantVerification(
    verification.status,
    context.managedDomain.registrantVerificationStatus,
  )
  const verificationStatus = storedVerification.status
  const verificationActionRequired = storedVerification.customerActionRequired
  const managedDomain = await updateManagedDomain(
    payload,
    context.managedDomain,
    {
      registrantVerificationStatus: verificationStatus,
      registrantVerificationCheckedAt: dependencies.now(),
      registrantVerificationDueAt: normalizeOpenProviderTimestamp(
        context.providerDomain.verificationEmailExpiresAt,
      ) ?? context.managedDomain.registrantVerificationDueAt,
      registrantVerificationRecoveredAt: storedVerification.recovered
        ? dependencies.now()
        : undefined,
      registrantVerificationDescription: verification.description,
      customerStatus: verificationActionRequired
        ? "verification_required"
        : "provisioning",
      reconciliationRequired: verificationActionRequired,
      failureReason: verificationActionRequired
        ? `registrant_verification_${verificationStatus}`
        : null,
    },
    `registrant_verification_${verificationStatus}`,
    dependencies.now(),
  )
  if (["overdue", "suspended", "failed"].includes(verificationStatus)) {
    await recordCommerceAdminException({
      payload,
      source: "domains",
      code: `registrant_verification_${verificationStatus}`,
      message:
        "Provider-reported registrant verification requires immediate customer recovery.",
      tenant: managedDomain.tenant,
      subjectId: managedDomain.id,
      severity: verificationStatus === "suspended" ? "critical" : "error",
      now: dependencies.now(),
    })
  }
  if (verificationActionRequired) {
    const agreements = await payload.find({
      collection: "billing-agreements",
      where: { originatingOrder: { equals: input.order.id } },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    if (agreements.docs.length === 1) {
      const delivery = await ensureCommerceNotification({
        payload,
        kind: "domain_verification_required",
        tenantId: context.tenantId,
        recipient: input.order.customerEmail,
        businessEventKey: `registration:${managedDomain.id}`,
        eventAt:
          managedDomain.registrantVerificationDueAt ??
          managedDomain.registrationRequestedAt ??
          managedDomain.createdAt,
        billingAgreementId: agreements.docs[0]!.id,
      })
      await queueCommerceNotification(payload, delivery.id)
    }
    return {
      outcome: "customer_action_required",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Customer registrant verification is required before activation.",
      ),
    }
  }

  return { outcome: "continue", managedDomain }
}

async function verifyProvisioningReadinessPhase(
  payload: Payload,
  run: SiteGenerationRun,
  dependencies: ProvisioningDependencies,
  context: {
    normalized: Extract<NormalizedDomain, { ok: true }>
    managedDomain: ManagedDomain
    zone: CloudflareZoneResult
  },
): Promise<ProvisioningReadinessPhaseOutcome> {
  let managedDomain = context.managedDomain
  const refreshedZone = (await dependencies.listCloudflareZones(
    context.normalized.domain,
  )).find((candidate) => candidate.id === context.zone.id) ?? context.zone
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    cloudflareZoneStatus: refreshedZone.status,
  }, "cloudflare_zone_reconciled", dependencies.now())
  if (refreshedZone.status !== "active") {
    return {
      outcome: "waiting",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Cloudflare is waiting for authoritative nameserver activation.",
      ),
    }
  }

  const authoritativeDns = await dependencies.verifyAuthoritativeDns(
    context.normalized.domain,
    refreshedZone.nameServers,
  )
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    authoritativeDnsStatus: authoritativeDns.status === "verified"
      ? "verified"
      : "pending",
    authoritativeDnsCheckedAt: dependencies.now(),
    authoritativeDnsEvidence: authoritativeDns,
    reconciliationRequired: authoritativeDns.status !== "verified",
  }, `authoritative_dns_${authoritativeDns.status}`, dependencies.now())
  if (authoritativeDns.status !== "verified") {
    return {
      outcome: "waiting",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Authoritative DNS delegation is not verified yet.",
      ),
    }
  }

  if (
    managedDomain.edgeRoutingStatus !== "active" ||
    managedDomain.httpsStatus !== "verified" ||
    managedDomain.adminHttpsStatus !== "verified"
  ) {
    await queueCommerceReconciliation(payload)
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      reconciliationRequired: true,
      failureReason: null,
    }, "edge_routing_reconciliation_queued", dependencies.now())
    return {
      outcome: "waiting",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Automatic website and administration routing is awaiting Cloudflare activation.",
      ),
    }
  }

  return {
    outcome: "continue",
    managedDomain,
    zone: refreshedZone,
  }
}

async function projectProvisioningActivationPhase(
  payload: Payload,
  run: SiteGenerationRun,
  dependencies: ProvisioningDependencies,
  context: {
    normalized: Extract<NormalizedDomain, { ok: true }>
    tenantId: string | number
    tenant: Tenant
    registrant: DomainRegistrantDetails
    managedDomain: ManagedDomain
    zone: CloudflareZoneResult
  },
): Promise<ProvisioningActivationPhaseOutcome> {
  let managedDomain = context.managedDomain
  const expectedSendingDomain = `mail.${context.normalized.domain}`
  const currentEmailSending = context.tenant.emailSending
  const emailSending: TenantEmailSendingState =
    currentEmailSending?.cloudflareZoneId === context.zone.id &&
    currentEmailSending.sendingDomain?.trim().toLowerCase() ===
      expectedSendingDomain
      ? currentEmailSending
      : {
          ...buildDefaultTenantEmailSending(context.normalized.domain),
          cloudflareZoneId: context.zone.id,
        }
  await payload.update({
    collection: "tenants",
    id: context.tenantId,
    data: {
      domain: context.normalized.domain,
      domainVerification: {
        status: "verified",
        checkedAt: dependencies.now(),
        notes:
          "Verified from active Cloudflare zone and authoritative nameserver response.",
      },
      emailSending,
    },
    depth: 0,
    overrideAccess: true,
  })

  const settingsResult = await payload.find({
    collection: "site-settings",
    where: { tenant: { equals: context.tenantId } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (settingsResult.docs.length !== 1) {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      reconciliationRequired: true,
      failureReason: "site_settings_not_unique",
    }, "site_settings_not_unique", dependencies.now())
    return {
      outcome: "waiting",
      result: waiting(
        context.normalized.domain,
        run,
        managedDomain,
        "Exactly one tenant site-settings record is required before publication.",
      ),
    }
  }
  const siteSettings = settingsResult.docs[0]!
  const wwwHost = `www.${context.normalized.domain}`
  const existingAliases = (siteSettings.aliases ?? [])
    .map((alias) => alias?.host?.trim().toLowerCase())
    .filter((host): host is string => Boolean(host))
  await payload.update({
    collection: "site-settings",
    id: siteSettings.id,
    data: {
      siteUrl: `https://${context.normalized.domain}`,
      aliases: [...new Set([...existingAliases, wwwHost])].map((host) => ({
        host,
      })),
    },
    depth: 0,
    overrideAccess: true,
  })

  managedDomain = await updateManagedDomain(payload, managedDomain, {
    reconciliationRequired: false,
    failureReason: null,
    customerStatus: "provisioning",
  }, "domain_ready_for_entitlement_activation", dependencies.now())
  run = await compatibilityProjection(
    payload,
    run,
    managedDomain,
    "registered",
    "domain_ready_for_entitlement_activation",
    context.registrant,
    emailSending,
  )
  return {
    outcome: "completed",
    result: {
      status: "ready_for_activation",
      domain: context.normalized.domain,
      run,
      managedDomain,
    },
  }
}

export async function provisionPaidDomainOrder(
  payload: Payload,
  run: SiteGenerationRun,
  input: ProvisionPaidDomainInput,
): Promise<ProvisionPaidDomainResult> {
  const dependencies = { ...defaultDependencies, ...input.dependencies }
  const authorityOutcome = await loadAndClassifyProvisioningAuthorityPhase(
    payload,
    run,
    input,
    dependencies,
  )
  if (authorityOutcome.outcome !== "continue") {
    return authorityOutcome.result
  }
  const {
    order,
    normalized,
    capability,
    tenantId,
    tenant: initialTenant,
    registrant,
    managedDomain: initialManagedDomain,
    initialProviderRegistrationState,
    initialFailureReason,
    now,
  } = authorityOutcome.context
  input.order = order
  const tenant = initialTenant
  let managedDomain = initialManagedDomain
  if (managedDomain.state === "pending" || managedDomain.state === "manual_review") {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      state: "registration_pending",
      customerStatus: "provisioning",
      reconciliationRequired: managedDomain.reconciliationRequired,
      failureReason: null,
    }, "registration_workflow_started", now)
  }
  run = await compatibilityProjection(
    payload,
    run,
    managedDomain,
    "registration_requested",
    "managed_domain_registration_pending",
    registrant,
  )

  const token = await dependencies.loginOpenProvider()
  let providerDomain: OpenProviderDomainRecord | null
  try {
    providerDomain = await dependencies.findOpenProviderDomain(
      normalized.domain,
      { token },
    )
  } catch (error) {
    if (!(error instanceof OpenProviderAmbiguousDomainLookupError)) throw error
    return stopProvisioningForProviderManualReview(
      payload,
      run,
      managedDomain,
      registrant,
      "openprovider_domain_lookup_ambiguous",
      "Multiple exact Openprovider domains match the accepted registration authority.",
      dependencies.now(),
    )
  }
  if (
    providerDomain &&
    managedDomain.providerCustomerHandle &&
    providerDomain.ownerHandle !== managedDomain.providerCustomerHandle
  ) {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      state: "manual_review",
      customerStatus: "manual_review",
      reconciliationRequired: false,
      failureReason: "provider_domain_owner_mismatch",
    }, "provider_domain_owner_mismatch", dependencies.now())
    run = await compatibilityProjection(
      payload,
      run,
      managedDomain,
      "failed",
      "provider_domain_owner_mismatch",
      registrant,
    )
    return {
      status: "unfulfillable",
      domain: normalized.domain,
      run,
      managedDomain,
      message: "The paid domain exists under a different provider owner.",
    }
  }

  if (
    !providerDomain &&
    (initialFailureReason === "openprovider_registration_indeterminate" ||
      (
        initialProviderRegistrationState === "prepared" &&
        initialFailureReason?.startsWith("openprovider_customer_handle_") !== true
      ))
  ) {
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "Openprovider registration outcome remains indeterminate; no registration retry was sent.",
    )
  }

  if (!providerDomain && managedDomain.providerRegistrationState === "not_started") {
    const availability = await dependencies.checkOpenProviderDomainAvailability(normalized.domain, {
      token,
      withPrice: false,
    })
    if (!availability.available) {
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        state: "manual_review",
        customerStatus: "manual_review",
        reconciliationRequired: false,
        failureReason: "paid_domain_became_unavailable_before_provider_commit",
      }, "paid_domain_race_lost", dependencies.now())
      run = await compatibilityProjection(
        payload,
        run,
        managedDomain,
        "failed",
        "paid_domain_became_unavailable_before_provider_commit",
        registrant,
      )
      return {
        status: "unfulfillable",
        domain: normalized.domain,
        run,
        managedDomain,
        message: "The paid domain became unavailable before provider commitment.",
      }
    }
  }

  const customerOutcome = await reconcileOpenProviderCustomerPhase(
    payload,
    run,
    input,
    dependencies,
    {
      token,
      normalized,
      registrant,
      managedDomain,
    },
  )
  if (customerOutcome.outcome !== "continue") {
    return customerOutcome.result
  }
  const customerHandle = customerOutcome.customerHandle
  managedDomain = customerOutcome.managedDomain

  const zoneOutcome = await reconcileCloudflareZonePhase(
    payload,
    run,
    input,
    dependencies,
    {
      normalized,
      registrant,
      managedDomain,
    },
  )
  if (zoneOutcome.outcome !== "continue") {
    return zoneOutcome.result
  }
  const zone = zoneOutcome.zone
  managedDomain = zoneOutcome.managedDomain

  const registrationOutcome = await claimAndReconcileRegistrarRegistrationPhase(
    payload,
    run,
    input,
    dependencies,
    {
      token,
      normalized,
      capability,
      registrant,
      managedDomain,
      providerDomain,
      customerHandle,
      zone,
    },
  )
  if (registrationOutcome.outcome !== "continue") {
    return registrationOutcome.result
  }
  providerDomain = registrationOutcome.providerDomain
  managedDomain = registrationOutcome.managedDomain

  const verificationOutcome = await projectRegistrantVerificationPhase(
    payload,
    run,
    input,
    dependencies,
    {
      normalized,
      capability,
      tenantId,
      managedDomain,
      providerDomain,
    },
  )
  if (verificationOutcome.outcome !== "continue") {
    return verificationOutcome.result
  }
  managedDomain = verificationOutcome.managedDomain

  const readinessOutcome = await verifyProvisioningReadinessPhase(
    payload,
    run,
    dependencies,
    { normalized, managedDomain, zone },
  )
  if (readinessOutcome.outcome !== "continue") {
    return readinessOutcome.result
  }
  managedDomain = readinessOutcome.managedDomain

  const activationOutcome = await projectProvisioningActivationPhase(
    payload,
    run,
    dependencies,
    {
      normalized,
      tenantId,
      tenant,
      registrant,
      managedDomain,
      zone: readinessOutcome.zone,
    },
  )
  return activationOutcome.result
}

export async function activateManagedDomainEntitlement(
  payload: Payload,
  domain: ManagedDomain,
  now = new Date().toISOString(),
): Promise<ManagedDomain> {
  if (
    domain.authoritativeDnsStatus !== "verified" ||
    domain.httpsStatus !== "verified" ||
    domain.adminHttpsStatus !== "verified" ||
    domain.edgeRoutingStatus !== "active"
  ) {
    throw new Error(
      "Managed-domain entitlement requires verified authoritative DNS, website HTTPS, and administration routing.",
    )
  }
  return updateManagedDomain(payload, domain, {
    state: "active",
    entitlementStatus: "active",
    entitlementActivatedAt: domain.entitlementActivatedAt ?? now,
    customerStatus: "active",
    reconciliationRequired: false,
    failureReason: null,
  }, "entitlement_activated", now)
}
