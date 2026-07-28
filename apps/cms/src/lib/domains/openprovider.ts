import "server-only"
import {
  getEnabledTldCapability,
  getTldCapabilityByVersion,
  validateTldRegistrationLabel,
  validateTldTransferAuthorization,
} from "@siteinabox/contracts/tld-capabilities"
import { splitDomain } from "@/lib/domains/normalize"
import type { DomainRegistrantDetails } from "@/lib/domains/orderState"

export type OpenProviderAvailabilityStatus = "available" | "unavailable" | "premium" | "internal"

export type OpenProviderAvailabilityResult = {
  status: OpenProviderAvailabilityStatus
  domain: string
  available: boolean
  premium: boolean
  price: { amount: string; currency: string } | null
  internalReason: string | null
}

export type OpenProviderDomainSuggestion = {
  domain: string
  name: string
  extension: string
}

export type OpenProviderRegistrationRequest = {
  domain: { name: string; extension: string }
  period: number
  owner_handle: string
  admin_handle: string
  tech_handle: string
  billing_handle: string
  autorenew: "on" | "off" | "default"
  ns_group?: string
  name_servers?: Array<{ name: string }>
  comments?: string
}

export type OpenProviderRegistrationResult = {
  id: number | string | null
  domain: string
  status: "registered" | "requested"
  raw: unknown
}

export type OpenProviderTransferRequest = {
  domain: { name: string; extension: string }
  auth_code: string
  owner_handle: string
  admin_handle: string
  tech_handle: string
  billing_handle: string
  autorenew: "on" | "off" | "default"
  ns_group?: string
  name_servers?: Array<{ name: string }>
  comments?: string
}

export type OpenProviderTransferResult = {
  id: string | number
  domain: string
  status: "requested" | "transferred"
  raw: unknown
}

export type OpenProviderNameserverUpdateResult = {
  id: string | number
  status: string | null
  raw: unknown
}

export type OpenProviderCustomerHandleResult = {
  handle: string
  raw: unknown
}

export type OpenProviderDomainRecord = {
  id: number | string
  domain: string
  status: string
  ownerHandle: string | null
  adminHandle: string | null
  nameServers: string[]
  renewalDate: string | null
  registryExpiryDate?: string | null
  autorenew: "on" | "off" | "default" | "unknown"
  verificationEmailStatus: string | null
  verificationEmailExpiresAt?: string | null
  verificationEmailDescription: string | null
  raw: unknown
}

export type OpenProviderDomainPrice = {
  domain: string
  operation: "transfer" | "renew"
  currency: string
  netAmountMinor: number
  premium: boolean
  raw: unknown
}

export type OpenProviderAutorenewResult = {
  id: number | string
  autorenew: "on" | "off"
  status: string | null
  raw: unknown
}

export type OpenProviderCustomerRecord = {
  handle: string
  comments: string | null
  raw: unknown
}

export type OpenProviderResellerBalance = {
  availableAmount: number
  reservedAmount: number
  currency: string
}

type FetchLike = typeof fetch

type OpenProviderOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: FetchLike
  token?: string
}

type OpenProviderAvailabilityOptions = OpenProviderOptions & {
  withPrice?: boolean
}

const DEFAULT_API_BASE = "https://api.openprovider.eu/v1beta"
const OPENPROVIDER_TOKEN_TTL_MS = 47 * 60 * 60 * 1000
const AVAILABILITY_CACHE_TTL_MS = 60 * 1000
const AVAILABILITY_CACHE_MAX_ENTRIES = 256

export class OpenProviderApiError extends Error {
  status: number
  operation: string
  providerCode: string | null

  constructor(operation: string, status: number, providerCode: string | null = null) {
    super(`${operation} failed with HTTP ${status}.`)
    this.name = "OpenProviderApiError"
    this.status = status
    this.operation = operation
    this.providerCode = providerCode
  }
}

export class OpenProviderIndeterminateWriteError extends Error {
  operation: string

  constructor(operation: string, _cause?: unknown) {
    super(`${operation} has an indeterminate provider outcome.`)
    this.name = "OpenProviderIndeterminateWriteError"
    this.operation = operation
  }
}

const cleanEnv = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export const normalizeOpenProviderTimestamp = (
  value: string | null | undefined,
): string | null => {
  const trimmed = value?.trim()
  if (!trimmed || /^0{4}-0{2}-0{2}/.test(trimmed)) return null
  const normalized = trimmed.replace(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/,
    "$1T$2.000Z",
  )
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const apiBase = (env: NodeJS.ProcessEnv): string =>
  (cleanEnv(env.OPENPROVIDER_API_BASE_URL) ?? DEFAULT_API_BASE).replace(/\/+$/, "")

const jsonHeaders = (token?: string): Record<string, string> => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

const json = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text) return null
  return JSON.parse(text) as unknown
}

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

const dataObject = (value: unknown): Record<string, unknown> => {
  const root = readObject(value)
  return readObject(root.data)
}

const providerErrorCode = async (response: Response): Promise<string | null> => {
  try {
    const payload = readObject(await json(response))
    const error = readObject(payload.error)
    const errors = Array.isArray(payload.errors) ? payload.errors : []
    const firstError = readObject(errors[0])
    const data = readObject(payload.data)
    const candidate = [
      payload.code,
      payload.error_code,
      error.code,
      firstError.code,
      data.code,
    ].find((value) => typeof value === "string")
    const normalized = typeof candidate === "string"
      ? candidate.trim().toUpperCase()
      : ""
    return /^[A-Z0-9_.-]{1,80}$/.test(normalized) ? normalized : null
  } catch {
    return null
  }
}

const fetcher = (options?: OpenProviderOptions): FetchLike => options?.fetchImpl ?? globalThis.fetch

type CachedOpenProviderToken = {
  key: string
  token: string
  expiresAt: number
}

let fetcherIdSequence = 0
const fetcherIds = new WeakMap<FetchLike, number>()
let cachedOpenProviderToken: CachedOpenProviderToken | null = null
let pendingOpenProviderLogin: Promise<CachedOpenProviderToken> | null = null
let pendingOpenProviderLoginKey: string | null = null

const fetcherCacheId = (fetchImpl: FetchLike): number => {
  const existing = fetcherIds.get(fetchImpl)
  if (existing) return existing
  fetcherIdSequence += 1
  fetcherIds.set(fetchImpl, fetcherIdSequence)
  return fetcherIdSequence
}

const authCacheKey = (env: NodeJS.ProcessEnv, fetchImpl: FetchLike, username: string): string =>
  `${apiBase(env)}:${username}:${fetcherCacheId(fetchImpl)}`

const clearCachedOpenProviderToken = (key?: string): void => {
  if (!key || cachedOpenProviderToken?.key === key) cachedOpenProviderToken = null
  if (!key || pendingOpenProviderLoginKey === key) {
    pendingOpenProviderLogin = null
    pendingOpenProviderLoginKey = null
  }
}

const cloneAvailabilityResult = (result: OpenProviderAvailabilityResult): OpenProviderAvailabilityResult => ({
  ...result,
  price: result.price ? { ...result.price } : null,
})

type CachedAvailabilityResult = {
  expiresAt: number
  result: OpenProviderAvailabilityResult
}

const availabilityCache = new Map<string, CachedAvailabilityResult>()

const availabilityCacheKey = (scope: string, domain: string, withPrice: boolean): string =>
  `${scope}:${domain}:with_price=${withPrice}`

const getCachedAvailabilityResult = (scope: string, domain: string, withPrice: boolean, now = Date.now()): OpenProviderAvailabilityResult | null => {
  const key = availabilityCacheKey(scope, domain, withPrice)
  const cached = availabilityCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= now) {
    availabilityCache.delete(key)
    return null
  }
  return cloneAvailabilityResult(cached.result)
}

const pruneAvailabilityCache = (now = Date.now()): void => {
  for (const [key, cached] of availabilityCache) {
    if (cached.expiresAt <= now) availabilityCache.delete(key)
  }
  while (availabilityCache.size > AVAILABILITY_CACHE_MAX_ENTRIES) {
    const oldestKey = availabilityCache.keys().next().value as string | undefined
    if (!oldestKey) break
    availabilityCache.delete(oldestKey)
  }
}

const setCachedAvailabilityResult = (scope: string, result: OpenProviderAvailabilityResult, withPrice: boolean, now = Date.now()): void => {
  availabilityCache.set(availabilityCacheKey(scope, result.domain, withPrice), {
    expiresAt: now + AVAILABILITY_CACHE_TTL_MS,
    result: cloneAvailabilityResult(result),
  })
  pruneAvailabilityCache(now)
}

export function requireOpenProviderCredentials(env: NodeJS.ProcessEnv = process.env): { username: string; password: string } {
  const username = cleanEnv(env.OPENPROVIDER_USERNAME)
  const password = cleanEnv(env.OPENPROVIDER_PASSWORD)
  if (!username || !password) throw new Error("OPENPROVIDER_USERNAME and OPENPROVIDER_PASSWORD are required.")
  return { username, password }
}

export async function loginOpenProvider(options?: OpenProviderOptions): Promise<string> {
  if (options?.token) return options.token

  const env = options?.env ?? process.env
  const credentials = requireOpenProviderCredentials(env)
  const fetchImpl = fetcher(options)
  const key = authCacheKey(env, fetchImpl, credentials.username)
  const now = Date.now()
  if (cachedOpenProviderToken?.key === key && cachedOpenProviderToken.expiresAt > now) {
    return cachedOpenProviderToken.token
  }
  if (pendingOpenProviderLogin && pendingOpenProviderLoginKey === key) {
    return (await pendingOpenProviderLogin).token
  }

  pendingOpenProviderLoginKey = key
  pendingOpenProviderLogin = (async () => {
    const response = await fetchImpl(`${apiBase(env)}/auth/login`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(credentials),
    })
    if (!response.ok) throw new OpenProviderApiError("OpenProvider login", response.status)

    const payload = dataObject(await json(response))
    const token = typeof payload.token === "string" ? payload.token : null
    if (!token) throw new Error("OpenProvider login response did not include a token.")

    const entry = { key, token, expiresAt: Date.now() + OPENPROVIDER_TOKEN_TTL_MS }
    cachedOpenProviderToken = entry
    return entry
  })()

  try {
    return (await pendingOpenProviderLogin).token
  } finally {
    if (pendingOpenProviderLoginKey === key) {
      pendingOpenProviderLogin = null
      pendingOpenProviderLoginKey = null
    }
  }
}

const normalizeMoney = (source: unknown): { amount: string; currency: string } | null => {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null
  const value = readObject(source)
  const nestedPrice = readObject(value.price)
  const amount = nestedPrice.create ?? value.price ?? value.amount ?? value.product_price
  const currency = value.currency ?? value.product_currency
  if ((typeof amount === "string" || typeof amount === "number") && typeof currency === "string") {
    return { amount: String(amount), currency }
  }
  for (const key of ["product", "reseller", "premium", "price"]) {
    const nested = normalizeMoney(value[key])
    if (nested) return nested
  }
  return null
}

export function normalizeOpenProviderAvailabilityResponse(domain: string, payload: unknown): OpenProviderAvailabilityResult {
  const data = dataObject(payload)
  const results = Array.isArray(data.results) ? data.results : []
  const first = readObject(results[0] ?? data)
  const rawStatus = String(first.status ?? data.status ?? "").toLowerCase()
  const isPremium = Boolean(first.is_premium ?? first.premium) || rawStatus === "premium"
  const price = normalizeMoney(first.price) ?? normalizeMoney(first)

  if (isPremium) {
    return { status: "premium", domain, available: false, premium: true, price, internalReason: "premium_domain" }
  }
  if (rawStatus === "free" || rawStatus === "available") {
    return { status: "available", domain, available: true, premium: false, price, internalReason: null }
  }
  if (rawStatus === "active" || rawStatus === "unavailable" || rawStatus === "taken" || rawStatus === "registered") {
    return { status: "unavailable", domain, available: false, premium: false, price, internalReason: "domain_unavailable" }
  }

  return { status: "internal", domain, available: false, premium: false, price, internalReason: "unknown_provider_status" }
}

const internalAvailabilityResult = (domain: string, reason: string): OpenProviderAvailabilityResult => ({
  status: "internal",
  domain,
  available: false,
  premium: false,
  price: null,
  internalReason: reason,
})

const availabilityResultDomain = (value: unknown): string | null => {
  const source = readObject(value)
  const direct = source.domain
  if (typeof direct === "string" && direct.includes(".")) return direct

  const domainObject = readObject(direct)
  const name = typeof source.name === "string"
    ? source.name
    : typeof domainObject.name === "string"
      ? domainObject.name
      : null
  const extension = typeof source.extension === "string"
    ? source.extension
    : typeof source.tld === "string"
      ? source.tld
      : typeof domainObject.extension === "string"
        ? domainObject.extension
        : null
  if (!name || !extension) return null
  return `${name}.${extension.replace(/^\./, "")}`
}

const fetchOpenProviderAvailability = async (
  env: NodeJS.ProcessEnv,
  token: string,
  domains: Array<{ name: string; extension: string }>,
  withPrice: boolean,
  options?: OpenProviderOptions,
): Promise<Response> =>
  fetcher(options)(`${apiBase(env)}/domains/check`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      domains: domains.map((domain) => ({ name: domain.name, extension: domain.extension })),
      with_price: withPrice,
    }),
  })

const fetchOpenProviderSuggestions = async (
  env: NodeJS.ProcessEnv,
  token: string,
  body: Record<string, unknown>,
  options?: OpenProviderOptions,
): Promise<Response> =>
  fetcher(options)(`${apiBase(env)}/domains/suggest-name`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(body),
  })

export async function checkOpenProviderDomainsAvailability(
  domainInputs: string[],
  options?: OpenProviderAvailabilityOptions,
): Promise<OpenProviderAvailabilityResult[]> {
  const domains = [...new Map(domainInputs.map((input) => {
    const domain = splitDomain(input)
    return [domain.domain, domain] as const
  })).values()]
  if (domains.length === 0) return []

  const env = options?.env ?? process.env
  const withPrice = options?.withPrice ?? true
  const canUseProcessCache = !options?.token
  const fetchImpl = fetcher(options)
  const cacheScope = canUseProcessCache
    ? authCacheKey(env, fetchImpl, requireOpenProviderCredentials(env).username)
    : null
  const cachedResults = new Map<string, OpenProviderAvailabilityResult>()
  const domainsToFetch = canUseProcessCache
    ? domains.filter((domain) => {
      const cached = cacheScope ? getCachedAvailabilityResult(cacheScope, domain.domain, withPrice) : null
      if (cached) cachedResults.set(domain.domain, cached)
      return !cached
    })
    : domains
  if (domainsToFetch.length === 0) return domains.map((domain) => cachedResults.get(domain.domain) ?? internalAvailabilityResult(domain.domain, "unknown_provider_status"))

  let token = options?.token ?? await loginOpenProvider(options)
  let response = await fetchOpenProviderAvailability(env, token, domainsToFetch, withPrice, options)
  if (!options?.token && response.status === 401) {
    clearCachedOpenProviderToken(cacheScope ?? undefined)
    token = await loginOpenProvider(options)
    response = await fetchOpenProviderAvailability(env, token, domainsToFetch, withPrice, options)
  }

  if (!response.ok) {
    const fetchedResults = new Map(domainsToFetch.map((domain) => [
      domain.domain,
      internalAvailabilityResult(domain.domain, `provider_http_${response.status}`),
    ]))
    return domains.map((domain) => cachedResults.get(domain.domain) ?? fetchedResults.get(domain.domain) ?? internalAvailabilityResult(domain.domain, `provider_http_${response.status}`))
  }

  const payload = await json(response)
  const data = dataObject(payload)
  const rawResults = Array.isArray(data.results) ? data.results : []
  const resultsByDomain = new Map<string, unknown>()
  rawResults.forEach((result, index) => {
    const directDomain = availabilityResultDomain(result)
    const fallbackDomain = domainsToFetch[index]?.domain ?? null
    let key = fallbackDomain
    if (directDomain) {
      try {
        key = splitDomain(directDomain).domain
      } catch {
        key = fallbackDomain
      }
    }
    if (key) resultsByDomain.set(key, result)
  })

  const fetchedResults = new Map<string, OpenProviderAvailabilityResult>()
  domainsToFetch.forEach((domain) => {
    const result = resultsByDomain.get(domain.domain)
    const normalized = result
      ? normalizeOpenProviderAvailabilityResponse(domain.domain, { data: { results: [result] } })
      : internalAvailabilityResult(domain.domain, "unknown_provider_status")
    fetchedResults.set(domain.domain, normalized)
    if (cacheScope) setCachedAvailabilityResult(cacheScope, normalized, withPrice)
  })

  return domains.map((domain) => cachedResults.get(domain.domain) ?? fetchedResults.get(domain.domain) ?? internalAvailabilityResult(domain.domain, "unknown_provider_status"))
}

export async function checkOpenProviderDomainAvailability(
  domainInput: string,
  options?: OpenProviderAvailabilityOptions,
): Promise<OpenProviderAvailabilityResult> {
  const domain = splitDomain(domainInput)
  return (await checkOpenProviderDomainsAvailability([domain.domain], options))[0]
    ?? internalAvailabilityResult(domain.domain, "unknown_provider_status")
}

const suggestionDomainFromResult = (value: unknown): string | null => {
  if (typeof value === "string") return value
  const source = readObject(value)
  const direct = source.name ?? source.domain
  if (typeof direct === "string" && direct.includes(".")) return direct
  const name = typeof source.name === "string"
    ? source.name
    : typeof readObject(source.domain).name === "string"
      ? readObject(source.domain).name
      : null
  const domainObject = readObject(source.domain)
  let extension: string | null = null
  if (typeof source.tld === "string") {
    extension = source.tld
  } else if (typeof source.extension === "string") {
    extension = source.extension
  } else if (typeof domainObject.extension === "string") {
    extension = domainObject.extension
  }
  if (!name || !extension) return null
  return `${name}.${extension.replace(/^\./, "")}`
}

export function normalizeOpenProviderSuggestionResponse(payload: unknown): OpenProviderDomainSuggestion[] {
  const root = readObject(payload)
  const data = dataObject(payload)
  const rawResults = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.suggestions)
      ? data.suggestions
      : Array.isArray(root.results)
        ? root.results
        : []
  const suggestions = new Map<string, OpenProviderDomainSuggestion>()
  for (const result of rawResults) {
    const candidate = suggestionDomainFromResult(result)
    if (!candidate) continue
    try {
      const domain = splitDomain(candidate)
      suggestions.set(domain.domain, domain)
    } catch {
      // Provider suggestions are optional candidates; invalid entries are ignored.
    }
  }
  return [...suggestions.values()]
}

export async function suggestOpenProviderDomains(
  domainInput: string,
  options?: OpenProviderOptions & { limit?: number; language?: string },
): Promise<OpenProviderDomainSuggestion[]> {
  const domain = splitDomain(domainInput)
  const env = options?.env ?? process.env
  const body = {
    language: options?.language ?? "dut",
    limit: options?.limit ?? 8,
    name: domain.name,
    provider: "namestudio",
    sensitive: true,
    tlds: [domain.extension],
  }
  let token = options?.token ?? await loginOpenProvider(options)
  let response = await fetchOpenProviderSuggestions(env, token, body, options)
  if (!options?.token && response.status === 401) {
    const credentials = requireOpenProviderCredentials(env)
    clearCachedOpenProviderToken(authCacheKey(env, fetcher(options), credentials.username))
    token = await loginOpenProvider(options)
    response = await fetchOpenProviderSuggestions(env, token, body, options)
  }
  if (!response.ok) throw new OpenProviderApiError("OpenProvider domain suggestions", response.status)
  return normalizeOpenProviderSuggestionResponse(await json(response))
}

const requiredHandle = (env: NodeJS.ProcessEnv, key: string): string => {
  const value = cleanEnv(env[key])
  if (!value) throw new Error(`${key} is required for OpenProvider domain registration.`)
  return value
}

const nameserversFromEnv = (env: NodeJS.ProcessEnv): Array<{ name: string }> | null => {
  const value = cleanEnv(env.OPENPROVIDER_NAMESERVERS)
  if (!value) return null
  const names = value.split(",").map((entry) => entry.trim()).filter(Boolean)
  return names.length > 0 ? names.map((name) => ({ name })) : null
}

const enabledCapabilityForDomain = (
  domainInput: string,
  acceptedCapabilityVersion?: string,
) => {
  const domain = splitDomain(domainInput)
  const currentlyEnabled = getEnabledTldCapability(domain.extension)
  const acceptedCapability = acceptedCapabilityVersion
    ? getTldCapabilityByVersion(acceptedCapabilityVersion)
    : null
  if (
    acceptedCapabilityVersion &&
    (
      !acceptedCapability?.productionEnabled ||
      acceptedCapability.tld !== domain.extension
    )
  ) {
    throw new Error(
      `Accepted TLD capability ${acceptedCapabilityVersion} is not valid for .${domain.extension}.`,
    )
  }
  const capability = (
    acceptedCapability?.productionEnabled &&
    acceptedCapability.tld === domain.extension
      ? acceptedCapability
      : null
  ) ?? currentlyEnabled
  if (!capability) throw new Error(`TLD .${domain.extension} is not enabled for provider operations.`)
  if (!validateTldRegistrationLabel(capability, domain.name)) {
    throw new Error(`Domain label is not supported for .${domain.extension}.`)
  }
  return { domain, capability }
}

export function buildOpenProviderDomainRegistrationRequest(
  domainInput: string,
  env: NodeJS.ProcessEnv = process.env,
  input?: {
    ownerHandle?: string
    adminHandle?: string
    period?: number
    autorenew?: "on" | "off" | "default"
    nameServers?: Array<{ name: string }>
    nsGroup?: string | null
    reference?: string
    acceptedCapabilityVersion?: string
  },
): OpenProviderRegistrationRequest {
  const { domain, capability } = enabledCapabilityForDomain(
    domainInput,
    input?.acceptedCapabilityVersion,
  )
  const explicitNameServers = input?.nameServers && input.nameServers.length > 0
    ? input.nameServers
    : null
  const nsGroup = explicitNameServers
    ? null
    : cleanEnv(input?.nsGroup ?? undefined) ?? cleanEnv(env.OPENPROVIDER_NS_GROUP)
  const nameServers = explicitNameServers ?? nameserversFromEnv(env)
  if (!nsGroup && !nameServers) {
    throw new Error("OPENPROVIDER_NS_GROUP or OPENPROVIDER_NAMESERVERS is required for domain registration.")
  }

  return {
    domain: { name: domain.name, extension: domain.extension },
    period: input?.period ?? capability.registration.periodYears,
    owner_handle: cleanEnv(input?.ownerHandle) ?? requiredHandle(env, "OPENPROVIDER_OWNER_HANDLE"),
    admin_handle: cleanEnv(input?.adminHandle) ?? requiredHandle(env, "OPENPROVIDER_ADMIN_HANDLE"),
    tech_handle: requiredHandle(env, "OPENPROVIDER_TECH_HANDLE"),
    billing_handle: requiredHandle(env, "OPENPROVIDER_BILLING_HANDLE"),
    autorenew: input?.autorenew ?? "on",
    ...(nsGroup ? { ns_group: nsGroup } : { name_servers: nameServers ?? [] }),
    ...(cleanEnv(input?.reference) ? { comments: cleanEnv(input?.reference) as string } : {}),
  }
}

export function buildOpenProviderDomainTransferRequest(
  domainInput: string,
  env: NodeJS.ProcessEnv = process.env,
  input: {
    authCode: string
    ownerHandle?: string
    adminHandle?: string
    autorenew?: "on" | "off" | "default"
    nameServers?: Array<{ name: string }>
    nsGroup?: string | null
    reference?: string
    acceptedCapabilityVersion?: string
  },
): OpenProviderTransferRequest {
  const { domain, capability } = enabledCapabilityForDomain(
    domainInput,
    input.acceptedCapabilityVersion,
  )
  const authCode = input.authCode.trim()
  if (!validateTldTransferAuthorization(capability, authCode)) {
    throw new Error(`A valid .${capability.tld} OpenProvider domain transfer auth code is required.`)
  }
  const explicitNameServers = input.nameServers && input.nameServers.length > 0
    ? input.nameServers
    : null
  const nsGroup = explicitNameServers
    ? null
    : cleanEnv(input.nsGroup ?? undefined) ?? cleanEnv(env.OPENPROVIDER_NS_GROUP)
  const nameServers = explicitNameServers ?? nameserversFromEnv(env)
  if (!nsGroup && !nameServers) {
    throw new Error("OPENPROVIDER_NS_GROUP or OPENPROVIDER_NAMESERVERS is required for domain transfer.")
  }
  return {
    domain: { name: domain.name, extension: domain.extension },
    auth_code: authCode,
    owner_handle: cleanEnv(input.ownerHandle) ?? requiredHandle(env, "OPENPROVIDER_OWNER_HANDLE"),
    admin_handle: cleanEnv(input.adminHandle) ?? requiredHandle(env, "OPENPROVIDER_ADMIN_HANDLE"),
    tech_handle: requiredHandle(env, "OPENPROVIDER_TECH_HANDLE"),
    billing_handle: requiredHandle(env, "OPENPROVIDER_BILLING_HANDLE"),
    autorenew: input.autorenew ?? (
      capability.renewal.executionMode === "provider_autorenew" ? "on" : "off"
    ),
    ...(nsGroup ? { ns_group: nsGroup } : { name_servers: nameServers ?? [] }),
    ...(cleanEnv(input.reference) ? { comments: cleanEnv(input.reference) as string } : {}),
  }
}

export function buildOpenProviderCustomerRequest(
  details: DomainRegistrantDetails,
  reference?: string,
): Record<string, unknown> {
  return {
    name: {
      first_name: details.firstName,
      last_name: details.lastName,
    },
    ...(details.companyName ? { company_name: details.companyName } : {}),
    email: details.email,
    address: {
      street: details.street,
      number: details.number,
      ...(details.suffix ? { suffix: details.suffix } : {}),
      zipcode: details.zipcode,
      city: details.city,
      country: details.country,
      ...(details.state ? { state: details.state } : {}),
    },
    phone: {
      country_code: details.phoneCountryCode,
      area_code: details.phoneAreaCode,
      subscriber_number: details.phoneSubscriberNumber,
    },
    locale: details.locale,
    ...(cleanEnv(reference) ? { comments: cleanEnv(reference) as string } : {}),
  }
}

export async function createOpenProviderCustomerHandle(
  details: DomainRegistrantDetails,
  options?: OpenProviderOptions & { reference?: string },
): Promise<OpenProviderCustomerHandleResult> {
  const env = options?.env ?? process.env
  const token = options?.token ?? await loginOpenProvider(options)
  let response: Response
  try {
    response = await fetcher(options)(`${apiBase(env)}/customers`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(buildOpenProviderCustomerRequest(details, options?.reference)),
    })
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError("OpenProvider customer handle creation", error)
  }
  if (!response.ok) {
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new OpenProviderIndeterminateWriteError("OpenProvider customer handle creation")
    }
    throw new OpenProviderApiError("OpenProvider customer handle creation", response.status)
  }

  let payload: unknown
  try {
    payload = await json(response)
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError(
      "OpenProvider customer handle creation",
      error,
    )
  }
  const data = dataObject(payload)
  const handle =
    typeof data.handle === "string"
      ? data.handle
      : typeof data.id === "string"
        ? data.id
        : null
  if (!handle) {
    throw new OpenProviderIndeterminateWriteError(
      "OpenProvider customer handle creation",
    )
  }
  return { handle, raw: payload }
}

const openProviderDomainName = (value: Record<string, unknown>): string | null => {
  const domain = readObject(value.domain)
  const name = typeof domain.name === "string" ? domain.name : null
  const extension = typeof domain.extension === "string" ? domain.extension : null
  if (!name || !extension) return null
  try {
    return splitDomain(`${name}.${extension.replace(/^\./, "")}`).domain
  } catch {
    return null
  }
}

const parseOpenProviderDomainRecord = (value: unknown): OpenProviderDomainRecord | null => {
  const source = readObject(value)
  const id = typeof source.id === "string" || typeof source.id === "number" ? source.id : null
  const domain = openProviderDomainName(source)
  if (id == null || !domain) return null
  const nameServers = Array.isArray(source.name_servers)
    ? source.name_servers
      .map((entry) => readObject(entry).name)
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : []
  return {
    id,
    domain,
    status: typeof source.status === "string" ? source.status : "unknown",
    ownerHandle: typeof source.owner_handle === "string" ? source.owner_handle : null,
    adminHandle: typeof source.admin_handle === "string" ? source.admin_handle : null,
    nameServers,
    renewalDate: typeof source.renewal_date === "string" && source.renewal_date.trim()
      ? source.renewal_date
      : null,
    registryExpiryDate:
      typeof source.registry_expiration_date === "string" &&
      source.registry_expiration_date.trim()
      ? source.registry_expiration_date
      : null,
    autorenew: source.autorenew === "on" || source.autorenew === "off" || source.autorenew === "default"
      ? source.autorenew
      : "unknown",
    verificationEmailStatus:
      typeof source.verification_email_status === "string" && source.verification_email_status.trim()
        ? source.verification_email_status
        : null,
    verificationEmailExpiresAt:
      typeof source.verification_email_exp_date === "string" &&
      source.verification_email_exp_date.trim()
        ? source.verification_email_exp_date
        : null,
    verificationEmailDescription:
      typeof source.verification_email_status_description === "string" &&
      source.verification_email_status_description.trim()
        ? source.verification_email_status_description
        : null,
    raw: value,
  }
}

const providerPriceMinor = (value: unknown): number | null => {
  const normalized = typeof value === "number"
    ? value.toFixed(2)
    : typeof value === "string" ? value.trim() : ""
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ""] = normalized.split(".")
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return Number.isSafeInteger(minor) && minor >= 0 ? minor : null
}

export async function getOpenProviderDomainOperationPrice(
  domainInput: string,
  operation: "transfer" | "renew",
  options?: OpenProviderOptions,
): Promise<OpenProviderDomainPrice> {
  const env = options?.env ?? process.env
  const domain = splitDomain(domainInput)
  const token = options?.token ?? await loginOpenProvider(options)
  const query = new URLSearchParams({
    "domain.name": domain.name,
    "domain.extension": domain.extension,
    operation,
    period: "1",
  })
  const response = await fetcher(options)(`${apiBase(env)}/domains/prices?${query.toString()}`, {
    method: "GET",
    headers: jsonHeaders(token),
  })
  if (!response.ok) {
    throw new OpenProviderApiError(
      `OpenProvider domain ${operation} price`,
      response.status,
    )
  }
  const payload = await json(response)
  const data = dataObject(payload)
  const prices = readObject(data.price)
  const reseller = readObject(prices.reseller)
  const currency = typeof reseller.currency === "string" ? reseller.currency.trim().toUpperCase() : ""
  const netAmountMinor = providerPriceMinor(reseller.price)
  if (!currency || netAmountMinor == null) {
    throw new Error(`OpenProvider ${operation} price response is incomplete.`)
  }
  return {
    domain: domain.domain,
    operation,
    currency,
    netAmountMinor,
    premium: data.is_premium === true,
    raw: payload,
  }
}

export async function getOpenProviderDomainRenewalPrice(
  domainInput: string,
  options?: OpenProviderOptions,
): Promise<OpenProviderDomainPrice> {
  return getOpenProviderDomainOperationPrice(domainInput, "renew", options)
}

export async function getOpenProviderDomainTransferPrice(
  domainInput: string,
  options?: OpenProviderOptions,
): Promise<OpenProviderDomainPrice> {
  return getOpenProviderDomainOperationPrice(domainInput, "transfer", options)
}

export async function setOpenProviderDomainAutorenew(
  domainId: string | number,
  autorenew: "on" | "off",
  options?: OpenProviderOptions,
): Promise<OpenProviderAutorenewResult> {
  const normalizedId = String(domainId).trim()
  if (!normalizedId) throw new Error("OpenProvider domain id is required.")
  const env = options?.env ?? process.env
  const token = options?.token ?? await loginOpenProvider(options)
  let response: Response
  try {
    response = await fetcher(options)(`${apiBase(env)}/domains/${encodeURIComponent(normalizedId)}`, {
      method: "PUT",
      headers: jsonHeaders(token),
      body: JSON.stringify({ autorenew }),
    })
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError("OpenProvider domain autorenew update", error)
  }
  if (!response.ok) {
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new OpenProviderIndeterminateWriteError("OpenProvider domain autorenew update")
    }
    throw new OpenProviderApiError("OpenProvider domain autorenew update", response.status)
  }
  let payload: unknown
  try {
    payload = await json(response)
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError("OpenProvider domain autorenew update", error)
  }
  const data = dataObject(payload)
  const returnedId = typeof data.id === "string" || typeof data.id === "number"
    ? data.id
    : domainId
  return {
    id: returnedId,
    autorenew,
    status: typeof data.status === "string" ? data.status : null,
    raw: payload,
  }
}

export async function findOpenProviderDomain(
  domainInput: string,
  options?: OpenProviderOptions,
): Promise<OpenProviderDomainRecord | null> {
  const env = options?.env ?? process.env
  const domain = splitDomain(domainInput)
  const token = options?.token ?? await loginOpenProvider(options)
  const query = new URLSearchParams({
    full_name: domain.domain,
    with_verification_email: "true",
    limit: "2",
  })
  const response = await fetcher(options)(`${apiBase(env)}/domains?${query.toString()}`, {
    method: "GET",
    headers: jsonHeaders(token),
  })
  if (!response.ok) throw new OpenProviderApiError("OpenProvider domain lookup", response.status)
  const data = dataObject(await json(response))
  const results = Array.isArray(data.results) ? data.results : []
  return results
    .map(parseOpenProviderDomainRecord)
    .find((entry): entry is OpenProviderDomainRecord => entry?.domain === domain.domain) ?? null
}

export async function findOpenProviderCustomerByReference(
  reference: string,
  options?: OpenProviderOptions,
): Promise<OpenProviderCustomerRecord | null> {
  const normalizedReference = cleanEnv(reference)
  if (!normalizedReference) throw new Error("OpenProvider customer reference is required.")
  const env = options?.env ?? process.env
  const token = options?.token ?? await loginOpenProvider(options)
  const query = new URLSearchParams({ comment_pattern: normalizedReference, limit: "2" })
  const response = await fetcher(options)(`${apiBase(env)}/customers?${query.toString()}`, {
    method: "GET",
    headers: jsonHeaders(token),
  })
  if (!response.ok) throw new OpenProviderApiError("OpenProvider customer lookup", response.status)
  const data = dataObject(await json(response))
  const results = Array.isArray(data.results) ? data.results : []
  for (const result of results) {
    const source = readObject(result)
    const handle = typeof source.handle === "string" ? source.handle : null
    const comments = typeof source.comments === "string" ? source.comments : null
    if (handle && comments === normalizedReference) {
      return { handle, comments, raw: result }
    }
  }
  return null
}

export async function getOpenProviderResellerBalance(
  options?: OpenProviderOptions,
): Promise<OpenProviderResellerBalance> {
  const env = options?.env ?? process.env
  const token = options?.token ?? await loginOpenProvider(options)
  const response = await fetcher(options)(
    `${apiBase(env)}/resellers?with_settings=true`,
    {
      method: "GET",
      headers: jsonHeaders(token),
    },
  )
  if (!response.ok) {
    throw new OpenProviderApiError("OpenProvider reseller balance lookup", response.status)
  }
  const data = dataObject(await json(response))
  const settings = readObject(data.settings)
  const availableAmount = data.balance
  const reservedAmount = data.reserved_balance
  const currency = settings.currency
  if (
    typeof availableAmount !== "number" ||
    !Number.isFinite(availableAmount) ||
    typeof reservedAmount !== "number" ||
    !Number.isFinite(reservedAmount) ||
    typeof currency !== "string" ||
    !currency.trim()
  ) {
    throw new Error("OpenProvider reseller balance response is incomplete.")
  }
  return {
    availableAmount,
    reservedAmount,
    currency: currency.trim().toUpperCase(),
  }
}

export async function getOpenProviderDomainAuthCode(
  domainId: string | number,
  options?: OpenProviderOptions,
): Promise<string> {
  const normalizedId = String(domainId).trim()
  if (!normalizedId) throw new Error("OpenProvider domain id is required.")
  const env = options?.env ?? process.env
  const token = options?.token ?? await loginOpenProvider(options)
  const response = await fetcher(options)(
    `${apiBase(env)}/domains/${encodeURIComponent(normalizedId)}/authcode?auth_code_type=external`,
    {
      method: "GET",
      headers: jsonHeaders(token),
    },
  )
  if (!response.ok) {
    throw new OpenProviderApiError("OpenProvider domain auth-code lookup", response.status)
  }
  const data = dataObject(await json(response))
  const authCode = typeof data.auth_code === "string"
    ? data.auth_code.trim()
    : ""
  if (!authCode) {
    throw new Error("OpenProvider did not return an external domain auth code.")
  }
  return authCode
}

export async function registerOpenProviderDomain(
  domainInput: string,
  options?: OpenProviderOptions & {
    ownerHandle?: string
    adminHandle?: string
    period?: number
    autorenew?: "on" | "off" | "default"
    nameServers?: Array<{ name: string }>
    nsGroup?: string | null
    reference?: string
    acceptedCapabilityVersion?: string
  },
): Promise<OpenProviderRegistrationResult> {
  const env = options?.env ?? process.env
  const domain = splitDomain(domainInput)
  const token = options?.token ?? await loginOpenProvider(options)
  const body = buildOpenProviderDomainRegistrationRequest(domain.domain, env, {
    ownerHandle: options?.ownerHandle,
    adminHandle: options?.adminHandle,
    period: options?.period,
    autorenew: options?.autorenew,
    nameServers: options?.nameServers,
    nsGroup: options?.nsGroup,
    reference: options?.reference,
    acceptedCapabilityVersion: options?.acceptedCapabilityVersion,
  })
  let response: Response
  try {
    response = await fetcher(options)(`${apiBase(env)}/domains`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError("OpenProvider domain registration", error)
  }
  if (!response.ok) {
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new OpenProviderIndeterminateWriteError("OpenProvider domain registration")
    }
    throw new OpenProviderApiError("OpenProvider domain registration", response.status)
  }

  let payload: unknown
  try {
    payload = await json(response)
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError("OpenProvider domain registration", error)
  }
  const data = dataObject(payload)
  const id = typeof data.id === "string" || typeof data.id === "number" ? data.id : null
  if (id == null) {
    throw new OpenProviderIndeterminateWriteError("OpenProvider domain registration")
  }
  const providerStatus = typeof data.status === "string" ? data.status.toUpperCase() : ""
  return {
    id,
    domain: domain.domain,
    status:
      !providerStatus || providerStatus === "ACT" || providerStatus === "ACTIVE"
        ? "registered"
        : "requested",
    raw: payload,
  }
}

export async function transferOpenProviderDomain(
  domainInput: string,
  options: OpenProviderOptions & {
    authCode: string
    ownerHandle?: string
    adminHandle?: string
    autorenew?: "on" | "off" | "default"
    nameServers: Array<{ name: string }>
    reference: string
    acceptedCapabilityVersion?: string
  },
): Promise<OpenProviderTransferResult> {
  const env = options.env ?? process.env
  const domain = splitDomain(domainInput)
  const token = options.token ?? await loginOpenProvider(options)
  const body = buildOpenProviderDomainTransferRequest(domain.domain, env, {
    authCode: options.authCode,
    ownerHandle: options.ownerHandle,
    adminHandle: options.adminHandle,
    autorenew: options.autorenew,
    nameServers: options.nameServers,
    nsGroup: null,
    reference: options.reference,
    acceptedCapabilityVersion: options.acceptedCapabilityVersion,
  })
  let response: Response
  try {
    response = await fetcher(options)(`${apiBase(env)}/domains/transfer`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError("OpenProvider domain transfer", error)
  }
  if (!response.ok) {
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new OpenProviderIndeterminateWriteError("OpenProvider domain transfer")
    }
    throw new OpenProviderApiError(
      "OpenProvider domain transfer",
      response.status,
      await providerErrorCode(response),
    )
  }
  let payload: unknown
  try {
    payload = await json(response)
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError("OpenProvider domain transfer", error)
  }
  const data = dataObject(payload)
  const id = typeof data.id === "string" || typeof data.id === "number" ? data.id : null
  if (id == null) {
    throw new OpenProviderIndeterminateWriteError("OpenProvider domain transfer")
  }
  const status = typeof data.status === "string" ? data.status.toUpperCase() : ""
  return {
    id,
    domain: domain.domain,
    status: ["ACT", "ACTIVE", "REGISTERED"].includes(status) ? "transferred" : "requested",
    raw: payload,
  }
}

export async function updateOpenProviderDomainNameservers(
  domainId: string | number,
  nameServers: Array<{ name: string }>,
  options?: OpenProviderOptions,
): Promise<OpenProviderNameserverUpdateResult> {
  const normalizedId = String(domainId).trim()
  const normalizedNameservers = [...new Set(
    nameServers.map((entry) => entry.name.trim().toLowerCase().replace(/\.$/, "")),
  )].filter(Boolean)
  if (!normalizedId) throw new Error("OpenProvider domain id is required.")
  if (normalizedNameservers.length < 2) {
    throw new Error("At least two nameservers are required for an OpenProvider domain update.")
  }
  const env = options?.env ?? process.env
  const token = options?.token ?? await loginOpenProvider(options)
  let response: Response
  try {
    response = await fetcher(options)(`${apiBase(env)}/domains/${encodeURIComponent(normalizedId)}`, {
      method: "PUT",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        name_servers: normalizedNameservers.map((name) => ({ name })),
        remove_nses: true,
      }),
    })
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError(
      "OpenProvider domain nameserver update",
      error,
    )
  }
  if (!response.ok) {
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new OpenProviderIndeterminateWriteError("OpenProvider domain nameserver update")
    }
    throw new OpenProviderApiError("OpenProvider domain nameserver update", response.status)
  }
  let payload: unknown
  try {
    payload = await json(response)
  } catch (error) {
    throw new OpenProviderIndeterminateWriteError(
      "OpenProvider domain nameserver update",
      error,
    )
  }
  const data = dataObject(payload)
  const id = typeof data.id === "string" || typeof data.id === "number" ? data.id : domainId
  return {
    id,
    status: typeof data.status === "string" ? data.status : null,
    raw: payload,
  }
}
