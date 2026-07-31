import "server-only"

import {
  buildAutomaticMigrationTargetZone,
  buildDnssecPreparationPlan,
  normalizeCompleteZone,
  semanticZoneComparison,
  type CompleteZoneExport,
  type NormalizedCompleteZone,
} from "@siteinabox/contracts/domain-migration"
import {
  getTldCapabilityByVersion,
  tldCapabilityOperationFlagEnabled,
  validateTldTransferAuthorization,
  type TldCapability,
} from "@siteinabox/contracts/tld-capabilities"
import { sql } from "@payloadcms/db-postgres"
import type { Payload } from "payload"
import type {
  CheckoutProfile,
  DomainMigration,
  ManagedDomain,
  Order,
  PaymentAttempt,
  SiteGenerationRun,
  Tenant,
} from "@/payload-types"
import {
  recordCommerceAdminException,
  resolveCommerceAdminException,
} from "@/lib/commerce/alerts"
import { commerceProviderWritesAllowed } from "@/lib/commerce/releaseGateCore"
import { withCommerceOrderLock } from "@/lib/commerce/orderLock"
import { CHECKOUT_QUOTE_SCHEMA_VERSION } from "@/lib/checkout/checkoutQuoteSchema"
import { initialPaymentIsFinanciallySecured } from "@/lib/payments/initialPaymentPolicy"

import {
  CloudflareIndeterminateWriteError,
  classifyCloudflareZoneLookup,
  createOrReuseCloudflareMigrationDnsRecord,
  createOrReuseCloudflareZone,
  enableCloudflareDnssec,
  getCloudflareDnssec,
  getCloudflareDnsRecordUsage,
  getCloudflareSslVerification,
  listCloudflareMigrationDnsRecords,
  listCloudflareZones,
} from "@/lib/domains/cloudflare"
import {
  buildAutomaticSourceRefreshAuthority,
  openMigrationSecret,
  openAutomaticSourceRefreshAuthority,
  sealMigrationSecret,
  sealAutomaticSourceRefreshAuthority,
  type AutomaticSourceRefreshAuthority,
} from "@/lib/domains/migrationSecrets"
import {
  resolveCloudflareOAuthCredential,
  revokeCloudflareSourceAuthorization,
} from "@/lib/domains/cloudflareSourceOAuth"
import {
  MigrationSourceChangedError,
  MigrationSourceDnssecTransitionPendingError,
  MigrationTransferEligibilityBlockedError,
  refreshAutomaticMigrationSource,
  type AutomaticMigrationSourceRefreshInput,
  type AutomaticMigrationSourceRefreshMode,
} from "@/lib/domains/migrationSources/refresh"
import {
  consumeMigrationCheckoutSecret,
  invalidateAttachedMigrationCheckoutSecret,
  openAttachedMigrationCheckoutSecret,
} from "@/lib/domains/migrationCheckoutSecret"
import {
  MigrationSourceAuthorizationError,
  MigrationSourceRefreshRetryableError,
  type AcquiredMigrationSource,
} from "@/lib/domains/migrationSources/types"
import {
  registrarDnskeysForDs,
  validateSignedDnssecEvidence,
} from "@/lib/domains/migrationSources/dnssecEvidence"
import {
  domainMigrationEvidenceHash,
  domainMigrationSourceAuthorityHash,
  domainMigrationSourceContentHash,
  stableDomainMigrationEvidenceString,
} from "@/lib/domains/migrationEvidence"
import { normalizeDomain } from "@/lib/domains/normalize"
import {
  OpenProviderAmbiguousCustomerReferenceLookupError,
  OpenProviderAmbiguousDomainLookupError,
  OpenProviderApiError,
  OpenProviderIndeterminateWriteError,
  createOpenProviderCustomerHandle,
  findOpenProviderCustomerByReference,
  findOpenProviderDomain,
  loginOpenProvider,
  normalizeOpenProviderTimestamp,
  transferOpenProviderDomain,
  updateOpenProviderDomainDnssec,
  updateOpenProviderDomainNameservers,
  type OpenProviderDnskey,
  type OpenProviderDomainRecord,
} from "@/lib/domains/openprovider"
import {
  verifyAuthoritativeDns,
  verifyDnssecChain,
  verifyHttpsEndpoint,
  verifyParentDsAbsent,
  verifyPreservedDnsRecords,
  type DnssecChainVerification,
} from "@/lib/domains/verification"
import { domainRegistrantFromCheckoutProfile } from "@/lib/checkout/checkoutProfile"
import { publishAndActivateAfterCompletedPayment } from "@/lib/payments/postPaymentActivation"
import { activateManagedDomainEntitlement } from "@/lib/domains/provisioning"
import { cloudflareTunnelTarget } from "@/lib/domains/cloudflareTunnels"
import { queueCommerceReconciliation } from "@/lib/jobs/queueCommerceReconciliation"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import { classifyMigrationEntry } from "@/lib/domains/migrationDecisions"
import {
  migrationRegistrantVerification,
  storedRegistrantVerification,
} from "@/lib/domains/registrantVerification"

const CUTOVER_VERIFICATION_MINUTES = 30
const SOURCE_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60_000
const SOURCE_REFRESH_AUTHORITY_LIFETIME_MS = 30 * 24 * 60 * 60_000

export class DomainMigrationCustomerInputError extends Error {
  constructor(readonly kind: "invalid_input" | "stale_authority") {
    super(kind)
    this.name = "DomainMigrationCustomerInputError"
  }
}

export type MigrationActionStatus =
  "required" | "pending" | "completed" | "not_required" | "failed"
type MigrationActionEvidence = {
  status: MigrationActionStatus
  updatedAt: string
  evidence?: string
}
type MigrationCustomerActionStates = {
  provide_epp_code: MigrationActionEvidence
  authorize_provider: MigrationActionEvidence
  upload_complete_zone: MigrationActionEvidence
  confirm_transfer: MigrationActionEvidence
  verify_registrant: MigrationActionEvidence
  remove_dnssec_ds: MigrationActionEvidence
}

type MigrationResult = {
  status: "waiting" | "completed" | "rolled_back" | "failed"
  migrationId: string | number
  message: string
}

type MigrationDependencies = {
  now: () => string
  forwardProviderWritesAllowed: () => boolean
  transferContractEvidenceAllowed: (capability: TldCapability) => boolean
  loginOpenProvider: typeof loginOpenProvider
  findOpenProviderCustomerByReference: typeof findOpenProviderCustomerByReference
  createOpenProviderCustomerHandle: typeof createOpenProviderCustomerHandle
  findOpenProviderDomain: typeof findOpenProviderDomain
  transferOpenProviderDomain: typeof transferOpenProviderDomain
  updateOpenProviderDomainDnssec: typeof updateOpenProviderDomainDnssec
  updateOpenProviderDomainNameservers: typeof updateOpenProviderDomainNameservers
  listCloudflareZones: typeof listCloudflareZones
  createOrReuseCloudflareZone: typeof createOrReuseCloudflareZone
  listCloudflareMigrationDnsRecords: typeof listCloudflareMigrationDnsRecords
  createOrReuseCloudflareMigrationDnsRecord: typeof createOrReuseCloudflareMigrationDnsRecord
  getCloudflareDnsRecordUsage: typeof getCloudflareDnsRecordUsage
  getCloudflareDnssec: typeof getCloudflareDnssec
  enableCloudflareDnssec: typeof enableCloudflareDnssec
  getCloudflareSslVerification: typeof getCloudflareSslVerification
  verifyParentDsAbsent: typeof verifyParentDsAbsent
  verifyDnssecChain: typeof verifyDnssecChain
  verifyAuthoritativeDns: typeof verifyAuthoritativeDns
  verifyPreservedDnsRecords: typeof verifyPreservedDnsRecords
  verifyHttpsEndpoint: typeof verifyHttpsEndpoint
  publishAndActivateAfterCompletedPayment: typeof publishAndActivateAfterCompletedPayment
  activateManagedDomainEntitlement: typeof activateManagedDomainEntitlement
  refreshAutomaticMigrationSource: typeof refreshAutomaticMigrationSource
  resolveCloudflareOAuthCredential: typeof resolveCloudflareOAuthCredential
}

const defaultDependencies: MigrationDependencies = {
  now: () => new Date().toISOString(),
  forwardProviderWritesAllowed: commerceProviderWritesAllowed,
  transferContractEvidenceAllowed: (capability) =>
    capability.dnssec.productionEvidenceComplete,
  loginOpenProvider,
  findOpenProviderCustomerByReference,
  createOpenProviderCustomerHandle,
  findOpenProviderDomain,
  transferOpenProviderDomain,
  updateOpenProviderDomainDnssec,
  updateOpenProviderDomainNameservers,
  listCloudflareZones,
  createOrReuseCloudflareZone,
  listCloudflareMigrationDnsRecords,
  createOrReuseCloudflareMigrationDnsRecord,
  getCloudflareDnsRecordUsage,
  getCloudflareDnssec,
  enableCloudflareDnssec,
  getCloudflareSslVerification,
  verifyParentDsAbsent,
  verifyDnssecChain,
  verifyAuthoritativeDns,
  verifyPreservedDnsRecords,
  verifyHttpsEndpoint,
  publishAndActivateAfterCompletedPayment,
  activateManagedDomainEntitlement,
  refreshAutomaticMigrationSource,
  resolveCloudflareOAuthCredential,
}

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const numericRelationshipId = (value: Parameters<typeof relationshipId>[0]): number => {
  const id = relationshipId(value)
  const numeric = id == null ? Number.NaN : Number(id)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error("A numeric relationship id is required.")
  }
  return numeric
}

const canonicalNameservers = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      ).map((entry) => entry.trim().toLowerCase().replace(/\.$/, "")))].sort()
    : []

const stringIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0)
    : []

const nameserversEqual = (left: unknown, right: unknown): boolean => {
  const leftNames = canonicalNameservers(left)
  const rightNames = canonicalNameservers(right)
  return leftNames.length === rightNames.length &&
    leftNames.every((entry, index) => entry === rightNames[index])
}

const migrationZoneRecordsForComparison = (
  records: Awaited<ReturnType<typeof listCloudflareMigrationDnsRecords>>,
  domain: string,
): NormalizedCompleteZone["records"] => {
  let cmsTunnelTarget: string | null = null
  try {
    cmsTunnelTarget = cloudflareTunnelTarget("cms")
  } catch {
    // Missing routing configuration remains fail-closed in edge reconciliation.
  }
  return records
    .map((entry) => entry.record)
    .filter((record) =>
      !(record.type === "NS" && record.name === domain) &&
      !(
        cmsTunnelTarget &&
        record.type === "CNAME" &&
        record.name === `admin.${domain}` &&
        record.content === cmsTunnelTarget
      ))
}

const canonicalDsRecords = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      ).map((entry) => entry.trim().replace(/\s+/g, " ").toUpperCase()))].sort()
    : []

const dsRecordsEqual = (left: unknown, right: unknown): boolean => {
  const leftRecords = canonicalDsRecords(left)
  const rightRecords = canonicalDsRecords(right)
  return leftRecords.length === rightRecords.length &&
    leftRecords.every((entry, index) => entry === rightRecords[index])
}

const sourceDnskeys = (source: NormalizedCompleteZone): OpenProviderDnskey[] =>
  registrarDnskeysForDs({
    domain: source.domain,
    parentDsRecords: source.dnssec.parentDsRecords,
    dnsKeys: source.dnssec.dnsKeys,
  }).map((key) => ({
    flags: key.flags,
    protocol: key.protocol,
    alg: key.algorithm,
    pub_key: key.publicKey,
  }))

const frozenSourceDnssecChecks = async (
  source: NormalizedCompleteZone,
  deps: Pick<MigrationDependencies, "verifyDnssecChain">,
): Promise<DnssecChainVerification[]> => {
  if (source.dnssec.status === "unsigned") return []
  const keys = sourceDnskeys(source)
  return Promise.all(keys.map((key) =>
    deps.verifyDnssecChain(source.domain, {
      flags: key.flags,
      protocol: key.protocol,
      algorithm: key.alg,
      publicKey: key.pub_key,
      parentDsRecords: source.dnssec.parentDsRecords,
    })))
}

const verifyFrozenSourceDnssec = async (
  source: NormalizedCompleteZone,
  deps: Pick<MigrationDependencies, "verifyDnssecChain">,
): Promise<boolean> => {
  if (source.dnssec.status === "unsigned") return true
  const checks = await frozenSourceDnssecChecks(source, deps)
  return checks.length > 0 && checks.every((check) => check.status === "verified")
}

const canonicalDnskeys = (value: OpenProviderDnskey[]): string[] =>
  value.map((key) =>
    `${key.flags}:${key.protocol}:${key.alg}:${key.pub_key.replace(/\s+/g, "")}`,
  ).sort()

const dnskeysEqual = (
  left: OpenProviderDnskey[],
  right: OpenProviderDnskey[],
): boolean => {
  const leftKeys = canonicalDnskeys(left)
  const rightKeys = canonicalDnskeys(right)
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((entry, index) => entry === rightKeys[index])
}

const dnssecWaitUntil = (now: string, ttlSeconds: number): string =>
  new Date(Date.parse(now) + ttlSeconds * 1_000).toISOString()

const actionStates = (
  value: unknown,
  now: string,
): MigrationCustomerActionStates => {
  const source = readObject(value)
  const read = (
    key: keyof MigrationCustomerActionStates,
    fallback: MigrationActionStatus,
  ): MigrationActionEvidence => {
    const item = readObject(source[key])
    const status = ["required", "pending", "completed", "not_required", "failed"]
      .includes(String(item.status))
      ? item.status as MigrationActionStatus
      : fallback
    return {
      status,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
      ...(typeof item.evidence === "string" ? { evidence: item.evidence } : {}),
    }
  }
  return {
    provide_epp_code: read("provide_epp_code", "required"),
    authorize_provider: read("authorize_provider", "completed"),
    upload_complete_zone: read("upload_complete_zone", "required"),
    confirm_transfer: read("confirm_transfer", "pending"),
    verify_registrant: read("verify_registrant", "pending"),
    remove_dnssec_ds: read("remove_dnssec_ds", "not_required"),
  }
}

const withAction = (
  actions: MigrationCustomerActionStates,
  action: keyof MigrationCustomerActionStates,
  status: MigrationActionStatus,
  now: string,
  evidence?: string,
): MigrationCustomerActionStates => ({
  ...actions,
  [action]: {
    status,
    updatedAt: now,
    ...(evidence ? { evidence } : {}),
  },
})

export const transferConfirmationStatus = (
  capability: TldCapability,
  providerDispatched: boolean,
): "not_required" | "pending" | "required" =>
  capability.transfer.customerConfirmation === "none"
    ? "not_required"
    : providerDispatched
      ? "required"
      : "pending"

export const nextTransferConfirmationStatus = (
  current: MigrationActionStatus,
  capability: TldCapability,
  providerDispatched: boolean,
): MigrationActionStatus => {
  if (capability.transfer.customerConfirmation === "none") {
    return "not_required"
  }
  if (current === "completed" || current === "failed" || current === "required") {
    return current
  }
  return transferConfirmationStatus(capability, providerDispatched)
}

const transferConfirmationAction = (
  actions: MigrationCustomerActionStates,
  capability: TldCapability,
  status: "pending" | "required",
  now: string,
): MigrationCustomerActionStates => {
  const actionStatus = nextTransferConfirmationStatus(
    actions.confirm_transfer.status,
    capability,
    status === "required",
  )
  const current = actions.confirm_transfer
  if (
    current.status === "completed" ||
    (
      current.status === actionStatus &&
      (
        actionStatus === "not_required" ||
        current.evidence === (
          actionStatus === "required"
            ? "registrant_email_confirmation_required"
            : "awaiting_provider_transfer_dispatch"
        )
      )
    )
  ) {
    return actions
  }
  if (actionStatus === "not_required") {
    return withAction(
      actions,
      "confirm_transfer",
      "not_required",
      now,
      "tld_confirmation_not_required",
    )
  }
  return withAction(
    actions,
    "confirm_transfer",
    actionStatus,
    now,
    actionStatus === "required"
      ? "registrant_email_confirmation_required"
      : "awaiting_provider_transfer_dispatch",
  )
}

const migrationHistory = (
  migration: DomainMigration,
  at: string,
  state: string,
  reason: string,
): Array<Record<string, string>> => [
  ...(Array.isArray(migration.stateHistory)
    ? migration.stateHistory.filter(
      (entry): entry is Record<string, string> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    )
    : []),
  { at, state, reason },
]

const migrationHistoryEventAt = (
  migration: DomainMigration,
  reason: string,
): string | null => {
  if (!Array.isArray(migration.stateHistory)) return null
  for (let index = migration.stateHistory.length - 1; index >= 0; index -= 1) {
    const entry = migration.stateHistory[index]
    if (
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry)
    ) {
      const event = entry as Record<string, unknown>
      if (event.reason === reason && typeof event.at === "string") {
        return event.at
      }
    }
  }
  return null
}

const sourceAuthorityRevocationIsPending = (
  migration: DomainMigration,
): boolean => {
  const history = Array.isArray(migration.stateHistory)
    ? migration.stateHistory
    : []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index]
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    const reason = (entry as Record<string, unknown>).reason
    if (reason === "source_authority_revocation_confirmed") return false
    if (reason === "source_authority_revocation_pending") return true
  }
  return false
}

async function updateMigration(
  payload: Payload,
  migration: DomainMigration,
  data: Record<string, unknown>,
  reason: string,
  now: string,
): Promise<DomainMigration> {
  const state = typeof data.state === "string" ? data.state : migration.state
  return payload.update({
    collection: "domain-migrations",
    id: migration.id,
    data: {
      ...data,
      updatedAt: now,
      stateHistory: migrationHistory(migration, now, state, reason),
    },
    depth: 0,
    overrideAccess: true,
    context: { domainMigrationLifecycleMutation: true },
  }) as Promise<DomainMigration>
}

const clearedMigrationCredentials = (
  now: string,
  sourceAuthorityRevoked = true,
) => ({
  encryptedTransferCode: null,
  transferCodeDeletedAt: now,
  ...(sourceAuthorityRevoked
    ? {
        encryptedSourceRefreshAuthority: null,
        sourceRefreshAuthorityDeletedAt: now,
      }
    : {}),
})

const revokeMigrationSourceAuthority = async (
  payload: Payload,
  migration: DomainMigration,
  now: string,
): Promise<{
  migration: DomainMigration
  confirmed: boolean
}> => {
  if (!migration.encryptedSourceRefreshAuthority) {
    return { migration, confirmed: true }
  }
  const authority = openAutomaticSourceRefreshAuthority(
    migration.encryptedSourceRefreshAuthority,
    migration.idempotencyKey,
    migration.domainNameAscii,
  )
  if (authority.credential.kind === "cloudflare_oauth") {
    const confirmed = await revokeCloudflareSourceAuthorization(
      payload,
      authority.credential,
      { now: new Date(now) },
    )
    if (!confirmed) {
      const pendingMigration = await updateMigration(payload, migration, {
        reconciliationRequired: true,
      }, "source_authority_revocation_pending", now)
      return { migration: pendingMigration, confirmed: false }
    }
  }
  return { migration, confirmed: true }
}

async function updateManagedDomain(
  payload: Payload,
  domain: ManagedDomain,
  data: Record<string, unknown>,
  reason: string,
  now: string,
): Promise<ManagedDomain> {
  const state = typeof data.state === "string" ? data.state : domain.state
  const history = Array.isArray(domain.stateHistory)
    ? domain.stateHistory.filter(
      (entry): entry is Record<string, string> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    )
    : []
  return payload.update({
    collection: "managed-domains",
    id: domain.id,
    data: { ...data, stateHistory: [...history, { at: now, state, reason }] },
    depth: 0,
    overrideAccess: true,
    context: { managedDomainLifecycleMutation: true },
  }) as Promise<ManagedDomain>
}

const migrationEvidenceFromOrder = (order: Order) => {
  const quoteEvidence = readObject(order.quoteEvidence)
  if (quoteEvidence.schemaVersion !== CHECKOUT_QUOTE_SCHEMA_VERSION) {
    throw new Error("Accepted order does not use the current checkout quote evidence schema.")
  }
  const migration = readObject(quoteEvidence.migration)
  const sourceMechanism = String(migration.sourceMechanism)
  if (
    !["automatic", "assisted_standard"].includes(String(migration.classification)) ||
    ![
      "customer_authorized_provider_export_v1",
      "cloudflare_api_v1",
      "authorized_axfr_v1",
      "validated_provider_export_v1",
    ].includes(sourceMechanism)
  ) {
    throw new Error("Accepted order does not freeze a supported migration source contract.")
  }
  const tldEvidence = readObject(quoteEvidence.tldCapability)
  const capabilityVersion = typeof tldEvidence.capabilityVersion === "string"
    ? tldEvidence.capabilityVersion
    : ""
  const capability = getTldCapabilityByVersion(capabilityVersion)
  if (
    !capability ||
    capability.tld !== tldEvidence.tld ||
    !tldCapabilityOperationFlagEnabled(capability, "incoming_transfer") ||
    quoteEvidence.transferRenewalEffect !== capability.transfer.renewalEffect ||
    tldEvidence.transferRenewalEffect !== capability.transfer.renewalEffect
  ) {
    throw new Error("Accepted order has invalid frozen TLD capability evidence.")
  }
  return {
    capability,
    classification: migration.classification as "automatic" | "assisted_standard",
    sourceMechanism: sourceMechanism as
      | "customer_authorized_provider_export_v1"
      | "cloudflare_api_v1"
      | "authorized_axfr_v1"
      | "validated_provider_export_v1",
    sourceZoneHash: typeof migration.sourceZoneHash === "string"
      ? migration.sourceZoneHash
      : null,
    checkoutSecretKey: typeof migration.checkoutSecretKey === "string"
      ? migration.checkoutSecretKey
      : null,
  }
}

export const isAutomaticMigrationOrder = (order: Order): boolean => {
  const migration = readObject(readObject(order.quoteEvidence).migration)
  return migration.classification === "automatic" &&
    [
      "customer_authorized_provider_export_v1",
      "cloudflare_api_v1",
      "authorized_axfr_v1",
      "validated_provider_export_v1",
    ].includes(String(migration.sourceMechanism))
}

export const isSupportedDomainMigrationOrder = (order: Order): boolean => {
  const migration = readObject(readObject(order.quoteEvidence).migration)
  return ["automatic", "assisted_standard"].includes(String(migration.classification)) &&
    [
      "customer_authorized_provider_export_v1",
      "cloudflare_api_v1",
      "authorized_axfr_v1",
      "validated_provider_export_v1",
    ].includes(String(migration.sourceMechanism))
}

async function checkoutProfileForOrder(
  payload: Payload,
  order: Order,
): Promise<CheckoutProfile> {
  if (!order.checkoutProfileKey) {
    throw new Error("Automatic migration order is missing its frozen checkout profile key.")
  }
  const result = await payload.find({
    collection: "checkout-profiles",
    where: { profileKey: { equals: order.checkoutProfileKey } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (result.docs.length !== 1) {
    throw new Error("Automatic migration requires one authoritative checkout profile.")
  }
  return result.docs[0] as CheckoutProfile
}

export async function createAutomaticDomainMigration(
  payload: Payload,
  orderId: string | number,
  now = new Date().toISOString(),
  dependencies: {
    refreshAutomaticMigrationSource?: typeof refreshAutomaticMigrationSource
    resolveCloudflareOAuthCredential?: typeof resolveCloudflareOAuthCredential
  } = {},
): Promise<DomainMigration> {
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as Order
  if (order.paymentStatus !== "paid") {
    throw new Error("Automatic migration starts only after the accepted order is paid.")
  }
  if (!["accepted", "fulfillment_pending"].includes(order.state ?? "")) {
    throw new Error("Automatic migration order is not fulfillable.")
  }
  const normalized = normalizeDomain(order.domain)
  if (!normalized.ok) throw new Error("Automatic migration order domain is invalid.")
  const {
    capability,
    classification,
    sourceMechanism,
    sourceZoneHash: acceptedSourceZoneHash,
    checkoutSecretKey,
  } = migrationEvidenceFromOrder(order)
  if (capability.tld !== normalized.extension || !capability.transfer.supported) {
    throw new Error("Accepted TLD capability does not support this transfer.")
  }
  const tenantId = relationshipId(order.tenant)
  if (!tenantId) throw new Error("Automatic migration order requires a tenant.")
  const profile = await checkoutProfileForOrder(payload, order)
  const idempotencyKey = `domain-migration:order:${order.id}:v1`
  const existing = await payload.find({
    collection: "domain-migrations",
    where: { idempotencyKey: { equals: idempotencyKey } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs.length > 1) throw new Error("Duplicate automatic migration authority.")
  const actions = transferConfirmationAction(
    actionStates(null, now),
    capability,
    "pending",
    now,
  )
  let migration = existing.docs[0] as DomainMigration | undefined
  if (!migration) {
    try {
      migration = await payload.create({
      collection: "domain-migrations",
      data: {
        idempotencyKey,
        originatingOrder: order.id,
        checkoutProfile: profile.id,
        tenant: numericRelationshipId(order.tenant),
        domainNameAscii: normalized.domain,
        tld: normalized.extension,
        acceptedClassification: classification,
        state: "awaiting_customer",
        sourceMechanism,
        customerActions: actions,
        dnssecPhase: "source_unsigned",
        dnssecWriteState: "not_started",
        providerTransferState: "not_started",
        cloudflareZoneState: "not_started",
        cutoverWriteState: "not_started",
        rollbackWriteState: "not_started",
        operatorWorkAuthorizationState: "not_required",
        reconciliationRequired: false,
        stateHistory: [{
          at: now,
          state: "awaiting_customer",
          reason: "customer_inputs_required",
        }],
        createdAt: now,
        updatedAt: now,
      },
      depth: 0,
      overrideAccess: true,
      }) as DomainMigration
    } catch (error) {
      const raced = await payload.find({
        collection: "domain-migrations",
        where: { idempotencyKey: { equals: idempotencyKey } },
        limit: 2,
        depth: 0,
        overrideAccess: true,
      })
      if (raced.docs.length !== 1) throw error
      migration = raced.docs[0] as DomainMigration
    }
  }
  if (order.state === "accepted") {
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { state: "fulfillment_pending" },
      depth: 0,
      overrideAccess: true,
      context: { legalOrderLifecycleMutation: true },
    })
  }
  if (
    checkoutSecretKey &&
    acceptedSourceZoneHash &&
    !migration.sourceZoneSnapshot &&
    ["awaiting_customer", "ready_to_prepare"].includes(migration.state)
  ) {
    const generationRunId = relationshipId(order.generationRun)
    if (!generationRunId) {
      throw new Error("Migration checkout input requires a generation run.")
    }
    const checkoutInput = await openAttachedMigrationCheckoutSecret(payload, {
      secretKey: checkoutSecretKey,
      orderId: order.id,
      generationRunId,
      domain: normalized.domain,
      sourceZoneHash: acceptedSourceZoneHash,
      now: new Date(now),
    })
    if (
      checkoutInput.classification !== classification ||
      checkoutInput.sourceMechanism !== sourceMechanism ||
      checkoutInput.sourceZoneHash !== acceptedSourceZoneHash
    ) {
      throw new Error("Encrypted migration checkout input differs from the accepted order.")
    }
    let refreshedSource: CompleteZoneExport
    try {
      if (checkoutInput.schemaVersion === 2) {
        let refreshInput: AutomaticMigrationSourceRefreshInput = checkoutInput
        if (
          checkoutInput.sourceRefreshCredential.kind === "cloudflare_oauth"
        ) {
          const credential = await (
            dependencies.resolveCloudflareOAuthCredential ??
            resolveCloudflareOAuthCredential
          )(
            payload,
            checkoutInput.sourceRefreshCredential,
            { now: new Date(now) },
          )
          if (!credential.zoneId) {
            throw new MigrationSourceAuthorizationError()
          }
          refreshInput = {
            ...checkoutInput,
            sourceRefreshCredential: {
              kind: "cloudflare_api_token",
              token: credential.accessToken,
              zoneId: credential.zoneId,
            },
          }
        }
        refreshedSource = await (
          dependencies.refreshAutomaticMigrationSource ??
          refreshAutomaticMigrationSource
        )(refreshInput)
      } else {
        refreshedSource = checkoutInput.sourceZone
      }
    } catch (error) {
      if (
        !(error instanceof MigrationSourceChangedError) &&
        !(error instanceof MigrationSourceAuthorizationError)
      ) {
        throw error
      }
      if (
        checkoutInput.schemaVersion === 2 &&
        checkoutInput.sourceRefreshCredential.kind === "cloudflare_oauth"
      ) {
        await revokeCloudflareSourceAuthorization(
          payload,
          checkoutInput.sourceRefreshCredential,
          { now: new Date(now) },
        )
      }
      await invalidateAttachedMigrationCheckoutSecret(payload, {
        secretKey: checkoutSecretKey,
        orderId: order.id,
        now: new Date(now),
      })
      return updateMigration(payload, migration, {
        state: "awaiting_customer",
        failureReason: "source_evidence_stale",
        customerActions: withAction(
          actionStates(migration.customerActions, now),
          "upload_complete_zone",
          "required",
          now,
          "automatic_source_reauthorization_required",
        ),
        reconciliationRequired: false,
      }, "automatic_source_reauthorization_required", now)
    }
    let sourceRefreshAuthority: AutomaticSourceRefreshAuthority | undefined
    if (
      checkoutInput.schemaVersion === 2 &&
      (
        checkoutInput.sourceMechanism === "cloudflare_api_v1" ||
        checkoutInput.sourceMechanism === "authorized_axfr_v1"
      )
    ) {
      sourceRefreshAuthority = buildAutomaticSourceRefreshAuthority({
        domain: normalized.domain,
        sourceMechanism: checkoutInput.sourceMechanism,
        sourceZone: checkoutInput.normalizedSourceZone,
        credential: checkoutInput.sourceRefreshCredential,
      })
    }
    migration = await acquireAutomaticMigrationInputs(payload, {
      migrationId: migration.id,
      zoneExport: refreshedSource,
      transferCode: checkoutInput.transferCode,
      sourceRefreshAuthority,
      now,
      queuePreparation: false,
    })
    await consumeMigrationCheckoutSecret(payload, {
      secretKey: checkoutSecretKey,
      orderId: order.id,
      now: new Date(now),
    })
  }
  if (
    checkoutSecretKey &&
    acceptedSourceZoneHash &&
    migration.sourceZoneSnapshot
  ) {
    await consumeMigrationCheckoutSecret(payload, {
      secretKey: checkoutSecretKey,
      orderId: order.id,
      now: new Date(now),
    })
  }
  return migration
}

export const createDomainMigration = createAutomaticDomainMigration

export async function replaceMigrationTransferAuthorization(
  payload: Payload,
  input: {
    migrationId: string | number
    expectedUpdatedAt: string
    transferCode: string
    env?: NodeJS.ProcessEnv
    now?: string
  },
): Promise<DomainMigration> {
  const now = input.now ?? new Date().toISOString()
  const migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (
    migration.updatedAt !== input.expectedUpdatedAt ||
    migration.state !== "awaiting_customer" ||
    !migration.sourceZoneSnapshot ||
    !["provider_rejected_transfer_authorization", "transfer_code_expired"].includes(
      migration.failureReason ?? "",
    )
  ) {
    throw new DomainMigrationCustomerInputError("stale_authority")
  }
  const order = await payload.findByID({
    collection: "orders",
    id: relationshipId(migration.originatingOrder) as string | number,
    depth: 0,
    overrideAccess: true,
  }) as Order
  const { capability } = migrationEvidenceFromOrder(order)
  if (!validateTldTransferAuthorization(capability, input.transferCode)) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  const sourceEvidenceStale = sourceEvidenceIsStale(migration, now)
  if (
    sourceEvidenceStale &&
    migration.cloudflareZoneState === "not_started" &&
    !migration.providerCustomerHandle &&
    migration.providerTransferState === "not_started"
  ) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  const actions = withAction(
    actionStates(migration.customerActions, now),
    "provide_epp_code",
    "completed",
    now,
    "replacement_encrypted_at_rest",
  )
  const updated = await updateMigration(payload, migration, {
    state: "ready_to_prepare",
    providerTransferState: "not_started",
    encryptedTransferCode: sealMigrationSecret(
      input.transferCode,
      migration.idempotencyKey,
      input.env,
    ),
    transferCodeReceivedAt: now,
    transferCodeDeletedAt: null,
    transferCodeExpiresAt: capability.transfer.authorizationValidityDays
      ? new Date(
          new Date(now).getTime() +
          capability.transfer.authorizationValidityDays * 24 * 60 * 60_000,
        ).toISOString()
      : null,
    customerActions: actions,
    reconciliationRequired: false,
    failureReason: null,
  }, "customer_replaced_transfer_authorization", now)
  await payload.jobs.queue({
    task: "prepare-domain-migration",
    input: { migrationId: String(updated.id) },
    queue: "default",
    overrideAccess: true,
  })
  return updated
}

export async function replaceMigrationSourceRefreshAuthority(
  payload: Payload,
  input: {
    migrationId: string | number
    expectedUpdatedAt: string
    acquiredSource: AcquiredMigrationSource
    transferCode?: string
    env?: NodeJS.ProcessEnv
    now?: string
  },
  dependencies: {
    verifyParentDsAbsent?: typeof verifyParentDsAbsent
  } = {},
): Promise<DomainMigration> {
  let now = input.now ?? new Date().toISOString()
  let migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (
    migration.updatedAt !== input.expectedUpdatedAt ||
    migration.state !== "awaiting_customer" ||
    migration.failureReason !== "source_authority_reauthorization_required" ||
    !["cloudflare_api_v1", "authorized_axfr_v1"].includes(
      migration.sourceMechanism,
    ) ||
    input.acquiredSource.mechanism !== migration.sourceMechanism
  ) {
    throw new DomainMigrationCustomerInputError("stale_authority")
  }
  const source = migrationSource(migration)
  const refreshed = normalizeCompleteZone(input.acquiredSource.zone)
  const acceptedAuthorityHash = domainMigrationSourceAuthorityHash(source)
  const acceptedContentHash = domainMigrationSourceContentHash(source)
  const refreshMode = sourceRefreshModeForMigration(migration)
  if (refreshMode === "stable_content_after_dnssec_transition") {
    const parentDs = await (
      dependencies.verifyParentDsAbsent ?? verifyParentDsAbsent
    )(migration.domainNameAscii)
    if (parentDs.status !== "absent") {
      throw new DomainMigrationCustomerInputError("stale_authority")
    }
  }
  if (
    refreshed.domain !== migration.domainNameAscii ||
    (
      refreshMode === "exact_authority" &&
      domainMigrationSourceAuthorityHash(refreshed) !== acceptedAuthorityHash
    ) ||
    domainMigrationSourceContentHash(refreshed) !== acceptedContentHash
  ) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  const order = await payload.findByID({
    collection: "orders",
    id: relationshipId(migration.originatingOrder) as string | number,
    depth: 0,
    overrideAccess: true,
  }) as Order
  const { capability } = migrationEvidenceFromOrder(order)
  const transferCodeRequired = migration.providerTransferState !== "confirmed"
  if (
    transferCodeRequired &&
    !validateTldTransferAuthorization(capability, input.transferCode ?? "")
  ) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  const authority: AutomaticSourceRefreshAuthority = {
    schemaVersion: 1,
    domain: migration.domainNameAscii,
    sourceMechanism: migration.sourceMechanism as
      AutomaticSourceRefreshAuthority["sourceMechanism"],
    acceptedSourceAuthorityHash: acceptedAuthorityHash,
    acceptedSourceContentHash: acceptedContentHash,
    credential: input.acquiredSource.refreshCredential as
      AutomaticSourceRefreshAuthority["credential"],
  }
  const expectedTime = Date.parse(input.expectedUpdatedAt)
  const requestedTime = Date.parse(now)
  if (!Number.isFinite(expectedTime) || !Number.isFinite(requestedTime)) {
    throw new DomainMigrationCustomerInputError("stale_authority")
  }
  now = new Date(Math.max(requestedTime, expectedTime + 1)).toISOString()
  const claim = await payload.db.drizzle.execute(sql`
    UPDATE "domain_migrations"
    SET "updated_at" = ${new Date(now)}
    WHERE "id" = ${migration.id}
      AND "updated_at" = ${new Date(input.expectedUpdatedAt)}
      AND "state" = 'awaiting_customer'
      AND "failure_reason" = 'source_authority_reauthorization_required'
    RETURNING "id"
  `)
  if (claim.rows.length !== 1) {
    throw new DomainMigrationCustomerInputError("stale_authority")
  }
  migration = { ...migration, updatedAt: now }
  const authorizedActions = withAction(
    actionStates(migration.customerActions, now),
    "authorize_provider",
    "completed",
    now,
    "automatic_source_reauthorized",
  )
  const actions = transferCodeRequired
    ? withAction(
        authorizedActions,
        "provide_epp_code",
        "completed",
        now,
        "replacement_encrypted_at_rest",
      )
    : authorizedActions
  const transferCodeUpdates = transferCodeRequired
    ? {
        encryptedTransferCode: sealMigrationSecret(
          input.transferCode!,
          migration.idempotencyKey,
          input.env,
        ),
        transferCodeReceivedAt: now,
        transferCodeDeletedAt: null,
        transferCodeExpiresAt: capability.transfer.authorizationValidityDays
          ? new Date(
              Date.parse(now) +
              capability.transfer.authorizationValidityDays * 24 * 60 * 60_000,
            ).toISOString()
          : null,
      }
    : {}
  migration = await updateMigration(payload, migration, {
    state: "ready_to_prepare",
    encryptedSourceRefreshAuthority: sealAutomaticSourceRefreshAuthority(
      authority,
      migration.idempotencyKey,
      input.env,
    ),
    sourceRefreshAuthorityExpiresAt: new Date(
      Date.parse(now) + SOURCE_REFRESH_AUTHORITY_LIFETIME_MS,
    ).toISOString(),
    sourceRefreshAuthorityDeletedAt: null,
    sourceAuthorityLastVerifiedAt: now,
    ...transferCodeUpdates,
    customerActions: actions,
    reconciliationRequired: false,
    failureReason: null,
  }, "automatic_source_authority_replaced", now)
  await payload.jobs.queue({
    task: "prepare-domain-migration",
    input: { migrationId: String(migration.id) },
    queue: "default",
    overrideAccess: true,
  })
  return migration
}

export async function acquireAutomaticMigrationInputs(
  payload: Payload,
  input: {
    migrationId: string | number
    zoneExport: CompleteZoneExport
    transferCode: string
    transferCodeExpiresAt?: string | null
    sourceRefreshAuthority?: AutomaticSourceRefreshAuthority
    env?: NodeJS.ProcessEnv
    now?: string
    queuePreparation?: boolean
    expectedUpdatedAt?: string
  },
): Promise<DomainMigration> {
  let now = input.now ?? new Date().toISOString()
  let migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  const replacingStaleEvidence = input.expectedUpdatedAt !== undefined
  if (
    replacingStaleEvidence &&
    (
      migration.updatedAt !== input.expectedUpdatedAt ||
      migration.state !== "awaiting_customer" ||
      migration.failureReason !== "source_evidence_stale"
    )
  ) {
    throw new DomainMigrationCustomerInputError("stale_authority")
  }
  if (
    !replacingStaleEvidence &&
    migration.failureReason === "source_evidence_stale"
  ) {
    throw new DomainMigrationCustomerInputError("stale_authority")
  }
  if (
    !replacingStaleEvidence &&
    !["awaiting_customer", "ready_to_prepare"].includes(migration.state)
  ) {
    throw new DomainMigrationCustomerInputError("stale_authority")
  }
  let source: NormalizedCompleteZone
  try {
    source = normalizeCompleteZone(input.zoneExport)
  } catch {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  if (source.domain !== migration.domainNameAscii) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  const sourceAcquiredAt = Date.parse(source.acquiredAt)
  const acquisitionTime = Date.parse(now)
  if (
    !Number.isFinite(sourceAcquiredAt) ||
    !Number.isFinite(acquisitionTime) ||
    sourceAcquiredAt < acquisitionTime - SOURCE_EVIDENCE_MAX_AGE_MS ||
    sourceAcquiredAt > acquisitionTime + 5 * 60_000
  ) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  if (
    source.dnssec.status === "signed" &&
    !validateSignedDnssecEvidence({
      domain: source.domain,
      parentDsRecords: source.dnssec.parentDsRecords,
      parentDsTtl: source.dnssec.parentDsTtl,
      dnsKeys: source.dnssec.dnsKeys,
    }).valid
  ) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  const order = await payload.findByID({
    collection: "orders",
    id: relationshipId(migration.originatingOrder) as string | number,
    depth: 0,
    overrideAccess: true,
  }) as Order
  const { capability, sourceZoneHash: acceptedSourceZoneHash } =
    migrationEvidenceFromOrder(order)
  if (!validateTldTransferAuthorization(capability, input.transferCode)) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  const target = buildAutomaticMigrationTargetZone(source, {
    rendererTargetHost: cloudflareTunnelTarget(
      "renderer",
      input.env ?? process.env,
    ),
  })
  const sourceAuthorityHash = domainMigrationSourceAuthorityHash(source)
  const sourceHash = domainMigrationEvidenceHash(source)
  if (
    acceptedSourceZoneHash &&
    acceptedSourceZoneHash !== sourceAuthorityHash
  ) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  const targetHash = domainMigrationEvidenceHash(target)
  if (
    (migration.sourceZoneHash && migration.sourceZoneHash !== sourceHash) ||
    (migration.targetZoneHash && migration.targetZoneHash !== targetHash)
  ) {
    throw new DomainMigrationCustomerInputError("invalid_input")
  }
  const tenant = await payload.findByID({
    collection: "tenants",
    id: relationshipId(migration.tenant) as string | number,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  const actions = withAction(
    withAction(actionStates(migration.customerActions, now), "upload_complete_zone", "completed", now, sourceHash),
    "provide_epp_code",
    "completed",
    now,
    "encrypted_at_rest",
  )
  if (input.expectedUpdatedAt) {
    const expectedTime = Date.parse(input.expectedUpdatedAt)
    const requestedTime = Date.parse(now)
    if (!Number.isFinite(expectedTime) || !Number.isFinite(requestedTime)) {
      throw new DomainMigrationCustomerInputError("stale_authority")
    }
    now = new Date(Math.max(requestedTime, expectedTime + 1)).toISOString()
    const claim = await payload.db.drizzle.execute(sql`
      UPDATE "domain_migrations"
      SET "updated_at" = ${new Date(now)}
      WHERE "id" = ${migration.id}
        AND "updated_at" = ${new Date(input.expectedUpdatedAt)}
        AND "state" = 'awaiting_customer'
        AND "failure_reason" = 'source_evidence_stale'
      RETURNING "id"
    `)
    if (claim.rows.length !== 1) {
      throw new DomainMigrationCustomerInputError("stale_authority")
    }
    migration = { ...migration, updatedAt: now }
  }
  const binding = migration.idempotencyKey
  const encryptedSourceRefreshAuthority = input.sourceRefreshAuthority
    ? sealAutomaticSourceRefreshAuthority(
        input.sourceRefreshAuthority,
        binding,
        input.env,
      )
    : null
  migration = await updateMigration(payload, migration, {
    state: "ready_to_prepare",
    sourceZoneHash: sourceHash,
    sourceZoneSnapshot: source,
    targetZoneHash: targetHash,
    targetZoneSnapshot: target,
    rollbackEvidence: {
      schemaVersion: 1,
      sourceZoneHash: sourceHash,
      sourceZoneSnapshot: source,
      authoritativeNameservers: source.authoritativeNameservers,
      dnssec: source.dnssec,
      tenantBeforeCutover: {
        domain: tenant.domain,
        domainVerification: tenant.domainVerification ?? null,
      },
      frozenAt: now,
    },
    encryptedSourceRefreshAuthority,
    sourceRefreshAuthorityExpiresAt: encryptedSourceRefreshAuthority
      ? new Date(
          new Date(now).getTime() + SOURCE_REFRESH_AUTHORITY_LIFETIME_MS,
        ).toISOString()
      : null,
    sourceRefreshAuthorityDeletedAt: encryptedSourceRefreshAuthority
      ? null
      : migration.sourceRefreshAuthorityDeletedAt,
    sourceAuthorityLastVerifiedAt: encryptedSourceRefreshAuthority
      ? now
      : null,
    encryptedTransferCode: sealMigrationSecret(input.transferCode, binding, input.env),
    transferCodeReceivedAt: now,
    transferCodeExpiresAt: input.transferCodeExpiresAt ?? (
      capability.transfer.authorizationValidityDays
        ? new Date(
            new Date(now).getTime() +
            capability.transfer.authorizationValidityDays * 24 * 60 * 60_000,
          ).toISOString()
        : null
    ),
    customerActions: actions,
    failureReason: null,
  }, "authoritative_zone_and_transfer_code_acquired", now)
  if (input.queuePreparation !== false) {
    await payload.jobs.queue({
      task: "prepare-domain-migration",
      input: { migrationId: String(migration.id) },
      queue: "default",
      overrideAccess: true,
    })
  }
  return migration
}

async function getOrCreateManagedDomain(
  payload: Payload,
  migration: DomainMigration,
  order: Order,
  profile: CheckoutProfile,
  now: string,
): Promise<ManagedDomain> {
  const existing = await payload.find({
    collection: "managed-domains",
    where: { domainNameAscii: { equals: migration.domainNameAscii } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs.length > 1) throw new Error("Duplicate managed-domain authority.")
  if (existing.docs[0]) {
    const domain = existing.docs[0] as ManagedDomain
    if (
      domain.initialOperation !== "transfer" ||
      !sameRelationshipId(domain.originatingOrder, order.id) ||
      !sameRelationshipId(domain.registrantProfile, profile.id)
    ) {
      throw new Error("Existing managed domain belongs to different accepted evidence.")
    }
    return domain
  }
  return payload.create({
    collection: "managed-domains",
    data: {
      domainNameAscii: migration.domainNameAscii,
      tld: migration.tld,
      provisioningIdempotencyKey: migration.idempotencyKey,
      originatingOrder: order.id,
      registrantProfile: profile.id,
      tenant: numericRelationshipId(migration.tenant),
      state: "transfer_pending",
      custodyStatus: "managed",
      initialOperation: "transfer",
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
      stateHistory: [{ at: now, state: "transfer_pending", reason: "migration_preparation_started" }],
      createdAt: now,
    },
    depth: 0,
    overrideAccess: true,
  }) as Promise<ManagedDomain>
}

const activeProviderDomain = (
  record: OpenProviderDomainRecord,
  activeStatuses: readonly string[],
): boolean => activeStatuses.includes(record.status.trim().toUpperCase())

const storedZoneSnapshot = (value: unknown): NormalizedCompleteZone => {
  const source = readObject(value)
  const records = Array.isArray(source.records) ? source.records : []
  const proxiedByRecord = new Map<string, boolean>()
  for (const record of records) {
    const entry = { ...readObject(record) }
    const proxied = entry.proxied === true
    delete entry.proxied
    proxiedByRecord.set(stableDomainMigrationEvidenceString(entry), proxied)
  }
  const withoutRuntimeFields = {
    ...source,
    records: records.map((record) => {
      const entry = { ...readObject(record) }
      delete entry.proxied
      return entry
    }),
  }
  const normalized = normalizeCompleteZone(withoutRuntimeFields)
  return {
    ...normalized,
    records: normalized.records.map((record) => {
      const entry = { ...record } as Record<string, unknown>
      delete entry.proxied
      return {
        ...record,
        proxied: proxiedByRecord.get(stableDomainMigrationEvidenceString(entry)) ?? false,
      }
    }),
  }
}

const migrationSource = (migration: DomainMigration): NormalizedCompleteZone =>
  storedZoneSnapshot(migration.sourceZoneSnapshot)

const migrationTarget = (migration: DomainMigration): NormalizedCompleteZone =>
  storedZoneSnapshot(migration.targetZoneSnapshot)

const sourceRefreshModeForMigration = (
  migration: DomainMigration,
): AutomaticMigrationSourceRefreshMode => {
  const source = migrationSource(migration)
  return source.dnssec.status === "signed" &&
    [
      "source_ds_removal",
      "source_ds_cache_wait",
      "unsigned_cutover_ready",
    ].includes(migration.dnssecPhase)
    ? "stable_content_after_dnssec_transition"
    : "exact_authority"
}

const sourceEvidenceVerifiedAt = (migration: DomainMigration): number => {
  const lastVerified = Date.parse(migration.sourceAuthorityLastVerifiedAt ?? "")
  if (Number.isFinite(lastVerified)) return lastVerified
  return Date.parse(
    String(readObject(migration.sourceZoneSnapshot).acquiredAt ?? ""),
  )
}

const sourceEvidenceIsStale = (
  migration: DomainMigration,
  now: string,
): boolean => {
  const verifiedAt = sourceEvidenceVerifiedAt(migration)
  const current = Date.parse(now)
  return !Number.isFinite(verifiedAt) ||
    !Number.isFinite(current) ||
    verifiedAt < current - SOURCE_EVIDENCE_MAX_AGE_MS
}

const sourceRefreshReauthorization = async (
  payload: Payload,
  migration: DomainMigration,
  now: string,
  reason: string,
): Promise<DomainMigration> => {
  const revocation = await revokeMigrationSourceAuthority(
    payload,
    migration,
    now,
  )
  migration = revocation.migration
  if (!revocation.confirmed) {
    return updateMigration(payload, migration, {
      state: "awaiting_provider",
      reconciliationRequired: true,
      failureReason: "source_authority_revocation_pending",
    }, "source_authority_revocation_pending", now)
  }
  const actions = withAction(
    actionStates(migration.customerActions, now),
    "authorize_provider",
    "required",
    now,
    reason,
  )
  return updateMigration(payload, migration, {
    state: "awaiting_customer",
    encryptedSourceRefreshAuthority: null,
    sourceRefreshAuthorityDeletedAt: now,
    sourceAuthorityLastVerifiedAt: null,
    customerActions: actions,
    reconciliationRequired: false,
    failureReason: "source_authority_reauthorization_required",
  }, reason, now)
}

const refreshMigrationSourceAuthority = async (
  payload: Payload,
  migration: DomainMigration,
  mode: AutomaticMigrationSourceRefreshMode,
  deps: Pick<
    MigrationDependencies,
    "now" | "refreshAutomaticMigrationSource" | "verifyParentDsAbsent"
    | "resolveCloudflareOAuthCredential"
  >,
): Promise<{
  migration: DomainMigration
  blocked: MigrationResult | null
}> => {
  const now = deps.now()
  if (
    !["cloudflare_api_v1", "authorized_axfr_v1"].includes(
      migration.sourceMechanism,
    )
  ) {
    return { migration, blocked: null }
  }
  const envelope = migration.encryptedSourceRefreshAuthority
  const expiresAt = Date.parse(migration.sourceRefreshAuthorityExpiresAt ?? "")
  if (
    !envelope ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.parse(now)
  ) {
    const updated = await sourceRefreshReauthorization(
      payload,
      migration,
      now,
      "automatic_source_authority_expired",
    )
    return {
      migration: updated,
      blocked: waiting(
        updated,
        "The automatic DNS source authorization expired and must be renewed.",
      ),
    }
  }
  if (mode === "stable_content_after_dnssec_transition") {
    const parentDs = await deps.verifyParentDsAbsent(
      migration.domainNameAscii,
    )
    if (parentDs.status !== "absent") {
      return {
        migration,
        blocked: waiting(
          migration,
          parentDs.status === "indeterminate"
            ? "The parent DNSSEC state is indeterminate; source refresh remains paused."
            : "The old parent DS is still visible; source refresh is waiting for its cache window.",
        ),
      }
    }
  }
  let authority: AutomaticSourceRefreshAuthority
  try {
    authority = openAutomaticSourceRefreshAuthority(
      envelope,
      migration.idempotencyKey,
      migration.domainNameAscii,
    )
    let sourceCredential = authority.credential
    if (authority.credential.kind === "cloudflare_oauth") {
      try {
        const resolved = await deps.resolveCloudflareOAuthCredential(
          payload,
          authority.credential,
          { now: new Date(now) },
        )
        if (!resolved.zoneId) throw new MigrationSourceAuthorizationError()
        sourceCredential = {
          kind: "cloudflare_api_token",
          token: resolved.accessToken,
          zoneId: resolved.zoneId,
        }
      } catch (error) {
        if (error instanceof MigrationSourceRefreshRetryableError) {
          throw error
        }
        throw new MigrationSourceAuthorizationError()
      }
    }
    const source = migrationSource(migration)
    if (
      authority.sourceMechanism !== migration.sourceMechanism ||
      authority.acceptedSourceAuthorityHash !==
        domainMigrationSourceAuthorityHash(source) ||
      authority.acceptedSourceContentHash !==
        domainMigrationSourceContentHash(source)
    ) {
      throw new MigrationSourceChangedError()
    }
    await deps.refreshAutomaticMigrationSource({
      domain: authority.domain,
      sourceMechanism: authority.sourceMechanism,
      sourceZoneHash: authority.acceptedSourceAuthorityHash,
      sourceContentHash: authority.acceptedSourceContentHash,
      sourceZone: source,
      sourceRefreshCredential: sourceCredential,
    }, {}, mode)
  } catch (error) {
    if (error instanceof MigrationSourceRefreshRetryableError) {
      return {
        migration,
        blocked: waiting(
          migration,
          "The automatic DNS source authorization refresh is temporarily pending.",
        ),
      }
    }
    if (error instanceof MigrationSourceDnssecTransitionPendingError) {
      return {
        migration,
        blocked: waiting(
          migration,
          "The old parent DS is still visible in fresh source evidence; source refresh remains paused.",
        ),
      }
    }
    if (error instanceof MigrationTransferEligibilityBlockedError) {
      const updated = await updateMigration(payload, migration, {
        state: "awaiting_provider",
        failureReason: "registry_transfer_blocked_before_provider_write",
        reconciliationRequired: true,
      }, "registry_transfer_blocked_before_provider_write", now)
      return {
        migration: updated,
        blocked: waiting(
          updated,
          "Fresh registry evidence blocks the transfer; no registrar write was sent.",
        ),
      }
    }
    if (
      !(error instanceof MigrationSourceChangedError) &&
      !(error instanceof MigrationSourceAuthorizationError)
    ) {
      throw error
    }
    const updated = await sourceRefreshReauthorization(
      payload,
      migration,
      now,
      error instanceof MigrationSourceChangedError
        ? "automatic_source_changed"
        : "automatic_source_authorization_revoked",
    )
    return {
      migration: updated,
      blocked: waiting(
        updated,
        "The automatic DNS source must be reauthorized before migration continues.",
      ),
    }
  }
  const updated = await updateMigration(payload, migration, {
    sourceAuthorityLastVerifiedAt: now,
    failureReason: migration.failureReason ===
      "source_authority_reauthorization_required"
      ? null
      : migration.failureReason,
  }, `automatic_source_refreshed_${mode}`, now)
  return { migration: updated, blocked: null }
}

const waiting = (migration: DomainMigration, message: string): MigrationResult => ({
  status: "waiting",
  migrationId: migration.id,
  message,
})

const invalidTransferAuthorizationCodes = new Set([
  "AUTH_CODE_INVALID",
  "DOMAIN_AUTH_CODE_INVALID",
  "DOMAIN_TRANSFER_AUTH_CODE_INVALID",
  "INVALID_AUTH_CODE",
])

const providerRejectedTransferAuthorization = (
  error: unknown,
): error is OpenProviderApiError =>
  error instanceof OpenProviderApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  error.providerCode != null &&
  invalidTransferAuthorizationCodes.has(error.providerCode)

export const transferAutorenewMode = (
  capability: TldCapability,
): "on" | "off" =>
  tldCapabilityOperationFlagEnabled(
    capability,
    "renewal_provider_autorenew",
  )
    ? "on"
    : "off"

const PROVIDER_WRITE_CLAIM_LEASE_MS = 5 * 60_000
const PROVIDER_WRITE_RECONCILIATION_TIMEOUT_MS = 24 * 60 * 60_000

const providerWriteClaimLeaseElapsed = (
  requestedAt: string | null | undefined,
  now: string,
): boolean => {
  const requested = Date.parse(requestedAt ?? "")
  const current = Date.parse(now)
  return Number.isFinite(requested) &&
    Number.isFinite(current) &&
    current - requested >= PROVIDER_WRITE_CLAIM_LEASE_MS
}

const providerWriteReconciliationTimedOut = (
  requestedAt: string | null | undefined,
  now: string,
): boolean => {
  const requested = Date.parse(requestedAt ?? "")
  const current = Date.parse(now)
  return Number.isFinite(requested) &&
    Number.isFinite(current) &&
    current - requested >= PROVIDER_WRITE_RECONCILIATION_TIMEOUT_MS
}

async function stopMigrationForProviderManualReview(
  payload: Payload,
  migration: DomainMigration,
  managedDomain: ManagedDomain,
  code: string,
  now: string,
  message: string,
): Promise<MigrationResult> {
  const revocation = await revokeMigrationSourceAuthority(
    payload,
    migration,
    now,
  )
  migration = revocation.migration
  migration = await updateMigration(payload, migration, {
    state: "failed",
    ...clearedMigrationCredentials(now, revocation.confirmed),
    reconciliationRequired: true,
    failureReason: code,
  }, code, now)
  await updateManagedDomain(payload, managedDomain, {
    state: "manual_review",
    entitlementStatus: "blocked",
    customerStatus: "manual_review",
    reconciliationRequired: true,
    failureReason: code,
  }, code, now)
  await recordCommerceAdminException({
    payload,
    source: "domains",
    code,
    message,
    tenant: migration.tenant,
    subjectId: migration.id,
    severity: "critical",
    now,
  })
  return {
    status: "failed",
    migrationId: migration.id,
    message,
  }
}

async function pauseMigrationForRegistrarAmbiguity(
  payload: Payload,
  migration: DomainMigration,
  managedDomain: ManagedDomain,
  now: string,
): Promise<MigrationResult> {
  migration = await updateMigration(payload, migration, {
    state: "awaiting_provider",
    reconciliationRequired: true,
    failureReason: "openprovider_domain_lookup_ambiguous",
  }, "openprovider_domain_lookup_ambiguous", now)
  await updateManagedDomain(payload, managedDomain, {
    state: "manual_review",
    entitlementStatus: "blocked",
    customerStatus: "manual_review",
    reconciliationRequired: true,
    failureReason: "openprovider_domain_lookup_ambiguous",
  }, "openprovider_domain_lookup_ambiguous", now)
  await recordCommerceAdminException({
    payload,
    source: "domains",
    code: "openprovider_domain_lookup_ambiguous",
    message:
      "Multiple exact Openprovider domains match a prepared or committed migration transfer.",
    tenant: migration.tenant,
    subjectId: migration.id,
    severity: "critical",
    now,
  })
  return waiting(
    migration,
    "Registrar domain authority is ambiguous and requires provider reconciliation.",
  )
}

async function stopUnfulfillableMigrationBeforeRegistrarCommit(
  payload: Payload,
  migration: DomainMigration,
  managedDomain: ManagedDomain,
  order: Order,
  code: string,
  now: string,
): Promise<MigrationResult> {
  const revocation = await revokeMigrationSourceAuthority(
    payload,
    migration,
    now,
  )
  migration = revocation.migration
  migration = await updateMigration(payload, migration, {
    state: "failed",
    ...clearedMigrationCredentials(now, revocation.confirmed),
    reconciliationRequired: !revocation.confirmed,
    failureReason: code,
  }, code, now)
  await updateManagedDomain(payload, managedDomain, {
    state: "manual_review",
    entitlementStatus: "blocked",
    customerStatus: "manual_review",
    reconciliationRequired: false,
    failureReason: code,
  }, code, now)
  const attempts = await payload.find({
    collection: "payment-attempts",
    where: {
      and: [
        { order: { equals: order.id } },
        { purpose: { equals: "first_payment" } },
        {
          state: {
            in: ["paid", "refund_pending", "partially_refunded", "refunded"],
          },
        },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (attempts.docs.length !== 1) {
    throw new Error("Unfulfillable migration has no unique captured payment authority.")
  }
  const attempt = attempts.docs[0] as PaymentAttempt
  await payload.jobs.queue({
    task: "request-mollie-refund",
    input: {
      paymentAttemptId: String(attempt.id),
      scenario: "unfulfillable_before_provider_commit",
    },
    queue: "default",
    overrideAccess: true,
  })
  if (order.state === "fulfillment_pending") {
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { state: "exception" },
      depth: 0,
      overrideAccess: true,
      context: { legalOrderLifecycleMutation: true },
    })
  }
  return {
    status: "failed",
    migrationId: migration.id,
    message: "Automatic migration is unfulfillable before registrar transfer; a full governed refund was queued.",
  }
}

async function stopMigrationForRevokedPaymentBeforeRegistrarCommit(
  payload: Payload,
  migration: DomainMigration,
  managedDomain: ManagedDomain,
  order: Order,
  now: string,
): Promise<MigrationResult> {
  const revocation = await revokeMigrationSourceAuthority(
    payload,
    migration,
    now,
  )
  migration = revocation.migration
  migration = await updateMigration(payload, migration, {
    state: "failed",
    ...clearedMigrationCredentials(now, revocation.confirmed),
    reconciliationRequired: !revocation.confirmed,
    failureReason: "payment_authority_revoked_before_registrar_commit",
  }, "payment_authority_revoked_before_registrar_commit", now)
  await updateManagedDomain(payload, managedDomain, {
    state: "failed",
    entitlementStatus: "blocked",
    customerStatus: "failed",
    reconciliationRequired: false,
    failureReason: "payment_authority_revoked_before_registrar_commit",
  }, "payment_authority_revoked_before_registrar_commit", now)
  if (order.state === "fulfillment_pending") {
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { state: "exception" },
      depth: 0,
      overrideAccess: true,
      context: { legalOrderLifecycleMutation: true },
    })
  }
  return {
    status: "failed",
    migrationId: migration.id,
    message: "Payment authority was revoked before registrar transfer; no provider write was sent.",
  }
}

async function loadSecuredInitialPaymentAuthority(
  payload: Payload,
  orderId: string | number,
): Promise<{ order: Order; attempt: PaymentAttempt | null; secured: boolean }> {
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as Order
  if (!order.providerPaymentId) return { order, attempt: null, secured: false }
  const attempts = await payload.find({
    collection: "payment-attempts",
    where: {
      and: [
        { order: { equals: order.id } },
        { purpose: { equals: "first_payment" } },
        { providerPaymentId: { equals: order.providerPaymentId } },
        { state: { in: ["paid", "refund_failed"] } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (attempts.docs.length !== 1) {
    return { order, attempt: null, secured: false }
  }
  const attempt = attempts.docs[0] as PaymentAttempt
  return {
    order,
    attempt,
    secured: initialPaymentIsFinanciallySecured(order, attempt),
  }
}

async function stopMigrationForRevokedPaymentAfterRegistrarCommit(
  payload: Payload,
  migration: DomainMigration,
  managedDomain: ManagedDomain,
  order: Order,
  now: string,
): Promise<MigrationResult> {
  const revocation = await revokeMigrationSourceAuthority(
    payload,
    migration,
    now,
  )
  migration = revocation.migration
  await recordCommerceAdminException({
    payload,
    source: "domains",
    code: "payment_authority_revoked_after_registrar_commit",
    message:
      "Payment authority changed after registrar commitment; customer domain custody and DNS continuity remain preserved while website entitlement is blocked.",
    tenant: managedDomain.tenant,
    subjectId: migration.id,
    severity: "critical",
    now,
  })
  await updateManagedDomain(payload, managedDomain, {
    state: "manual_review",
    entitlementStatus: "blocked",
    customerStatus: "manual_review",
    reconciliationRequired: false,
    failureReason: "payment_authority_revoked_after_registrar_commit",
  }, "payment_authority_revoked_after_registrar_commit", now)
  migration = await updateMigration(payload, migration, {
    state: "failed",
    ...clearedMigrationCredentials(now, revocation.confirmed),
    reconciliationRequired: !revocation.confirmed,
    failureReason: "payment_authority_revoked_after_registrar_commit",
  }, "payment_authority_revoked_after_registrar_commit", now)
  if (order.state === "fulfillment_pending") {
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { state: "exception" },
      depth: 0,
      overrideAccess: true,
      context: { legalOrderLifecycleMutation: true },
    })
  }
  return {
    status: "failed",
    migrationId: migration.id,
    message:
      "Payment authority changed after registrar commitment; customer domain custody and DNS continuity remain preserved without website activation.",
  }
}

async function prepareDnssecForCutover(
  payload: Payload,
  migration: DomainMigration,
  managedDomain: ManagedDomain,
  providerDomain: OpenProviderDomainRecord,
  source: NormalizedCompleteZone,
  token: string,
  deps: MigrationDependencies,
): Promise<{
  migration: DomainMigration
  providerDomain: OpenProviderDomainRecord
  result: MigrationResult | null
}> {
  const now = deps.now()
  const expectedSourceKeys = sourceDnskeys(source)

  if (source.dnssec.status === "unsigned") {
    if ([
      "target_signing",
      "target_ds_publication",
      "target_chain_verifying",
      "target_secure",
      "rollback_target_ds_removal",
      "rollback_target_ds_cache_wait",
      "rollback_old_authority",
      "rollback_source_ds_publication",
    ].includes(migration.dnssecPhase)) {
      return { migration, providerDomain, result: null }
    }
    const parentDs = await deps.verifyParentDsAbsent(migration.domainNameAscii)
    if (parentDs.status !== "absent") {
      return {
        migration,
        providerDomain,
        result: waiting(migration, "Unsigned source still has an unsafe parent DS state."),
      }
    }
    if (migration.dnssecPhase === "source_unsigned") {
      migration = await updateMigration(payload, migration, {
        dnssecPhase: "unsigned_cutover_ready",
        dnssecWriteState: "confirmed",
        dnssecVerification: {
          checkedAt: now,
          sourceStatus: "unsigned",
          parentDs,
        },
      }, "unsigned_source_ready_for_cutover", now)
    }
    return { migration, providerDomain, result: null }
  }

  if (migration.dnssecPhase === "source_secure_preserved") {
    const sourceChainPreserved = providerDomain.dnssecEnabled === true &&
      dnskeysEqual((providerDomain.dnssecKeys ?? []), expectedSourceKeys)
    if (!sourceChainPreserved) {
      if (providerDomain.dnssecEnabled == null) {
        return {
          migration,
          providerDomain,
          result: waiting(
            migration,
            "Openprovider has not returned authoritative DNSSEC state for the transferred domain.",
          ),
        }
      }
      if (
        migration.dnssecWriteState === "indeterminate" ||
        (
          migration.dnssecWriteState === "prepared" &&
          !providerWriteClaimLeaseElapsed(migration.dnssecWriteRequestedAt, now)
        )
      ) {
        if (providerWriteReconciliationTimedOut(migration.dnssecWriteRequestedAt, now)) {
          return {
            migration,
            providerDomain,
            result: await stopMigrationForProviderManualReview(
              payload,
              migration,
              managedDomain,
              "source_dnssec_preservation_outcome_unresolved",
              now,
              "Source DNSSEC preservation could not be reconciled safely.",
            ),
          }
        }
        return {
          migration,
          providerDomain,
          result: waiting(migration, "Source DNSSEC preservation awaits reconciliation."),
        }
      }
      if (!deps.forwardProviderWritesAllowed()) {
        return {
          migration,
          providerDomain,
          result: waiting(migration, "Source DNSSEC repair is release-blocked."),
        }
      }
      migration = await updateMigration(payload, migration, {
        dnssecWriteState: "prepared",
        dnssecWriteRequestedAt: now,
        reconciliationRequired: true,
      }, "source_dnssec_preservation_write_prepared", now)
      try {
        await deps.updateOpenProviderDomainDnssec(
          providerDomain.id,
          { enabled: true, keys: expectedSourceKeys },
          { token },
        )
      } catch (error) {
        if (!(error instanceof OpenProviderIndeterminateWriteError)) throw error
      }
      migration = await updateMigration(payload, migration, {
        dnssecWriteState: "indeterminate",
        reconciliationRequired: true,
      }, "source_dnssec_preservation_write_dispatched", deps.now())
      providerDomain = await deps.findOpenProviderDomain(
        migration.domainNameAscii,
        { token },
      ) ?? providerDomain
      if (
        providerDomain.dnssecEnabled !== true ||
        !dnskeysEqual((providerDomain.dnssecKeys ?? []), expectedSourceKeys)
      ) {
        return {
          migration,
          providerDomain,
          result: waiting(migration, "Source DNSSEC preservation awaits provider confirmation."),
        }
      }
    }
    migration = await updateMigration(payload, migration, {
      dnssecPhase: "source_ds_removal",
      dnssecWriteState: "not_started",
      dnssecWriteRequestedAt: null,
      reconciliationRequired: false,
    }, "source_dnssec_chain_preserved", deps.now())
  }

  if (migration.dnssecPhase === "source_ds_removal") {
    if (providerDomain.dnssecEnabled !== false) {
      if (
        migration.dnssecWriteState === "indeterminate" ||
        (
          migration.dnssecWriteState === "prepared" &&
          !providerWriteClaimLeaseElapsed(migration.dnssecWriteRequestedAt, deps.now())
        )
      ) {
        if (providerWriteReconciliationTimedOut(migration.dnssecWriteRequestedAt, deps.now())) {
          return {
            migration,
            providerDomain,
            result: await stopMigrationForProviderManualReview(
              payload,
              migration,
              managedDomain,
              "source_ds_removal_outcome_unresolved",
              deps.now(),
              "Source DS removal could not be reconciled safely.",
            ),
          }
        }
        return {
          migration,
          providerDomain,
          result: waiting(migration, "Source DS removal awaits provider reconciliation."),
        }
      }
      if (!deps.forwardProviderWritesAllowed()) {
        return {
          migration,
          providerDomain,
          result: waiting(migration, "Source DS removal is release-blocked."),
        }
      }
      migration = await updateMigration(payload, migration, {
        dnssecWriteState: "prepared",
        dnssecWriteRequestedAt: deps.now(),
        reconciliationRequired: true,
      }, "source_ds_removal_write_prepared", deps.now())
      try {
        await deps.updateOpenProviderDomainDnssec(
          providerDomain.id,
          { enabled: false, keys: [] },
          { token },
        )
      } catch (error) {
        if (!(error instanceof OpenProviderIndeterminateWriteError)) throw error
      }
      migration = await updateMigration(payload, migration, {
        dnssecWriteState: "indeterminate",
        reconciliationRequired: true,
      }, "source_ds_removal_write_dispatched", deps.now())
      providerDomain = await deps.findOpenProviderDomain(
        migration.domainNameAscii,
        { token },
      ) ?? providerDomain
      if (providerDomain.dnssecEnabled !== false) {
        return {
          migration,
          providerDomain,
          result: waiting(migration, "Source DS removal awaits authoritative confirmation."),
        }
      }
    }
    migration = await updateMigration(payload, migration, {
      dnssecPhase: "source_ds_cache_wait",
      dnssecWriteState: "confirmed",
      dnssecWriteRequestedAt: null,
      reconciliationRequired: true,
    }, "source_ds_removal_confirmed", deps.now())
  }

  if (migration.dnssecPhase === "source_ds_cache_wait") {
    const parentDs = await deps.verifyParentDsAbsent(migration.domainNameAscii)
    if (parentDs.status === "indeterminate") {
      return {
        migration,
        providerDomain,
        result: waiting(migration, "Parent DS removal cannot yet be verified."),
      }
    }
    if (parentDs.status === "present") {
      return {
        migration,
        providerDomain,
        result: waiting(migration, "Parent DS removal is still propagating."),
      }
    }
    const ttl = source.dnssec.parentDsTtl
    if (ttl == null) throw new Error("Signed source has no frozen parent DS TTL.")
    const safeAfter = migration.dnssecSafeAfter ?? dnssecWaitUntil(deps.now(), ttl)
    if (!migration.dnssecSafeAfter) {
      migration = await updateMigration(payload, migration, {
        dnssecSafeAfter: safeAfter,
        dnssecVerification: {
          checkedAt: deps.now(),
          sourceDsAbsent: parentDs,
          safeAfter,
        },
      }, "source_ds_cache_safety_window_started", deps.now())
    }
    if (Date.parse(deps.now()) < Date.parse(safeAfter)) {
      return {
        migration,
        providerDomain,
        result: waiting(migration, "Cached source DS records are still inside the safety window."),
      }
    }
    migration = await updateMigration(payload, migration, {
      dnssecPhase: "unsigned_cutover_ready",
      dnssecSafeAfter: null,
      reconciliationRequired: false,
    }, "source_ds_cache_safety_window_elapsed", deps.now())
  }

  return { migration, providerDomain, result: null }
}

async function secureTargetDnssec(
  payload: Payload,
  migration: DomainMigration,
  managedDomain: ManagedDomain,
  providerDomain: OpenProviderDomainRecord,
  zoneId: string,
  token: string,
  deps: MigrationDependencies,
): Promise<{
  migration: DomainMigration
  providerDomain: OpenProviderDomainRecord
  result: MigrationResult | null
}> {
  let cloudflareDnssec = await deps.getCloudflareDnssec(zoneId)
  const cloudflareKeyAvailable =
    cloudflareDnssec.flags != null &&
    cloudflareDnssec.algorithm != null &&
    cloudflareDnssec.publicKey != null &&
    cloudflareDnssec.ds != null &&
    cloudflareDnssec.status !== "disabled" &&
    cloudflareDnssec.status !== "unknown"

  if (!cloudflareKeyAvailable) {
    if (
      migration.dnssecPhase === "target_signing" &&
      (
        migration.dnssecWriteState === "indeterminate" ||
        (
          migration.dnssecWriteState === "prepared" &&
          !providerWriteClaimLeaseElapsed(migration.dnssecWriteRequestedAt, deps.now())
        )
      )
    ) {
      if (providerWriteReconciliationTimedOut(migration.dnssecWriteRequestedAt, deps.now())) {
        return {
          migration,
          providerDomain,
          result: await stopMigrationForProviderManualReview(
            payload,
            migration,
            managedDomain,
            "cloudflare_dnssec_enablement_outcome_unresolved",
            deps.now(),
            "Cloudflare DNSSEC enablement could not be reconciled safely.",
          ),
        }
      }
      return {
        migration,
        providerDomain,
        result: waiting(migration, "Cloudflare DNSSEC enablement awaits reconciliation."),
      }
    }
    if (!deps.forwardProviderWritesAllowed()) {
      return {
        migration,
        providerDomain,
        result: waiting(migration, "Cloudflare DNSSEC enablement is release-blocked."),
      }
    }
    migration = await updateMigration(payload, migration, {
      dnssecPhase: "target_signing",
      dnssecWriteState: "prepared",
      dnssecWriteRequestedAt: deps.now(),
      reconciliationRequired: true,
    }, "target_dnssec_signing_write_prepared", deps.now())
    try {
      cloudflareDnssec = await deps.enableCloudflareDnssec(zoneId)
    } catch (error) {
      if (!(error instanceof CloudflareIndeterminateWriteError)) throw error
    }
    migration = await updateMigration(payload, migration, {
      dnssecWriteState: "indeterminate",
      reconciliationRequired: true,
    }, "target_dnssec_signing_write_dispatched", deps.now())
    cloudflareDnssec = await deps.getCloudflareDnssec(zoneId)
  }

  if (
    cloudflareDnssec.flags == null ||
    cloudflareDnssec.algorithm == null ||
    cloudflareDnssec.publicKey == null ||
    cloudflareDnssec.ds == null ||
    ["disabled", "unknown"].includes(cloudflareDnssec.status)
  ) {
    return {
      migration,
      providerDomain,
      result: waiting(migration, "Cloudflare has not returned complete target DNSSEC evidence."),
    }
  }

  const targetKey: OpenProviderDnskey = {
    flags: cloudflareDnssec.flags,
    protocol: 3,
    alg: cloudflareDnssec.algorithm,
    pub_key: cloudflareDnssec.publicKey,
  }
  const targetDs = canonicalDsRecords([cloudflareDnssec.ds])
  if (!["target_ds_publication", "target_chain_verifying", "target_secure"]
    .includes(migration.dnssecPhase)) {
    migration = await updateMigration(payload, migration, {
      dnssecPhase: "target_ds_publication",
      dnssecWriteState: "not_started",
      dnssecWriteRequestedAt: null,
      targetDnssecEvidence: {
        capturedAt: deps.now(),
        cloudflareStatus: cloudflareDnssec.status,
        dnskey: targetKey,
        parentDsRecords: targetDs,
      },
      reconciliationRequired: true,
    }, "target_dnssec_key_reconciled", deps.now())
  }

  const providerTargetKeyActive = providerDomain.dnssecEnabled === true &&
    dnskeysEqual((providerDomain.dnssecKeys ?? []), [targetKey])
  if (!providerTargetKeyActive) {
    if (
      migration.dnssecWriteState === "indeterminate" ||
      (
        migration.dnssecWriteState === "prepared" &&
        !providerWriteClaimLeaseElapsed(migration.dnssecWriteRequestedAt, deps.now())
      )
    ) {
      if (providerWriteReconciliationTimedOut(migration.dnssecWriteRequestedAt, deps.now())) {
        return {
          migration,
          providerDomain,
          result: await stopMigrationForProviderManualReview(
            payload,
            migration,
            managedDomain,
            "target_ds_publication_outcome_unresolved",
            deps.now(),
            "Target DS publication could not be reconciled safely.",
          ),
        }
      }
      return {
        migration,
        providerDomain,
        result: waiting(migration, "Target DS publication awaits provider reconciliation."),
      }
    }
    if (!deps.forwardProviderWritesAllowed()) {
      return {
        migration,
        providerDomain,
        result: waiting(migration, "Target DS publication is release-blocked."),
      }
    }
    migration = await updateMigration(payload, migration, {
      dnssecPhase: "target_ds_publication",
      dnssecWriteState: "prepared",
      dnssecWriteRequestedAt: deps.now(),
      reconciliationRequired: true,
    }, "target_ds_publication_write_prepared", deps.now())
    try {
      await deps.updateOpenProviderDomainDnssec(
        providerDomain.id,
        { enabled: true, keys: [targetKey] },
        { token },
      )
    } catch (error) {
      if (!(error instanceof OpenProviderIndeterminateWriteError)) throw error
    }
    migration = await updateMigration(payload, migration, {
      dnssecWriteState: "indeterminate",
      reconciliationRequired: true,
    }, "target_ds_publication_write_dispatched", deps.now())
    providerDomain = await deps.findOpenProviderDomain(
      migration.domainNameAscii,
      { token },
    ) ?? providerDomain
    if (
      providerDomain.dnssecEnabled !== true ||
      !dnskeysEqual((providerDomain.dnssecKeys ?? []), [targetKey])
    ) {
      return {
        migration,
        providerDomain,
        result: waiting(migration, "Target DS publication awaits authoritative confirmation."),
      }
    }
  }

  const [parentDs, refreshedCloudflareDnssec, dnssecChain] = await Promise.all([
    deps.verifyParentDsAbsent(migration.domainNameAscii),
    deps.getCloudflareDnssec(zoneId),
    deps.verifyDnssecChain(migration.domainNameAscii, {
      flags: targetKey.flags,
      protocol: targetKey.protocol,
      algorithm: targetKey.alg,
      publicKey: targetKey.pub_key,
      parentDsRecords: targetDs,
    }),
  ])
  const targetVerified = parentDs.status === "present" &&
    dsRecordsEqual(parentDs.records, targetDs) &&
    parentDs.ttl != null &&
    refreshedCloudflareDnssec.status === "active" &&
    refreshedCloudflareDnssec.ds != null &&
    dsRecordsEqual([refreshedCloudflareDnssec.ds], targetDs) &&
    dnssecChain.status === "verified"
  migration = await updateMigration(payload, migration, {
    dnssecPhase: targetVerified ? "target_secure" : "target_chain_verifying",
    dnssecWriteState: targetVerified ? "confirmed" : "indeterminate",
    targetDnssecEvidence: {
      capturedAt: deps.now(),
      cloudflareStatus: refreshedCloudflareDnssec.status,
      dnskey: targetKey,
      parentDsRecords: targetDs,
      parentDsTtl: parentDs.ttl ?? null,
    },
    dnssecVerification: {
      checkedAt: deps.now(),
      parentDs,
      cloudflareStatus: refreshedCloudflareDnssec.status,
      dnssecChain,
      expectedParentDsRecords: targetDs,
      verified: targetVerified,
    },
    reconciliationRequired: !targetVerified,
  }, targetVerified ? "target_dnssec_chain_verified" : "target_dnssec_chain_pending", deps.now())
  if (!targetVerified) {
    const verificationDeadlineReached = migration.verificationDeadlineAt
      ? Date.parse(deps.now()) >= Date.parse(migration.verificationDeadlineAt)
      : false
    if (verificationDeadlineReached) {
      const reason = "target_dnssec_verification_deadline_exceeded"
      migration = await updateMigration(payload, migration, {
        rollbackRequestedAt: migration.rollbackRequestedAt ?? deps.now(),
        reconciliationRequired: true,
        failureReason: reason,
      }, reason, deps.now())
      return {
        migration,
        providerDomain,
        result: await rollbackCutover(
          payload,
          migration,
          managedDomain,
          providerDomain,
          reason,
          deps,
        ),
      }
    }
    return {
      migration,
      providerDomain,
      result: waiting(migration, "Target DNSSEC chain is still propagating."),
    }
  }
  return { migration, providerDomain, result: null }
}

async function rollbackCutover(
  payload: Payload,
  migration: DomainMigration,
  managedDomain: ManagedDomain,
  providerDomain: OpenProviderDomainRecord,
  reason: string,
  deps: MigrationDependencies,
): Promise<MigrationResult> {
  const now = deps.now()
  const rollback = readObject(migration.rollbackEvidence)
  const source = migrationSource(migration)
  const oldNameservers = canonicalNameservers(rollback.authoritativeNameservers)
  if (oldNameservers.length < 2) {
    throw new Error("Frozen rollback evidence has no complete nameserver set.")
  }
  const targetDsMayBePublished = [
    "target_ds_publication",
    "target_chain_verifying",
    "target_secure",
    "rollback_target_ds_removal",
    "rollback_target_ds_cache_wait",
  ].includes(migration.dnssecPhase)
  if (targetDsMayBePublished) {
    if (migration.dnssecPhase !== "rollback_target_ds_cache_wait") {
      if (migration.dnssecPhase !== "rollback_target_ds_removal") {
        migration = await updateMigration(payload, migration, {
          dnssecPhase: "rollback_target_ds_removal",
          dnssecWriteState: "not_started",
          dnssecWriteRequestedAt: null,
          dnssecSafeAfter: null,
          reconciliationRequired: true,
          failureReason: redactOperationalMessage(reason),
        }, "rollback_target_ds_removal_started", now)
      }
      if (providerDomain.dnssecEnabled !== false) {
        if (
          migration.dnssecWriteState === "indeterminate" ||
          (
            migration.dnssecWriteState === "prepared" &&
            !providerWriteClaimLeaseElapsed(migration.dnssecWriteRequestedAt, deps.now())
          )
        ) {
          if (providerWriteReconciliationTimedOut(migration.dnssecWriteRequestedAt, deps.now())) {
            return stopMigrationForProviderManualReview(
              payload,
              migration,
              managedDomain,
              "rollback_target_ds_removal_unresolved",
              deps.now(),
              "Target DS removal could not be reconciled during rollback.",
            )
          }
          return waiting(migration, "Rollback is waiting for target DS removal reconciliation.")
        }
        migration = await updateMigration(payload, migration, {
          dnssecWriteState: "prepared",
          dnssecWriteRequestedAt: deps.now(),
          reconciliationRequired: true,
        }, "rollback_target_ds_removal_write_prepared", deps.now())
        try {
          await deps.updateOpenProviderDomainDnssec(
            providerDomain.id,
            { enabled: false, keys: [] },
          )
        } catch (error) {
          if (!(error instanceof OpenProviderIndeterminateWriteError)) throw error
        }
        migration = await updateMigration(payload, migration, {
          dnssecWriteState: "indeterminate",
          reconciliationRequired: true,
        }, "rollback_target_ds_removal_write_dispatched", deps.now())
        providerDomain = await deps.findOpenProviderDomain(migration.domainNameAscii) ??
          providerDomain
        if (providerDomain.dnssecEnabled !== false) {
          return waiting(migration, "Rollback target DS removal awaits confirmation.")
        }
      }
      migration = await updateMigration(payload, migration, {
        dnssecPhase: "rollback_target_ds_cache_wait",
        dnssecWriteState: "confirmed",
        dnssecWriteRequestedAt: null,
        reconciliationRequired: true,
      }, "rollback_target_ds_removal_confirmed", deps.now())
    }
    const parentDs = await deps.verifyParentDsAbsent(migration.domainNameAscii)
    if (parentDs.status !== "absent") {
      return waiting(migration, "Rollback is waiting for target DS removal to propagate.")
    }
    const targetDnssecEvidence = readObject(migration.targetDnssecEvidence)
    const capturedTargetDsTtl = Number(targetDnssecEvidence.parentDsTtl)
    const ttl = Number.isSafeInteger(capturedTargetDsTtl) &&
      capturedTargetDsTtl > 0 &&
      capturedTargetDsTtl <= 604_800
      ? capturedTargetDsTtl
      : 604_800
    const safeAfter = migration.dnssecSafeAfter ?? dnssecWaitUntil(deps.now(), ttl)
    if (!migration.dnssecSafeAfter) {
      migration = await updateMigration(payload, migration, {
        dnssecSafeAfter: safeAfter,
        dnssecVerification: {
          checkedAt: deps.now(),
          rollbackTargetDsAbsent: parentDs,
          safeAfter,
        },
      }, "rollback_target_ds_cache_safety_window_started", deps.now())
    }
    if (Date.parse(deps.now()) < Date.parse(safeAfter)) {
      return waiting(migration, "Rollback is waiting for cached target DS records to expire.")
    }
    migration = await updateMigration(payload, migration, {
      dnssecPhase: "rollback_old_authority",
      dnssecWriteState: "not_started",
      dnssecWriteRequestedAt: null,
      dnssecSafeAfter: null,
    }, "rollback_target_ds_cache_safety_window_elapsed", deps.now())
  }
  const oldNameserversVisible = nameserversEqual(
    providerDomain.nameServers,
    oldNameservers,
  )
  const unresolvedCutoverNeedsExplicitRollback =
    migration.cutoverWriteState === "indeterminate" &&
    ["not_started", "prepared"].includes(migration.rollbackWriteState)
  if (!oldNameserversVisible || unresolvedCutoverNeedsExplicitRollback) {
    if (
      migration.rollbackWriteState === "indeterminate" &&
      providerWriteReconciliationTimedOut(migration.rollbackRequestedAt, now)
    ) {
      return stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "rollback_provider_outcome_unresolved",
        now,
        "Rollback provider outcome requires immediate manual reconciliation.",
      )
    }
    if (
      migration.rollbackWriteState === "indeterminate" ||
      (
        migration.rollbackWriteState === "prepared" &&
        !providerWriteClaimLeaseElapsed(migration.rollbackRequestedAt, now)
      )
    ) {
      return waiting(
        migration,
        "Rollback nameserver outcome awaits reconciliation; no duplicate write was sent.",
      )
    }
    migration = await updateMigration(payload, migration, {
      rollbackWriteState: "prepared",
      rollbackRequestedAt: now,
      reconciliationRequired: true,
      failureReason: redactOperationalMessage(reason),
    }, "rollback_nameserver_write_prepared", now)
    try {
      await deps.updateOpenProviderDomainNameservers(
        providerDomain.id,
        oldNameservers.map((name) => ({ name })),
      )
      migration = await updateMigration(payload, migration, {
        rollbackWriteState: "indeterminate",
        reconciliationRequired: true,
      }, "rollback_nameserver_write_dispatched", deps.now())
    } catch (error) {
      if (!(error instanceof OpenProviderIndeterminateWriteError)) throw error
      migration = await updateMigration(payload, migration, {
        rollbackWriteState: "indeterminate",
        reconciliationRequired: true,
      }, "rollback_nameserver_write_indeterminate", deps.now())
      return waiting(migration, "Automatic rollback is awaiting provider reconciliation.")
    }
    const reconciled = await deps.findOpenProviderDomain(migration.domainNameAscii)
    if (!reconciled || !nameserversEqual(reconciled.nameServers, oldNameservers)) {
      return waiting(migration, "Automatic rollback nameservers are not confirmed yet.")
    }
    providerDomain = reconciled
  }
  if (!migration.rollbackRequestedAt) {
    migration = await updateMigration(payload, migration, {
      rollbackWriteState: "indeterminate",
      rollbackRequestedAt: now,
      reconciliationRequired: true,
    }, "rollback_dns_verification_started", now)
  }
  const [authoritativeDns, preservedDns] = await Promise.all([
    deps.verifyAuthoritativeDns(migration.domainNameAscii, oldNameservers),
    deps.verifyPreservedDnsRecords(source.records, oldNameservers),
  ])
  if (
    authoritativeDns.status !== "verified" ||
    preservedDns.status !== "verified"
  ) {
    if (providerWriteReconciliationTimedOut(migration.rollbackRequestedAt, deps.now())) {
      return stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "rollback_dns_verification_unresolved",
        deps.now(),
        "Rollback delegation or preserved DNS records did not verify before the safety deadline.",
      )
    }
    migration = await updateMigration(payload, migration, {
      rollbackWriteState: "indeterminate",
      reconciliationRequired: true,
      postCutoverVerification: {
        checkedAt: deps.now(),
        rollback: true,
        authoritativeDns,
        preservedDns,
      },
    }, "rollback_dns_verification_pending", deps.now())
    return waiting(
      migration,
      "Rollback nameservers are confirmed; authoritative and recursive DNS verification is pending.",
    )
  }
  if (source.dnssec.status === "signed") {
    const expectedSourceKeys = sourceDnskeys(source)
    if (
      providerDomain.dnssecEnabled !== true ||
      !dnskeysEqual((providerDomain.dnssecKeys ?? []), expectedSourceKeys)
    ) {
      if (migration.dnssecPhase !== "rollback_source_ds_publication") {
        migration = await updateMigration(payload, migration, {
          dnssecPhase: "rollback_source_ds_publication",
          dnssecWriteState: "not_started",
          dnssecWriteRequestedAt: null,
          reconciliationRequired: true,
        }, "rollback_source_ds_publication_started", deps.now())
      }
      if (
        migration.dnssecWriteState === "indeterminate" ||
        (
          migration.dnssecWriteState === "prepared" &&
          !providerWriteClaimLeaseElapsed(migration.dnssecWriteRequestedAt, deps.now())
        )
      ) {
        if (providerWriteReconciliationTimedOut(migration.dnssecWriteRequestedAt, deps.now())) {
          return stopMigrationForProviderManualReview(
            payload,
            migration,
            managedDomain,
            "rollback_source_ds_publication_unresolved",
            deps.now(),
            "Source DNSSEC restoration could not be reconciled during rollback.",
          )
        }
        return waiting(migration, "Rollback source DNSSEC restoration awaits reconciliation.")
      }
      migration = await updateMigration(payload, migration, {
        dnssecWriteState: "prepared",
        dnssecWriteRequestedAt: deps.now(),
        reconciliationRequired: true,
      }, "rollback_source_ds_publication_write_prepared", deps.now())
      try {
        await deps.updateOpenProviderDomainDnssec(
          providerDomain.id,
          { enabled: true, keys: expectedSourceKeys },
        )
      } catch (error) {
        if (!(error instanceof OpenProviderIndeterminateWriteError)) throw error
      }
      migration = await updateMigration(payload, migration, {
        dnssecWriteState: "indeterminate",
        reconciliationRequired: true,
      }, "rollback_source_ds_publication_write_dispatched", deps.now())
      providerDomain = await deps.findOpenProviderDomain(migration.domainNameAscii) ??
        providerDomain
      if (
        providerDomain.dnssecEnabled !== true ||
        !dnskeysEqual((providerDomain.dnssecKeys ?? []), expectedSourceKeys)
      ) {
        return waiting(migration, "Rollback source DNSSEC restoration awaits confirmation.")
      }
    }
    const restoredParentDs = await deps.verifyParentDsAbsent(migration.domainNameAscii)
    if (
      restoredParentDs.status !== "present" ||
      !dsRecordsEqual(restoredParentDs.records, source.dnssec.parentDsRecords)
    ) {
      return waiting(migration, "Rollback is waiting for the frozen source DNSSEC chain.")
    }
    const restoredSourceChain = await frozenSourceDnssecChecks(source, deps)
    if (
      restoredSourceChain.length === 0 ||
      restoredSourceChain.some((check) => check.status !== "verified")
    ) {
      migration = await updateMigration(payload, migration, {
        dnssecVerification: {
          checkedAt: deps.now(),
          rollbackSourceDnssecRestored: false,
          parentDs: restoredParentDs,
          sourceChain: restoredSourceChain,
        },
        reconciliationRequired: true,
      }, "rollback_source_dnssec_chain_pending", deps.now())
      return waiting(migration, "Rollback is waiting for the frozen source DNSSEC chain.")
    }
    migration = await updateMigration(payload, migration, {
      dnssecWriteState: "confirmed",
      dnssecVerification: {
        checkedAt: deps.now(),
        rollbackSourceDnssecRestored: true,
        parentDs: restoredParentDs,
        sourceChain: restoredSourceChain,
      },
      reconciliationRequired: false,
    }, "rollback_source_dnssec_chain_verified", deps.now())
  }
  const rollbackTenant = readObject(rollback.tenantBeforeCutover)
  const previousDomainVerification = readObject(rollbackTenant.domainVerification)
  await payload.update({
    collection: "tenants",
    id: numericRelationshipId(migration.tenant),
    data: {
      domain: typeof rollbackTenant.domain === "string"
        ? rollbackTenant.domain
        : managedDomain.domainNameAscii,
      domainVerification: Object.keys(previousDomainVerification).length > 0
        ? previousDomainVerification
        : { status: "not_checked" },
    },
    depth: 0,
    overrideAccess: true,
  })
  await updateManagedDomain(payload, managedDomain, {
    state: "manual_review",
    entitlementStatus: "blocked",
    customerStatus: "manual_review",
    reconciliationRequired: false,
    failureReason: redactOperationalMessage(reason),
  }, "migration_automatically_rolled_back", deps.now())
  const revocation = await revokeMigrationSourceAuthority(
    payload,
    migration,
    deps.now(),
  )
  migration = revocation.migration
  migration = await updateMigration(payload, migration, {
    state: "rolled_back",
    rollbackWriteState: "confirmed",
    rollbackConfirmedAt: deps.now(),
    rolledBackAt: deps.now(),
    ...clearedMigrationCredentials(deps.now(), revocation.confirmed),
    reconciliationRequired: !revocation.confirmed,
    failureReason: redactOperationalMessage(reason),
  }, "automatic_rollback_confirmed", deps.now())
  const orderId = relationshipId(migration.originatingOrder)
  if (orderId) {
    await payload.update({
      collection: "orders",
      id: orderId,
      data: { state: "exception" },
      depth: 0,
      overrideAccess: true,
      context: { legalOrderLifecycleMutation: true },
    })
  }
  return {
    status: "rolled_back",
    migrationId: migration.id,
    message: "Cutover verification failed and the frozen old nameservers were restored.",
  }
}

type MigrationPhaseOutcome =
  | { outcome: "continue"; migration: DomainMigration }
  | {
      outcome:
        | "waiting"
        | "customer_action_required"
        | "provider_reconciliation_required"
        | "manual_review"
        | "rollback_required"
        | "completed"
      result: MigrationResult
    }

type MigrationStoppedPhaseOutcome = Exclude<
  MigrationPhaseOutcome,
  { outcome: "continue" }
>

type SourceAuthorityPhaseOutcome =
  | {
      outcome: "continue"
      migration: DomainMigration
      sourceEvidenceStale: boolean
      now: string
    }
  | MigrationStoppedPhaseOutcome

type MigrationValidationContextPhaseOutcome =
  | {
      outcome: "continue"
      migration: DomainMigration
      order: Order
      capability: TldCapability
      profile: CheckoutProfile
      source: ReturnType<typeof migrationSource>
      target: ReturnType<typeof migrationTarget>
      managedDomain: ManagedDomain
      actions: MigrationCustomerActionStates
    }
  | MigrationStoppedPhaseOutcome

type CloudflarePreparationPhaseOutcome =
  | {
      outcome: "continue"
      migration: DomainMigration
      managedDomain: ManagedDomain
      zone: Awaited<
        ReturnType<MigrationDependencies["listCloudflareZones"]>
      >[number]
    }
  | MigrationStoppedPhaseOutcome

type EdgeReadinessPhaseOutcome =
  | {
      outcome: "continue"
      status: "configured" | "active"
    }
  | {
      outcome: "failed"
      failureReason: "automatic_edge_routing_conflict"
    }
  | {
      outcome: "waiting"
      message: string
    }

type OpenProviderCustomerPreparationPhaseOutcome =
  | {
      outcome: "continue"
      migration: DomainMigration
      managedDomain: ManagedDomain
      token: string
      customerHandle: string
    }
  | MigrationStoppedPhaseOutcome

const sourceAuthorityBlockedOutcome = (
  migration: DomainMigration,
  result: MigrationResult,
): MigrationStoppedPhaseOutcome => ({
  outcome: migration.state === "awaiting_customer"
    ? "customer_action_required"
    : migration.reconciliationRequired
      ? "provider_reconciliation_required"
      : "waiting",
  result,
})

async function loadAndClassifyMigrationPhase(
  payload: Payload,
  migrationId: string | number,
  deps: Pick<MigrationDependencies, "now">,
): Promise<MigrationPhaseOutcome> {
  let migration = await payload.findByID({
    collection: "domain-migrations",
    id: migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (
    ["completed", "failed", "rolled_back"].includes(migration.state) &&
    migration.encryptedSourceRefreshAuthority &&
    sourceAuthorityRevocationIsPending(migration)
  ) {
    const now = deps.now()
    const revocation = await revokeMigrationSourceAuthority(
      payload,
      migration,
      now,
    )
    migration = revocation.migration
    if (!revocation.confirmed) {
      return {
        outcome: "provider_reconciliation_required",
        result: waiting(
          migration,
          "Source authorization revocation remains pending reconciliation.",
        ),
      }
    }
    const managedDomainId = relationshipId(migration.managedDomain)
    const managedDomain = managedDomainId
      ? await payload.findByID({
          collection: "managed-domains",
          id: managedDomainId,
          depth: 0,
          overrideAccess: true,
        }) as ManagedDomain
      : null
    migration = await updateMigration(payload, migration, {
      encryptedSourceRefreshAuthority: null,
      sourceRefreshAuthorityDeletedAt: now,
      reconciliationRequired: managedDomain
        ? Boolean(managedDomain.reconciliationRequired)
        : migration.state === "failed",
    }, "source_authority_revocation_confirmed", now)
  }
  const decision = classifyMigrationEntry(migration)
  if (decision.outcome === "continue") {
    return { outcome: "continue", migration }
  }
  return {
    outcome: decision.outcome,
    result: {
      status: decision.status,
      migrationId: migration.id,
      message: decision.message,
    },
  }
}

async function refreshSourceAuthorityAndCustomerReadinessPhase(
  payload: Payload,
  initialMigration: DomainMigration,
  deps: MigrationDependencies,
): Promise<SourceAuthorityPhaseOutcome> {
  let migration = initialMigration
  const now = deps.now()
  if (
    migration.failureReason === "source_authority_revocation_pending" &&
    migration.encryptedSourceRefreshAuthority
  ) {
    migration = await sourceRefreshReauthorization(
      payload,
      migration,
      now,
      "source_authority_revocation_confirmed",
    )
    return {
      outcome: migration.failureReason === "source_authority_revocation_pending"
        ? "provider_reconciliation_required"
        : "customer_action_required",
      result: waiting(
        migration,
        migration.failureReason === "source_authority_revocation_pending"
          ? "Source authorization revocation remains pending reconciliation."
          : "The previous source authorization was revoked; fresh customer authority is required.",
      ),
    }
  }
  let sourceEvidenceStale = sourceEvidenceIsStale(migration, now)
  if (
    sourceEvidenceStale &&
    ["cloudflare_api_v1", "authorized_axfr_v1"].includes(
      migration.sourceMechanism,
    )
  ) {
    const refreshed = await refreshMigrationSourceAuthority(
      payload,
      migration,
      sourceRefreshModeForMigration(migration),
      deps,
    )
    migration = refreshed.migration
    if (refreshed.blocked) {
      return sourceAuthorityBlockedOutcome(migration, refreshed.blocked)
    }
    sourceEvidenceStale = false
  }
  if (
    sourceEvidenceStale &&
    migration.cloudflareZoneState === "not_started" &&
    !migration.providerCustomerHandle &&
    migration.providerTransferState === "not_started"
  ) {
    const actions = withAction(
      withAction(
        actionStates(migration.customerActions, now),
        "upload_complete_zone",
        "required",
        now,
        "source_evidence_stale",
      ),
      "provide_epp_code",
      "required",
      now,
      "source_evidence_stale",
    )
    migration = await updateMigration(payload, migration, {
      state: "awaiting_customer",
      sourceZoneHash: null,
      sourceZoneSnapshot: null,
      targetZoneHash: null,
      targetZoneSnapshot: null,
      rollbackEvidence: null,
      encryptedTransferCode: null,
      transferCodeDeletedAt: now,
      customerActions: actions,
      failureReason: "source_evidence_stale",
    }, "source_evidence_stale", now)
    return {
      outcome: "customer_action_required",
      result: waiting(
        migration,
        "The source evidence is stale and must be reacquired.",
      ),
    }
  }
  if (
    migration.transferCodeExpiresAt &&
    new Date(migration.transferCodeExpiresAt).getTime() <= new Date(now).getTime()
  ) {
    const actions = withAction(
      actionStates(migration.customerActions, now),
      "provide_epp_code",
      "required",
      now,
      "expired",
    )
    migration = await updateMigration(payload, migration, {
      state: "awaiting_customer",
      encryptedTransferCode: null,
      transferCodeDeletedAt: now,
      customerActions: actions,
      failureReason: "transfer_code_expired",
    }, "transfer_code_expired", now)
    return {
      outcome: "customer_action_required",
      result: waiting(
        migration,
        "The transfer code expired and must be replaced.",
      ),
    }
  }
  if (migration.state === "awaiting_customer") {
    migration = await updateMigration(payload, migration, {
      state: "ready_to_prepare",
      failureReason: null,
    }, "customer_actions_satisfied", now)
  }
  if (
    migration.state === "ready_to_prepare" &&
    migration.acceptedClassification === "assisted_standard" &&
    !migration.operatorWorkCompletedAt
  ) {
    const { pauseAcceptedAssistedMigration } = await import(
      "@/lib/domains/assistedMigration"
    )
    migration = await pauseAcceptedAssistedMigration(payload, migration)
    return {
      outcome: "waiting",
      result: waiting(
        migration,
        "Paid assisted migration is waiting for operator work.",
      ),
    }
  }
  if (migration.state === "ready_to_prepare") {
    migration = await updateMigration(payload, migration, {
      state: "preparing",
      failureReason: null,
    }, "automatic_migration_preparation_started", now)
  }
  return { outcome: "continue", migration, sourceEvidenceStale, now }
}

const validationContextBlockedOutcome = (
  result: MigrationResult,
): MigrationStoppedPhaseOutcome => ({
  outcome: result.status === "failed" ? "manual_review" : "waiting",
  result,
})

async function validateCapabilityFinancialAndDnssecContextPhase(
  payload: Payload,
  initialMigration: DomainMigration,
  sourceEvidenceStale: boolean,
  now: string,
  deps: MigrationDependencies,
): Promise<MigrationValidationContextPhaseOutcome> {
  let migration = initialMigration
  const order = await payload.findByID({
    collection: "orders",
    id: relationshipId(migration.originatingOrder) as string | number,
    depth: 0,
    overrideAccess: true,
  }) as Order
  const { capability } = migrationEvidenceFromOrder(order)
  if (!deps.transferContractEvidenceAllowed(capability)) {
    return validationContextBlockedOutcome(waiting(
      migration,
      `Incoming .${capability.tld} transfer remains disabled until DNSSEC and cutover contract evidence is complete.`,
    ))
  }
  const profile = await checkoutProfileForOrder(payload, order)
  const source = migrationSource(migration)
  const target = migrationTarget(migration)
  const managedDomain = await getOrCreateManagedDomain(
    payload,
    migration,
    order,
    profile,
    now,
  )
  if (!migration.managedDomain) {
    migration = await updateMigration(payload, migration, {
      managedDomain: managedDomain.id,
    }, "managed_domain_authority_linked", deps.now())
  }
  if (
    sourceEvidenceStale &&
    migration.providerTransferState === "not_started" &&
    migration.cloudflareZoneState !== "indeterminate"
  ) {
    return validationContextBlockedOutcome(
      await stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "source_evidence_stale_before_provider_write",
        deps.now(),
        "Frozen source evidence expired before provider preparation; reviewed fresh authority is required.",
      ),
    )
  }
  let actions = actionStates(migration.customerActions, deps.now())
  if (migration.providerTransferState === "not_started") {
    const parentDs = await deps.verifyParentDsAbsent(migration.domainNameAscii)
    if (parentDs.status === "indeterminate") {
      return validationContextBlockedOutcome(
        waiting(migration, "DNSSEC parent DS state could not be verified."),
      )
    }
    const frozenParentDs = source.dnssec.parentDsRecords
    const parentStateMatchesSource = source.dnssec.status === "signed"
      ? parentDs.status === "present" &&
        dsRecordsEqual(parentDs.records, frozenParentDs) &&
        parentDs.ttl === source.dnssec.parentDsTtl
      : parentDs.status === "absent"
    if (!parentStateMatchesSource) {
      return validationContextBlockedOutcome(
        await stopUnfulfillableMigrationBeforeRegistrarCommit(
          payload,
          migration,
          managedDomain,
          order,
          "dnssec_parent_state_changed_since_source_capture",
          deps.now(),
        ),
      )
    }
    if (!await verifyFrozenSourceDnssec(source, deps)) {
      return validationContextBlockedOutcome(waiting(
        migration,
        "Frozen source DNSSEC chain is not currently authenticated; transfer remains paused.",
      ))
    }
    const dnssecPlan = buildDnssecPreparationPlan({
      sourceStatus: source.dnssec.status,
      parentDsRecords: frozenParentDs,
      parentDsTtl: source.dnssec.parentDsTtl,
      dnsKeys: source.dnssec.dnsKeys,
      checkedAt: deps.now(),
    })
    actions = withAction(
      actions,
      "remove_dnssec_ds",
      "not_required",
      deps.now(),
      source.dnssec.status === "signed"
        ? "automatic_dnssec_transition"
        : "parent_ds_absent",
    )
    migration = await updateMigration(payload, migration, {
      dnssecPreparation: dnssecPlan,
      dnssecPhase: source.dnssec.status === "signed"
        ? "source_secure_preserved"
        : "source_unsigned",
      customerActions: actions,
    }, `dnssec_preparation_${parentDs.status}`, deps.now())
    if (!dnssecPlan.cutoverReady) {
      return validationContextBlockedOutcome(
        await stopUnfulfillableMigrationBeforeRegistrarCommit(
          payload,
          migration,
          managedDomain,
          order,
          "dnssec_source_evidence_incomplete",
          deps.now(),
        ),
      )
    }
  }
  return {
    outcome: "continue",
    migration,
    order,
    capability,
    profile,
    source,
    target,
    managedDomain,
    actions,
  }
}

const cloudflarePreparationBlockedOutcome = (
  migration: DomainMigration,
  result: MigrationResult,
): MigrationStoppedPhaseOutcome => ({
  outcome: result.status === "failed"
    ? "manual_review"
    : migration.reconciliationRequired
      ? "provider_reconciliation_required"
      : "waiting",
  result,
})

async function prepareCloudflareZoneAndSemanticRecordsPhase(
  payload: Payload,
  initialMigration: DomainMigration,
  initialManagedDomain: ManagedDomain,
  order: Order,
  target: ReturnType<typeof migrationTarget>,
  deps: MigrationDependencies,
): Promise<CloudflarePreparationPhaseOutcome> {
  let migration = initialMigration
  let managedDomain = initialManagedDomain
  const visibleZones = await deps.listCloudflareZones(migration.domainNameAscii)
  const persistedZone = migration.cloudflareZoneId
    ? visibleZones.filter((entry) => entry.id === migration.cloudflareZoneId)
    : []
  const zoneLookup = classifyCloudflareZoneLookup(
    migration.domainNameAscii,
    persistedZone.length > 0 ? persistedZone : visibleZones,
  )
  if (zoneLookup.outcome === "ambiguous") {
    return cloudflarePreparationBlockedOutcome(
      migration,
      await stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "cloudflare_zone_lookup_ambiguous",
        deps.now(),
        "Multiple exact Cloudflare zones match the migration authority.",
      ),
    )
  }
  let zone = zoneLookup.outcome === "exact" ? zoneLookup.zone : null
  if (!zone) {
    if (migration.cloudflareZoneState === "indeterminate") {
      if (
        providerWriteReconciliationTimedOut(
          migrationHistoryEventAt(
            migration,
            "cloudflare_zone_write_indeterminate",
          ),
          deps.now(),
        )
      ) {
        return cloudflarePreparationBlockedOutcome(
          migration,
          await stopMigrationForProviderManualReview(
            payload,
            migration,
            managedDomain,
            "cloudflare_zone_outcome_unresolved",
            deps.now(),
            "Cloudflare zone creation exceeded the reconciliation window.",
          ),
        )
      }
      return cloudflarePreparationBlockedOutcome(
        migration,
        waiting(migration, "Cloudflare zone creation remains indeterminate."),
      )
    }
    if (!deps.forwardProviderWritesAllowed()) {
      return cloudflarePreparationBlockedOutcome(
        migration,
        waiting(
          migration,
          "Cloudflare zone creation is prepared but forward provider writes are release-blocked.",
        ),
      )
    }
    migration = await updateMigration(payload, migration, {
      cloudflareZoneState: "prepared",
      reconciliationRequired: true,
    }, "cloudflare_zone_write_prepared", deps.now())
    try {
      zone = await deps.createOrReuseCloudflareZone(migration.domainNameAscii)
    } catch (error) {
      if (!(error instanceof CloudflareIndeterminateWriteError)) throw error
      migration = await updateMigration(payload, migration, {
        state: "awaiting_provider",
        cloudflareZoneState: "indeterminate",
        reconciliationRequired: true,
        failureReason: "cloudflare_zone_creation_indeterminate",
      }, "cloudflare_zone_write_indeterminate", deps.now())
      return cloudflarePreparationBlockedOutcome(
        migration,
        waiting(
          migration,
          "Cloudflare zone creation is awaiting reconciliation.",
        ),
      )
    }
  }
  const dnsWriteAwaitingReconciliation =
    migration.cloudflareZoneState === "indeterminate" &&
    migration.failureReason === "cloudflare_dns_write_indeterminate"
  const zoneCreationRecoveredByExactRead =
    migration.cloudflareZoneState === "indeterminate" &&
    migration.failureReason === "cloudflare_zone_creation_indeterminate"
  migration = await updateMigration(payload, migration, {
    cloudflareZoneId: zone.id,
    cloudflareNameservers: zone.nameServers,
    ...(zoneCreationRecoveredByExactRead
      ? { cloudflareZoneState: "prepared" }
      : {}),
    failureReason: dnsWriteAwaitingReconciliation
      ? migration.failureReason
      : null,
  }, "cloudflare_zone_reconciled", deps.now())
  let cloudflareRecords = await deps.listCloudflareMigrationDnsRecords(zone.id)
  let comparison = semanticZoneComparison(
    target.records,
    migrationZoneRecordsForComparison(cloudflareRecords, target.domain),
  )
  if (!comparison.equivalent && migration.cloudflareZoneState === "indeterminate") {
    if (
      providerWriteReconciliationTimedOut(
        migrationHistoryEventAt(migration, "cloudflare_dns_write_indeterminate"),
        deps.now(),
      )
    ) {
      return cloudflarePreparationBlockedOutcome(
        migration,
        await stopMigrationForProviderManualReview(
          payload,
          migration,
          managedDomain,
          "cloudflare_dns_outcome_unresolved",
          deps.now(),
          "Cloudflare DNS preparation exceeded the reconciliation window.",
        ),
      )
    }
    return cloudflarePreparationBlockedOutcome(
      migration,
      waiting(
        migration,
        "Cloudflare DNS write remains indeterminate; no duplicate records were sent.",
      ),
    )
  }
  if (!comparison.equivalent && cloudflareRecords.length > 0) {
    const unexpectedExisting = migrationZoneRecordsForComparison(
      cloudflareRecords,
      target.domain,
    ).some((record) =>
      semanticZoneComparison(target.records, [record]).unexpected.length > 0)
    if (unexpectedExisting) {
      const revocation = await revokeMigrationSourceAuthority(
        payload,
        migration,
        deps.now(),
      )
      migration = revocation.migration
      migration = await updateMigration(payload, migration, {
        state: "failed",
        semanticComparison: comparison,
        ...clearedMigrationCredentials(deps.now(), revocation.confirmed),
        ...(!revocation.confirmed
          ? { reconciliationRequired: true }
          : {}),
        failureReason: "cloudflare_zone_contains_unexpected_records",
      }, "automatic_zone_preparation_stopped", deps.now())
      return cloudflarePreparationBlockedOutcome(migration, {
        status: "failed",
        migrationId: migration.id,
        message: "Cloudflare already contains unexpected records; automatic migration stopped.",
      })
    }
  }
  if (!comparison.equivalent) {
    const usage = await deps.getCloudflareDnsRecordUsage(zone.id)
    const recordsStillRequired = comparison.missing.filter(
      (entry) => !entry.endsWith(":ttl"),
    ).length
    if (usage.recordUsage + recordsStillRequired > usage.recordQuota) {
      return cloudflarePreparationBlockedOutcome(
        migration,
        await stopUnfulfillableMigrationBeforeRegistrarCommit(
          payload,
          migration,
          managedDomain,
          order,
          "cloudflare_dns_capacity_insufficient",
          deps.now(),
        ),
      )
    }
  }
  if (!comparison.equivalent) {
    if (!deps.forwardProviderWritesAllowed()) {
      return cloudflarePreparationBlockedOutcome(
        migration,
        waiting(
          migration,
          "Cloudflare DNS preparation is ready but forward provider writes are release-blocked.",
        ),
      )
    }
    try {
      for (const record of target.records) {
        await deps.createOrReuseCloudflareMigrationDnsRecord(zone.id, record)
      }
    } catch (error) {
      if (!(error instanceof CloudflareIndeterminateWriteError)) throw error
      migration = await updateMigration(payload, migration, {
        state: "awaiting_provider",
        cloudflareZoneState: "indeterminate",
        reconciliationRequired: true,
        failureReason: "cloudflare_dns_write_indeterminate",
      }, "cloudflare_dns_write_indeterminate", deps.now())
      return cloudflarePreparationBlockedOutcome(
        migration,
        waiting(
          migration,
          "Cloudflare DNS preparation is awaiting reconciliation.",
        ),
      )
    }
    cloudflareRecords = await deps.listCloudflareMigrationDnsRecords(zone.id)
    comparison = semanticZoneComparison(
      target.records,
      migrationZoneRecordsForComparison(cloudflareRecords, target.domain),
    )
  }
  if (!comparison.equivalent) {
    return cloudflarePreparationBlockedOutcome(
      migration,
      waiting(migration, "Cloudflare target zone is not semantically complete."),
    )
  }
  migration = await updateMigration(payload, migration, {
    cloudflareZoneState: "confirmed",
    cloudflareRecordIds: cloudflareRecords.map((entry) => entry.id).filter(Boolean),
    zonePreparedAt: deps.now(),
    semanticComparison: comparison,
    reconciliationRequired: false,
    failureReason: null,
  }, "cloudflare_target_zone_semantically_verified", deps.now())
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    cloudflareZoneId: zone.id,
    cloudflareNameservers: zone.nameServers,
    cloudflareZoneStatus: zone.status,
    cloudflareDnsRecordIds: [...new Set([
      ...stringIds(managedDomain.cloudflareDnsRecordIds),
      ...cloudflareRecords
        .map((entry) => entry.id)
        .filter((id): id is string => Boolean(id)),
    ])],
    reconciliationRequired: managedDomain.edgeRoutingStatus !== "active",
  }, "migration_edge_zone_linked", deps.now())
  return { outcome: "continue", migration, managedDomain, zone }
}

const evaluateEdgeReadinessPhase = (
  managedDomain: ManagedDomain,
): EdgeReadinessPhaseOutcome => {
  if (managedDomain.edgeRoutingStatus === "failed") {
    return {
      outcome: "failed",
      failureReason: "automatic_edge_routing_conflict",
    }
  }
  if (
    managedDomain.edgeRoutingStatus !== "configured" &&
    managedDomain.edgeRoutingStatus !== "active"
  ) {
    return {
      outcome: "waiting",
      message:
        "Automatic website and administration routing is being prepared before transfer.",
    }
  }
  return {
    outcome: "continue",
    status: managedDomain.edgeRoutingStatus,
  }
}

const openProviderCustomerPreparationBlockedOutcome = (
  migration: DomainMigration,
  result: MigrationResult,
): MigrationStoppedPhaseOutcome => ({
  outcome: result.status === "failed"
    ? "manual_review"
    : migration.reconciliationRequired
      ? "provider_reconciliation_required"
      : "waiting",
  result,
})

async function prepareOpenProviderCustomerPhase(
  payload: Payload,
  initialMigration: DomainMigration,
  initialManagedDomain: ManagedDomain,
  profile: CheckoutProfile,
  deps: MigrationDependencies,
): Promise<OpenProviderCustomerPreparationPhaseOutcome> {
  let migration = initialMigration
  let managedDomain = initialManagedDomain
  const token = await deps.loginOpenProvider()
  let customerHandle = migration.providerCustomerHandle ?? null
  if (!customerHandle) {
    let existingCustomer: Awaited<
      ReturnType<MigrationDependencies["findOpenProviderCustomerByReference"]>
    >
    try {
      existingCustomer = await deps.findOpenProviderCustomerByReference(
        migration.idempotencyKey,
        { token },
      )
    } catch (error) {
      if (!(error instanceof OpenProviderAmbiguousCustomerReferenceLookupError)) {
        throw error
      }
      return openProviderCustomerPreparationBlockedOutcome(
        migration,
        await stopMigrationForProviderManualReview(
          payload,
          migration,
          managedDomain,
          "openprovider_customer_reference_ambiguous",
          deps.now(),
          "Multiple exact Openprovider customers match the migration reference.",
        ),
      )
    }
    if (existingCustomer) {
      customerHandle = existingCustomer.handle
    } else if (
      migration.providerTransferState === "indeterminate" &&
      migrationHistoryEventAt(
        migration,
        "openprovider_customer_handle_indeterminate",
      )
    ) {
      if (
        providerWriteReconciliationTimedOut(
          migrationHistoryEventAt(
            migration,
            "openprovider_customer_handle_indeterminate",
          ),
          deps.now(),
        )
      ) {
        return openProviderCustomerPreparationBlockedOutcome(
          migration,
          await stopMigrationForProviderManualReview(
            payload,
            migration,
            managedDomain,
            "openprovider_customer_handle_outcome_unresolved",
            deps.now(),
            "Openprovider customer creation exceeded the reconciliation window.",
          ),
        )
      }
      return openProviderCustomerPreparationBlockedOutcome(
        migration,
        waiting(migration, "Customer-handle creation remains indeterminate."),
      )
    } else {
      if (!deps.forwardProviderWritesAllowed()) {
        return openProviderCustomerPreparationBlockedOutcome(
          migration,
          waiting(
            migration,
            "Registrant preparation is ready but forward provider writes are release-blocked.",
          ),
        )
      }
      try {
        customerHandle = (await deps.createOpenProviderCustomerHandle(
          domainRegistrantFromCheckoutProfile(profile),
          { token, reference: migration.idempotencyKey },
        )).handle
      } catch (error) {
        if (!(error instanceof OpenProviderIndeterminateWriteError)) throw error
        migration = await updateMigration(payload, migration, {
          state: "awaiting_provider",
          providerTransferState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_customer_handle_indeterminate",
        }, "openprovider_customer_handle_indeterminate", deps.now())
        return openProviderCustomerPreparationBlockedOutcome(
          migration,
          waiting(
            migration,
            "Customer-handle creation is awaiting reconciliation.",
          ),
        )
      }
    }
    migration = await updateMigration(payload, migration, {
      providerCustomerHandle: customerHandle,
      providerTransferState: "not_started",
      reconciliationRequired: false,
      failureReason: null,
    }, "provider_customer_handle_persisted", deps.now())
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      providerCustomerHandle: customerHandle,
    }, "provider_customer_handle_persisted", deps.now())
  }
  return {
    outcome: "continue",
    migration,
    managedDomain,
    token,
    customerHandle,
  }
}

export async function prepareDomainMigration(
  payload: Payload,
  migrationId: string | number,
  dependencies: Partial<MigrationDependencies> = {},
): Promise<MigrationResult> {
  const deps = { ...defaultDependencies, ...dependencies }
  const loadOutcome = await loadAndClassifyMigrationPhase(
    payload,
    migrationId,
    deps,
  )
  if (loadOutcome.outcome !== "continue") return loadOutcome.result
  const sourceAuthorityOutcome =
    await refreshSourceAuthorityAndCustomerReadinessPhase(
      payload,
      loadOutcome.migration,
      deps,
    )
  if (sourceAuthorityOutcome.outcome !== "continue") {
    return sourceAuthorityOutcome.result
  }
  const sourceEvidenceStale = sourceAuthorityOutcome.sourceEvidenceStale
  const validationContextOutcome =
    await validateCapabilityFinancialAndDnssecContextPhase(
      payload,
      sourceAuthorityOutcome.migration,
      sourceEvidenceStale,
      sourceAuthorityOutcome.now,
      deps,
    )
  if (validationContextOutcome.outcome !== "continue") {
    return validationContextOutcome.result
  }
  let migration = validationContextOutcome.migration
  const order = validationContextOutcome.order
  const capability = validationContextOutcome.capability
  const profile = validationContextOutcome.profile
  const source = validationContextOutcome.source
  const target = validationContextOutcome.target
  let managedDomain = validationContextOutcome.managedDomain
  let actions = validationContextOutcome.actions

  const cloudflarePreparationOutcome =
    await prepareCloudflareZoneAndSemanticRecordsPhase(
      payload,
      migration,
      managedDomain,
      order,
      target,
      deps,
    )
  if (cloudflarePreparationOutcome.outcome !== "continue") {
    return cloudflarePreparationOutcome.result
  }
  migration = cloudflarePreparationOutcome.migration
  managedDomain = cloudflarePreparationOutcome.managedDomain
  const zone = cloudflarePreparationOutcome.zone
  const edgeReadinessOutcome = evaluateEdgeReadinessPhase(managedDomain)
  if (edgeReadinessOutcome.outcome === "failed") {
    return stopUnfulfillableMigrationBeforeRegistrarCommit(
      payload,
      migration,
      managedDomain,
      order,
      edgeReadinessOutcome.failureReason,
      deps.now(),
    )
  }
  if (edgeReadinessOutcome.outcome === "waiting") {
    await queueCommerceReconciliation(payload)
    return waiting(migration, edgeReadinessOutcome.message)
  }
  if (
    sourceEvidenceStale &&
    migration.providerTransferState === "not_started"
  ) {
    return stopMigrationForProviderManualReview(
      payload,
      migration,
      managedDomain,
      "source_evidence_stale_before_provider_write",
      deps.now(),
      "Frozen source evidence expired before provider preparation; reviewed fresh authority is required.",
    )
  }

  const customerPreparationOutcome = await prepareOpenProviderCustomerPhase(
    payload,
    migration,
    managedDomain,
    profile,
    deps,
  )
  if (customerPreparationOutcome.outcome !== "continue") {
    return customerPreparationOutcome.result
  }
  migration = customerPreparationOutcome.migration
  managedDomain = customerPreparationOutcome.managedDomain
  const token = customerPreparationOutcome.token
  const customerHandle = customerPreparationOutcome.customerHandle

  let providerDomain: Awaited<
    ReturnType<MigrationDependencies["findOpenProviderDomain"]>
  >
  try {
    providerDomain = await deps.findOpenProviderDomain(
      migration.domainNameAscii,
      { token },
    )
  } catch (error) {
    if (!(error instanceof OpenProviderAmbiguousDomainLookupError)) throw error
    if (migration.providerTransferState !== "not_started") {
      return pauseMigrationForRegistrarAmbiguity(
        payload,
        migration,
        managedDomain,
        deps.now(),
      )
    }
    return stopMigrationForProviderManualReview(
      payload,
      migration,
      managedDomain,
      "openprovider_domain_lookup_ambiguous",
      deps.now(),
      "Multiple exact Openprovider domains match the migration authority.",
    )
  }
  if (
    providerDomain &&
    (
      migration.failureReason === "openprovider_domain_lookup_ambiguous" ||
      managedDomain.failureReason === "openprovider_domain_lookup_ambiguous"
    )
  ) {
    await resolveCommerceAdminException({
      payload,
      source: "domains",
      code: "openprovider_domain_lookup_ambiguous",
      subjectId: migration.id,
      now: deps.now(),
    })
    migration = await updateMigration(payload, migration, {
      failureReason: null,
      reconciliationRequired: true,
    }, "openprovider_domain_lookup_ambiguity_resolved", deps.now())
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      state: "transfer_pending",
      entitlementStatus: "pending",
      customerStatus: "provisioning",
      reconciliationRequired: true,
      failureReason: null,
    }, "openprovider_domain_lookup_ambiguity_resolved", deps.now())
  }
  if (!providerDomain) {
    if (
      migration.providerTransferState === "prepared" &&
      !migration.providerTransferId &&
      providerWriteClaimLeaseElapsed(migration.transferRequestedAt, deps.now())
    ) {
      return stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "provider_transfer_dispatch_unknown",
        deps.now(),
        "Transfer dispatch is unresolved; the provider operation must not be repeated.",
      )
    }
    if (
      (
        migration.providerTransferState === "indeterminate" ||
        (
          migration.providerTransferState === "prepared" &&
          Boolean(migration.providerTransferId)
        )
      ) &&
      providerWriteReconciliationTimedOut(
        migration.transferRequestedAt,
        deps.now(),
      )
    ) {
      return stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "provider_transfer_outcome_unresolved",
        deps.now(),
        "Transfer provider outcome exceeded the reconciliation window.",
      )
    }
    if (
      migration.providerTransferState === "indeterminate" ||
      (
        migration.providerTransferState === "prepared" &&
        (
          migration.providerTransferId ||
          !providerWriteClaimLeaseElapsed(migration.transferRequestedAt, deps.now())
        )
      )
    ) {
      return waiting(migration, "Domain transfer outcome awaits reconciliation; no retry was sent.")
    }
    if (
      ["cloudflare_api_v1", "authorized_axfr_v1"].includes(
        migration.sourceMechanism,
      )
    ) {
      const refreshed = await refreshMigrationSourceAuthority(
        payload,
        migration,
        "exact_authority",
        deps,
      )
      migration = refreshed.migration
      if (refreshed.blocked) return refreshed.blocked
    } else if (sourceEvidenceStale) {
      return stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "source_evidence_stale_before_transfer",
        deps.now(),
        "Frozen source evidence expired before transfer; reviewed fresh authority is required.",
      )
    }
    const transferParentDs = await deps.verifyParentDsAbsent(migration.domainNameAscii)
    if (transferParentDs.status === "indeterminate") {
      return waiting(migration, "DNSSEC parent state could not be reverified before transfer.")
    }
    const transferParentStateMatches = source.dnssec.status === "signed"
      ? transferParentDs.status === "present" &&
        dsRecordsEqual(transferParentDs.records, source.dnssec.parentDsRecords) &&
        transferParentDs.ttl === source.dnssec.parentDsTtl
      : transferParentDs.status === "absent"
    if (!transferParentStateMatches) {
      return stopUnfulfillableMigrationBeforeRegistrarCommit(
        payload,
        migration,
        managedDomain,
        order,
        "dnssec_parent_state_changed_before_transfer",
        deps.now(),
      )
    }
    if (!await verifyFrozenSourceDnssec(source, deps)) {
      return waiting(
        migration,
        "Source DNSSEC chain could not be reauthenticated immediately before transfer.",
      )
    }
    const transferResult = await withCommerceOrderLock(
      payload,
      order.id,
      async (): Promise<MigrationResult | null> => {
        const paymentAuthority = await loadSecuredInitialPaymentAuthority(
          payload,
          order.id,
        )
        if (
          !paymentAuthority.secured ||
          paymentAuthority.order.state !== "fulfillment_pending"
        ) {
          return stopMigrationForRevokedPaymentBeforeRegistrarCommit(
            payload,
            migration,
            managedDomain,
            paymentAuthority.order,
            deps.now(),
          )
        }
        if (!deps.forwardProviderWritesAllowed()) {
          return waiting(
            migration,
            "Domain transfer is prepared but forward provider writes are release-blocked.",
          )
        }
        migration = await updateMigration(payload, migration, {
          providerTransferState: "prepared",
          transferRequestedAt: deps.now(),
          reconciliationRequired: true,
        }, "provider_transfer_write_prepared", deps.now())
        const encryptedTransferCode = migration.encryptedTransferCode
        if (!encryptedTransferCode) {
          return waiting(migration, "The encrypted transfer code is no longer available.")
        }
        const transferCode = openMigrationSecret(
          encryptedTransferCode,
          migration.idempotencyKey,
        )
        try {
          const transfer = await deps.transferOpenProviderDomain(migration.domainNameAscii, {
            token,
            authCode: transferCode,
            ownerHandle: customerHandle,
            nameServers: source.authoritativeNameservers.map((name) => ({ name })),
            dnssecKeys: source.dnssec.status === "signed"
              ? sourceDnskeys(source)
              : undefined,
            autorenew: transferAutorenewMode(capability),
            reference: migration.idempotencyKey,
            acceptedCapabilityVersion: capability.capabilityVersion,
          })
          actions = transferConfirmationAction(
            actionStates(migration.customerActions, deps.now()),
            capability,
            "required",
            deps.now(),
          )
          migration = await updateMigration(payload, migration, {
            providerTransferId: String(transfer.id),
            customerActions: actions,
          }, `provider_transfer_${transfer.status}`, deps.now())
        } catch (error) {
          try {
            providerDomain = await deps.findOpenProviderDomain(migration.domainNameAscii, { token })
          } catch {
            // The prepared write remains authoritative until reconciliation succeeds.
          }
          if (!providerDomain && error instanceof OpenProviderIndeterminateWriteError) {
            actions = transferConfirmationAction(
              actionStates(migration.customerActions, deps.now()),
              capability,
              "required",
              deps.now(),
            )
            migration = await updateMigration(payload, migration, {
              state: "awaiting_provider",
              providerTransferState: "indeterminate",
              customerActions: actions,
              reconciliationRequired: true,
              failureReason: "openprovider_transfer_indeterminate",
            }, "provider_transfer_indeterminate", deps.now())
            return waiting(migration, "Domain transfer is awaiting provider reconciliation.")
          }
          if (!providerDomain && providerRejectedTransferAuthorization(error)) {
            actions = withAction(
              actionStates(migration.customerActions, deps.now()),
              "provide_epp_code",
              "failed",
              deps.now(),
              "provider_rejected_authorization",
            )
            migration = await updateMigration(payload, migration, {
              state: "awaiting_customer",
              providerTransferState: "not_started",
              encryptedTransferCode: null,
              transferCodeDeletedAt: deps.now(),
              customerActions: actions,
              reconciliationRequired: false,
              failureReason: "provider_rejected_transfer_authorization",
            }, "provider_rejected_transfer_authorization", deps.now())
            return waiting(migration, "The provider rejected the transfer authorization.")
          }
          if (
            !providerDomain &&
            error instanceof OpenProviderApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return stopMigrationForProviderManualReview(
              payload,
              migration,
              managedDomain,
              "openprovider_transfer_rejected_non_authorization",
              deps.now(),
              "The provider rejected a paid transfer for immediate operator review.",
            )
          }
          if (!providerDomain) throw error
        }
        providerDomain ??= await deps.findOpenProviderDomain(
          migration.domainNameAscii,
          { token },
        )
        return null
      },
    )
    if (transferResult) return transferResult
  }
  if (!providerDomain || !activeProviderDomain(
    providerDomain,
    capability.transfer.confirmation.activeStatuses,
  )) {
    const currentConfirmationStatus = actions.confirm_transfer.status
    const confirmationNeedsUpdate =
      nextTransferConfirmationStatus(
        currentConfirmationStatus,
        capability,
        true,
      ) !== currentConfirmationStatus
    if (migration.state === "preparing" || confirmationNeedsUpdate) {
      actions = transferConfirmationAction(
        actions,
        capability,
        "required",
        deps.now(),
      )
      migration = await updateMigration(payload, migration, {
        state: "awaiting_provider",
        customerActions: actions,
      }, "provider_transfer_processing", deps.now())
    }
    const requestedAt = migration.transferRequestedAt
      ? new Date(migration.transferRequestedAt).getTime()
      : Number.NaN
    const maximumWaitMs =
      Math.max(1, capability.transfer.maximumExpectedWaitDays) *
      24 * 60 * 60 * 1_000
    if (
      Number.isFinite(requestedAt) &&
      new Date(deps.now()).getTime() - requestedAt >= maximumWaitMs
    ) {
      if (migration.failureReason !== "provider_transfer_sla_exceeded") {
        migration = await updateMigration(payload, migration, {
          state: "awaiting_provider",
          failureReason: "provider_transfer_sla_exceeded",
          reconciliationRequired: true,
        }, "provider_transfer_sla_exceeded", deps.now())
      }
      await recordCommerceAdminException({
        payload,
        source: "domains",
        code: "provider_transfer_sla_exceeded",
        message:
          "The registrar transfer exceeded the governed TLD waiting window; automated polling continues without repeating the transfer write.",
        tenant: managedDomain.tenant,
        subjectId: migration.id,
        severity: "error",
        now: deps.now(),
      })
    }
    return waiting(migration, "Openprovider is still processing the domain transfer.")
  }
  await resolveCommerceAdminException({
    payload,
    source: "domains",
    code: "provider_transfer_sla_exceeded",
    subjectId: migration.id,
    now: deps.now(),
  })
  if (migration.failureReason === "provider_transfer_sla_exceeded") {
    migration = await updateMigration(payload, migration, {
      failureReason: null,
      reconciliationRequired: false,
    }, "provider_transfer_completed_after_sla", deps.now())
  }
  if (providerDomain.ownerHandle !== customerHandle) {
    return stopMigrationForProviderManualReview(
      payload,
      migration,
      managedDomain,
      "provider_domain_owner_mismatch",
      deps.now(),
      "Transferred domain ownership differs from the accepted customer registrant.",
    )
  }
  if (
    migration.cutoverWriteState === "not_started" &&
    !nameserversEqual(providerDomain.nameServers, source.authoritativeNameservers)
  ) {
    return rollbackCutover(
      payload,
      migration,
      managedDomain,
      providerDomain,
      "transfer_did_not_retain_old_nameservers",
      deps,
    )
  }
  const postTransferPayment = await loadSecuredInitialPaymentAuthority(
    payload,
    order.id,
  )
  if (!postTransferPayment.secured) {
    return stopMigrationForRevokedPaymentAfterRegistrarCommit(
      payload,
      migration,
      managedDomain,
      postTransferPayment.order,
      deps.now(),
    )
  }
  const registrantVerification = migrationRegistrantVerification(providerDomain)
  const storedVerification = storedRegistrantVerification(
    registrantVerification,
    managedDomain.registrantVerificationStatus,
  )
  const projectedRegistrantVerification = storedVerification.status
  const verificationActionRequired = storedVerification.customerActionRequired
  actions = actionStates(migration.customerActions, deps.now())
  actions = withAction(
    withAction(
      actions,
      "confirm_transfer",
      capability.transfer.customerConfirmation === "none"
        ? "not_required"
        : "completed",
      deps.now(),
      capability.transfer.customerConfirmation === "none"
        ? "tld_confirmation_not_required"
        : "provider_domain_active",
    ),
    "verify_registrant",
    verificationActionRequired
      ? registrantVerification === "pending" ? "required" : "failed"
      : "completed",
    deps.now(),
    providerDomain.verificationEmailDescription ?? registrantVerification,
  )
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    providerDomainId: String(providerDomain.id),
    providerRegistrationState: "confirmed",
    registrantVerificationStatus: projectedRegistrantVerification,
    registrantVerificationCheckedAt: deps.now(),
    registrantVerificationDueAt: normalizeOpenProviderTimestamp(
      providerDomain.verificationEmailExpiresAt,
    ) ?? managedDomain.registrantVerificationDueAt,
    registrantVerificationRecoveredAt: storedVerification.recovered
      ? deps.now()
      : undefined,
    registrantVerificationDescription: providerDomain.verificationEmailDescription,
    providerAutorenew: providerDomain.autorenew,
    providerAutorenewCheckedAt: deps.now(),
    expiresAt: normalizeOpenProviderTimestamp(providerDomain.renewalDate),
    providerRenewalDate: normalizeOpenProviderTimestamp(providerDomain.renewalDate),
    registryExpiryDate: normalizeOpenProviderTimestamp(providerDomain.registryExpiryDate),
    reconciliationRequired: verificationActionRequired,
  }, "provider_transfer_reconciled", deps.now())
  migration = await updateMigration(payload, migration, {
    providerTransferState: "confirmed",
    providerDomainId: String(providerDomain.id),
    transferConfirmedAt: migration.transferConfirmedAt ?? deps.now(),
    encryptedTransferCode: null,
    transferCodeDeletedAt: migration.transferCodeDeletedAt ?? deps.now(),
    customerActions: actions,
    reconciliationRequired: verificationActionRequired,
    failureReason: verificationActionRequired
      ? `registrant_verification_${projectedRegistrantVerification}`
      : null,
  }, `registrant_verification_${registrantVerification}`, deps.now())
  if (["overdue", "suspended", "failed"].includes(projectedRegistrantVerification)) {
    await recordCommerceAdminException({
      payload,
      source: "domains",
      code: `registrant_verification_${projectedRegistrantVerification}`,
      message: "Provider-reported registrant verification blocks the domain migration.",
      tenant: managedDomain.tenant,
      subjectId: migration.id,
      severity: projectedRegistrantVerification === "suspended" ? "critical" : "error",
      now: deps.now(),
    })
  }
  if (verificationActionRequired) {
    if (["cutover_in_progress", "verifying"].includes(migration.state)) {
      return rollbackCutover(
        payload,
        migration,
        managedDomain,
        providerDomain,
        `registrant_verification_${projectedRegistrantVerification}_after_cutover`,
        deps,
      )
    }
    migration = await updateMigration(payload, migration, {
      state: "awaiting_provider",
      reconciliationRequired: true,
    }, registrantVerification === "pending"
      ? "registrant_verification_required"
      : "registrant_verification_customer_action_required", deps.now())
    return waiting(
      migration,
      registrantVerification === "pending"
        ? "Customer registrant verification is required before cutover."
      : "Registrant verification still requires customer action; cutover remains paused.",
    )
  }
  const dnssecCutover = await prepareDnssecForCutover(
    payload,
    migration,
    managedDomain,
    providerDomain,
    source,
    token,
    deps,
  )
  migration = dnssecCutover.migration
  providerDomain = dnssecCutover.providerDomain
  if (dnssecCutover.result) return dnssecCutover.result
  if (migration.state === "preparing" || migration.state === "awaiting_provider") {
    migration = await updateMigration(payload, migration, {
      state: "ready_for_cutover",
    }, "migration_ready_for_cutover", deps.now())
  }

  if (
    migration.rollbackRequestedAt ||
    migration.rollbackWriteState !== "not_started"
  ) {
    return rollbackCutover(
      payload,
      migration,
      managedDomain,
      providerDomain,
      migration.failureReason ?? "automatic_rollback_reconciliation",
      deps,
    )
  }

  if (!nameserversEqual(providerDomain.nameServers, zone.nameServers)) {
    if (
      migration.cutoverWriteState === "indeterminate" &&
      migration.verificationDeadlineAt &&
      Date.parse(deps.now()) >= Date.parse(migration.verificationDeadlineAt)
    ) {
      return rollbackCutover(
        payload,
        migration,
        managedDomain,
        providerDomain,
        "cutover_provider_outcome_unresolved",
        deps,
      )
    }
    if (
      migration.cutoverWriteState === "indeterminate" ||
      (
        migration.cutoverWriteState === "prepared" &&
        !providerWriteClaimLeaseElapsed(migration.cutoverRequestedAt, deps.now())
      )
    ) {
      return waiting(migration, "Nameserver cutover outcome awaits reconciliation.")
    }
    if (
      ["cloudflare_api_v1", "authorized_axfr_v1"].includes(
        migration.sourceMechanism,
      )
    ) {
      const refreshed = await refreshMigrationSourceAuthority(
        payload,
        migration,
        sourceRefreshModeForMigration(migration),
        deps,
      )
      migration = refreshed.migration
      if (refreshed.blocked) return refreshed.blocked
    } else if (sourceEvidenceStale) {
      return stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "source_evidence_stale_before_cutover",
        deps.now(),
        "Frozen source evidence expired before nameserver cutover; reviewed fresh authority is required.",
      )
    }
    if (!deps.forwardProviderWritesAllowed()) {
      return waiting(
        migration,
        "Nameserver cutover is prepared but forward provider writes are release-blocked.",
      )
    }
    migration = await updateMigration(payload, migration, {
      state: "cutover_in_progress",
      cutoverWriteState: "prepared",
      cutoverRequestedAt: deps.now(),
      verificationDeadlineAt: migration.verificationDeadlineAt ?? new Date(
        new Date(deps.now()).getTime() + CUTOVER_VERIFICATION_MINUTES * 60_000,
      ).toISOString(),
      reconciliationRequired: true,
    }, "nameserver_cutover_write_prepared", deps.now())
    try {
      await deps.updateOpenProviderDomainNameservers(
        providerDomain.id,
        zone.nameServers.map((name) => ({ name })),
        { token },
      )
      migration = await updateMigration(payload, migration, {
        cutoverWriteState: "indeterminate",
        reconciliationRequired: true,
      }, "nameserver_cutover_write_dispatched", deps.now())
    } catch (error) {
      if (!(error instanceof OpenProviderIndeterminateWriteError)) throw error
      migration = await updateMigration(payload, migration, {
        cutoverWriteState: "indeterminate",
        reconciliationRequired: true,
        failureReason: "openprovider_cutover_indeterminate",
      }, "nameserver_cutover_indeterminate", deps.now())
      return waiting(migration, "Nameserver cutover is awaiting provider reconciliation.")
    }
    providerDomain = await deps.findOpenProviderDomain(migration.domainNameAscii, { token }) ??
      providerDomain
    if (!nameserversEqual(providerDomain.nameServers, zone.nameServers)) {
      return waiting(migration, "Openprovider has not confirmed the Cloudflare nameservers yet.")
    }
  }
  if (migration.state === "ready_for_cutover") {
    migration = await updateMigration(payload, migration, {
      state: "cutover_in_progress",
      cutoverRequestedAt: migration.cutoverRequestedAt ?? deps.now(),
      verificationDeadlineAt: migration.verificationDeadlineAt ?? new Date(
        new Date(deps.now()).getTime() + CUTOVER_VERIFICATION_MINUTES * 60_000,
      ).toISOString(),
    }, "nameserver_cutover_reconciled", deps.now())
  }
  migration = await updateMigration(payload, migration, {
    state: "verifying",
    cutoverWriteState: "confirmed",
    cutoverConfirmedAt: migration.cutoverConfirmedAt ?? deps.now(),
    reconciliationRequired: true,
  }, "post_cutover_verification_started", deps.now())

  const postCutoverRecords = await deps.listCloudflareMigrationDnsRecords(zone.id)
  const postCutoverComparison = semanticZoneComparison(
    target.records,
    migrationZoneRecordsForComparison(postCutoverRecords, target.domain),
  )
  const authoritativeDns = await deps.verifyAuthoritativeDns(
    migration.domainNameAscii,
    zone.nameServers,
  )
  const preservedRecords = target.records.filter((record) =>
    !["A", "AAAA", "CNAME"].includes(record.type) ||
    (record.name !== target.domain && record.name !== `www.${target.domain}`),
  )
  const preservedDns = await deps.verifyPreservedDnsRecords(
    preservedRecords,
    zone.nameServers,
  )
  const edgeReady =
    managedDomain.edgeRoutingStatus === "active" &&
    managedDomain.httpsStatus === "verified" &&
    managedDomain.adminHttpsStatus === "verified"
  const https = edgeReady
    ? { status: "verified" as const, httpStatus: 200, reason: null }
    : {
        status: "pending" as const,
        httpStatus: null,
        reason: "automatic_edge_routing_pending",
      }
  const verification = {
    checkedAt: deps.now(),
    semanticZone: postCutoverComparison,
    authoritativeDns,
    preservedDns,
    cloudflareSsl: {
      status: edgeReady ? "active" : "pending",
      providerStatuses: [],
    },
    https,
    edgeRouting: {
      status: managedDomain.edgeRoutingStatus,
      adminHttpsStatus: managedDomain.adminHttpsStatus,
      checkedAt: managedDomain.edgeRoutingCheckedAt,
    },
    preservedRecordCount: preservedRecords.length,
  }
  migration = await updateMigration(payload, migration, {
    postCutoverVerification: verification,
  }, "post_cutover_verification_recorded", deps.now())
  const verified = postCutoverComparison.equivalent &&
    authoritativeDns.status === "verified" &&
    preservedDns.status === "verified" &&
    edgeReady
  if (!verified) {
    const deadlineReached = migration.verificationDeadlineAt
      ? new Date(deps.now()).getTime() >= new Date(migration.verificationDeadlineAt).getTime()
      : false
    if (!deadlineReached && postCutoverComparison.equivalent) {
      await queueCommerceReconciliation(payload)
      return waiting(migration, "Cutover propagation and HTTPS verification are still pending.")
    }
    return rollbackCutover(
      payload,
      migration,
      managedDomain,
      providerDomain,
      postCutoverComparison.equivalent
        ? "post_cutover_verification_deadline_exceeded"
        : "post_cutover_zone_semantic_mismatch",
      deps,
    )
  }

  const targetDnssec = await secureTargetDnssec(
    payload,
    migration,
    managedDomain,
    providerDomain,
    zone.id,
    token,
    deps,
  )
  migration = targetDnssec.migration
  providerDomain = targetDnssec.providerDomain
  if (targetDnssec.result) return targetDnssec.result
  if (!providerDomain) {
    return waiting(
      migration,
      "Transferred domain authority awaits provider reconciliation before publication.",
    )
  }
  const publicationProviderDomain = providerDomain

  return withCommerceOrderLock(payload, order.id, async () => {
    const prePublicationPayment = await loadSecuredInitialPaymentAuthority(
      payload,
      order.id,
    )
    if (!prePublicationPayment.secured) {
      return stopMigrationForRevokedPaymentAfterRegistrarCommit(
        payload,
        migration,
        managedDomain,
        prePublicationPayment.order,
        deps.now(),
      )
    }

    const tenant = await payload.update({
    collection: "tenants",
    id: relationshipId(migration.tenant) as string | number,
    data: {
      domain: migration.domainNameAscii,
      domainVerification: {
        status: "verified",
        checkedAt: deps.now(),
        notes: "Automatic migration verified complete semantic zone preservation, authoritative DNS, and HTTPS.",
      },
    },
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  const generationRunId = relationshipId(order.generationRun)
  if (!generationRunId) {
    return rollbackCutover(
      payload,
      migration,
      managedDomain,
      publicationProviderDomain,
      "migration_order_generation_run_missing",
      deps,
    )
  }
  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: generationRunId,
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun
  if (!sameRelationshipId(run.tenant, tenant.id)) {
    return rollbackCutover(
      payload,
      migration,
      managedDomain,
      publicationProviderDomain,
      "migration_order_tenant_mismatch",
      deps,
    )
  }
  const activation = await deps.publishAndActivateAfterCompletedPayment(payload, run)
  if (activation.status !== "activated") {
    return rollbackCutover(
      payload,
      migration,
      managedDomain,
      publicationProviderDomain,
      `approved_snapshot_activation_failed:${activation.message}`,
      deps,
    )
  }
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    authoritativeDnsStatus: "verified",
    authoritativeDnsCheckedAt: deps.now(),
    authoritativeDnsEvidence: authoritativeDns,
    httpsStatus: "verified",
    httpsCheckedAt: deps.now(),
    httpsEvidence: https,
    cloudflareZoneId: zone.id,
    cloudflareNameservers: zone.nameServers,
    cloudflareZoneStatus: zone.status,
    transferredAt: managedDomain.transferredAt ?? deps.now(),
    reconciliationRequired: false,
    failureReason: null,
  }, "migration_cutover_verified", deps.now())
  managedDomain = await deps.activateManagedDomainEntitlement(payload, managedDomain, deps.now())
  const revocation = await revokeMigrationSourceAuthority(
    payload,
    migration,
    deps.now(),
  )
  migration = revocation.migration
  migration = await updateMigration(payload, migration, {
    state: "completed",
    completedAt: deps.now(),
    ...clearedMigrationCredentials(deps.now(), revocation.confirmed),
    reconciliationRequired: !revocation.confirmed,
    failureReason: null,
  }, "automatic_migration_completed", deps.now())
  await payload.update({
    collection: "orders",
    id: order.id,
    data: { state: "fulfilled" },
    depth: 0,
    overrideAccess: true,
    context: { legalOrderLifecycleMutation: true },
  })
    return {
      status: "completed",
      migrationId: migration.id,
      message: "Automatic existing-domain migration completed.",
    }
  })
}
