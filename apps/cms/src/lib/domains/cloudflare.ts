import "server-only"
import { z } from "zod"
import { migrationDnsRecordSchema } from "@siteinabox/contracts/domain-migration"
import { requestProviderJson } from "@/lib/providers/http"
import {
  type NormalizedMigrationDnsRecord,
} from "@siteinabox/contracts/domain-migration"
import { parseCloudflareDnssec } from "@/lib/domains/dnssecProviderContracts"
import { cloudflareTunnelTarget } from "@/lib/domains/cloudflareTunnels"
import { splitDomain } from "@/lib/domains/normalize"

export type CloudflareZoneResult = {
  id: string
  name: string
  nameServers: string[]
  status: "initializing" | "pending" | "active" | "moved" | "unknown"
  raw: unknown
}

export type CloudflareZoneLookup =
  | { outcome: "absent" }
  | { outcome: "exact"; zone: CloudflareZoneResult }
  | { outcome: "ambiguous" }

export type CloudflareDnsRecordType = "A" | "CNAME"
export type CloudflareDnsRecordReadableType = CloudflareDnsRecordType | "AAAA"

export type CloudflareDnsRecordRequest = {
  type: CloudflareDnsRecordType
  name: string
  content: string
  ttl: number
  proxied: boolean
}

export type CloudflareDnsRecordResult = {
  id: string | null
  type: CloudflareDnsRecordReadableType
  name: string
  content: string
  proxied: boolean
  raw: unknown
}

export type CloudflareOwnedDnsReconciliationResult =
  CloudflareDnsRecordResult & {
    ownershipDisposition: "owned" | "created" | "unowned_reused"
  }

export type CloudflareMigrationDnsRecordResult = {
  id: string | null
  record: NormalizedMigrationDnsRecord
  raw: unknown
}

export type CloudflareDnsRecordUsage = {
  recordQuota: number
  recordUsage: number
}

export type CloudflareEdgeDnsPreflight = {
  unownedMatchingRecordIds: string[]
}

export type CloudflareEmailSendingSubdomainResult = {
  id: string
  name: string
  enabled: boolean
  dkimSelector: string | null
  returnPathDomain: string | null
  raw: unknown
}

export type CloudflareSslVerificationResult = {
  status: "active" | "pending" | "failed"
  providerStatuses: string[]
  raw: unknown
}

export type CloudflareHostnameCertificateResult = {
  hostname: string
  universalSslEnabled: boolean
  covered: boolean
  certificateStatuses: string[]
  raw: unknown
}

export type CloudflareDnssecResult = {
  status: "disabled" | "pending" | "active" | "unknown"
  flags: number | null
  algorithm: number | null
  publicKey: string | null
  ds: string | null
  dsTtl: number | null
  raw: unknown
}

type FetchLike = typeof fetch
const providerFetch = (options?: CloudflareOptions): typeof fetch => async (input, init = {}) => {
  const url = new URL(String(input))
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Provider request URL is invalid.")
  const response = await requestProviderJson(url.toString(), init, {
    operation: "Cloudflare request",
    timeoutMs: options?.timeoutMs ?? 10_000,
    maxBodyBytes: 512 * 1024,
    readAttempts: 2,
    signal: options?.signal,
    fetchImpl: options?.fetchImpl,
  })
  if (response.ok && typeof readObject(response.body).success !== "boolean") throw new Error("Cloudflare response envelope is invalid.")
  if (response.ok && readObject(response.body).success === true && (init.method ?? "GET") !== "GET") {
    resultObject(response.body)
  }
  return Response.json(response.body ?? null, { status: response.status })
}


type CloudflareOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: FetchLike
  timeoutMs?: number
  signal?: AbortSignal
}

const DEFAULT_API_BASE = "https://api.cloudflare.com/client/v4"

export class CloudflareApiError extends Error {
  status: number
  operation: string

  constructor(operation: string, status: number) {
    super(`${operation} failed with HTTP ${status}.`)
    this.name = "CloudflareApiError"
    this.status = status
    this.operation = operation
  }
}

export class CloudflareIndeterminateWriteError extends Error {
  operation: string

  constructor(operation: string, _cause?: unknown) {
    super(`${operation} has an indeterminate provider outcome.`)
    this.name = "CloudflareIndeterminateWriteError"
    this.operation = operation
  }
}

export class CloudflareAmbiguousZoneLookupError extends Error {
  constructor(readonly domain: string) {
    super(`Cloudflare zone lookup for ${domain} returned multiple exact matches.`)
    this.name = "CloudflareAmbiguousZoneLookupError"
  }
}

export function classifyCloudflareZoneLookup(
  domainInput: string,
  zones: readonly CloudflareZoneResult[],
): CloudflareZoneLookup {
  const domain = splitDomain(domainInput).domain
  const exact = zones.filter((zone) =>
    zone.name.trim().toLowerCase().replace(/\.$/, "") === domain)
  if (exact.length === 0) return { outcome: "absent" }
  if (exact.length === 1) return { outcome: "exact", zone: exact[0]! }
  return { outcome: "ambiguous" }
}

export class CloudflareDnsRecordConflictError extends Error {
  constructor(readonly hostname: string) {
    super(`Cloudflare already contains an unowned conflicting address record for ${hostname}.`)
    this.name = "CloudflareDnsRecordConflictError"
  }
}

const assertProviderId = (id: string): void => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(id)) throw new Error("Cloudflare identifier is invalid.")
}

const cleanEnv = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const apiBase = (env: NodeJS.ProcessEnv): string =>
  (cleanEnv(env.CLOUDFLARE_API_BASE_URL) ?? DEFAULT_API_BASE).replace(/\/+$/, "")

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

const json = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text) return null
  return JSON.parse(text) as unknown
}

const resultObject = (value: unknown): Record<string, unknown> => {
  const result = readObject(value).result
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Cloudflare response result is invalid.")
  return readObject(result)
}

const resultArray = (value: unknown): Record<string, unknown>[] => {
  const result = readObject(value).result
  if (!Array.isArray(result) || result.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) throw new Error("Cloudflare response list is invalid.")
  return result.map(readObject)
}

export function requireCloudflareConfig(env: NodeJS.ProcessEnv = process.env): { token: string; accountId: string } {
  const token = cleanEnv(env.CLOUDFLARE_API_TOKEN)
  const accountId = cleanEnv(env.CLOUDFLARE_ACCOUNT_ID)
  if (!token || !accountId) throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.")
  return { token, accountId }
}

const headers = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
  "Content-Type": "application/json",
})

const assertCloudflareOk = (operation: string, response: Response, payload: unknown) => {
  if (!response.ok) throw new CloudflareApiError(operation, response.status)
  if (readObject(payload).success !== true) throw new CloudflareApiError(operation, response.status)
}

const readCloudflareWritePayload = async (
  operation: string,
  response: Response,
): Promise<unknown> => {
  if (
    !response.ok &&
    (response.status >= 500 || response.status === 408 || response.status === 429)
  ) {
    throw new CloudflareIndeterminateWriteError(operation)
  }
  try {
    return await json(response)
  } catch (error) {
    if (response.ok) throw new CloudflareIndeterminateWriteError(operation, error)
    throw new CloudflareApiError(operation, response.status)
  }
}

const parseCloudflareZone = (
  value: unknown,
  fallbackName?: string,
): CloudflareZoneResult | null => {
  const result = readObject(value)
  const id = typeof result.id === "string" ? result.id : null
  const name = typeof result.name === "string" ? result.name : fallbackName
  const nameServers = Array.isArray(result.name_servers)
    ? result.name_servers.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
    )
    : []
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(id) || !name || nameServers.length === 0 || nameServers.length !== (Array.isArray(result.name_servers) ? result.name_servers.length : 0)) return null
  if (fallbackName && name.toLowerCase().replace(/\.$/, "") !== fallbackName) return null
  try { splitDomain(name) } catch { return null }
  const rawStatus = typeof result.status === "string" ? result.status : "unknown"
  const status = ["initializing", "pending", "active", "moved"].includes(rawStatus)
    ? rawStatus as CloudflareZoneResult["status"]
    : "unknown"
  return { id, name, nameServers, status, raw: value }
}

const parseEmailSendingSubdomain = (
  value: unknown,
  fallbackName?: string | null,
): CloudflareEmailSendingSubdomainResult => {
  const schema = z.object({ tag: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/), name: z.string().trim().min(1).max(255).optional(), enabled: z.boolean(), dkim_selector: z.string().trim().min(1).max(255).nullish(), return_path_domain: z.string().trim().min(1).max(255).nullish() }).passthrough()
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new Error("Cloudflare Email Sending response is invalid.")
  const result = parsed.data
  if (fallbackName && result.name != null && result.name.toLowerCase() !== fallbackName.toLowerCase()) throw new Error("Cloudflare Email Sending response identity is invalid.")
  const id = typeof result.tag === "string" && result.tag.trim().length > 0 ? result.tag : null
  const name = typeof result.name === "string" && result.name.trim().length > 0 ? result.name : fallbackName
  if (!id) throw new Error("Cloudflare Email Sending subdomain response did not include a subdomain id.")
  if (!name) throw new Error("Cloudflare Email Sending subdomain response did not include a name.")
  return {
    id,
    name,
    enabled: result.enabled === true,
    dkimSelector: typeof result.dkim_selector === "string" && result.dkim_selector.trim().length > 0
      ? result.dkim_selector
      : null,
    returnPathDomain: typeof result.return_path_domain === "string" && result.return_path_domain.trim().length > 0
      ? result.return_path_domain
      : null,
    raw: value,
  }
}

export async function createCloudflareZone(domainInput: string, options?: CloudflareOptions): Promise<CloudflareZoneResult> {
  const env = options?.env ?? process.env
  const { token, accountId } = requireCloudflareConfig(env)
  const domain = splitDomain(domainInput)
  let response: Response
  try {
    response = await providerFetch(options)(`${apiBase(env)}/zones`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        account: { id: accountId },
        name: domain.domain,
        type: "full",
      }),
    })
  } catch (error) {
    throw new CloudflareIndeterminateWriteError("Cloudflare zone creation", error)
  }
  const payload = await readCloudflareWritePayload("Cloudflare zone creation", response)
  assertCloudflareOk("Cloudflare zone creation", response, payload)
  const zoneResult = resultObject(payload)
  const account = readObject(zoneResult.account)
  if (account.id != null && account.id !== accountId) throw new CloudflareIndeterminateWriteError("Cloudflare zone creation")
  const result = parseCloudflareZone(zoneResult, domain.domain)
  if (!result) {
    throw new CloudflareIndeterminateWriteError("Cloudflare zone creation")
  }
  return { ...result, raw: payload }
}

export async function listCloudflareZones(
  domainInput: string,
  options?: CloudflareOptions,
): Promise<CloudflareZoneResult[]> {
  const env = options?.env ?? process.env
  const { token, accountId } = requireCloudflareConfig(env)
  const domain = splitDomain(domainInput)
  const query = new URLSearchParams({
    "account.id": accountId,
    name: domain.domain,
    match: "all",
    per_page: "5",
  })
  const response = await providerFetch(options)(`${apiBase(env)}/zones?${query.toString()}`, {
    method: "GET",
    headers: headers(token),
  })
  const payload = await json(response)
  assertCloudflareOk("Cloudflare zone list", response, payload)
  const zones = resultArray(payload).map((entry) => parseCloudflareZone(entry))
  if (zones.some((entry) => entry == null || entry.name.toLowerCase().replace(/\.$/, "") !== domain.domain)) throw new Error("Cloudflare zone lookup identity is invalid.")
  const info = readObject(readObject(payload).result_info)
  if ((info.total_count != null && info.total_count !== zones.length) || (info.total_pages != null && (!Number.isSafeInteger(info.total_pages) || Number(info.total_pages) > 1 || Number(info.total_pages) < 1))) throw new Error("Cloudflare zone lookup is incomplete.")
  return zones.filter((entry): entry is CloudflareZoneResult => entry !== null)
}

export async function createOrReuseCloudflareZone(
  domainInput: string,
  options?: CloudflareOptions,
): Promise<CloudflareZoneResult> {
  const domain = splitDomain(domainInput).domain
  const existing = classifyCloudflareZoneLookup(
    domain,
    await listCloudflareZones(domain, options),
  )
  if (existing.outcome === "exact") return existing.zone
  if (existing.outcome === "ambiguous") {
    throw new CloudflareAmbiguousZoneLookupError(domain)
  }
  try {
    return await createCloudflareZone(domain, options)
  } catch (error) {
    let reconciledZones: CloudflareZoneResult[]
    try {
      reconciledZones = await listCloudflareZones(domain, options)
    } catch {
      // Preserve the original write outcome classification.
      throw error
    }
    const reconciled = classifyCloudflareZoneLookup(domain, reconciledZones)
    if (reconciled.outcome === "exact") return reconciled.zone
    if (reconciled.outcome === "ambiguous") {
      throw new CloudflareAmbiguousZoneLookupError(domain)
    }
    throw error
  }
}

export function buildCloudflareDnsRecordRequests(
  domainInput: string,
  env: NodeJS.ProcessEnv = process.env,
  input?: { ttl?: number; proxied?: boolean },
): CloudflareDnsRecordRequest[] {
  const domain = splitDomain(domainInput)
  const targetHost = cleanEnv(env.SIAB_RENDERER_TARGET_HOST)
  const targetIp = cleanEnv(env.SIAB_RENDERER_TARGET_IP)
  if (!targetHost && !targetIp) {
    throw new Error("SIAB_RENDERER_TARGET_HOST or SIAB_RENDERER_TARGET_IP is required for Cloudflare DNS records.")
  }

  const ttl = input?.ttl ?? 1
  const proxied = input?.proxied ?? true
  if (targetIp) {
    return [
      { type: "A", name: domain.domain, content: targetIp, ttl, proxied },
      { type: "CNAME", name: `www.${domain.domain}`, content: domain.domain, ttl, proxied },
    ]
  }

  return [
    { type: "CNAME", name: domain.domain, content: targetHost as string, ttl, proxied },
    { type: "CNAME", name: `www.${domain.domain}`, content: domain.domain, ttl, proxied },
  ]
}

export function buildCloudflareEdgeDnsRecordRequests(
  domainInput: string,
  env: NodeJS.ProcessEnv = process.env,
): CloudflareDnsRecordRequest[] {
  const domain = splitDomain(domainInput).domain
  const rendererTarget = cloudflareTunnelTarget("renderer", env)
  return [
    {
      type: "CNAME",
      name: domain,
      content: rendererTarget,
      ttl: 1,
      proxied: true,
    },
    {
      type: "CNAME",
      name: `www.${domain}`,
      content: rendererTarget,
      ttl: 1,
      proxied: true,
    },
  ]
}

export async function createCloudflareDnsRecord(
  zoneId: string,
  record: CloudflareDnsRecordRequest,
  options?: CloudflareOptions,
): Promise<CloudflareDnsRecordResult> {
  assertProviderId(zoneId)
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  let response: Response
  try {
    response = await providerFetch(options)(`${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dns_records`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(record),
    })
  } catch (error) {
    throw new CloudflareIndeterminateWriteError("Cloudflare DNS record creation", error)
  }
  const payload = await readCloudflareWritePayload("Cloudflare DNS record creation", response)
  assertCloudflareOk("Cloudflare DNS record creation", response, payload)
  const result = resultObject(payload)
  const id = typeof result.id === "string" ? result.id : null
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(id) || (result.name != null && result.name !== record.name) || (result.type != null && result.type !== record.type) || (result.content != null && result.content !== record.content)) {
    throw new CloudflareIndeterminateWriteError("Cloudflare DNS record creation")
  }
  return {
    id,
    type: record.type,
    name: typeof result.name === "string" ? result.name : record.name,
    content: typeof result.content === "string" ? result.content : record.content,
    proxied: typeof result.proxied === "boolean" ? result.proxied : record.proxied,
    raw: payload,
  }
}

export async function listCloudflareDnsRecords(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareDnsRecordResult[]> {
  assertProviderId(zoneId)
  options = { ...options, signal: options?.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) }
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const records: Record<string, unknown>[] = []
  let page = 1
  let expectedTotalPages: number | null = null
  let expectedTotalCount: number | null = null
  const maximumPages = 100
  while (true) {
    if (page > maximumPages) {
      throw new Error("Cloudflare DNS record pagination exceeded its safety bound.")
    }
    const response = await providerFetch(options)(
      `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=500&page=${page}`,
      { method: "GET", headers: headers(token) },
    )
    const payload = await json(response)
    assertCloudflareOk("Cloudflare DNS record list", response, payload)
    const pageRecords = resultArray(payload)
    records.push(...pageRecords)
    if (records.length > 10_000) throw new Error("Cloudflare DNS record inventory is too large.")
    const resultInfo = readObject(readObject(payload).result_info)
    if (["page", "per_page", "total_pages", "total_count", "count"].some((key) => resultInfo[key] != null && !Number.isSafeInteger(resultInfo[key]))) throw new Error("Cloudflare DNS pagination metadata is invalid.")
    const responsePage = Number.isSafeInteger(resultInfo.page)
      ? Number(resultInfo.page)
      : null
    const responsePerPage = Number.isSafeInteger(resultInfo.per_page)
      ? Number(resultInfo.per_page)
      : null
    const totalPages = Number.isSafeInteger(resultInfo.total_pages)
      ? Number(resultInfo.total_pages)
      : null
    const totalCount = Number.isSafeInteger(resultInfo.total_count)
      ? Number(resultInfo.total_count)
      : null
    const count = Number.isSafeInteger(resultInfo.count)
      ? Number(resultInfo.count)
      : null
    if (
      (responsePage != null && responsePage !== page) ||
      (responsePerPage != null && responsePerPage !== 500) ||
      (count != null && count !== pageRecords.length) ||
      (totalPages != null && (totalPages < 1 || totalPages > maximumPages)) ||
      (totalCount != null && totalCount < records.length)
    ) {
      throw new Error("Cloudflare DNS record pagination metadata is invalid.")
    }
    if (expectedTotalPages == null) expectedTotalPages = totalPages
    if (expectedTotalCount == null) expectedTotalCount = totalCount
    if (
      totalPages != null &&
      expectedTotalPages != null &&
      totalPages !== expectedTotalPages
    ) {
      throw new Error("Cloudflare DNS record pagination changed during read.")
    }
    if (
      totalCount != null &&
      expectedTotalCount != null &&
      totalCount !== expectedTotalCount
    ) {
      throw new Error("Cloudflare DNS record count changed during read.")
    }
    const more = totalPages != null
      ? page < totalPages
      : pageRecords.length === 500
    if (!more) break
    page += 1
  }
  const recordIds = records.map((record) => record.id).filter((id): id is string => typeof id === "string")
  if (new Set(recordIds).size !== recordIds.length) throw new Error("Cloudflare DNS record pagination repeated an identity.")
  if (expectedTotalCount != null && records.length !== expectedTotalCount) {
    throw new Error("Cloudflare DNS record pagination returned an incomplete result.")
  }
  return records.flatMap((result) => {
    const type =
      result.type === "A" ||
      result.type === "AAAA" ||
      result.type === "CNAME"
        ? result.type
        : null
    const name = typeof result.name === "string" ? result.name : null
    const content = typeof result.content === "string" ? result.content : null
    if (!type) return []
    if (!name || !content || typeof result.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(result.id) || (result.proxied != null && typeof result.proxied !== "boolean")) throw new Error("Cloudflare address record is invalid.")
    return [{
      id: typeof result.id === "string" ? result.id : null,
      type,
      name,
      content,
      proxied: result.proxied === true,
      raw: result,
    }]
  })
}

export async function assertCloudflareEdgeDnsRecordsReconciliable(
  zoneId: string,
  records: CloudflareDnsRecordRequest[],
  ownedRecordIds: string[],
  options?: CloudflareOptions,
): Promise<CloudflareEdgeDnsPreflight> {
  assertProviderId(zoneId)
  const existing = await listCloudflareDnsRecords(zoneId, options)
  const unownedMatchingRecordIds: string[] = []
  for (const requested of records) {
    const normalizedName = requested.name.toLowerCase().replace(/\.$/, "")
    const candidates = existing.filter((candidate) =>
      candidate.name.toLowerCase().replace(/\.$/, "") === normalizedName)
    const matching = candidates.find((candidate) =>
      sameCloudflareRecord(candidate, requested))
    if (matching) {
      if (matching.id && !ownedRecordIds.includes(matching.id)) {
        unownedMatchingRecordIds.push(matching.id)
      }
      continue
    }
    if (candidates.length === 0) continue
    const owned = candidates.filter((candidate) =>
      candidate.id != null && ownedRecordIds.includes(candidate.id))
    if (candidates.length !== 1 || owned.length !== 1) {
      throw new CloudflareDnsRecordConflictError(requested.name)
    }
  }
  return { unownedMatchingRecordIds: [...new Set(unownedMatchingRecordIds)] }
}

const sameCloudflareRecord = (
  existing: CloudflareDnsRecordResult,
  requested: CloudflareDnsRecordRequest,
): boolean =>
  existing.type === requested.type &&
  existing.name.toLowerCase().replace(/\.$/, "") === requested.name.toLowerCase().replace(/\.$/, "") &&
  existing.content.toLowerCase().replace(/\.$/, "") ===
    requested.content.toLowerCase().replace(/\.$/, "") &&
  existing.proxied === requested.proxied

export async function createOrReuseCloudflareDnsRecord(
  zoneId: string,
  record: CloudflareDnsRecordRequest,
  options?: CloudflareOptions,
): Promise<CloudflareDnsRecordResult> {
  assertProviderId(zoneId)
  const existing = (await listCloudflareDnsRecords(zoneId, options))
    .find((candidate) => sameCloudflareRecord(candidate, record))
  if (existing) return existing
  try {
    return await createCloudflareDnsRecord(zoneId, record, options)
  } catch (error) {
    try {
      const reconciled = (await listCloudflareDnsRecords(zoneId, options))
        .find((candidate) => sameCloudflareRecord(candidate, record))
      if (reconciled) return reconciled
    } catch {
      // Preserve the original write outcome classification.
    }
    throw error
  }
}

async function updateCloudflareDnsRecord(
  zoneId: string,
  recordId: string,
  record: CloudflareDnsRecordRequest,
  options?: CloudflareOptions,
): Promise<CloudflareDnsRecordResult> {
  assertProviderId(zoneId)
  assertProviderId(recordId)
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  let response: Response
  try {
    response = await providerFetch(options)(
      `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
      {
        method: "PUT",
        headers: headers(token),
        body: JSON.stringify(record),
      },
    )
  } catch (error) {
    throw new CloudflareIndeterminateWriteError("Cloudflare DNS record update", error)
  }
  const payload = await readCloudflareWritePayload("Cloudflare DNS record update", response)
  assertCloudflareOk("Cloudflare DNS record update", response, payload)
  const result = resultObject(payload)
  if ((result.id != null && result.id !== recordId) || (result.name != null && result.name !== record.name) || (result.type != null && result.type !== record.type) || (result.content != null && result.content !== record.content) || (result.proxied != null && result.proxied !== record.proxied)) throw new CloudflareIndeterminateWriteError("Cloudflare DNS record update")
  const id = typeof result.id === "string" ? result.id : recordId
  return {
    id,
    type: result.type === "A" || result.type === "CNAME" ? result.type : record.type,
    name: typeof result.name === "string" ? result.name : record.name,
    content: typeof result.content === "string" ? result.content : record.content,
    proxied: typeof result.proxied === "boolean" ? result.proxied : record.proxied,
    raw: payload,
  }
}

export async function reconcileOwnedCloudflareDnsRecord(
  zoneId: string,
  record: CloudflareDnsRecordRequest,
  ownedRecordIds: string[],
  options?: CloudflareOptions,
): Promise<CloudflareOwnedDnsReconciliationResult> {
  assertProviderId(zoneId)
  const normalizedName = record.name.toLowerCase().replace(/\.$/, "")
  const readCandidates = async () => (await listCloudflareDnsRecords(zoneId, options))
    .filter((candidate) =>
      candidate.name.toLowerCase().replace(/\.$/, "") === normalizedName)
  let candidates = await readCandidates()
  const matching = candidates.find((candidate) => sameCloudflareRecord(candidate, record))
  if (matching) {
    return {
      ...matching,
      ownershipDisposition:
        matching.id && ownedRecordIds.includes(matching.id)
          ? "owned"
          : "unowned_reused",
    }
  }
  if (candidates.length === 0) {
    try {
      return {
        ...await createCloudflareDnsRecord(zoneId, record, options),
        ownershipDisposition: "created",
      }
    } catch (error) {
      candidates = await readCandidates()
      const reconciled = candidates.find((candidate) =>
        sameCloudflareRecord(candidate, record))
      if (reconciled) {
        return {
          ...reconciled,
          ownershipDisposition:
            reconciled.id && ownedRecordIds.includes(reconciled.id)
              ? "owned"
              : "unowned_reused",
        }
      }
      throw error
    }
  }
  const owned = candidates.filter((candidate) =>
    candidate.id != null && ownedRecordIds.includes(candidate.id))
  if (candidates.length !== 1 || owned.length !== 1 || !owned[0]?.id) {
    throw new CloudflareDnsRecordConflictError(record.name)
  }
  try {
    return {
      ...await updateCloudflareDnsRecord(
        zoneId,
        owned[0].id,
        record,
        options,
      ),
      ownershipDisposition: "owned",
    }
  } catch (error) {
    candidates = await readCandidates()
    const reconciled = candidates.find((candidate) =>
      sameCloudflareRecord(candidate, record))
    if (reconciled) {
      return {
        ...reconciled,
        ownershipDisposition:
          reconciled.id && ownedRecordIds.includes(reconciled.id)
            ? "owned"
            : "unowned_reused",
      }
    }
    throw error
  }
}

const migrationRecordBody = (
  record: NormalizedMigrationDnsRecord,
): Record<string, unknown> => {
  const common = {
    type: record.type,
    name: record.name,
    ttl: record.ttl,
    proxied: record.proxied,
  }
  if (record.type === "MX") {
    return { ...common, content: record.target, priority: record.priority }
  }
  if (record.type === "CAA") {
    return {
      ...common,
      data: { flags: record.flags, tag: record.tag, value: record.value },
    }
  }
  if (record.type === "SRV") {
    return {
      ...common,
      data: {
        priority: record.priority,
        weight: record.weight,
        port: record.port,
        target: record.target,
      },
    }
  }
  if (record.type === "TLSA") {
    return {
      ...common,
      data: {
        usage: record.certificateUsage,
        selector: record.selector,
        matching_type: record.matchingType,
        certificate: record.certificateAssociationData,
      },
    }
  }
  return { ...common, content: record.content }
}

const canonicalDnsName = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "")

const parseMigrationDnsRecord = (
  value: Record<string, unknown>,
): CloudflareMigrationDnsRecordResult | null => {
  const type = value.type
  const name = typeof value.name === "string" ? canonicalDnsName(value.name) : null
  const ttl = typeof value.ttl === "number" && Number.isSafeInteger(value.ttl)
    ? value.ttl
    : null
  if (ttl == null || ttl < 1 || ttl > 86_400 || (value.proxied != null && typeof value.proxied !== "boolean")) return null
  const proxied = value.proxied === true
  const semanticTtl = proxied && ttl === 1 ? 300 : ttl
  if (!name) return null
  if (type === "MX") {
    const priority = typeof value.priority === "number" ? value.priority : null
    const target = typeof value.content === "string" ? canonicalDnsName(value.content) : null
    if (priority == null || !target) return null
    return {
      id: typeof value.id === "string" ? value.id : null,
      record: { type, name, ttl: semanticTtl, priority, target, proxied },
      raw: value,
    }
  }
  if (type === "CAA") {
    const data = readObject(value.data)
    const content = typeof value.content === "string" ? value.content.trim() : ""
    const match = content.match(/^(\d+)\s+([A-Za-z0-9]+)\s+"?(.+?)"?$/)
    const flags = typeof data.flags === "number"
      ? data.flags
      : match ? Number(match[1]) : null
    const tag = typeof data.tag === "string"
      ? data.tag.toLowerCase()
      : match?.[2]?.toLowerCase()
    const caaValue = typeof data.value === "string" ? data.value : match?.[3]
    if (flags == null || !tag || !caaValue) return null
    return {
      id: typeof value.id === "string" ? value.id : null,
      record: {
        type,
        name,
        ttl: semanticTtl,
        flags,
        tag,
        value: caaValue,
        proxied,
      },
      raw: value,
    }
  }
  if (type === "SRV") {
    const data = readObject(value.data)
    const parts = typeof value.content === "string"
      ? value.content.trim().split(/\s+/)
      : []
    const priority = typeof data.priority === "number" ? data.priority : Number(parts[0])
    const weight = typeof data.weight === "number" ? data.weight : Number(parts[1])
    const port = typeof data.port === "number" ? data.port : Number(parts[2])
    const target = typeof data.target === "string"
      ? canonicalDnsName(data.target)
      : parts[3] ? canonicalDnsName(parts[3]) : null
    if (
      !Number.isSafeInteger(priority) ||
      !Number.isSafeInteger(weight) ||
      !Number.isSafeInteger(port) ||
      !target
    ) return null
    return {
      id: typeof value.id === "string" ? value.id : null,
      record: {
        type,
        name,
        ttl: semanticTtl,
        priority,
        weight,
        port,
        target,
        proxied,
      },
      raw: value,
    }
  }
  if (type === "TLSA") {
    const data = readObject(value.data)
    const parts = typeof value.content === "string"
      ? value.content.trim().split(/\s+/)
      : []
    const certificateUsage = typeof data.usage === "number"
      ? data.usage
      : Number(parts[0])
    const selector = typeof data.selector === "number"
      ? data.selector
      : Number(parts[1])
    const matchingType = typeof data.matching_type === "number"
      ? data.matching_type
      : Number(parts[2])
    const certificateAssociationData = typeof data.certificate === "string"
      ? data.certificate.toLowerCase()
      : parts[3]?.toLowerCase()
    const validAssociationData = typeof certificateAssociationData === "string" &&
      /^[a-f0-9]+$/.test(certificateAssociationData) &&
      certificateAssociationData.length % 2 === 0 &&
      (
        (matchingType === 0) ||
        (matchingType === 1 && certificateAssociationData.length === 64) ||
        (matchingType === 2 && certificateAssociationData.length === 128)
      )
    if (
      !Number.isSafeInteger(certificateUsage) ||
      !Number.isSafeInteger(selector) ||
      !Number.isSafeInteger(matchingType) ||
      !validAssociationData
    ) return null
    return {
      id: typeof value.id === "string" ? value.id : null,
      record: {
        type,
        name,
        ttl: semanticTtl,
        certificateUsage,
        selector,
        matchingType,
        certificateAssociationData,
        proxied,
      },
      raw: value,
    }
  }
  if (
    type === "A" ||
    type === "AAAA" ||
    type === "CNAME" ||
    type === "TXT" ||
    type === "NS"
  ) {
    const content = typeof value.content === "string" ? value.content : null
    if (content == null) return null
    const normalizedContent = type === "CNAME" || type === "NS" || type === "AAAA"
      ? canonicalDnsName(content)
      : content
    return {
      id: typeof value.id === "string" ? value.id : null,
      record: {
        type,
        name,
        ttl: semanticTtl,
        content: normalizedContent,
        proxied,
      },
      raw: value,
    }
  }
  return null
}

export async function listCloudflareMigrationDnsRecords(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareMigrationDnsRecordResult[]> {
  assertProviderId(zoneId)
  options = { ...options, signal: options?.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) }
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const rawRecords: Record<string, unknown>[] = []
  let expectedTotalCount: number | null = null
  let expectedTotalPages: number | null = null
  for (let page = 1; ; page += 1) {
    const response = await providerFetch(options)(
      `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=500&page=${page}`,
      { method: "GET", headers: headers(token) },
    )
    const payload = await json(response)
    assertCloudflareOk("Cloudflare migration DNS record list", response, payload)
    const source = readObject(payload)
    const resultInfo = readObject(source.result_info)
    const totalCount = resultInfo.total_count
    const totalPages = resultInfo.total_pages
    const returnedPage = resultInfo.page
    if (
      !Number.isSafeInteger(totalCount) ||
      Number(totalCount) < 0 ||
      !Number.isSafeInteger(totalPages) ||
      Number(totalPages) < 1 ||
      Number(totalPages) > 100 ||
      returnedPage !== page
    ) {
      throw new Error("Cloudflare migration DNS record list has invalid pagination metadata.")
    }
    if (expectedTotalCount == null) {
      expectedTotalCount = Number(totalCount)
      expectedTotalPages = Number(totalPages)
    } else if (
      expectedTotalCount !== totalCount ||
      expectedTotalPages !== totalPages
    ) {
      throw new Error("Cloudflare migration DNS record pagination changed during capture.")
    }
    rawRecords.push(...resultArray(payload))
    if (rawRecords.length > 10_000) throw new Error("Cloudflare migration DNS inventory is too large.")
    if (page === expectedTotalPages) break
  }
  const recordIds = rawRecords.map((record) => record.id).filter((id): id is string => typeof id === "string")
  if (new Set(recordIds).size !== recordIds.length) throw new Error("Cloudflare migration DNS pagination repeated an identity.")
  if (rawRecords.length !== expectedTotalCount) {
    throw new Error("Cloudflare migration DNS record list is incomplete.")
  }
  const parsed = rawRecords.map(parseMigrationDnsRecord).map((entry) =>
    entry && migrationDnsRecordSchema.safeParse(entry.record).success ? entry : null)
  if (parsed.some((entry) => entry === null)) {
    throw new Error("Cloudflare contains a DNS record unsupported by automatic migration.")
  }
  return parsed.filter(
    (entry): entry is CloudflareMigrationDnsRecordResult => entry !== null,
  )
}

export async function getCloudflareDnsRecordUsage(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareDnsRecordUsage> {
  assertProviderId(zoneId)
  const env = options?.env ?? process.env
  const { token, accountId } = requireCloudflareConfig(env)
  const response = await providerFetch(options)(
    `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dns_records/usage`,
    { method: "GET", headers: headers(token) },
  )
  const payload = await json(response)
  assertCloudflareOk("Cloudflare DNS record usage", response, payload)
  const result = resultObject(payload)
  const recordQuota = result.record_quota
  const recordUsage = result.record_usage
  if (
    !Number.isSafeInteger(recordUsage) ||
    Number(recordUsage) < 0
  ) {
    throw new Error("Cloudflare DNS record usage response is invalid.")
  }
  if (recordQuota === null) {
    const accountResponse = await providerFetch(options)(
      `${apiBase(env)}/accounts/${encodeURIComponent(accountId)}/dns_records/usage`,
      { method: "GET", headers: headers(token) },
    )
    const accountPayload = await json(accountResponse)
    assertCloudflareOk(
      "Cloudflare account DNS record usage",
      accountResponse,
      accountPayload,
    )
    const accountResult = resultObject(accountPayload)
    const accountQuota = accountResult.record_quota
    const accountUsage = accountResult.record_usage
    if (
      !Number.isSafeInteger(accountQuota) ||
      Number(accountQuota) < 0 ||
      !Number.isSafeInteger(accountUsage) ||
      Number(accountUsage) < 0 ||
      Number(accountUsage) > Number(accountQuota)
    ) {
      throw new Error(
        "Cloudflare account DNS record usage response is invalid.",
      )
    }
    return {
      recordQuota: Number(accountQuota),
      recordUsage: Number(accountUsage),
    }
  }
  if (
    !Number.isSafeInteger(recordQuota) ||
    Number(recordQuota) < 0 ||
    Number(recordUsage) > Number(recordQuota)
  ) {
    throw new Error("Cloudflare DNS record usage response is invalid.")
  }
  return {
    recordQuota: Number(recordQuota),
    recordUsage: Number(recordUsage),
  }
}

/**
 * Submit one caller-planned set of missing migration records. The response is
 * deliberately not treated as confirmation; the migration orchestrator must
 * list and semantically compare the full zone after this effect.
 */
export async function batchCreateCloudflareMigrationDnsRecords(
  zoneId: string,
  records: readonly NormalizedMigrationDnsRecord[],
  options?: CloudflareOptions,
): Promise<void> {
  assertProviderId(zoneId)
  if (records.length === 0) return
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  let response: Response
  try {
    response = await providerFetch(options)(
      `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dns_records/batch`,
      {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({
          posts: records.map(migrationRecordBody),
        }),
      },
    )
  } catch (error) {
    throw new CloudflareIndeterminateWriteError("Cloudflare migration DNS batch creation", error)
  }
  const payload = await readCloudflareWritePayload(
    "Cloudflare migration DNS batch creation",
    response,
  )
  assertCloudflareOk("Cloudflare migration DNS batch creation", response, payload)
}

export async function getCloudflareSslVerification(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareSslVerificationResult> {
  assertProviderId(zoneId)
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const response = await providerFetch(options)(
    `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/ssl/verification`,
    { method: "GET", headers: headers(token) },
  )
  const payload = await json(response)
  assertCloudflareOk("Cloudflare SSL verification", response, payload)
  const entries = resultArray(payload)
  if (entries.some((entry) => typeof entry.certificate_status !== "string" || !entry.certificate_status.trim())) throw new Error("Cloudflare certificate status is invalid.")
  const statuses = entries
    .map((entry) => entry.certificate_status)
    .filter((status): status is string => typeof status === "string" && status.trim().length > 0)
  const status = statuses.some((entry) => entry === "active")
    ? "active"
    : statuses.some((entry) =>
      ["expired", "timing_out", "initializing_timed_out", "validation_timed_out"].includes(entry))
      ? "failed"
      : "pending"
  return { status, providerStatuses: statuses, raw: payload }
}

const certificateNameCovers = (certificateName: string, hostname: string): boolean => {
  const name = certificateName.trim().toLowerCase().replace(/\.$/, "")
  const host = hostname.trim().toLowerCase().replace(/\.$/, "")
  if (name === host) return true
  if (!name.startsWith("*.")) return false
  const suffix = name.slice(2)
  return host.endsWith(`.${suffix}`) &&
    host.split(".").length === suffix.split(".").length + 1
}

export async function getCloudflareHostnameCertificate(
  zoneId: string,
  hostname: string,
  options?: CloudflareOptions,
): Promise<CloudflareHostnameCertificateResult> {
  assertProviderId(zoneId)
  options = { ...options, signal: options?.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) }
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const settingsResponse = await providerFetch(options)(
    `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/ssl/universal/settings`,
    { method: "GET", headers: headers(token) },
  )
  const settingsPayload = await json(settingsResponse)
  assertCloudflareOk("Cloudflare Universal SSL settings", settingsResponse, settingsPayload)
  const packs: Record<string, unknown>[] = []
  const packPayloads: unknown[] = []
  let page = 1
  let expectedTotalPages: number | null = null
  let expectedTotalCount: number | null = null
  const maximumPages = 100
  while (true) {
    if (page > maximumPages) {
      throw new Error("Cloudflare certificate pagination exceeded its safety bound.")
    }
    const packsResponse = await providerFetch(options)(
      `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/ssl/certificate_packs?status=all&deploy=production&per_page=50&page=${page}`,
      { method: "GET", headers: headers(token) },
    )
    const packsPayload = await json(packsResponse)
    assertCloudflareOk("Cloudflare certificate pack list", packsResponse, packsPayload)
    packPayloads.push(packsPayload)
    const pagePacks = resultArray(packsPayload)
    packs.push(...pagePacks)
    if (packs.length > 5_000) throw new Error("Cloudflare certificate inventory is too large.")
    const resultInfo = readObject(readObject(packsPayload).result_info)
    if (["page", "per_page", "total_pages", "total_count", "count"].some((key) => resultInfo[key] != null && !Number.isSafeInteger(resultInfo[key]))) throw new Error("Cloudflare certificate pagination metadata is invalid.")
    const responsePage = Number.isSafeInteger(resultInfo.page)
      ? Number(resultInfo.page)
      : null
    const responsePerPage = Number.isSafeInteger(resultInfo.per_page)
      ? Number(resultInfo.per_page)
      : null
    const totalPages = Number.isSafeInteger(resultInfo.total_pages)
      ? Number(resultInfo.total_pages)
      : null
    const totalCount = Number.isSafeInteger(resultInfo.total_count)
      ? Number(resultInfo.total_count)
      : null
    const count = Number.isSafeInteger(resultInfo.count)
      ? Number(resultInfo.count)
      : null
    if (
      (responsePage != null && responsePage !== page) ||
      (responsePerPage != null && responsePerPage !== 50) ||
      (count != null && count !== pagePacks.length) ||
      (totalPages != null && (totalPages < 1 || totalPages > maximumPages)) ||
      (totalCount != null && totalCount < packs.length)
    ) {
      throw new Error("Cloudflare certificate pagination metadata is invalid.")
    }
    if (expectedTotalPages == null) expectedTotalPages = totalPages
    if (expectedTotalCount == null) expectedTotalCount = totalCount
    if (
      totalPages != null &&
      expectedTotalPages != null &&
      totalPages !== expectedTotalPages
    ) {
      throw new Error("Cloudflare certificate pagination changed during read.")
    }
    if (
      totalCount != null &&
      expectedTotalCount != null &&
      totalCount !== expectedTotalCount
    ) {
      throw new Error("Cloudflare certificate count changed during read.")
    }
    const more = totalPages != null ? page < totalPages : pagePacks.length === 50
    if (!more) break
    page += 1
  }
  if (expectedTotalCount != null && packs.length !== expectedTotalCount) {
    throw new Error("Cloudflare certificate pagination returned an incomplete result.")
  }
  const sslSettings = resultObject(settingsPayload)
  if (typeof sslSettings.enabled !== "boolean") throw new Error("Cloudflare SSL settings are invalid.")
  if (packs.some((pack) => !Array.isArray(pack.hosts) || pack.hosts.some((host) => typeof host !== "string") || typeof pack.status !== "string")) throw new Error("Cloudflare certificate pack is invalid.")
  const universalSslEnabled = sslSettings.enabled
  const matchingPacks = packs.filter((pack) => {
    const hosts = Array.isArray(pack.hosts)
      ? pack.hosts.filter((entry): entry is string => typeof entry === "string")
      : []
    return hosts.some((candidate) => certificateNameCovers(candidate, hostname))
  })
  const certificateStatuses = matchingPacks.flatMap((pack) =>
    typeof pack.status === "string" ? [pack.status] : [])
  return {
    hostname,
    universalSslEnabled,
    covered:
      universalSslEnabled &&
      matchingPacks.some((pack) => pack.status === "active"),
    certificateStatuses,
    raw: {
      universalSsl: settingsPayload,
      certificatePacks: packPayloads,
    },
  }
}

export async function getCloudflareDnssec(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareDnssecResult> {
  assertProviderId(zoneId)
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const response = await providerFetch(options)(
    `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dnssec`,
    { method: "GET", headers: headers(token) },
  )
  const payload = await json(response)
  assertCloudflareOk("Cloudflare DNSSEC read", response, payload)
  return { ...parseCloudflareDnssec(resultObject(payload)), raw: payload }
}

export async function enableCloudflareDnssec(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareDnssecResult> {
  assertProviderId(zoneId)
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  let response: Response
  try {
    response = await providerFetch(options)(
      `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dnssec`,
      {
        method: "PATCH",
        headers: headers(token),
        body: JSON.stringify({ status: "active" }),
      },
    )
  } catch (error) {
    throw new CloudflareIndeterminateWriteError("Cloudflare DNSSEC enablement", error)
  }
  const payload = await readCloudflareWritePayload(
    "Cloudflare DNSSEC enablement",
    response,
  )
  assertCloudflareOk("Cloudflare DNSSEC enablement", response, payload)
  try {
    return { ...parseCloudflareDnssec(resultObject(payload)), raw: payload }
  } catch (error) {
    throw new CloudflareIndeterminateWriteError("Cloudflare DNSSEC enablement", error)
  }
}

export async function listCloudflareEmailSendingSubdomains(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareEmailSendingSubdomainResult[]> {
  assertProviderId(zoneId)
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const response = await providerFetch(options)(`${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/email/sending/subdomains`, {
    method: "GET",
    headers: headers(token),
  })
  const payload = await json(response)
  assertCloudflareOk("Cloudflare Email Sending subdomain list", response, payload)
  return resultArray(payload).map((entry) => parseEmailSendingSubdomain(entry))
}

export async function getCloudflareEmailSendingSubdomain(
  zoneId: string,
  subdomainId: string,
  options?: CloudflareOptions,
): Promise<CloudflareEmailSendingSubdomainResult> {
  assertProviderId(zoneId)
  assertProviderId(subdomainId)
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const response = await providerFetch(options)(
    `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/email/sending/subdomains/${encodeURIComponent(subdomainId)}`,
    {
      method: "GET",
      headers: headers(token),
    },
  )
  const payload = await json(response)
  assertCloudflareOk("Cloudflare Email Sending subdomain get", response, payload)
  const result = parseEmailSendingSubdomain(resultObject(payload))
  if (result.id !== subdomainId) throw new Error("Cloudflare Email Sending response identity is invalid.")
  return result
}

export async function createCloudflareEmailSendingSubdomain(
  zoneId: string,
  name: string,
  options?: CloudflareOptions,
): Promise<CloudflareEmailSendingSubdomainResult> {
  assertProviderId(zoneId)
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const subdomainName = splitDomain(name).domain
  let response: Response
  try {
    response = await providerFetch(options)(`${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/email/sending/subdomains`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ name: subdomainName }),
    })
  } catch (error) {
    throw new CloudflareIndeterminateWriteError(
      "Cloudflare Email Sending subdomain creation",
      error,
    )
  }
  const payload = await readCloudflareWritePayload(
    "Cloudflare Email Sending subdomain creation",
    response,
  )
  assertCloudflareOk("Cloudflare Email Sending subdomain creation", response, payload)
  try {
    return parseEmailSendingSubdomain(resultObject(payload), subdomainName)
  } catch (error) {
    throw new CloudflareIndeterminateWriteError(
      "Cloudflare Email Sending subdomain creation",
      error,
    )
  }
}

export async function createOrReuseCloudflareEmailSendingSubdomain(
  zoneId: string,
  name: string,
  options?: CloudflareOptions,
): Promise<CloudflareEmailSendingSubdomainResult> {
  assertProviderId(zoneId)
  const subdomainName = splitDomain(name).domain
  const existing = (await listCloudflareEmailSendingSubdomains(zoneId, options))
    .find((subdomain) => subdomain.name.toLowerCase() === subdomainName)
  if (existing) return existing
  try {
    return await createCloudflareEmailSendingSubdomain(zoneId, subdomainName, options)
  } catch (error) {
    try {
      const reconciled = (await listCloudflareEmailSendingSubdomains(zoneId, options))
        .find((subdomain) => subdomain.name.toLowerCase() === subdomainName)
      if (reconciled) return reconciled
    } catch {
      // Preserve the original write outcome classification.
    }
    throw error
  }
}
