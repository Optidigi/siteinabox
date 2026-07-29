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
import { recordCommerceAdminException } from "@/lib/commerce/alerts"
import { commerceProviderWritesAllowed } from "@/lib/commerce/releaseGateCore"

import {
  CloudflareIndeterminateWriteError,
  createOrReuseCloudflareMigrationDnsRecord,
  createOrReuseCloudflareZone,
  getCloudflareDnsRecordUsage,
  getCloudflareSslVerification,
  listCloudflareMigrationDnsRecords,
  listCloudflareZones,
} from "@/lib/domains/cloudflare"
import {
  openMigrationSecret,
  sealMigrationSecret,
} from "@/lib/domains/migrationSecrets"
import {
  MigrationSourceChangedError,
  refreshAutomaticMigrationSource,
} from "@/lib/domains/migrationSources/refresh"
import {
  consumeMigrationCheckoutSecret,
  invalidateAttachedMigrationCheckoutSecret,
  openAttachedMigrationCheckoutSecret,
} from "@/lib/domains/migrationCheckoutSecret"
import {
  MigrationSourceAuthorizationError,
} from "@/lib/domains/migrationSources/types"
import {
  domainMigrationEvidenceHash,
  domainMigrationSourceAuthorityHash,
  stableDomainMigrationEvidenceString,
} from "@/lib/domains/migrationEvidence"
import { normalizeDomain } from "@/lib/domains/normalize"
import {
  OpenProviderApiError,
  OpenProviderIndeterminateWriteError,
  createOpenProviderCustomerHandle,
  findOpenProviderCustomerByReference,
  findOpenProviderDomain,
  loginOpenProvider,
  normalizeOpenProviderTimestamp,
  transferOpenProviderDomain,
  updateOpenProviderDomainNameservers,
  type OpenProviderDomainRecord,
} from "@/lib/domains/openprovider"
import {
  verifyAuthoritativeDns,
  verifyHttpsEndpoint,
  verifyParentDsAbsent,
  verifyPreservedDnsRecords,
} from "@/lib/domains/verification"
import { domainRegistrantFromCheckoutProfile } from "@/lib/checkout/checkoutProfile"
import { publishAndActivateAfterCompletedPayment } from "@/lib/payments/postPaymentActivation"
import { activateManagedDomainEntitlement } from "@/lib/domains/provisioning"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"

const CUTOVER_VERIFICATION_MINUTES = 30
const SOURCE_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60_000

export class DomainMigrationCustomerInputError extends Error {
  constructor(readonly kind: "invalid_input" | "stale_authority") {
    super(kind)
    this.name = "DomainMigrationCustomerInputError"
  }
}

type MigrationActionStatus = "required" | "pending" | "completed" | "not_required" | "failed"
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
  updateOpenProviderDomainNameservers: typeof updateOpenProviderDomainNameservers
  listCloudflareZones: typeof listCloudflareZones
  createOrReuseCloudflareZone: typeof createOrReuseCloudflareZone
  listCloudflareMigrationDnsRecords: typeof listCloudflareMigrationDnsRecords
  createOrReuseCloudflareMigrationDnsRecord: typeof createOrReuseCloudflareMigrationDnsRecord
  getCloudflareDnsRecordUsage: typeof getCloudflareDnsRecordUsage
  getCloudflareSslVerification: typeof getCloudflareSslVerification
  verifyParentDsAbsent: typeof verifyParentDsAbsent
  verifyAuthoritativeDns: typeof verifyAuthoritativeDns
  verifyPreservedDnsRecords: typeof verifyPreservedDnsRecords
  verifyHttpsEndpoint: typeof verifyHttpsEndpoint
  publishAndActivateAfterCompletedPayment: typeof publishAndActivateAfterCompletedPayment
  activateManagedDomainEntitlement: typeof activateManagedDomainEntitlement
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
  updateOpenProviderDomainNameservers,
  listCloudflareZones,
  createOrReuseCloudflareZone,
  listCloudflareMigrationDnsRecords,
  createOrReuseCloudflareMigrationDnsRecord,
  getCloudflareDnsRecordUsage,
  getCloudflareSslVerification,
  verifyParentDsAbsent,
  verifyAuthoritativeDns,
  verifyPreservedDnsRecords,
  verifyHttpsEndpoint,
  publishAndActivateAfterCompletedPayment,
  activateManagedDomainEntitlement,
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

const nameserversEqual = (left: unknown, right: unknown): boolean => {
  const leftNames = canonicalNameservers(left)
  const rightNames = canonicalNameservers(right)
  return leftNames.length === rightNames.length &&
    leftNames.every((entry, index) => entry === rightNames[index])
}

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
    !tldCapabilityOperationFlagEnabled(capability, "incoming_transfer")
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
  const actions = actionStates(null, now)
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
      refreshedSource = checkoutInput.schemaVersion === 2
        ? await (
            dependencies.refreshAutomaticMigrationSource ??
            refreshAutomaticMigrationSource
          )(checkoutInput)
        : checkoutInput.sourceZone
    } catch (error) {
      if (
        !(error instanceof MigrationSourceChangedError) &&
        !(error instanceof MigrationSourceAuthorizationError)
      ) {
        throw error
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
    migration = await acquireAutomaticMigrationInputs(payload, {
      migrationId: migration.id,
      zoneExport: refreshedSource,
      transferCode: checkoutInput.transferCode,
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
  const sourceAcquiredAt = Date.parse(
    String(readObject(migration.sourceZoneSnapshot).acquiredAt ?? ""),
  )
  const sourceEvidenceStale =
    !Number.isFinite(sourceAcquiredAt) ||
    sourceAcquiredAt < new Date(now).getTime() - SOURCE_EVIDENCE_MAX_AGE_MS
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

export async function acquireAutomaticMigrationInputs(
  payload: Payload,
  input: {
    migrationId: string | number
    zoneExport: CompleteZoneExport
    transferCode: string
    transferCodeExpiresAt?: string | null
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
  if (source.dnssec.status !== "unsigned") {
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
    rendererTargetHost: input.env?.SIAB_RENDERER_TARGET_HOST ??
      process.env.SIAB_RENDERER_TARGET_HOST,
    rendererTargetIp: input.env?.SIAB_RENDERER_TARGET_IP ??
      process.env.SIAB_RENDERER_TARGET_IP,
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
      entitlementStatus: "pending",
      customerStatus: "provisioning",
      renewalIntent: true,
      providerAutorenew: "unknown",
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

const verificationStatus = (
  providerDomain: OpenProviderDomainRecord,
): "not_required" | "pending" | "verified" | "overdue" | "suspended" | "failed" => {
  const status = providerDomain.verificationEmailStatus?.trim().toLowerCase() ?? ""
  if (!status || ["not applicable", "not required", "n/a"].includes(status)) {
    return "not_required"
  }
  if (["verified", "completed", "approved"].includes(status)) return "verified"
  if (status.includes("suspend")) return "suspended"
  if (status.includes("overdue") || status.includes("expired")) return "overdue"
  if (status.includes("fail") || status.includes("reject")) return "failed"
  return "pending"
}

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
  migration = await updateMigration(payload, migration, {
    state: "failed",
    encryptedTransferCode: null,
    transferCodeDeletedAt: now,
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

async function stopUnfulfillableMigrationBeforeRegistrarCommit(
  payload: Payload,
  migration: DomainMigration,
  managedDomain: ManagedDomain,
  order: Order,
  code: string,
  now: string,
): Promise<MigrationResult> {
  migration = await updateMigration(payload, migration, {
    state: "failed",
    encryptedTransferCode: null,
    transferCodeDeletedAt: now,
    reconciliationRequired: false,
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
  const oldNameservers = canonicalNameservers(rollback.authoritativeNameservers)
  if (oldNameservers.length < 2) {
    throw new Error("Frozen rollback evidence has no complete nameserver set.")
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
  }
  if (!migration.rollbackRequestedAt) {
    migration = await updateMigration(payload, migration, {
      rollbackWriteState: "indeterminate",
      rollbackRequestedAt: now,
      reconciliationRequired: true,
    }, "rollback_dns_verification_started", now)
  }
  const source = migrationSource(migration)
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
  migration = await updateMigration(payload, migration, {
    state: "rolled_back",
    rollbackWriteState: "confirmed",
    rollbackConfirmedAt: deps.now(),
    rolledBackAt: deps.now(),
    encryptedTransferCode: null,
    transferCodeDeletedAt: deps.now(),
    reconciliationRequired: false,
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

export async function prepareDomainMigration(
  payload: Payload,
  migrationId: string | number,
  dependencies: Partial<MigrationDependencies> = {},
): Promise<MigrationResult> {
  const deps = { ...defaultDependencies, ...dependencies }
  let migration = await payload.findByID({
    collection: "domain-migrations",
    id: migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (migration.state === "completed") {
    return { status: "completed", migrationId: migration.id, message: "Migration is complete." }
  }
  if (migration.state === "rolled_back") {
    return { status: "rolled_back", migrationId: migration.id, message: "Migration is rolled back." }
  }
  if (migration.state === "custom_quote_required") {
    return {
      status: "failed",
      migrationId: migration.id,
      message: "Complex migration requires a custom quote and cannot continue automatically.",
    }
  }
  if (migration.state === "paused_supplemental_order") {
    return waiting(migration, "Migration is paused for authorized operator work.")
  }
  if (migration.state === "awaiting_customer" && !migration.sourceZoneSnapshot) {
    return waiting(migration, "A complete authoritative zone export and transfer code are required.")
  }
  if (
    !migration.sourceZoneSnapshot ||
    !migration.targetZoneSnapshot ||
    !migration.rollbackEvidence ||
    (
      !migration.encryptedTransferCode &&
      migration.providerTransferState !== "confirmed"
    )
  ) {
    return waiting(migration, "Frozen migration preparation evidence is incomplete.")
  }
  const now = deps.now()
  const sourceAcquiredAt = Date.parse(
    String(readObject(migration.sourceZoneSnapshot).acquiredAt ?? ""),
  )
  const sourceEvidenceStale =
    !Number.isFinite(sourceAcquiredAt) ||
    sourceAcquiredAt < new Date(now).getTime() - SOURCE_EVIDENCE_MAX_AGE_MS
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
    return waiting(migration, "The source evidence is stale and must be reacquired.")
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
    return waiting(migration, "The transfer code expired and must be replaced.")
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
    return waiting(migration, "Paid assisted migration is waiting for operator work.")
  }
  if (migration.state === "ready_to_prepare") {
    migration = await updateMigration(payload, migration, {
      state: "preparing",
      failureReason: null,
    }, "automatic_migration_preparation_started", now)
  }
  const order = await payload.findByID({
    collection: "orders",
    id: relationshipId(migration.originatingOrder) as string | number,
    depth: 0,
    overrideAccess: true,
  }) as Order
  const { capability } = migrationEvidenceFromOrder(order)
  if (!deps.transferContractEvidenceAllowed(capability)) {
    return waiting(
      migration,
      `Incoming .${capability.tld} transfer remains disabled until DNSSEC and cutover contract evidence is complete.`,
    )
  }
  const profile = await checkoutProfileForOrder(payload, order)
  const source = migrationSource(migration)
  const target = migrationTarget(migration)
  let managedDomain = await getOrCreateManagedDomain(payload, migration, order, profile, now)
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
    return stopMigrationForProviderManualReview(
      payload,
      migration,
      managedDomain,
      "source_evidence_stale_before_provider_write",
      deps.now(),
      "Frozen source evidence expired before provider preparation; reviewed fresh authority is required.",
    )
  }
  const parentDs = await deps.verifyParentDsAbsent(migration.domainNameAscii)
  if (parentDs.status === "indeterminate") {
    return waiting(migration, "DNSSEC parent DS state could not be verified.")
  }
  const dnssecPlan = buildDnssecPreparationPlan({
    sourceStatus: source.dnssec.status,
    parentDsRecords: parentDs.records,
    checkedAt: deps.now(),
  })
  let actions = actionStates(migration.customerActions, deps.now())
  actions = withAction(
    actions,
    "remove_dnssec_ds",
    dnssecPlan.cutoverReady ? "not_required" : "required",
    deps.now(),
    parentDs.reason ?? "parent_ds_absent",
  )
  migration = await updateMigration(payload, migration, {
    dnssecPreparation: dnssecPlan,
    customerActions: actions,
  }, `dnssec_preparation_${parentDs.status}`, deps.now())
  if (!dnssecPlan.cutoverReady) {
    if (migration.state === "preparing") {
      migration = await updateMigration(payload, migration, {
        state: "awaiting_customer",
      }, "dnssec_customer_action_required", deps.now())
    }
    return waiting(migration, "Parent DS records must be removed before automatic cutover.")
  }

  const visibleZones = await deps.listCloudflareZones(migration.domainNameAscii)
  let zone = visibleZones
    .find((entry) => entry.id === migration.cloudflareZoneId) ??
    visibleZones[0] ??
    null
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
        return stopMigrationForProviderManualReview(
          payload,
          migration,
          managedDomain,
          "cloudflare_zone_outcome_unresolved",
          deps.now(),
          "Cloudflare zone creation exceeded the reconciliation window.",
        )
      }
      return waiting(migration, "Cloudflare zone creation remains indeterminate.")
    }
    if (!deps.forwardProviderWritesAllowed()) {
      return waiting(
        migration,
        "Cloudflare zone creation is prepared but forward provider writes are release-blocked.",
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
      return waiting(migration, "Cloudflare zone creation is awaiting reconciliation.")
    }
  }
  migration = await updateMigration(payload, migration, {
    cloudflareZoneId: zone.id,
    cloudflareNameservers: zone.nameServers,
    failureReason: null,
  }, "cloudflare_zone_reconciled", deps.now())
  let cloudflareRecords = await deps.listCloudflareMigrationDnsRecords(zone.id)
  let comparison = semanticZoneComparison(
    target.records,
    cloudflareRecords
      .map((entry) => entry.record)
      .filter((record) => !(record.type === "NS" && record.name === target.domain)),
  )
  if (!comparison.equivalent && migration.cloudflareZoneState === "indeterminate") {
    if (
      providerWriteReconciliationTimedOut(
        migrationHistoryEventAt(migration, "cloudflare_dns_write_indeterminate"),
        deps.now(),
      )
    ) {
      return stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "cloudflare_dns_outcome_unresolved",
        deps.now(),
        "Cloudflare DNS preparation exceeded the reconciliation window.",
      )
    }
    return waiting(
      migration,
      "Cloudflare DNS write remains indeterminate; no duplicate records were sent.",
    )
  }
  if (!comparison.equivalent && cloudflareRecords.length > 0) {
    const unexpectedExisting = cloudflareRecords.some((entry) =>
      !(entry.record.type === "NS" && entry.record.name === target.domain) &&
      semanticZoneComparison(target.records, [entry.record]).unexpected.length > 0)
    if (unexpectedExisting) {
      migration = await updateMigration(payload, migration, {
        state: "failed",
        semanticComparison: comparison,
        encryptedTransferCode: null,
        transferCodeDeletedAt: deps.now(),
        failureReason: "cloudflare_zone_contains_unexpected_records",
      }, "automatic_zone_preparation_stopped", deps.now())
      return {
        status: "failed",
        migrationId: migration.id,
        message: "Cloudflare already contains unexpected records; automatic migration stopped.",
      }
    }
  }
  if (!comparison.equivalent) {
    const usage = await deps.getCloudflareDnsRecordUsage(zone.id)
    const recordsStillRequired = comparison.missing.filter(
      (entry) => !entry.endsWith(":ttl"),
    ).length
    if (usage.recordUsage + recordsStillRequired > usage.recordQuota) {
      return stopUnfulfillableMigrationBeforeRegistrarCommit(
        payload,
        migration,
        managedDomain,
        order,
        "cloudflare_dns_capacity_insufficient",
        deps.now(),
      )
    }
  }
  if (!comparison.equivalent) {
    if (!deps.forwardProviderWritesAllowed()) {
      return waiting(
        migration,
        "Cloudflare DNS preparation is ready but forward provider writes are release-blocked.",
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
      return waiting(migration, "Cloudflare DNS preparation is awaiting reconciliation.")
    }
    cloudflareRecords = await deps.listCloudflareMigrationDnsRecords(zone.id)
    comparison = semanticZoneComparison(
      target.records,
      cloudflareRecords
        .map((entry) => entry.record)
        .filter((record) => !(record.type === "NS" && record.name === target.domain)),
    )
  }
  if (!comparison.equivalent) {
    return waiting(migration, "Cloudflare target zone is not semantically complete.")
  }
  migration = await updateMigration(payload, migration, {
    cloudflareZoneState: "confirmed",
    cloudflareRecordIds: cloudflareRecords.map((entry) => entry.id).filter(Boolean),
    zonePreparedAt: deps.now(),
    semanticComparison: comparison,
    reconciliationRequired: false,
    failureReason: null,
  }, "cloudflare_target_zone_semantically_verified", deps.now())
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

  const token = await deps.loginOpenProvider()
  let customerHandle = migration.providerCustomerHandle ?? null
  if (!customerHandle) {
    const existingCustomer = await deps.findOpenProviderCustomerByReference(
      migration.idempotencyKey,
      { token },
    )
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
        return stopMigrationForProviderManualReview(
          payload,
          migration,
          managedDomain,
          "openprovider_customer_handle_outcome_unresolved",
          deps.now(),
          "Openprovider customer creation exceeded the reconciliation window.",
        )
      }
      return waiting(migration, "Customer-handle creation remains indeterminate.")
    } else {
      if (!deps.forwardProviderWritesAllowed()) {
        return waiting(
          migration,
          "Registrant preparation is ready but forward provider writes are release-blocked.",
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
        return waiting(migration, "Customer-handle creation is awaiting reconciliation.")
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

  let providerDomain = await deps.findOpenProviderDomain(migration.domainNameAscii, { token })
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
    if (sourceEvidenceStale) {
      return stopMigrationForProviderManualReview(
        payload,
        migration,
        managedDomain,
        "source_evidence_stale_before_transfer",
        deps.now(),
        "Frozen source evidence expired before transfer; reviewed fresh authority is required.",
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
        autorenew: capability.renewal.executionMode === "provider_autorenew" ? "on" : "off",
        reference: migration.idempotencyKey,
        acceptedCapabilityVersion: capability.capabilityVersion,
      })
      migration = await updateMigration(payload, migration, {
        providerTransferId: String(transfer.id),
      }, `provider_transfer_${transfer.status}`, deps.now())
    } catch (error) {
      try {
        providerDomain = await deps.findOpenProviderDomain(migration.domainNameAscii, { token })
      } catch {
        // The prepared write remains authoritative until reconciliation succeeds.
      }
      if (!providerDomain && error instanceof OpenProviderIndeterminateWriteError) {
        migration = await updateMigration(payload, migration, {
          state: "awaiting_provider",
          providerTransferState: "indeterminate",
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
    providerDomain ??= await deps.findOpenProviderDomain(migration.domainNameAscii, { token })
  }
  if (!providerDomain || !activeProviderDomain(
    providerDomain,
    capability.transfer.confirmation.activeStatuses,
  )) {
    if (migration.state === "preparing") {
      migration = await updateMigration(payload, migration, {
        state: "awaiting_provider",
      }, "provider_transfer_processing", deps.now())
    }
    return waiting(migration, "Openprovider is still processing the domain transfer.")
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
  const registrantVerification = verificationStatus(providerDomain)
  const recovered = registrantVerification === "verified" &&
    ["pending", "overdue", "suspended", "failed"].includes(
      managedDomain.registrantVerificationStatus,
    )
  const storedRegistrantVerification = recovered ? "recovered" : registrantVerification
  const verificationActionRequired = [
    "pending",
    "overdue",
    "suspended",
    "failed",
  ].includes(storedRegistrantVerification)
  actions = actionStates(migration.customerActions, deps.now())
  actions = withAction(
    withAction(actions, "confirm_transfer", "completed", deps.now(), "provider_domain_active"),
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
    registrantVerificationStatus: storedRegistrantVerification,
    registrantVerificationCheckedAt: deps.now(),
    registrantVerificationDueAt: normalizeOpenProviderTimestamp(
      providerDomain.verificationEmailExpiresAt,
    ) ?? managedDomain.registrantVerificationDueAt,
    registrantVerificationRecoveredAt: recovered ? deps.now() : undefined,
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
      ? `registrant_verification_${storedRegistrantVerification}`
      : null,
  }, `registrant_verification_${registrantVerification}`, deps.now())
  if (["overdue", "suspended", "failed"].includes(storedRegistrantVerification)) {
    await recordCommerceAdminException({
      payload,
      source: "domains",
      code: `registrant_verification_${storedRegistrantVerification}`,
      message: "Provider-reported registrant verification blocks the domain migration.",
      tenant: managedDomain.tenant,
      subjectId: migration.id,
      severity: storedRegistrantVerification === "suspended" ? "critical" : "error",
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
        `registrant_verification_${storedRegistrantVerification}_after_cutover`,
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
    if (sourceEvidenceStale) {
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
    postCutoverRecords
      .map((entry) => entry.record)
      .filter((record) => !(record.type === "NS" && record.name === target.domain)),
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
  const ssl = await deps.getCloudflareSslVerification(zone.id)
  const https = ssl.status === "active"
    ? await deps.verifyHttpsEndpoint(migration.domainNameAscii)
    : { status: "pending" as const, httpStatus: null, reason: "cloudflare_ssl_pending" }
  const verification = {
    checkedAt: deps.now(),
    semanticZone: postCutoverComparison,
    authoritativeDns,
    preservedDns,
    cloudflareSsl: {
      status: ssl.status,
      providerStatuses: ssl.providerStatuses,
    },
    https,
    preservedRecordCount: preservedRecords.length,
  }
  migration = await updateMigration(payload, migration, {
    postCutoverVerification: verification,
  }, "post_cutover_verification_recorded", deps.now())
  const verified = postCutoverComparison.equivalent &&
    authoritativeDns.status === "verified" &&
    preservedDns.status === "verified" &&
    ssl.status === "active" &&
    https.status === "verified"
  if (!verified) {
    const deadlineReached = migration.verificationDeadlineAt
      ? new Date(deps.now()).getTime() >= new Date(migration.verificationDeadlineAt).getTime()
      : false
    if (!deadlineReached && postCutoverComparison.equivalent) {
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
      providerDomain,
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
      providerDomain,
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
      providerDomain,
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
    cloudflareDnsRecordIds: postCutoverRecords.map((entry) => entry.id).filter(Boolean),
    cloudflareZoneStatus: zone.status,
    transferredAt: managedDomain.transferredAt ?? deps.now(),
    reconciliationRequired: false,
    failureReason: null,
  }, "migration_cutover_verified", deps.now())
  managedDomain = await deps.activateManagedDomainEntitlement(payload, managedDomain, deps.now())
  migration = await updateMigration(payload, migration, {
    state: "completed",
    completedAt: deps.now(),
    encryptedTransferCode: null,
    transferCodeDeletedAt: deps.now(),
    reconciliationRequired: false,
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
}
