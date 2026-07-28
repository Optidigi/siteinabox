import "server-only"

import { resolve, resolveNs } from "node:dns/promises"
import {
  normalizeCompleteZone,
  type CompleteZoneExport,
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

const MAX_ZONE_EXPORT_BYTES = 256 * 1_024
const MAX_ZONE_EXPORT_AGE_MS = 24 * 60 * 60_000
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60_000

type MigrationReadiness =
  | "ready_automatic"
  | "ready_assisted"
  | "custom_quote"
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
  const acceptedCapability = input.acceptedOrderRecollection &&
      input.acceptedCapabilityVersion
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
  if (
    sourceZone.dnssec.status === "signed" ||
    input.publicEvidence.dnssecDsPresent
  ) {
    return {
      readiness: "custom_quote",
      domain: normalizedDomain.domain,
      classification: null,
      message: "DNSSEC-migratie is nog niet vrijgegeven voor de standaardcheckout.",
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
  // A customer upload can be structurally complete, but the customer's own
  // `complete: true` assertion is not provider provenance. Until an
  // authenticated connector, authorized AXFR/IXFR, or reviewed provider-native
  // parser supplies completeness evidence, operator verification is required.
  const classification = "assisted_standard"
  const sourceZoneHash = domainMigrationSourceAuthorityHash(sourceZone)
  const checkoutInput: CheckoutMigrationInput = {
    schemaVersion: 1,
    generationRunId: String(input.generationRunId),
    domain: normalizedDomain.domain,
    classification,
    sourceMechanism: "customer_authorized_provider_export_v1",
    sourceZoneHash,
    sourceZone: input.zoneExport,
    transferCode: input.transferCode,
    transferAuthorizationAccepted: true,
  }
  return {
    readiness: "ready_assisted",
    domain: normalizedDomain.domain,
    classification,
    message:
      "De DNS-export is technisch gevalideerd; controle door een operator is vereist voor begeleide migratie à € 49,00 excl. btw.",
    sourceZone,
    sourceZoneHash,
    encryptedInput: sealCheckoutMigrationInput(checkoutInput, input.env),
    publicEvidence: input.publicEvidence,
  }
}
