import "server-only"
import {
  semanticZoneComparison,
  type NormalizedMigrationDnsRecord,
} from "@siteinabox/contracts/domain-migration"
import { splitDomain } from "@/lib/domains/normalize"

export type CloudflareZoneResult = {
  id: string
  name: string
  nameServers: string[]
  status: "initializing" | "pending" | "active" | "moved" | "unknown"
  raw: unknown
}

export type CloudflareDnsRecordType = "A" | "CNAME"

export type CloudflareDnsRecordRequest = {
  type: CloudflareDnsRecordType
  name: string
  content: string
  ttl: number
  proxied: boolean
}

export type CloudflareDnsRecordResult = {
  id: string | null
  type: CloudflareDnsRecordType
  name: string
  content: string
  proxied: boolean
  raw: unknown
}

export type CloudflareMigrationDnsRecordResult = {
  id: string | null
  record: NormalizedMigrationDnsRecord
  raw: unknown
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

type FetchLike = typeof fetch

type CloudflareOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: FetchLike
}

const DEFAULT_API_BASE = "https://api.cloudflare.com/client/v4"

export class CloudflareApiError extends Error {
  status: number
  operation: string

  constructor(operation: string, status: number, message?: string | null) {
    super(message ? `${operation} failed with HTTP ${status}: ${message}` : `${operation} failed with HTTP ${status}.`)
    this.name = "CloudflareApiError"
    this.status = status
    this.operation = operation
  }
}

export class CloudflareIndeterminateWriteError extends Error {
  operation: string

  constructor(operation: string, cause?: unknown) {
    super(`${operation} has an indeterminate provider outcome.`, { cause })
    this.name = "CloudflareIndeterminateWriteError"
    this.operation = operation
  }
}

const cleanEnv = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const apiBase = (env: NodeJS.ProcessEnv): string =>
  (cleanEnv(env.CLOUDFLARE_API_BASE_URL) ?? DEFAULT_API_BASE).replace(/\/+$/, "")

const fetcher = (options?: CloudflareOptions): FetchLike => options?.fetchImpl ?? globalThis.fetch

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

const json = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text) return null
  return JSON.parse(text) as unknown
}

const resultObject = (value: unknown): Record<string, unknown> => readObject(readObject(value).result)

const resultArray = (value: unknown): Record<string, unknown>[] => {
  const result = readObject(value).result
  return Array.isArray(result) ? result.map(readObject) : []
}

const cloudflareApiMessage = (payload: unknown): string | null => {
  const errors = readObject(payload).errors
  if (!Array.isArray(errors)) return null
  const messages = errors
    .map((entry) => readObject(entry).message)
    .filter((message): message is string => typeof message === "string" && message.trim().length > 0)
  return messages.length > 0 ? messages.join("; ") : null
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
  if (!response.ok) throw new CloudflareApiError(operation, response.status, cloudflareApiMessage(payload))
  if (readObject(payload).success === false) throw new CloudflareApiError(operation, response.status, cloudflareApiMessage(payload))
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
  if (!id || !name || nameServers.length === 0) return null
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
  const result = readObject(value)
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
    response = await fetcher(options)(`${apiBase(env)}/zones`, {
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
  const result = parseCloudflareZone(resultObject(payload), domain.domain)
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
  const response = await fetcher(options)(`${apiBase(env)}/zones?${query.toString()}`, {
    method: "GET",
    headers: headers(token),
  })
  const payload = await json(response)
  assertCloudflareOk("Cloudflare zone list", response, payload)
  return resultArray(payload)
    .map((entry) => parseCloudflareZone(entry))
    .filter((entry): entry is CloudflareZoneResult => entry?.name.toLowerCase() === domain.domain)
}

export async function createOrReuseCloudflareZone(
  domainInput: string,
  options?: CloudflareOptions,
): Promise<CloudflareZoneResult> {
  const domain = splitDomain(domainInput).domain
  const existing = (await listCloudflareZones(domain, options))[0]
  if (existing) return existing
  try {
    return await createCloudflareZone(domain, options)
  } catch (error) {
    try {
      const reconciled = (await listCloudflareZones(domain, options))[0]
      if (reconciled) return reconciled
    } catch {
      // Preserve the original write outcome classification.
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

export async function createCloudflareDnsRecord(
  zoneId: string,
  record: CloudflareDnsRecordRequest,
  options?: CloudflareOptions,
): Promise<CloudflareDnsRecordResult> {
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  let response: Response
  try {
    response = await fetcher(options)(`${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dns_records`, {
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
  if (!id) {
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
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const response = await fetcher(options)(
    `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=500`,
    { method: "GET", headers: headers(token) },
  )
  const payload = await json(response)
  assertCloudflareOk("Cloudflare DNS record list", response, payload)
  return resultArray(payload).flatMap((result) => {
    const type = result.type === "A" || result.type === "CNAME" ? result.type : null
    const name = typeof result.name === "string" ? result.name : null
    const content = typeof result.content === "string" ? result.content : null
    if (!type || !name || !content) return []
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

export async function createCloudflareZoneDnsRecords(
  zoneId: string,
  domainInput: string,
  options?: CloudflareOptions & { ttl?: number; proxied?: boolean },
): Promise<CloudflareDnsRecordResult[]> {
  const env = options?.env ?? process.env
  const records = buildCloudflareDnsRecordRequests(domainInput, env, {
    ttl: options?.ttl,
    proxied: options?.proxied,
  })
  const results: CloudflareDnsRecordResult[] = []
  for (const record of records) {
    results.push(await createOrReuseCloudflareDnsRecord(zoneId, record, options))
  }
  return results
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
    : 1
  const proxied = value.proxied === true
  if (!name) return null
  if (type === "MX") {
    const priority = typeof value.priority === "number" ? value.priority : null
    const target = typeof value.content === "string" ? canonicalDnsName(value.content) : null
    if (priority == null || !target) return null
    return {
      id: typeof value.id === "string" ? value.id : null,
      record: { type, name, ttl, priority, target, proxied },
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
      record: { type, name, ttl, flags, tag, value: caaValue, proxied },
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
      record: { type, name, ttl, priority, weight, port, target, proxied },
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
      record: { type, name, ttl, content: normalizedContent, proxied },
      raw: value,
    }
  }
  return null
}

export async function listCloudflareMigrationDnsRecords(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareMigrationDnsRecordResult[]> {
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const rawRecords: Record<string, unknown>[] = []
  let expectedTotalCount: number | null = null
  let expectedTotalPages: number | null = null
  for (let page = 1; ; page += 1) {
    const response = await fetcher(options)(
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
      Number(totalPages) > 1_000 ||
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
    if (page === expectedTotalPages) break
  }
  if (rawRecords.length !== expectedTotalCount) {
    throw new Error("Cloudflare migration DNS record list is incomplete.")
  }
  const parsed = rawRecords.map(parseMigrationDnsRecord)
  if (parsed.some((entry) => entry === null)) {
    throw new Error("Cloudflare contains a DNS record unsupported by automatic migration.")
  }
  return parsed.filter(
    (entry): entry is CloudflareMigrationDnsRecordResult => entry !== null,
  )
}

export async function createCloudflareMigrationDnsRecord(
  zoneId: string,
  record: NormalizedMigrationDnsRecord,
  options?: CloudflareOptions,
): Promise<CloudflareMigrationDnsRecordResult> {
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  let response: Response
  try {
    response = await fetcher(options)(
      `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/dns_records`,
      {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify(migrationRecordBody(record)),
      },
    )
  } catch (error) {
    throw new CloudflareIndeterminateWriteError("Cloudflare migration DNS record creation", error)
  }
  const payload = await readCloudflareWritePayload(
    "Cloudflare migration DNS record creation",
    response,
  )
  assertCloudflareOk("Cloudflare migration DNS record creation", response, payload)
  const parsed = parseMigrationDnsRecord(resultObject(payload))
  if (!parsed?.id) {
    throw new CloudflareIndeterminateWriteError("Cloudflare migration DNS record creation")
  }
  return { ...parsed, raw: payload }
}

export async function createOrReuseCloudflareMigrationDnsRecord(
  zoneId: string,
  record: NormalizedMigrationDnsRecord,
  options?: CloudflareOptions,
): Promise<CloudflareMigrationDnsRecordResult> {
  const findExisting = async () => (await listCloudflareMigrationDnsRecords(zoneId, options))
    .find((candidate) =>
      semanticZoneComparison([record], [candidate.record]).equivalent)
  const existing = await findExisting()
  if (existing) return existing
  try {
    return await createCloudflareMigrationDnsRecord(zoneId, record, options)
  } catch (error) {
    try {
      const reconciled = await findExisting()
      if (reconciled) return reconciled
    } catch {
      // Preserve the original indeterminate provider outcome.
    }
    throw error
  }
}

export async function getCloudflareSslVerification(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareSslVerificationResult> {
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const response = await fetcher(options)(
    `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/ssl/verification`,
    { method: "GET", headers: headers(token) },
  )
  const payload = await json(response)
  assertCloudflareOk("Cloudflare SSL verification", response, payload)
  const result = readObject(payload).result
  const entries = Array.isArray(result) ? result.map(readObject) : []
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

export async function listCloudflareEmailSendingSubdomains(
  zoneId: string,
  options?: CloudflareOptions,
): Promise<CloudflareEmailSendingSubdomainResult[]> {
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const response = await fetcher(options)(`${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/email/sending/subdomains`, {
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
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const response = await fetcher(options)(
    `${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/email/sending/subdomains/${encodeURIComponent(subdomainId)}`,
    {
      method: "GET",
      headers: headers(token),
    },
  )
  const payload = await json(response)
  assertCloudflareOk("Cloudflare Email Sending subdomain get", response, payload)
  return parseEmailSendingSubdomain(resultObject(payload))
}

export async function createCloudflareEmailSendingSubdomain(
  zoneId: string,
  name: string,
  options?: CloudflareOptions,
): Promise<CloudflareEmailSendingSubdomainResult> {
  const env = options?.env ?? process.env
  const { token } = requireCloudflareConfig(env)
  const subdomainName = splitDomain(name).domain
  let response: Response
  try {
    response = await fetcher(options)(`${apiBase(env)}/zones/${encodeURIComponent(zoneId)}/email/sending/subdomains`, {
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
