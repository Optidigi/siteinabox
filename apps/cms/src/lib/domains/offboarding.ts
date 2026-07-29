import "server-only"

import { createHash } from "node:crypto"
import {
  domainOffboardingContinuityEvidenceSchema,
  type DomainOffboardingContinuityEvidence,
} from "@siteinabox/contracts/commerce"
import type { NormalizedMigrationDnsRecord } from
  "@siteinabox/contracts/domain-migration"
import { tldCapabilityAt } from "@siteinabox/contracts/tld-capabilities"
import type { Payload } from "payload"
import type { ManagedDomain, Order } from "@/payload-types"

import {
  commerceProviderReadsAllowed,
  commerceProviderWritesAllowed,
} from "@/lib/commerce/releaseGate"
import { listCloudflareMigrationDnsRecords } from "@/lib/domains/cloudflare"
import {
  findOpenProviderDomain,
  getOpenProviderDomainAuthCode,
  loginOpenProvider,
} from "@/lib/domains/openprovider"
import {
  openMigrationSecret,
  sealMigrationSecret,
} from "@/lib/domains/migrationSecrets"
import { verifyParentDsAbsent } from "@/lib/domains/verification"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"

const TRANSFER_CONFIRMATION_DELAY_MS = 15 * 60_000

type CustomerActor = {
  email: string
  tenantId: string | number
}

type OffboardingDependencies = {
  providerReadsAllowed: () => boolean
  providerWritesAllowed: () => boolean
  loginOpenProvider: typeof loginOpenProvider
  getOpenProviderDomainAuthCode: typeof getOpenProviderDomainAuthCode
  findOpenProviderDomain: typeof findOpenProviderDomain
  sealSecret: typeof sealMigrationSecret
  openSecret: typeof openMigrationSecret
  listCloudflareMigrationDnsRecords: typeof listCloudflareMigrationDnsRecords
  verifyParentDsAbsent: typeof verifyParentDsAbsent
}

const defaultDependencies: OffboardingDependencies = {
  providerReadsAllowed: commerceProviderReadsAllowed,
  providerWritesAllowed: commerceProviderWritesAllowed,
  loginOpenProvider,
  getOpenProviderDomainAuthCode,
  findOpenProviderDomain,
  sealSecret: sealMigrationSecret,
  openSecret: openMigrationSecret,
  listCloudflareMigrationDnsRecords,
  verifyParentDsAbsent,
}

const history = (
  domain: ManagedDomain,
  at: string,
  reason: string,
) => [
  ...(Array.isArray(domain.stateHistory) ? domain.stateHistory : []),
  { state: domain.state, at, reason },
]

const updateDomain = (
  payload: Payload,
  domain: ManagedDomain,
  data: Partial<ManagedDomain>,
  reason: string,
  now: string,
): Promise<ManagedDomain> => payload.update({
  collection: "managed-domains",
  id: domain.id,
  data: {
    ...data,
    lastSyncedAt: now,
    stateHistory: history(domain, now, reason),
  },
  depth: 0,
  overrideAccess: true,
  context: { managedDomainLifecycleMutation: true },
}) as Promise<ManagedDomain>

const originatingOrder = async (
  payload: Payload,
  domain: ManagedDomain,
): Promise<Order> => {
  const orderId = relationshipId(domain.originatingOrder)
  if (!orderId) throw new Error("Managed domain is missing its originating order.")
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as Order
  if (
    !sameRelationshipId(order.tenant, domain.tenant) ||
    order.domain.trim().toLowerCase() !== domain.domainNameAscii
  ) {
    throw new Error("Managed domain and originating order authority do not match.")
  }
  return order
}

const requireCustomerAuthority = async (
  payload: Payload,
  domain: ManagedDomain,
  actor: CustomerActor,
): Promise<Order> => {
  const order = await originatingOrder(payload, domain)
  if (
    !sameRelationshipId(domain.tenant, actor.tenantId) ||
    order.customerEmail.trim().toLowerCase() !== actor.email.trim().toLowerCase()
  ) {
    throw new Error("Domain offboarding requires the authenticated contracting customer.")
  }
  return order
}

const transferCodeBinding = (domain: ManagedDomain): string =>
  `managed-domain-transfer-out:${domain.id}`

const requireAutomaticOutgoingTransfer = (
  domain: ManagedDomain,
  effectiveAt: string,
): NonNullable<ReturnType<typeof tldCapabilityAt>> => {
  const capability = tldCapabilityAt(domain.tld, effectiveAt)
  if (
    domain.provider !== "openprovider" ||
    !capability?.transfer.outgoing.supported ||
    ![
      "openprovider_external_auth_code",
      "openprovider_registrant_delivery",
    ].includes(capability.transfer.outgoing.mechanism)
  ) {
    throw new Error(
      `Automatic transfer-out is not contract-enabled for .${domain.tld}.`,
    )
  }
  return capability
}

const hashRecords = (records: unknown[]): string => createHash("sha256")
  .update(JSON.stringify(records))
  .digest("hex")

export type DomainDnsPortabilityExport = {
  schemaVersion: 2
  format: "siteinabox-dns-portability-v2"
  domain: string
  exportedAt: string
  authoritativeNameservers: string[]
  provider: "cloudflare"
  complete: true
  dnssec: {
    parentStatus: "present" | "absent" | "indeterminate"
    parentDsRecords: string[]
  }
  records: NormalizedMigrationDnsRecord[]
}

export async function exportDomainDnsPortability(
  payload: Payload,
  input: {
    managedDomainId: string | number
    actor: CustomerActor
    now?: string
  },
  dependencies: Pick<
    OffboardingDependencies,
    | "providerReadsAllowed"
    | "listCloudflareMigrationDnsRecords"
    | "verifyParentDsAbsent"
  > = {
    providerReadsAllowed: commerceProviderReadsAllowed,
    listCloudflareMigrationDnsRecords,
    verifyParentDsAbsent,
  },
): Promise<DomainDnsPortabilityExport> {
  const domain = await payload.findByID({
    collection: "managed-domains",
    id: input.managedDomainId,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  await requireCustomerAuthority(payload, domain, input.actor)
  if (!dependencies.providerReadsAllowed()) {
    throw new Error("Commerce release stage does not allow provider reads.")
  }
  if (
    domain.custodyStatus === "transferred_out" ||
    domain.state === "expired" ||
    !domain.cloudflareZoneId ||
    !Array.isArray(domain.cloudflareNameservers) ||
    domain.cloudflareNameservers.length < 2
  ) {
    throw new Error(
      "A complete DNS export requires a customer-owned domain with verified authoritative Cloudflare DNS.",
    )
  }
  const records = (await dependencies.listCloudflareMigrationDnsRecords(
    domain.cloudflareZoneId,
  )).map(({ record }) => record)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  if (records.length === 0) {
    throw new Error("The authoritative DNS zone is empty or incomplete.")
  }
  const parentDs = await dependencies.verifyParentDsAbsent(domain.domainNameAscii)
  return {
    schemaVersion: 2,
    format: "siteinabox-dns-portability-v2",
    domain: domain.domainNameAscii,
    exportedAt: input.now ?? new Date().toISOString(),
    authoritativeNameservers: domain.cloudflareNameservers
      .map(String)
      .map((value) => value.toLowerCase())
      .sort(),
    provider: "cloudflare",
    complete: true,
    dnssec: {
      parentStatus: parentDs.status,
      parentDsRecords: parentDs.records,
    },
    records,
  }
}

export async function captureDomainOffboardingContinuityEvidence(
  payload: Payload,
  input: {
    managedDomainId: string | number
    actor: CustomerActor
    now?: string
  },
  dependencies: Pick<
    OffboardingDependencies,
    "providerReadsAllowed" | "listCloudflareMigrationDnsRecords" | "verifyParentDsAbsent"
  > = {
    providerReadsAllowed: commerceProviderReadsAllowed,
    listCloudflareMigrationDnsRecords,
    verifyParentDsAbsent,
  },
): Promise<DomainOffboardingContinuityEvidence> {
  const domain = await payload.findByID({
    collection: "managed-domains",
    id: input.managedDomainId,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  await requireCustomerAuthority(payload, domain, input.actor)
  if (!dependencies.providerReadsAllowed()) {
    throw new Error("Commerce release stage does not allow provider reads.")
  }
  if (
    !domain.cloudflareZoneId ||
    !Array.isArray(domain.cloudflareNameservers) ||
    domain.cloudflareNameservers.length < 2
  ) {
    throw new Error("Offboarding requires verified authoritative Cloudflare DNS.")
  }
  const records = (await dependencies.listCloudflareMigrationDnsRecords(
    domain.cloudflareZoneId,
  )).map(({ record }) => record)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  if (records.length === 0) {
    throw new Error("Offboarding requires a complete non-empty authoritative zone snapshot.")
  }
  const mailRecords = records.filter((record) =>
    record.type === "MX" ||
    record.type === "SRV" ||
    (
      ["TXT", "CNAME"].includes(record.type) &&
      /(^|\.)(_dmarc|[^.]+\._domainkey|mail|autodiscover|smtp|imap|pop)(\.|$)/i.test(record.name)
    ))
  const websiteRecord = (record: (typeof records)[number]) =>
    ["A", "AAAA", "CNAME"].includes(record.type) &&
    (record.name === "@" || record.name.toLowerCase() === `www.${domain.domainNameAscii}`)
  const serviceRecords = records.filter((record) => !websiteRecord(record))
  const parentDs = await dependencies.verifyParentDsAbsent(domain.domainNameAscii)
  if (parentDs.status === "indeterminate") {
    throw new Error(
      "Offboarding cannot continue while the parent DNSSEC state is indeterminate.",
    )
  }
  return domainOffboardingContinuityEvidenceSchema.parse({
    schemaVersion: 2,
    domain: domain.domainNameAscii,
    capturedAt: input.now ?? new Date().toISOString(),
    authoritativeNameservers: domain.cloudflareNameservers
      .map(String)
      .map((value) => value.toLowerCase())
      .sort(),
    dnssecStatus: parentDs.status === "present" ? "signed" : "unsigned",
    parentDsRecords: parentDs.records,
    zoneSnapshotHash: hashRecords(records),
    mailRecordSetHash: hashRecords(mailRecords),
    serviceRecordSetHash: hashRecords(serviceRecords),
    preservationMode: "retain_existing_dns_and_mail",
  })
}

export async function requestDomainOffboarding(
  payload: Payload,
  input: {
    managedDomainId: string | number
    actor: CustomerActor
    requestId: string
    reason: string
    continuityEvidence: DomainOffboardingContinuityEvidence
    now?: string
  },
): Promise<ManagedDomain> {
  const now = input.now ?? new Date().toISOString()
  const requestId = input.requestId.trim()
  const reason = input.reason.trim()
  if (!requestId || !reason) {
    throw new Error("Domain offboarding requires an audited request ID and reason.")
  }
  if (input.continuityEvidence.schemaVersion !== 2) {
    throw new Error("New offboarding requests require current DNSSEC continuity evidence.")
  }
  let domain = await payload.findByID({
    collection: "managed-domains",
    id: input.managedDomainId,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  await requireCustomerAuthority(payload, domain, input.actor)
  if (
    domain.offboardingRequestId === requestId &&
    domain.custodyStatus !== "managed"
  ) {
    return domain
  }
  const renewalDate = domain.providerRenewalDate
    ? new Date(domain.providerRenewalDate)
    : null
  if (
    !["active", "renewal_pending", "provider_hold", "manual_review"].includes(
      domain.state,
    ) ||
    !renewalDate ||
    !Number.isFinite(renewalDate.getTime()) ||
    renewalDate.getTime() <= new Date(now).getTime() ||
    !domain.providerDomainId ||
    domain.custodyStatus !== "managed"
  ) {
    throw new Error(
      "Only an unexpired provider-reconciled customer domain can start offboarding.",
    )
  }
  requireAutomaticOutgoingTransfer(domain, now)
  const evidence = domainOffboardingContinuityEvidenceSchema.parse(
    input.continuityEvidence,
  )
  if (evidence.domain !== domain.domainNameAscii) {
    throw new Error("Offboarding continuity evidence belongs to another domain.")
  }
  const expectedNameservers = Array.isArray(domain.cloudflareNameservers)
    ? domain.cloudflareNameservers.map(String).map((value) => value.toLowerCase()).sort()
    : []
  const evidenceNameservers = [...evidence.authoritativeNameservers].sort()
  if (
    expectedNameservers.length >= 2 &&
    (
      expectedNameservers.length !== evidenceNameservers.length ||
      expectedNameservers.some((value, index) => value !== evidenceNameservers[index])
    )
  ) {
    throw new Error("Offboarding evidence does not match the active authoritative nameservers.")
  }
  domain = await updateDomain(payload, domain, {
    custodyStatus: "offboarding_requested",
    offboardingRequestedAt: now,
    offboardingRequestedByEmail: input.actor.email.trim().toLowerCase(),
    offboardingRequestId: requestId,
    offboardingReason: reason,
    offboardingContinuityEvidence: evidence,
    reconciliationRequired: true,
  }, "customer_offboarding_requested_dns_unchanged", now)
  return domain
}

export async function prepareDomainTransferOutCode(
  payload: Payload,
  managedDomainId: string | number,
  dependencies: Partial<OffboardingDependencies> = {},
  now = new Date().toISOString(),
): Promise<ManagedDomain> {
  const deps = { ...defaultDependencies, ...dependencies }
  let domain = await payload.findByID({
    collection: "managed-domains",
    id: managedDomainId,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  if (domain.custodyStatus === "transfer_code_ready") return domain
  if (
    domain.custodyStatus !== "offboarding_requested" ||
    !domain.providerDomainId
  ) {
    throw new Error(
      "Transfer-out code preparation requires a contract-enabled Openprovider domain.",
    )
  }
  const capability = requireAutomaticOutgoingTransfer(domain, now)
  if (!deps.providerReadsAllowed()) {
    throw new Error("Commerce release stage does not allow provider reads.")
  }
  const token = await deps.loginOpenProvider()
  const providerDomain = await deps.findOpenProviderDomain(
    domain.domainNameAscii,
    { token },
  )
  if (
    !providerDomain ||
    String(providerDomain.id) !== String(domain.providerDomainId)
  ) {
    throw new Error(
      "Transfer-out code preparation requires a reconciled provider domain identity.",
    )
  }
  if (
    capability.transfer.outgoing.mechanism ===
      "openprovider_registrant_delivery" &&
    !deps.providerWritesAllowed()
  ) {
    throw new Error(
      "Commerce release stage does not allow provider-delivered transfer codes.",
    )
  }
  const authorization = await deps.getOpenProviderDomainAuthCode(
    domain.providerDomainId,
    { token },
  )
  if (authorization.delivery === "registrant_email") {
    if (
      capability.transfer.outgoing.mechanism !==
      "openprovider_registrant_delivery"
    ) {
      throw new Error(
        "OpenProvider did not return the contract-required external auth code.",
      )
    }
    return updateDomain(payload, domain, {
      custodyStatus: "transfer_code_ready",
      encryptedTransferOutCode: null,
      transferOutCodeDeliveryStatus: "registrant_email",
      reconciliationRequired: true,
      failureReason: null,
    }, "external_transfer_code_sent_to_registrant_dns_unchanged", now)
  }
  const encryptedTransferOutCode = deps.sealSecret(
    authorization.authCode,
    transferCodeBinding(domain),
  )
  domain = await updateDomain(payload, domain, {
    custodyStatus: "transfer_code_ready",
    encryptedTransferOutCode,
    transferOutCodeDeliveryStatus: "provider_returned",
    transferOutCodeFetchedAt: now,
    reconciliationRequired: true,
    failureReason: null,
  }, "external_transfer_code_encrypted_dns_unchanged", now)
  return domain
}

export async function revealDomainTransferOutCode(
  payload: Payload,
  input: {
    managedDomainId: string | number
    actor: CustomerActor
    now?: string
  },
  dependencies: Pick<OffboardingDependencies, "openSecret"> = {
    openSecret: openMigrationSecret,
  },
): Promise<{ authCode: string; domain: ManagedDomain }> {
  const now = input.now ?? new Date().toISOString()
  let domain = await payload.findByID({
    collection: "managed-domains",
    id: input.managedDomainId,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  await requireCustomerAuthority(payload, domain, input.actor)
  if (
    !["transfer_code_ready", "transfer_pending"].includes(domain.custodyStatus) ||
    !domain.encryptedTransferOutCode
  ) {
    throw new Error("No transfer-out code is available for this customer domain.")
  }
  const authCode = dependencies.openSecret(
    domain.encryptedTransferOutCode,
    transferCodeBinding(domain),
  )
  domain = await updateDomain(payload, domain, {
    transferOutCodeLastRevealedAt: now,
  }, "transfer_code_revealed_to_contracting_customer", now)
  return { authCode, domain }
}

export async function markDomainTransferOutStarted(
  payload: Payload,
  input: {
    managedDomainId: string | number
    actor: CustomerActor
    now?: string
  },
): Promise<ManagedDomain> {
  const now = input.now ?? new Date().toISOString()
  let domain = await payload.findByID({
    collection: "managed-domains",
    id: input.managedDomainId,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  await requireCustomerAuthority(payload, domain, input.actor)
  if (domain.custodyStatus === "transfer_pending") return domain
  if (
    domain.custodyStatus !== "transfer_code_ready" ||
    (
      !domain.encryptedTransferOutCode &&
      domain.transferOutCodeDeliveryStatus !== "registrant_email"
    )
  ) {
    throw new Error("Transfer-out cannot start before the customer receives authorization.")
  }
  domain = await updateDomain(payload, domain, {
    custodyStatus: "transfer_pending",
    transferOutStartedAt: now,
    transferOutProviderMissingCount: 0,
    transferOutFirstMissingAt: null,
    transferOutLastCheckedAt: null,
    reconciliationRequired: true,
  }, "customer_confirmed_external_transfer_started", now)
  return domain
}

export async function confirmDomainTransferCompletedByCustomer(
  payload: Payload,
  input: {
    managedDomainId: string | number
    actor: CustomerActor
    now?: string
  },
): Promise<ManagedDomain> {
  const now = input.now ?? new Date().toISOString()
  let domain = await payload.findByID({
    collection: "managed-domains",
    id: input.managedDomainId,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  await requireCustomerAuthority(payload, domain, input.actor)
  if (domain.custodyStatus === "transferred_out") return domain
  if (domain.custodyStatus !== "transfer_pending") {
    throw new Error("Transfer completion can only be confirmed for a pending transfer.")
  }
  if (domain.transferOutCustomerConfirmedAt) return domain
  domain = await updateDomain(payload, domain, {
    transferOutCustomerConfirmedAt: now,
    reconciliationRequired: true,
  }, "contracting_customer_confirmed_external_transfer_completion", now)
  return domain
}

export async function reconcileDomainTransferOut(
  payload: Payload,
  managedDomainId: string | number,
  dependencies: Partial<OffboardingDependencies> = {},
  nowDate = new Date(),
): Promise<{ status: "pending" | "transferred_out" | "manual_review"; domain: ManagedDomain }> {
  const deps = { ...defaultDependencies, ...dependencies }
  const now = nowDate.toISOString()
  let domain = await payload.findByID({
    collection: "managed-domains",
    id: managedDomainId,
    depth: 0,
    overrideAccess: true,
  }) as ManagedDomain
  if (domain.custodyStatus === "transferred_out") {
    return { status: "transferred_out", domain }
  }
  if (
    domain.custodyStatus !== "transfer_pending" ||
    domain.provider !== "openprovider" ||
    !domain.providerDomainId
  ) {
    throw new Error("Only a pending Openprovider transfer-out can be reconciled.")
  }
  if (!deps.providerReadsAllowed()) {
    throw new Error("Commerce release stage does not allow provider reads.")
  }
  const token = await deps.loginOpenProvider()
  const providerDomain = await deps.findOpenProviderDomain(
    domain.domainNameAscii,
    { token },
  )
  if (providerDomain && String(providerDomain.id) !== String(domain.providerDomainId)) {
    domain = await updateDomain(payload, domain, {
      custodyStatus: "manual_review",
      transferOutLastCheckedAt: now,
      reconciliationRequired: true,
      failureReason: "provider_domain_identity_changed_during_transfer_out",
    }, "transfer_out_provider_identity_mismatch", now)
    return { status: "manual_review", domain }
  }
  if (providerDomain) {
    domain = await updateDomain(payload, domain, {
      transferOutProviderMissingCount: 0,
      transferOutFirstMissingAt: null,
      transferOutLastCheckedAt: now,
      reconciliationRequired: true,
      failureReason: null,
    }, "transfer_out_still_present_at_provider", now)
    return { status: "pending", domain }
  }
  const previousMissingCount = domain.transferOutProviderMissingCount ?? 0
  const firstMissingAt = domain.transferOutFirstMissingAt ?? now
  const confirmationDelayElapsed =
    Boolean(domain.transferOutCustomerConfirmedAt) &&
    previousMissingCount >= 1 &&
    nowDate.getTime() - new Date(firstMissingAt).getTime() >=
      TRANSFER_CONFIRMATION_DELAY_MS
  if (!confirmationDelayElapsed) {
    domain = await updateDomain(payload, domain, {
      transferOutProviderMissingCount: previousMissingCount + 1,
      transferOutFirstMissingAt: firstMissingAt,
      transferOutLastCheckedAt: now,
      reconciliationRequired: true,
      failureReason: null,
    }, "transfer_out_first_provider_missing_observation", now)
    return { status: "pending", domain }
  }
  domain = await updateDomain(payload, domain, {
    custodyStatus: "transferred_out",
    encryptedTransferOutCode: null,
    transferOutCodeDeletedAt: now,
    transferOutProviderMissingCount: previousMissingCount + 1,
    transferOutLastCheckedAt: now,
    transferOutConfirmedAt: now,
    renewalIntent: false,
    providerAutorenew: "unknown",
    reconciliationRequired: false,
    failureReason: null,
  }, "transfer_out_confirmed_twice_dns_mail_and_entitlement_retained", now)
  return { status: "transferred_out", domain }
}
