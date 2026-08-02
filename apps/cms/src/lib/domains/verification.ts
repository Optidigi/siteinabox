import "server-only"

import { execFile } from "node:child_process"
import { Resolver, resolve, resolve4, resolve6, resolveNs } from "node:dns/promises"
import { promisify } from "node:util"
import {
  semanticZoneComparison,
  type NormalizedMigrationDnsRecord,
} from "@siteinabox/contracts/domain-migration"

const canonicalDnsName = (value: string): string => value.trim().toLowerCase().replace(/\.$/, "")
const canonicalDsRecords = (value: string[]): string[] =>
  [...new Set(value.map((record) =>
    record.trim().replace(/\s+/g, " ").toUpperCase()).filter(Boolean))].sort()
const execFileAsync = promisify(execFile)

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
  ttl?: number | null
  reason: string | null
}

export type DnssecChainVerification = {
  status: "verified" | "pending"
  authenticatedData: boolean
  dnskeyMatched: boolean
  rrsigPresent: boolean
  parentDsMatched: boolean
  parentDsTtl: number | null
  reason: string | null
}

export async function verifyDnssecChain(
  domain: string,
  expectedKey: {
    flags: number
    protocol: 3
    algorithm: number
    publicKey: string
    parentDsRecords?: string[]
  },
  options: {
    fetchImpl?: typeof fetch
    resolverUrl?: string
    signal?: AbortSignal
  } = {},
): Promise<DnssecChainVerification> {
  try {
    const url = new URL(options.resolverUrl ?? "https://cloudflare-dns.com/dns-query")
    url.searchParams.set("name", canonicalDnsName(domain))
    url.searchParams.set("type", "DNSKEY")
    url.searchParams.set("do", "true")
    url.searchParams.set("cd", "false")
    const response = await (options.fetchImpl ?? globalThis.fetch)(url, {
      method: "GET",
      headers: {
        Accept: "application/dns-json",
        "User-Agent": "Siteinabox-DNSSEC-Verification/1.0",
      },
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error("dnssec_resolver_http_failed")
    const payload: unknown = await response.json()
    const result = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {}
    const answers = Array.isArray(result.Answer)
      ? result.Answer.flatMap((entry) =>
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? [entry as Record<string, unknown>]
            : [])
      : []
    const expectedKeyData = [
      expectedKey.flags,
      expectedKey.protocol,
      expectedKey.algorithm,
      expectedKey.publicKey.replace(/\s+/g, ""),
    ].join(" ")
    const dnskeyMatched = answers.some((answer) =>
      answer.type === 48 &&
      typeof answer.data === "string" &&
      answer.data.trim().replace(/\s+/g, " ") === expectedKeyData)
    const rrsigPresent = answers.some((answer) =>
      answer.type === 46 &&
      typeof answer.data === "string" &&
      answer.data.trim().startsWith("48 "))
    const authenticatedData = result.AD === true
    const dsUrl = new URL(url)
    dsUrl.searchParams.set("type", "DS")
    const dsResponse = await (options.fetchImpl ?? globalThis.fetch)(dsUrl, {
      method: "GET",
      headers: {
        Accept: "application/dns-json",
        "User-Agent": "Siteinabox-DNSSEC-Verification/1.0",
      },
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(10_000),
    })
    if (!dsResponse.ok) throw new Error("dnssec_ds_resolver_http_failed")
    const dsPayload: unknown = await dsResponse.json()
    const dsResult = dsPayload && typeof dsPayload === "object" && !Array.isArray(dsPayload)
      ? dsPayload as Record<string, unknown>
      : {}
    const dsAnswers = Array.isArray(dsResult.Answer)
      ? dsResult.Answer.flatMap((entry) =>
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? [entry as Record<string, unknown>]
            : [])
      : []
    const expectedParentDs = canonicalDsRecords(expectedKey.parentDsRecords ?? [])
    const actualParentDs = canonicalDsRecords(dsAnswers.flatMap((answer) =>
      answer.type === 43 && typeof answer.data === "string"
        ? [answer.data]
        : []))
    const parentDsMatched = expectedParentDs.length > 0 &&
      actualParentDs.length === expectedParentDs.length &&
      actualParentDs.every((record, index) => record === expectedParentDs[index])
    const parentDsTtls = dsAnswers.flatMap((answer) =>
      answer.type === 43 &&
      typeof answer.TTL === "number" &&
      Number.isSafeInteger(answer.TTL) &&
      answer.TTL > 0
        ? [answer.TTL]
        : [])
    const parentDsTtl = parentDsTtls.length > 0 ? Math.max(...parentDsTtls) : null
    const verified = result.Status === 0 &&
      dsResult.Status === 0 &&
      authenticatedData &&
      dsResult.AD === true &&
      dnskeyMatched &&
      rrsigPresent &&
      parentDsMatched &&
      parentDsTtl != null
    return {
      status: verified ? "verified" : "pending",
      authenticatedData,
      dnskeyMatched,
      rrsigPresent,
      parentDsMatched,
      parentDsTtl,
      reason: verified ? null : "dnssec_chain_not_authenticated",
    }
  } catch {
    return {
      status: "pending",
      authenticatedData: false,
      dnskeyMatched: false,
      rrsigPresent: false,
      parentDsMatched: false,
      parentDsTtl: null,
      reason: "dnssec_chain_lookup_failed",
    }
  }
}

type DsRecord = {
  keyTag: number
  algorithm: number
  digestType: number
  digest: string
}

type DsLookup = {
  records: DsRecord[]
  ttl: number | null
}

type DigDsLookupInput = {
  hostname: string
  nameserver?: string
  authoritative: boolean
}

// Containers commonly inherit a non-recursive resolver from their runtime
// network. DNSSEC preflight needs an independent recursive view in addition to
// the parent-authoritative consensus, so make that resolver explicit.
const publicRecursiveDnsServer = "1.1.1.1"

const parseDigDsLookup = (
  stdout: string,
  input: DigDsLookupInput,
): DsLookup => {
  const status = stdout.match(/^;;\s+->>HEADER<<-.*\bstatus:\s*([A-Z]+),/m)?.[1]
  const flags = stdout.match(/^;;\s+flags:\s*([^;]+);/m)?.[1]
    ?.trim()
    .split(/\s+/) ?? []
  if (status !== "NOERROR") {
    throw new Error("parent_ds_response_status_invalid")
  }
  if (input.authoritative && !flags.includes("aa")) {
    throw new Error("parent_ds_authoritative_answer_missing")
  }

  const records: DsRecord[] = []
  const ttls: number[] = []
  for (const line of stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
    if (line.startsWith(";")) continue
    const fields = line.split(/\s+/)
    const dsIndex = fields.findIndex((field) => field.toUpperCase() === "DS")
    if (dsIndex < 0) {
      throw new Error("parent_ds_answer_invalid")
    }
    const ttl = Number(fields[1])
    const keyTag = Number(fields[dsIndex + 1])
    const algorithm = Number(fields[dsIndex + 2])
    const digestType = Number(fields[dsIndex + 3])
    const digest = fields.slice(dsIndex + 4).join("").toUpperCase()
    if (
      !Number.isSafeInteger(ttl) || ttl <= 0 ||
      !Number.isSafeInteger(keyTag) || keyTag < 0 ||
      !Number.isSafeInteger(algorithm) || algorithm < 0 ||
      !Number.isSafeInteger(digestType) || digestType < 0 ||
      !/^[A-F0-9]+$/.test(digest)
    ) {
      throw new Error("parent_ds_answer_invalid")
    }
    records.push({ keyTag, algorithm, digestType, digest })
    ttls.push(ttl)
  }
  return {
    records,
    ttl: ttls.length > 0 ? Math.max(...ttls) : null,
  }
}

const lookupDsWithDig = async (input: DigDsLookupInput): Promise<DsLookup> => {
  const { stdout } = await execFileAsync("dig", [
    "+time=5",
    "+tries=1",
    ...(input.authoritative ? ["+norecurse"] : []),
    "+noall",
    "+comments",
    "+answer",
    ...(input.nameserver ? [`@${input.nameserver}`] : []),
    input.hostname,
    "DS",
  ], { encoding: "utf8", timeout: 10_000, maxBuffer: 64 * 1_024 })
  return parseDigDsLookup(stdout, input)
}

export async function verifyParentDsAbsent(
  domain: string,
  options: {
    resolveDsImpl?: (hostname: string) => Promise<DsRecord[]>
    resolveRecursiveDsImpl?: (hostname: string) => Promise<DsRecord[]>
    resolveParentNsImpl?: (hostname: string) => Promise<string[]>
    authoritativeDsLookupImpl?: (
      nameserver: string,
      hostname: string,
    ) => Promise<{ records: DsRecord[]; ttl: number | null }>
    digDsLookupImpl?: (input: DigDsLookupInput) => Promise<DsLookup>
  } = {},
): Promise<ParentDsVerification> {
  try {
    const parseDs = (result: unknown): DsRecord[] => {
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
    }
    const normalizeDs = (records: DsRecord[]): string[] =>
      records.map((record) =>
        `${record.keyTag} ${record.algorithm} ${record.digestType} ${record.digest.toUpperCase()}`,
      ).sort()
    let normalized: string[]
    let authoritativeTtl: number | null = null
    if (options.resolveDsImpl) {
      normalized = normalizeDs(await options.resolveDsImpl(canonicalDnsName(domain)))
    } else {
      const hostname = canonicalDnsName(domain)
      const parent = hostname.split(".").slice(1).join(".")
      if (!parent) throw new Error("parent_zone_missing")
      const parentNameservers = [...new Set(
        (await (options.resolveParentNsImpl ?? resolveNs)(parent))
          .map(canonicalDnsName),
      )].sort()
      if (parentNameservers.length < 2) throw new Error("parent_nameservers_incomplete")
      const digDsLookup = options.digDsLookupImpl ?? lookupDsWithDig
      const authoritativeLookups = await Promise.all(parentNameservers.map(
        async (nameserver) => options.authoritativeDsLookupImpl
          ? await options.authoritativeDsLookupImpl(nameserver, hostname)
          : await digDsLookup({
              hostname,
              nameserver,
              authoritative: true,
            }),
      ))
      const authoritativeResults = authoritativeLookups.map((lookup) =>
        normalizeDs(lookup.records))
      const authoritativeTtls = authoritativeLookups.flatMap((lookup) =>
        lookup.ttl == null ? [] : [lookup.ttl])
      normalized = authoritativeResults[0] ?? []
      if (authoritativeResults.some((records) =>
        records.length !== normalized.length ||
        records.some((record, index) => record !== normalized[index]))) {
        return {
          status: "indeterminate",
          records: [],
          ttl: null,
          reason: "parent_ds_authoritative_mismatch",
        }
      }
      authoritativeTtl = authoritativeTtls.length > 0
        ? Math.max(...authoritativeTtls)
        : null
      if (normalized.length > 0 && authoritativeTtl == null) {
        return {
          status: "indeterminate",
          records: normalized,
          ttl: null,
          reason: "parent_ds_authoritative_ttl_missing",
        }
      }
      const recursiveLookup = options.resolveRecursiveDsImpl
        ? { records: parseDs(await options.resolveRecursiveDsImpl(hostname)), ttl: null }
        : await digDsLookup({
            hostname,
            nameserver: publicRecursiveDnsServer,
            authoritative: false,
          })
      const recursive = normalizeDs(recursiveLookup.records)
      if (
        recursive.length !== normalized.length ||
        recursive.some((record, index) => record !== normalized[index])
      ) {
        return {
          status: "indeterminate",
          records: normalized,
          ttl: authoritativeTtl,
          reason: "parent_ds_recursive_mismatch",
        }
      }
    }
    return {
      status: normalized.length === 0 ? "absent" : "present",
      records: normalized,
      ...(options.resolveDsImpl ? {} : { ttl: authoritativeTtl }),
      reason: normalized.length === 0 ? null : "parent_ds_present",
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : ""
    if (["ENODATA", "ENOTFOUND", "ENONAME"].includes(code)) {
      return { status: "absent", records: [], ttl: null, reason: null }
    }
    return {
      status: "indeterminate",
      records: [],
      ttl: null,
      reason: "parent_ds_lookup_failed",
    }
  }
}

export async function verifyHttpsEndpoint(
  domain: string,
  options: {
    fetchImpl?: typeof fetch
    signal?: AbortSignal
    service?: "renderer" | "cms"
    expectedDomain?: string
  } = {},
): Promise<HttpsVerification> {
  try {
    const service = options.service ?? "renderer"
    const path = service === "renderer" ? "/__siab/edge-check" : "/api/edge-check"
    const response = await (options.fetchImpl ?? globalThis.fetch)(`https://${canonicalDnsName(domain)}${path}`, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Siteinabox-Commerce-Verification/1.0" },
    })
    if (
      response.status === 200 &&
      response.headers.get("x-siab-service") === service &&
      (
        !options.expectedDomain ||
        response.headers.get("x-siab-domain") === canonicalDnsName(options.expectedDomain)
      )
    ) {
      return { status: "verified", httpStatus: response.status, reason: null }
    }
    return {
      status: "pending",
      httpStatus: response.status,
      reason: "https_service_identity_unready",
    }
  } catch {
    return { status: "pending", httpStatus: null, reason: "https_connection_unready" }
  }
}
