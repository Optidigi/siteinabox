import "server-only"

import { Resolver, resolve, resolve4, resolve6, resolveNs } from "node:dns/promises"
import {
  semanticZoneComparison,
  type NormalizedMigrationDnsRecord,
} from "@siteinabox/contracts/domain-migration"

const canonicalDnsName = (value: string): string => value.trim().toLowerCase().replace(/\.$/, "")

export type AuthoritativeDnsVerification = {
  status: "verified" | "pending"
  delegatedNameServers: string[]
  respondingNameServers: string[]
  reason: string | null
}

type DnsVerificationOptions = {
  resolveNsImpl?: (hostname: string) => Promise<string[]>
  resolve4Impl?: (hostname: string) => Promise<string[]>
  resolve6Impl?: (hostname: string) => Promise<string[]>
  resolverFactory?: () => Pick<Resolver, "setServers" | "resolveSoa">
}

const addressesForNameServer = async (
  nameServer: string,
  options: DnsVerificationOptions,
): Promise<string[]> => {
  const [ipv4, ipv6] = await Promise.all([
    (options.resolve4Impl ?? resolve4)(nameServer).catch(() => []),
    (options.resolve6Impl ?? resolve6)(nameServer).catch(() => []),
  ])
  return [...ipv4, ...ipv6]
}

export async function verifyAuthoritativeDns(
  domain: string,
  expectedNameServers: string[],
  options: DnsVerificationOptions = {},
): Promise<AuthoritativeDnsVerification> {
  const expected = [...new Set(expectedNameServers.map(canonicalDnsName))].sort()
  if (expected.length === 0) {
    throw new Error("Authoritative DNS verification requires assigned nameservers.")
  }

  let delegated: string[]
  try {
    delegated = [...new Set(
      (await (options.resolveNsImpl ?? resolveNs)(canonicalDnsName(domain))).map(canonicalDnsName),
    )].sort()
  } catch {
    return {
      status: "pending",
      delegatedNameServers: [],
      respondingNameServers: [],
      reason: "delegation_not_visible",
    }
  }
  if (delegated.length !== expected.length || delegated.some((entry, index) => entry !== expected[index])) {
    return {
      status: "pending",
      delegatedNameServers: delegated,
      respondingNameServers: [],
      reason: "delegation_mismatch",
    }
  }

  const responding: string[] = []
  for (const nameServer of expected) {
    const addresses = await addressesForNameServer(nameServer, options)
    for (const address of addresses) {
      const resolver = options.resolverFactory?.() ?? new Resolver()
      resolver.setServers([address])
      try {
        await resolver.resolveSoa(canonicalDnsName(domain))
        responding.push(nameServer)
        break
      } catch {
        // A second assigned nameserver or address can still authoritatively answer.
      }
    }
  }
  if (responding.length !== expected.length) {
    return {
      status: "pending",
      delegatedNameServers: delegated,
      respondingNameServers: responding,
      reason: "authoritative_nameservers_not_responding",
    }
  }
  return {
    status: "verified",
    delegatedNameServers: delegated,
    respondingNameServers: responding,
    reason: null,
  }
}

export type PreservedDnsVerification = {
  status: "verified" | "pending"
  recursiveEquivalent: boolean
  authoritativeEquivalent: boolean
  reason: string | null
}

type PreservedRecordType = NormalizedMigrationDnsRecord["type"]
type ResolveRecords = (
  hostname: string,
  type: PreservedRecordType,
) => Promise<unknown>

const dnsQueryName = (name: string): string =>
  name.startsWith("*.")
    ? `siab-preservation-probe.${name.slice(2)}`
    : name

const bufferHex = (value: unknown): string | null => {
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value).toString("hex")
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
      .toString("hex")
  }
  return null
}

const parsedDnsAnswers = (
  expected: NormalizedMigrationDnsRecord[],
  raw: unknown,
): NormalizedMigrationDnsRecord[] => {
  const exemplar = expected[0]
  if (!exemplar || !Array.isArray(raw)) return []
  const common = {
    name: exemplar.name,
    ttl: exemplar.ttl,
    proxied: false,
  }
  if (exemplar.type === "A" || exemplar.type === "AAAA" ||
    exemplar.type === "CNAME" || exemplar.type === "NS") {
    return raw.flatMap((value) =>
      typeof value === "string"
        ? [{
            ...common,
            type: exemplar.type,
            content: exemplar.type === "A"
              ? value
              : canonicalDnsName(value),
          }]
        : [],
    ) as NormalizedMigrationDnsRecord[]
  }
  if (exemplar.type === "TXT") {
    return raw.flatMap((value) =>
      Array.isArray(value) && value.every((part) => typeof part === "string")
        ? [{ ...common, type: "TXT" as const, content: value.join("") }]
        : [],
    )
  }
  if (exemplar.type === "MX") {
    return raw.flatMap((value) => {
      const entry = value && typeof value === "object"
        ? value as Record<string, unknown>
        : {}
      return Number.isSafeInteger(entry.priority) &&
        typeof entry.exchange === "string"
        ? [{
            ...common,
            type: "MX" as const,
            priority: Number(entry.priority),
            target: canonicalDnsName(entry.exchange),
          }]
        : []
    })
  }
  if (exemplar.type === "SRV") {
    return raw.flatMap((value) => {
      const entry = value && typeof value === "object"
        ? value as Record<string, unknown>
        : {}
      return Number.isSafeInteger(entry.priority) &&
        Number.isSafeInteger(entry.weight) &&
        Number.isSafeInteger(entry.port) &&
        typeof entry.name === "string"
        ? [{
            ...common,
            type: "SRV" as const,
            priority: Number(entry.priority),
            weight: Number(entry.weight),
            port: Number(entry.port),
            target: canonicalDnsName(entry.name),
          }]
        : []
    })
  }
  if (exemplar.type === "CAA") {
    return raw.flatMap((value) => {
      const entry = value && typeof value === "object"
        ? value as Record<string, unknown>
        : {}
      const tag = ["issue", "issuewild", "iodef", "contactemail", "contactphone"]
        .find((key) => typeof entry[key] === "string")
      return Number.isSafeInteger(entry.critical) && tag
        ? [{
            ...common,
            type: "CAA" as const,
            flags: Number(entry.critical),
            tag,
            value: String(entry[tag]),
          }]
        : []
    })
  }
  return raw.flatMap((value) => {
    const entry = value && typeof value === "object"
      ? value as Record<string, unknown>
      : {}
    const data = bufferHex(entry.data)
    return Number.isSafeInteger(entry.certUsage) &&
      Number.isSafeInteger(entry.selector) &&
      Number.isSafeInteger(entry.match) &&
      data
      ? [{
          ...common,
          type: "TLSA" as const,
          certificateUsage: Number(entry.certUsage),
          selector: Number(entry.selector),
          matchingType: Number(entry.match),
          certificateAssociationData: data,
        }]
      : []
  })
}

const groupedRecords = (
  records: NormalizedMigrationDnsRecord[],
): NormalizedMigrationDnsRecord[][] => {
  const groups = new Map<string, NormalizedMigrationDnsRecord[]>()
  for (const record of records) {
    const key = `${record.name}\u0000${record.type}`
    groups.set(key, [...(groups.get(key) ?? []), record])
  }
  return [...groups.values()]
}

const queryAndComparePreservedRecords = async (
  records: NormalizedMigrationDnsRecord[],
  resolveRecords: ResolveRecords,
): Promise<boolean> => {
  for (const expected of groupedRecords(records)) {
    const exemplar = expected[0]!
    let raw: unknown
    try {
      raw = await resolveRecords(dnsQueryName(exemplar.name), exemplar.type)
    } catch {
      return false
    }
    const actual = parsedDnsAnswers(expected, raw)
    if (!semanticZoneComparison(expected, actual).equivalent) return false
  }
  return true
}

export async function verifyPreservedDnsRecords(
  records: NormalizedMigrationDnsRecord[],
  authoritativeNameServers: string[],
  options: {
    recursiveResolveImpl?: ResolveRecords
    authoritativeResolveImpl?: (
      nameServer: string,
      hostname: string,
      type: PreservedRecordType,
    ) => Promise<unknown>
    resolve4Impl?: (hostname: string) => Promise<string[]>
    resolve6Impl?: (hostname: string) => Promise<string[]>
  } = {},
): Promise<PreservedDnsVerification> {
  if (records.length === 0) {
    return {
      status: "verified",
      recursiveEquivalent: true,
      authoritativeEquivalent: true,
      reason: null,
    }
  }
  const recursiveResolve = options.recursiveResolveImpl ??
    ((hostname, type) => resolve(hostname, type))
  const recursiveEquivalent = await queryAndComparePreservedRecords(
    records,
    recursiveResolve,
  )
  if (!recursiveEquivalent) {
    return {
      status: "pending",
      recursiveEquivalent: false,
      authoritativeEquivalent: false,
      reason: "recursive_preserved_record_mismatch",
    }
  }
  for (const nameServer of authoritativeNameServers) {
    const authoritativeResolve = options.authoritativeResolveImpl
      ? (hostname: string, type: PreservedRecordType) =>
          options.authoritativeResolveImpl!(nameServer, hostname, type)
      : async (hostname: string, type: PreservedRecordType) => {
          const addresses = await addressesForNameServer(nameServer, {
            resolve4Impl: options.resolve4Impl,
            resolve6Impl: options.resolve6Impl,
          })
          if (addresses.length === 0) {
            throw new Error("Authoritative nameserver has no resolvable address.")
          }
          let lastError: unknown
          for (const address of addresses) {
            const resolver = new Resolver()
            resolver.setServers([address])
            try {
              return await resolver.resolve(hostname, type)
            } catch (error) {
              lastError = error
            }
          }
          throw lastError ?? new Error("Authoritative DNS query failed.")
        }
    if (!(await queryAndComparePreservedRecords(records, authoritativeResolve))) {
      return {
        status: "pending",
        recursiveEquivalent: true,
        authoritativeEquivalent: false,
        reason: "authoritative_preserved_record_mismatch",
      }
    }
  }
  return {
    status: "verified",
    recursiveEquivalent: true,
    authoritativeEquivalent: true,
    reason: null,
  }
}

export type HttpsVerification = {
  status: "verified" | "pending"
  httpStatus: number | null
  reason: string | null
}

export type ParentDsVerification = {
  status: "absent" | "present" | "indeterminate"
  records: string[]
  reason: string | null
}

type DsRecord = {
  keyTag: number
  algorithm: number
  digestType: number
  digest: string
}

export async function verifyParentDsAbsent(
  domain: string,
  options: {
    resolveDsImpl?: (hostname: string) => Promise<DsRecord[]>
  } = {},
): Promise<ParentDsVerification> {
  try {
    const resolveDsImpl = options.resolveDsImpl ?? (async (hostname: string) => {
      const result: unknown = await resolve(hostname, "DS")
      if (!Array.isArray(result)) return []
      return result.flatMap((entry): DsRecord[] => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
        const record = entry as Record<string, unknown>
        return (
          typeof record.keyTag === "number" &&
          typeof record.algorithm === "number" &&
          typeof record.digestType === "number" &&
          typeof record.digest === "string"
        ) ? [{
            keyTag: record.keyTag,
            algorithm: record.algorithm,
            digestType: record.digestType,
            digest: record.digest,
          }] : []
      })
    })
    const records = await resolveDsImpl(canonicalDnsName(domain))
    const normalized = records.map((record) =>
      `${record.keyTag} ${record.algorithm} ${record.digestType} ${record.digest.toUpperCase()}`,
    ).sort()
    return {
      status: normalized.length === 0 ? "absent" : "present",
      records: normalized,
      reason: normalized.length === 0 ? null : "parent_ds_present",
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : ""
    if (["ENODATA", "ENOTFOUND", "ENONAME"].includes(code)) {
      return { status: "absent", records: [], reason: null }
    }
    return { status: "indeterminate", records: [], reason: "parent_ds_lookup_failed" }
  }
}

export async function verifyHttpsEndpoint(
  domain: string,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<HttpsVerification> {
  try {
    const response = await (options.fetchImpl ?? globalThis.fetch)(`https://${canonicalDnsName(domain)}/`, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Siteinabox-Commerce-Verification/1.0" },
    })
    if (response.status >= 200 && response.status < 500) {
      return { status: "verified", httpStatus: response.status, reason: null }
    }
    return {
      status: "pending",
      httpStatus: response.status,
      reason: "https_endpoint_unready",
    }
  } catch {
    return { status: "pending", httpStatus: null, reason: "https_connection_unready" }
  }
}
