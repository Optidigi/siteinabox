import "server-only"

import { Resolver, resolve, resolve4, resolve6, resolveNs } from "node:dns/promises"

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
