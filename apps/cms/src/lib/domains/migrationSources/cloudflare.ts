import "server-only"

import {
  completeZoneExportSchema,
  normalizeCompleteZone,
  type CompleteZoneExport,
  type MigrationDnsRecord,
} from "@siteinabox/contracts/domain-migration"
import { domainMigrationSourceAuthorityHash } from "@/lib/domains/migrationEvidence"
import { splitDomain } from "@/lib/domains/normalize"
import {
  MigrationSourceAuthorizationError,
  type AcquiredMigrationSource,
} from "./types"

type FetchLike = typeof fetch

type CloudflareSourceOptions = {
  fetchImpl?: FetchLike
  apiBaseUrl?: string
  now?: () => Date
  requestTimeoutMs?: number
}

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const readPayload = async (response: Response): Promise<Record<string, unknown>> => {
  if (response.status === 401 || response.status === 403) {
    throw new MigrationSourceAuthorizationError()
  }
  let payload: Record<string, unknown>
  try {
    payload = readObject(await response.json())
  } catch {
    throw new Error(`Cloudflare source read failed with HTTP ${response.status}.`)
  }
  if (!response.ok || payload.success === false) {
    throw new Error(`Cloudflare source read failed with HTTP ${response.status}.`)
  }
  return payload
}

const apiBase = (options?: CloudflareSourceOptions): string =>
  (options?.apiBaseUrl ?? "https://api.cloudflare.com/client/v4").replace(/\/+$/, "")

const headers = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
})

const readRequest = (
  token: string,
  options?: CloudflareSourceOptions,
): RequestInit => ({
  method: "GET",
  headers: headers(token),
  signal: AbortSignal.timeout(options?.requestTimeoutMs ?? 5_000),
})

const canonical = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "")

const integer = (
  value: unknown,
  field: string,
  maximum = 65_535,
): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) {
    throw new Error(`Cloudflare ${field} is invalid.`)
  }
  return Number(value)
}

const recordFromCloudflare = (
  value: Record<string, unknown>,
  domain: string,
): MigrationDnsRecord | null => {
  const type = typeof value.type === "string" ? value.type.toUpperCase() : ""
  const name = typeof value.name === "string" ? canonical(value.name) : ""
  const ttlValue = value.ttl === 1 ? 300 : value.ttl
  const ttl = integer(ttlValue, "record TTL", 86_400)
  const proxied = value.proxied === true
  if (!name || (name !== domain && !name.endsWith(`.${domain}`))) {
    throw new Error("Cloudflare source record owner is outside the selected zone.")
  }
  if (type === "A" || type === "AAAA") {
    return {
      type,
      name,
      ttl,
      content: String(value.content ?? ""),
      proxied,
    }
  }
  if (type === "CNAME" || type === "NS") {
    if (type === "NS" && name === domain) return null
    return {
      type,
      name,
      ttl,
      content: canonical(String(value.content ?? "")),
      proxied,
    }
  }
  if (type === "TXT") {
    return { type, name, ttl, content: String(value.content ?? ""), proxied }
  }
  const data = readObject(value.data)
  if (type === "MX") {
    return {
      type,
      name,
      ttl,
      priority: integer(value.priority ?? data.priority, "MX priority"),
      target: canonical(String(data.target ?? value.content ?? "")),
      proxied,
    }
  }
  if (type === "CAA") {
    return {
      type,
      name,
      ttl,
      flags: integer(data.flags ?? 0, "CAA flags", 255),
      tag: String(data.tag ?? ""),
      value: String(data.value ?? ""),
      proxied,
    }
  }
  if (type === "SRV") {
    return {
      type,
      name,
      ttl,
      priority: integer(data.priority, "SRV priority"),
      weight: integer(data.weight, "SRV weight"),
      port: integer(data.port, "SRV port"),
      target: canonical(String(data.target ?? "")),
      proxied,
    }
  }
  if (type === "TLSA") {
    return {
      type,
      name,
      ttl,
      certificateUsage: integer(
        data.usage ?? data.certificate_usage,
        "TLSA certificate usage",
        3,
      ),
      selector: integer(data.selector, "TLSA selector", 1),
      matchingType: integer(
        data.matching_type,
        "TLSA matching type",
        2,
      ),
      certificateAssociationData: String(
        data.certificate ?? data.certificate_association_data ?? "",
      ),
      proxied,
    }
  }
  throw new Error(`Cloudflare source record type ${type || "unknown"} is unsupported.`)
}

const capture = async (
  domain: string,
  token: string,
  options?: CloudflareSourceOptions,
): Promise<{ zoneId: string; zone: CompleteZoneExport }> => {
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch
  const zonesResponse = await fetchImpl(
    `${apiBase(options)}/zones?${new URLSearchParams({
      name: domain,
      match: "all",
      status: "active",
      per_page: "5",
    }).toString()}`,
    readRequest(token, options),
  )
  const zonesPayload = await readPayload(zonesResponse)
  const zones = Array.isArray(zonesPayload.result)
    ? zonesPayload.result.map(readObject).filter((zone) =>
        canonical(String(zone.name ?? "")) === domain)
    : []
  if (zones.length !== 1) {
    throw new Error("Cloudflare token must expose exactly the selected active zone.")
  }
  const sourceZone = zones[0]!
  const zoneId = typeof sourceZone.id === "string" ? sourceZone.id : ""
  const nameservers = Array.isArray(sourceZone.name_servers)
    ? sourceZone.name_servers
      .filter((entry): entry is string => typeof entry === "string")
      .map(canonical)
    : []
  if (!zoneId || nameservers.length < 2) {
    throw new Error("Cloudflare source zone metadata is incomplete.")
  }
  const rawRecords: Record<string, unknown>[] = []
  let expectedCount: number | null = null
  let expectedPages: number | null = null
  for (let page = 1; ; page += 1) {
    const response = await fetchImpl(
      `${apiBase(options)}/zones/${encodeURIComponent(zoneId)}/dns_records?` +
        new URLSearchParams({ per_page: "500", page: String(page) }).toString(),
      readRequest(token, options),
    )
    const payload = await readPayload(response)
    const info = readObject(payload.result_info)
    if (
      !Number.isSafeInteger(info.total_count) ||
      !Number.isSafeInteger(info.total_pages) ||
      Number(info.total_count) < 0 ||
      Number(info.total_count) > 500 ||
      Number(info.total_pages) < 1 ||
      Number(info.total_pages) > 1_000 ||
      info.page !== page
    ) {
      throw new Error("Cloudflare source pagination metadata is invalid.")
    }
    if (expectedCount == null) {
      expectedCount = Number(info.total_count)
      expectedPages = Number(info.total_pages)
    } else if (
      expectedCount !== info.total_count ||
      expectedPages !== info.total_pages
    ) {
      throw new Error("Cloudflare source changed during pagination.")
    }
    if (!Array.isArray(payload.result)) {
      throw new Error("Cloudflare source record response is incomplete.")
    }
    rawRecords.push(...payload.result.map(readObject))
    if (page === expectedPages) break
  }
  if (rawRecords.length !== expectedCount || rawRecords.length > 500) {
    throw new Error("Cloudflare source record capture is incomplete or too large.")
  }
  const dnssecResponse = await fetchImpl(
    `${apiBase(options)}/zones/${encodeURIComponent(zoneId)}/dnssec`,
    readRequest(token, options),
  )
  const dnssecPayload = await readPayload(dnssecResponse)
  const dnssec = readObject(dnssecPayload.result)
  const signed = dnssec.status === "active"
  const ds = typeof dnssec.ds === "string" && dnssec.ds.trim()
    ? [dnssec.ds.trim()]
    : []
  const records = rawRecords.flatMap((record) => {
    const parsed = recordFromCloudflare(record, domain)
    return parsed ? [parsed] : []
  })
  const zone = completeZoneExportSchema.parse({
    schemaVersion: 1,
    format: "siab-complete-zone-v1",
    domain,
    acquiredAt: (options?.now?.() ?? new Date()).toISOString(),
    authority: {
      mechanism: "cloudflare_api",
      provider: "cloudflare",
      complete: true,
    },
    authoritativeNameservers: nameservers,
    dnssec: {
      status: signed ? "signed" : "unsigned",
      parentDsRecords: signed ? ds : [],
    },
    records,
  } satisfies CompleteZoneExport)
  return { zoneId, zone }
}

export async function acquireCloudflareSource(input: {
  domain: string
  token: string
  options?: CloudflareSourceOptions
}): Promise<AcquiredMigrationSource> {
  const domain = splitDomain(input.domain).domain
  const token = input.token.trim()
  if (!token) throw new Error("A scoped Cloudflare source token is required.")
  const first = await capture(domain, token, input.options)
  const second = await capture(domain, token, input.options)
  if (
    first.zoneId !== second.zoneId ||
    domainMigrationSourceAuthorityHash(normalizeCompleteZone(first.zone)) !==
      domainMigrationSourceAuthorityHash(normalizeCompleteZone(second.zone))
  ) {
    throw new Error("Cloudflare source changed during the stable capture.")
  }
  return {
    mechanism: "cloudflare_api_v1",
    zone: second.zone,
    refreshCredential: {
      kind: "cloudflare_api_token",
      token,
      zoneId: second.zoneId,
    },
  }
}
