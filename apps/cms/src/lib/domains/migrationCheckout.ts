import "server-only"

import { createHash } from "node:crypto"
import { resolveNs } from "node:dns/promises"
import {
  normalizeCompleteZone,
  type CompleteZoneExport,
  type MigrationSourceMechanism,
  type NormalizedCompleteZone,
} from "@siteinabox/contracts/domain-migration"
import {
  getTldCapabilityForProductionOperation,
  getTldCapabilityByVersion,
  productionTldCapabilitiesAt,
  tldUsesIcannTransferPolicy,
  tldCapabilityOperationFlagEnabled,
  validateTldTransferAuthorization,
} from "@siteinabox/contracts/tld-capabilities"

import { domainMigrationSourceAuthorityHash } from "@/lib/domains/migrationEvidence"
import {
  sealCheckoutMigrationInput,
  type CheckoutMigrationInput,
} from "@/lib/domains/migrationSecrets"
import { normalizeDomain } from "@/lib/domains/normalize"
import {
  sourceAuthorityMechanism,
  type AcquiredMigrationSource,
} from "@/lib/domains/migrationSources/types"
import { validateSignedDnssecEvidence } from "@/lib/domains/migrationSources/dnssecEvidence"
import { verifyParentDsAbsent } from "@/lib/domains/verification"

const MAX_ZONE_EXPORT_BYTES = 256 * 1_024
const MAX_ZONE_EXPORT_AGE_MS = 24 * 60 * 60_000
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60_000
// New Cloudflare Free zones have a 200-record quota. Reserve two records for
// the managed apex and www routes so checkout cannot accept an unimportable
// source before the destination zone exists and exposes its exact quota.
const MAX_AUTOMATIC_SOURCE_RECORDS = 198

type MigrationReadiness =
  | "ready_automatic"
  | "unsupported"

export type ExistingDomainPublicEvidence = {
  checkedAt: string
  authoritativeNameservers: string[]
  dnssecDsPresent: boolean
  dnssecDsRecords: string[]
  dnssecDsTtl: number | null
  probableDnsProvider: string | null
  registrar: string | null
  registryStatuses?: string[]
  registeredAt?: string | null
  lastTransferredAt?: string | null
  registryExpiryAt?: string | null
  registryTransferEvidence?: "confirmed" | "unavailable"
  transferBlockers?: string[]
  supplementalOnly: true
}

export type ExistingDomainMigrationAssessment = {
  readiness: MigrationReadiness
  domain: string
  classification: "automatic" | null
  message: string
  reason:
    | "invalid_domain"
    | "tld_not_enabled"
    | "gtld_eligibility_required"
    | "registry_transfer_blocked"
    | "invalid_zone"
    | "stale_or_wrong_zone"
    | "nameservers_changed"
    | "zone_capacity_exceeded"
    | "dnssec_evidence_incomplete"
    | "transfer_authorization_invalid"
    | "dnssec_release_pending"
    | "source_authority_mismatch"
    | "automatic_ready"
    | "source_completeness_unproven"
  sourceZone: NormalizedCompleteZone | null
  sourceZoneHash: string | null
  encryptedInput: string | null
  publicEvidence: ExistingDomainPublicEvidence | null
}

export function existingDomainPublicEvidenceHash(
  evidence: ExistingDomainPublicEvidence,
): string {
  return createHash("sha256").update(JSON.stringify({
    authoritativeNameservers: canonicalNames(evidence.authoritativeNameservers),
    dnssecDsPresent: evidence.dnssecDsPresent,
    dnssecDsRecords: [...evidence.dnssecDsRecords].sort(),
    dnssecDsTtl: evidence.dnssecDsTtl,
    probableDnsProvider: evidence.probableDnsProvider?.trim().toLowerCase() ?? null,
    registrar: evidence.registrar?.trim().toLowerCase() ?? null,
    registryStatuses: [...(evidence.registryStatuses ?? [])].sort(),
    registeredAt: evidence.registeredAt ?? null,
    lastTransferredAt: evidence.lastTransferredAt ?? null,
    registryExpiryAt: evidence.registryExpiryAt ?? null,
    registryTransferEvidence:
      evidence.registryTransferEvidence ?? "unavailable",
    transferBlockers: [...(evidence.transferBlockers ?? [])].sort(),
  })).digest("hex")
}

const canonicalNames = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim().toLowerCase().replace(/\.$/, "")))]
    .filter(Boolean)
    .sort()

const probableDnsProvider = (nameservers: string[]): string | null => {
  const canonical = nameservers.map((nameserver) =>
    nameserver.trim().toLowerCase().replace(/\.$/, ""))
  const usesSuffix = (suffix: string) =>
    canonical.some((nameserver) =>
      nameserver === suffix || nameserver.endsWith(`.${suffix}`))
  if (usesSuffix("ns.cloudflare.com")) return "cloudflare"
  if (usesSuffix("transip.net")) return "transip"
  if (usesSuffix("yourhosting.nl")) return "yourhosting"
  if (usesSuffix("openprovider.eu") || usesSuffix("openprovider.nl")) {
    return "openprovider"
  }
  return null
}

const timeout = async <T>(promise: Promise<T>, milliseconds: number): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Existing-domain public inspection timed out.")),
          milliseconds,
        )
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export type ExistingDomainPublicEvidenceFailureCategory =
  | "nameserver_lookup_failed"
  | "parent_ds_lookup_failed"

export class ExistingDomainPublicEvidenceError extends Error {
  constructor(readonly category: ExistingDomainPublicEvidenceFailureCategory) {
    super(category)
    this.name = "ExistingDomainPublicEvidenceError"
  }
}

type RdapDomainEvidence = {
  registrar: string | null
  statuses: string[]
  registeredAt: string | null
  lastTransferredAt: string | null
  expiresAt: string | null
}

const normalizedRdapStatus = (value: string): string =>
  value
    .trim()
    .replace(/^https?:\/\/[^#]+#/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()

const validRdapDate = (value: unknown): string | null => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null
  return new Date(value).toISOString()
}

export function gtldTransferEligibilityDeclarationRequired(tld: string): boolean {
  return tldUsesIcannTransferPolicy(tld)
}

export function publicTransferBlockers(input: {
  tld: string
  evidenceAvailable: boolean
  statuses: string[]
  registeredAt: string | null
  lastTransferredAt: string | null
  now: Date
}): string[] {
  const statuses = new Set(input.statuses.map(normalizedRdapStatus))
  const blockers: string[] = []
  const isIcannGtld = tldUsesIcannTransferPolicy(input.tld)
  if (!input.evidenceAvailable) {
    blockers.push("rdap_transfer_evidence_unavailable")
  }
  const blockingStatuses = [
    "client transfer prohibited",
    "server transfer prohibited",
    "pending transfer",
    "redemption period",
    "pending delete",
    "pending restore",
    "client hold",
    "server hold",
  ]
  for (const status of blockingStatuses) {
    if (statuses.has(status)) blockers.push(`rdap_status:${status.replaceAll(" ", "_")}`)
  }
  if (isIcannGtld) {
    const sixtyDaysAgo = input.now.getTime() - 60 * 24 * 60 * 60_000
    const registeredAt = input.registeredAt ? Date.parse(input.registeredAt) : Number.NaN
    const lastTransferredAt = input.lastTransferredAt
      ? Date.parse(input.lastTransferredAt)
      : Number.NaN
    if (Number.isFinite(registeredAt) && registeredAt > sixtyDaysAgo) {
      blockers.push("icann_initial_registration_60_day_eligibility_risk")
    }
    if (Number.isFinite(lastTransferredAt) && lastTransferredAt > sixtyDaysAgo) {
      blockers.push("icann_previous_transfer_60_day_eligibility_risk")
    }
  }
  return [...new Set(blockers)].sort()
}

const rdapDomainEvidence = async (
  domain: string,
  fetchImpl: typeof fetch,
): Promise<RdapDomainEvidence | null> => {
  const tld = domain.split(".").at(-1)
  if (!tld) return null
  const bootstrapResponse = await fetchImpl(
    "https://data.iana.org/rdap/dns.json",
    {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3_000),
    },
  )
  if (!bootstrapResponse.ok) return null
  const bootstrap: unknown = await bootstrapResponse.json()
  const rawServices =
    bootstrap &&
    typeof bootstrap === "object" &&
    !Array.isArray(bootstrap) &&
    Array.isArray((bootstrap as { services?: unknown }).services)
      ? (bootstrap as { services: unknown[] }).services
      : []
  const services = rawServices.flatMap((entry): Array<[string[], string[]]> =>
    Array.isArray(entry) &&
    Array.isArray(entry[0]) &&
    entry[0].every((value) => typeof value === "string") &&
    Array.isArray(entry[1]) &&
    entry[1].every((value) => typeof value === "string")
      ? [[entry[0], entry[1]]]
      : [])
  const baseUrl = services.find(([tlds]) =>
    tlds.some((entry) => entry.toLowerCase() === tld))?.[1]?.[0]
  if (!baseUrl) return null
  const parsedBaseUrl = new URL(baseUrl)
  if (parsedBaseUrl.protocol !== "https:") return null
  const response = await fetchImpl(
    new URL(
      `domain/${encodeURIComponent(domain)}`,
      parsedBaseUrl.toString().endsWith("/")
        ? parsedBaseUrl
        : `${parsedBaseUrl.toString()}/`,
    ).toString(),
    {
      method: "GET",
      headers: { Accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(3_000),
    },
  )
  if (!response.ok) return null
  const rawPayload: unknown = await response.json()
  if (
    !rawPayload ||
    typeof rawPayload !== "object" ||
    Array.isArray(rawPayload)
  ) {
    return null
  }
  const payload = rawPayload as {
    objectClassName?: string
    ldhName?: string
    status?: string[]
    events?: Array<{
      eventAction?: string
      eventDate?: string
    }>
    entities?: Array<{
      handle?: string
      roles?: string[]
      vcardArray?: [string, Array<[string, Record<string, unknown>, string, string]>]
    }>
  }
  if (
    payload.objectClassName !== "domain" ||
    typeof payload.ldhName !== "string" ||
    canonicalNames([payload.ldhName])[0] !== canonicalNames([domain])[0] ||
    !Array.isArray(payload.status) ||
    !payload.status.every((status) => typeof status === "string") ||
    (
      payload.events !== undefined &&
      (
        !Array.isArray(payload.events) ||
        !payload.events.every((event) =>
          event &&
          typeof event === "object" &&
          typeof event.eventAction === "string" &&
          typeof event.eventDate === "string")
      )
    ) ||
    (
      payload.entities !== undefined &&
      !Array.isArray(payload.entities)
    )
  ) {
    return null
  }
  const registrar = payload.entities?.find((entity) =>
    entity.roles?.includes("registrar"))
  const name = registrar?.vcardArray?.[1].find((entry) => entry[0] === "fn")?.[3]
  const statuses = [...new Set(
    (payload.status ?? [])
      .filter((status): status is string => typeof status === "string")
      .map(normalizedRdapStatus)
      .filter(Boolean),
  )].sort()
  const eventDate = (...actions: string[]): string | null => {
    const normalizedActions = new Set(actions.map((action) => action.toLowerCase()))
    const dates = (payload.events ?? [])
      .filter((event) =>
        typeof event.eventAction === "string" &&
        normalizedActions.has(event.eventAction.trim().toLowerCase()))
      .map((event) => validRdapDate(event.eventDate))
      .filter((date): date is string => date !== null)
      .sort()
    return dates.at(-1) ?? null
  }
  const registeredAt = eventDate("registration")
  const lastTransferredAt = eventDate("transfer", "last transfer")
  const expiresAt = eventDate("expiration", "expiry")
  return {
    registrar: typeof name === "string" && name.trim()
      ? name.trim()
      : registrar?.handle?.trim() || null,
    statuses,
    registeredAt,
    lastTransferredAt,
    expiresAt,
  }
}

export async function inspectExistingDomainPublicEvidence(
  domain: string,
  input: {
    now?: Date
    resolveNsImpl?: typeof resolveNs
    resolveDsImpl?: (hostname: string) => Promise<unknown[]>
    fetchImpl?: typeof fetch
  } = {},
): Promise<ExistingDomainPublicEvidence> {
  const resolveNsImpl = input.resolveNsImpl ?? resolveNs
  const fetchImpl = input.fetchImpl ?? fetch
  const now = input.now ?? new Date()
  const dsEvidenceSource = input.resolveDsImpl
    ? Promise.resolve().then(() => input.resolveDsImpl!(domain)).then((records) => ({
        records: records.flatMap((record) => {
          const value = record as {
            keyTag?: unknown
            algorithm?: unknown
            digestType?: unknown
            digest?: unknown
          }
          return (
            Number.isInteger(value.keyTag) &&
            Number.isInteger(value.algorithm) &&
            Number.isInteger(value.digestType) &&
            typeof value.digest === "string"
          )
            ? [[
                value.keyTag,
                value.algorithm,
                value.digestType,
                value.digest.toUpperCase(),
              ].join(" ")]
            : []
        }),
        ttl: null,
      })).catch((error: NodeJS.ErrnoException) => {
        if (["ENODATA", "ENOTFOUND"].includes(error.code ?? "")) {
          return { records: [], ttl: null }
        }
        throw error
      })
    : verifyParentDsAbsent(domain).then((evidence) => {
        if (evidence.status === "indeterminate") {
          throw new Error("Parent DS inspection failed.")
        }
        return {
          records: evidence.records,
          ttl: evidence.ttl ?? null,
        }
      })
  const dsEvidencePromise = timeout(
    dsEvidenceSource,
    input.resolveDsImpl ? 3_000 : 20_000,
  ).catch((error) => {
    if (error instanceof ExistingDomainPublicEvidenceError) throw error
    throw new ExistingDomainPublicEvidenceError("parent_ds_lookup_failed")
  })
  const nameserversPromise = timeout(resolveNsImpl(domain), 3_000).catch(() => {
    throw new ExistingDomainPublicEvidenceError("nameserver_lookup_failed")
  })
  const [nameservers, dsEvidence, rdap] = await Promise.all([
    nameserversPromise,
    dsEvidencePromise,
    rdapDomainEvidence(domain, fetchImpl).catch(() => null),
  ])
  const normalizedNameservers = canonicalNames(nameservers)
  return {
    checkedAt: now.toISOString(),
    authoritativeNameservers: normalizedNameservers,
    dnssecDsPresent: dsEvidence.records.length > 0,
    dnssecDsRecords: dsEvidence.records,
    dnssecDsTtl: dsEvidence.ttl,
    probableDnsProvider: probableDnsProvider(normalizedNameservers),
    registrar: rdap?.registrar ?? null,
    registryStatuses: rdap?.statuses ?? [],
    registeredAt: rdap?.registeredAt ?? null,
    lastTransferredAt: rdap?.lastTransferredAt ?? null,
    registryExpiryAt: rdap?.expiresAt ?? null,
    registryTransferEvidence: rdap ? "confirmed" : "unavailable",
    transferBlockers: publicTransferBlockers({
      tld: domain.split(".").at(-1) ?? "",
      evidenceAvailable: rdap !== null,
      statuses: rdap?.statuses ?? [],
      registeredAt: rdap?.registeredAt ?? null,
      lastTransferredAt: rdap?.lastTransferredAt ?? null,
      now,
    }),
    supplementalOnly: true,
  }
}

export function existingDomainMigrationCheckoutEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED?.trim() === "1" &&
    productionTldCapabilitiesAt("incoming_transfer").length > 0
}

export function automaticMigrationSourceEnabled(
  mechanism: MigrationSourceMechanism,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (mechanism === "cloudflare_api_v1") {
    return env.COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_ENABLED?.trim() === "1"
  }
  if (mechanism === "authorized_axfr_v1") {
    return env.COMMERCE_MIGRATION_SOURCE_AXFR_ENABLED?.trim() === "1"
  }
  // A customer-uploaded file cannot independently prove complete source
  // authority. Keep the parser for historical evidence, but never expose this
  // mechanism as an ordinary automatic checkout route.
  if (mechanism === "validated_provider_export_v1") return false
  return false
}

export function assessExistingDomainMigrationInput(input: {
  generationRunId: string | number
  domain: string
  zoneExport: CompleteZoneExport
  transferCode: string
  transferAuthorizationAccepted: boolean
  gtldTransferEligibilityAccepted?: boolean
  publicEvidence: ExistingDomainPublicEvidence
  acceptedCapabilityVersion?: string
  acquiredSource?: AcquiredMigrationSource
  env?: NodeJS.ProcessEnv
  now?: Date
}, dependencies: {
  capabilityForTld?: (
    tld: string,
    operation: "incoming_transfer",
    effectiveAt: string | Date,
  ) => ReturnType<typeof getTldCapabilityForProductionOperation>
} = {}): ExistingDomainMigrationAssessment {
  const now = input.now ?? new Date()
  const normalizedDomain = normalizeDomain(input.domain)
  if (!normalizedDomain.ok) {
    return {
      readiness: "unsupported",
      domain: input.domain.trim().toLowerCase(),
      classification: null,
      message: "De bestaande domeinnaam is ongeldig.",
      reason: "invalid_domain",
      sourceZone: null,
      sourceZoneHash: null,
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  const acceptedCapability = input.acceptedCapabilityVersion
    ? getTldCapabilityByVersion(input.acceptedCapabilityVersion)
    : null
  const capability = (
    acceptedCapability?.tld === normalizedDomain.extension &&
    tldCapabilityOperationFlagEnabled(acceptedCapability, "incoming_transfer")
  )
    ? acceptedCapability
    : (
        dependencies.capabilityForTld ?? getTldCapabilityForProductionOperation
      )(
        normalizedDomain.extension,
        "incoming_transfer",
        now,
      )
  if (!capability?.transfer.supported) {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message: `Inkomende verhuizing voor .${normalizedDomain.extension} is niet ingeschakeld.`,
      reason: "tld_not_enabled",
      sourceZone: null,
      sourceZoneHash: null,
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  if (
    gtldTransferEligibilityDeclarationRequired(normalizedDomain.extension) &&
    input.gtldTransferEligibilityAccepted !== true
  ) {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message:
        "Bevestig dat er geen bekende recente houderwijziging, procedure of andere registrarblokkade geldt voordat deze gTLD kan worden verhuisd.",
      reason: "gtld_eligibility_required",
      sourceZone: null,
      sourceZoneHash: null,
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  if ((input.publicEvidence.transferBlockers?.length ?? 0) > 0) {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message:
        "De openbare registrygegevens tonen een actieve verhuisblokkade. Hef die eerst op en voer daarna een nieuwe voorcontrole uit.",
      reason: "registry_transfer_blocked",
      sourceZone: null,
      sourceZoneHash: null,
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  let sourceZone: NormalizedCompleteZone
  try {
    const serializedBytes = Buffer.byteLength(JSON.stringify(input.zoneExport), "utf8")
    if (serializedBytes > MAX_ZONE_EXPORT_BYTES) {
      throw new Error("The complete zone export exceeds the supported 256 KiB limit.")
    }
    sourceZone = normalizeCompleteZone(input.zoneExport)
  } catch {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message: "De volledige zone-export is ongeldig of bevat niet-ondersteunde records.",
      reason: "invalid_zone",
      sourceZone: null,
      sourceZoneHash: null,
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  const acquiredAt = Date.parse(sourceZone.acquiredAt)
  if (
    sourceZone.domain !== normalizedDomain.domain ||
    !Number.isFinite(acquiredAt) ||
    acquiredAt < now.getTime() - MAX_ZONE_EXPORT_AGE_MS ||
    acquiredAt > now.getTime() + MAX_FUTURE_CLOCK_SKEW_MS
  ) {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message: "De zone-export hoort niet bij dit domein of is ouder dan 24 uur.",
      reason: "stale_or_wrong_zone",
      sourceZone: null,
      sourceZoneHash: null,
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  if (
    canonicalNames(sourceZone.authoritativeNameservers).join("\n") !==
      canonicalNames(input.publicEvidence.authoritativeNameservers).join("\n")
  ) {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message: "De gezaghebbende nameservers zijn gewijzigd; lever een nieuwe volledige export aan.",
      reason: "nameservers_changed",
      sourceZone: null,
      sourceZoneHash: null,
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  if (sourceZone.records.length > MAX_AUTOMATIC_SOURCE_RECORDS) {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message:
        "Deze zone bevat te veel records voor de gegarandeerde automatische doelcapaciteit. Er wordt niets besteld of betaald.",
      reason: "zone_capacity_exceeded",
      sourceZone,
      sourceZoneHash: domainMigrationSourceAuthorityHash(sourceZone),
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  if (
    sourceZone.dnssec.status === "signed" ||
    input.publicEvidence.dnssecDsPresent
  ) {
    const dnssecEvidence = sourceZone.dnssec.status === "signed" &&
      input.publicEvidence.dnssecDsPresent &&
      [...sourceZone.dnssec.parentDsRecords].sort().join("\n") ===
        [...input.publicEvidence.dnssecDsRecords].sort().join("\n") &&
      sourceZone.dnssec.parentDsTtl === input.publicEvidence.dnssecDsTtl
      ? validateSignedDnssecEvidence({
          domain: normalizedDomain.domain,
          parentDsRecords: sourceZone.dnssec.parentDsRecords,
          parentDsTtl: sourceZone.dnssec.parentDsTtl,
          dnsKeys: sourceZone.dnssec.dnsKeys,
        })
      : { valid: false as const, reason: "signed_dnssec_state_mismatch" }
    if (!dnssecEvidence.valid) {
      return {
        readiness: "unsupported",
        domain: normalizedDomain.domain,
        classification: null,
        message:
          "De DNSSEC-bronketen is niet volledig of cryptografisch aantoonbaar. Er wordt niets besteld of betaald.",
        reason: "dnssec_evidence_incomplete",
        sourceZone,
        sourceZoneHash: domainMigrationSourceAuthorityHash(sourceZone),
        encryptedInput: null,
        publicEvidence: input.publicEvidence,
      }
    }
  }
  if (
    !input.transferAuthorizationAccepted ||
    !validateTldTransferAuthorization(capability, input.transferCode)
  ) {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message: "Een geldige verhuiscode en uitdrukkelijke verhuisautorisatie zijn vereist.",
      reason: "transfer_authorization_invalid",
      sourceZone,
      sourceZoneHash: domainMigrationSourceAuthorityHash(sourceZone),
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  if (
    !capability.dnssec.productionEvidenceComplete &&
    !input.acceptedCapabilityVersion
  ) {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message:
        `Inkomende verhuizing voor .${normalizedDomain.extension} blijft uitgeschakeld totdat DNSSEC- en cutoverbewijs compleet is.`,
      reason: "dnssec_release_pending",
      sourceZone,
      sourceZoneHash: domainMigrationSourceAuthorityHash(sourceZone),
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  const sourceZoneHash = domainMigrationSourceAuthorityHash(sourceZone)
  if (input.acquiredSource) {
    if (
      input.acquiredSource.zone !== input.zoneExport ||
      sourceZone.authority.mechanism !==
        sourceAuthorityMechanism(input.acquiredSource.mechanism)
    ) {
      return {
        readiness: "unsupported",
        domain: normalizedDomain.domain,
        classification: null,
        message: "De automatische bronautoriteit komt niet overeen met de gevalideerde zone.",
        reason: "source_authority_mismatch",
        sourceZone,
        sourceZoneHash,
        encryptedInput: null,
        publicEvidence: input.publicEvidence,
      }
    }
    const checkoutInput: CheckoutMigrationInput = {
      schemaVersion: 2,
      generationRunId: String(input.generationRunId),
      domain: normalizedDomain.domain,
      classification: "automatic",
      sourceMechanism: input.acquiredSource.mechanism,
      sourceZoneHash,
      sourceZone: input.acquiredSource.zone,
      sourceRefreshCredential: input.acquiredSource.refreshCredential,
      transferCode: input.transferCode,
      transferAuthorizationAccepted: true,
      gtldTransferEligibilityAccepted:
        input.gtldTransferEligibilityAccepted === true,
    }
    return {
      readiness: "ready_automatic",
      domain: normalizedDomain.domain,
      classification: "automatic",
      message: "De volledige DNS-bron en verhuisvereisten zijn automatisch gevalideerd.",
      reason: "automatic_ready",
      sourceZone,
      sourceZoneHash,
      encryptedInput: sealCheckoutMigrationInput(checkoutInput, input.env),
      publicEvidence: input.publicEvidence,
    }
  }
  // A source must be acquired through a current authorized adapter. A customer
  // assertion or historical export is not enough to create or resume a route.
  return {
    readiness: "unsupported",
    domain: normalizedDomain.domain,
    classification: null,
    message:
      "Deze export is technisch geldig, maar de volledigheid kan nog niet automatisch worden bewezen. Er wordt niets besteld of betaald.",
    reason: "source_completeness_unproven",
    sourceZone,
    sourceZoneHash,
    encryptedInput: null,
    publicEvidence: input.publicEvidence,
  }
}
