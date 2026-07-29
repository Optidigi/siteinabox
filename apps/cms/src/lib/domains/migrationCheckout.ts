import "server-only"

import { resolve, resolveNs } from "node:dns/promises"
import {
  normalizeCompleteZone,
  type CompleteZoneExport,
  type MigrationSourceMechanism,
  type NormalizedCompleteZone,
} from "@siteinabox/contracts/domain-migration"
import {
  getTldCapabilityForProductionOperation,
  getTldCapabilityByVersion,
  tldCapabilityOperationFlagEnabled,
  validateTldTransferAuthorization,
} from "@siteinabox/contracts/tld-capabilities"
import type { MigrationClassification } from "@siteinabox/contracts/commerce"

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

const MAX_ZONE_EXPORT_BYTES = 256 * 1_024
const MAX_ZONE_EXPORT_AGE_MS = 24 * 60 * 60_000
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60_000
// New Cloudflare Free zones have a 200-record quota. Reserve two records for
// the managed apex and www routes so checkout cannot accept an unimportable
// source before the destination zone exists and exposes its exact quota.
const MAX_AUTOMATIC_SOURCE_RECORDS = 198

type MigrationReadiness =
  | "ready_automatic"
  | "ready_assisted"
  | "unsupported"

export type ExistingDomainPublicEvidence = {
  checkedAt: string
  authoritativeNameservers: string[]
  dnssecDsPresent: boolean
  probableDnsProvider: string | null
  registrar: string | null
  supplementalOnly: true
}

export type ExistingDomainMigrationAssessment = {
  readiness: MigrationReadiness
  domain: string
  classification: Exclude<MigrationClassification, "complex"> | null
  message: string
  sourceZone: NormalizedCompleteZone | null
  sourceZoneHash: string | null
  encryptedInput: string | null
  publicEvidence: ExistingDomainPublicEvidence | null
}

const canonicalNames = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim().toLowerCase().replace(/\.$/, "")))]
    .filter(Boolean)
    .sort()

const probableDnsProvider = (nameservers: string[]): string | null => {
  const joined = nameservers.join(" ")
  if (joined.includes("cloudflare.com")) return "cloudflare"
  if (joined.includes("transip.net")) return "transip"
  if (joined.includes("yourhosting.nl")) return "yourhosting"
  if (joined.includes("openprovider.")) return "openprovider"
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

const rdapRegistrar = async (
  domain: string,
  fetchImpl: typeof fetch,
): Promise<string | null> => {
  if (!domain.endsWith(".nl")) return null
  const response = await fetchImpl(
    `https://rdap.sidn.nl/domain/${encodeURIComponent(domain)}`,
    {
      method: "GET",
      headers: { Accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(3_000),
    },
  )
  if (!response.ok) return null
  const payload = await response.json() as {
    entities?: Array<{
      handle?: string
      roles?: string[]
      vcardArray?: [string, Array<[string, Record<string, unknown>, string, string]>]
    }>
  }
  const registrar = payload.entities?.find((entity) =>
    entity.roles?.includes("registrar"))
  if (!registrar) return null
  const name = registrar.vcardArray?.[1].find((entry) => entry[0] === "fn")?.[3]
  return typeof name === "string" && name.trim()
    ? name.trim()
    : registrar.handle?.trim() || null
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
  const resolveDsImpl = input.resolveDsImpl ??
    ((hostname: string) => resolve(hostname, "DS") as Promise<unknown[]>)
  const fetchImpl = input.fetchImpl ?? fetch
  const [nameservers, dsResult, registrar] = await Promise.all([
    timeout(resolveNsImpl(domain), 3_000),
    timeout(resolveDsImpl(domain).catch((error: NodeJS.ErrnoException) => {
      if (["ENODATA", "ENOTFOUND"].includes(error.code ?? "")) return []
      throw error
    }), 3_000),
    rdapRegistrar(domain, fetchImpl).catch(() => null),
  ])
  const normalizedNameservers = canonicalNames(nameservers)
  return {
    checkedAt: (input.now ?? new Date()).toISOString(),
    authoritativeNameservers: normalizedNameservers,
    dnssecDsPresent: dsResult.length > 0,
    probableDnsProvider: probableDnsProvider(normalizedNameservers),
    registrar,
    supplementalOnly: true,
  }
}

export function existingDomainMigrationCheckoutEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED?.trim() === "1"
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
  if (mechanism === "validated_provider_export_v1") {
    return env.COMMERCE_MIGRATION_SOURCE_PROVIDER_EXPORT_ENABLED?.trim() === "1"
  }
  return false
}

export function assessExistingDomainMigrationInput(input: {
  generationRunId: string | number
  domain: string
  zoneExport: CompleteZoneExport
  transferCode: string
  transferAuthorizationAccepted: boolean
  requestedAssistance: boolean
  publicEvidence: ExistingDomainPublicEvidence
  acceptedOrderRecollection?: boolean
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
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message:
        "Deze DNSSEC-overgang kan nog niet volledig automatisch worden uitgevoerd. Er wordt niets besteld of betaald.",
      sourceZone,
      sourceZoneHash: domainMigrationSourceAuthorityHash(sourceZone),
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
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
      sourceZone,
      sourceZoneHash: domainMigrationSourceAuthorityHash(sourceZone),
      encryptedInput: null,
      publicEvidence: input.publicEvidence,
    }
  }
  if (
    !capability.dnssec.productionEvidenceComplete &&
    !input.acceptedOrderRecollection
  ) {
    return {
      readiness: "unsupported",
      domain: normalizedDomain.domain,
      classification: null,
      message:
        `Inkomende verhuizing voor .${normalizedDomain.extension} blijft uitgeschakeld totdat DNSSEC- en cutoverbewijs compleet is.`,
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
    }
    return {
      readiness: "ready_automatic",
      domain: normalizedDomain.domain,
      classification: "automatic",
      message: "De volledige DNS-bron en verhuisvereisten zijn automatisch gevalideerd.",
      sourceZone,
      sourceZoneHash,
      encryptedInput: sealCheckoutMigrationInput(checkoutInput, input.env),
      publicEvidence: input.publicEvidence,
    }
  }
  if (input.acceptedOrderRecollection) {
    const checkoutInput: CheckoutMigrationInput = {
      schemaVersion: 1,
      generationRunId: String(input.generationRunId),
      domain: normalizedDomain.domain,
      classification: "assisted_standard",
      sourceMechanism: "customer_authorized_provider_export_v1",
      sourceZoneHash,
      sourceZone: input.zoneExport,
      transferCode: input.transferCode,
      transferAuthorizationAccepted: true,
    }
    return {
      readiness: "ready_assisted",
      domain: normalizedDomain.domain,
      classification: "assisted_standard",
      message: "De bestaande geaccepteerde migratiegegevens zijn veilig vernieuwd.",
      sourceZone,
      sourceZoneHash,
      encryptedInput: sealCheckoutMigrationInput(checkoutInput, input.env),
      publicEvidence: input.publicEvidence,
    }
  }
  // A customer assertion can be structurally valid without proving that the
  // export is authoritative and complete. The retired assisted product may not
  // turn that assertion into a payable order. Automatic source acquisition
  // must establish provenance before ordinary checkout becomes available.
  return {
    readiness: "unsupported",
    domain: normalizedDomain.domain,
    classification: null,
    message:
      "Deze export is technisch geldig, maar de volledigheid kan nog niet automatisch worden bewezen. Er wordt niets besteld of betaald.",
    sourceZone,
    sourceZoneHash,
    encryptedInput: null,
    publicEvidence: input.publicEvidence,
  }
}
