import "server-only"
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
}

export type OpenProviderRegistrationResult = {
  id: number | string | null
  domain: string
  status: "registered" | "requested"
  raw: unknown
}

export type OpenProviderCustomerHandleResult = {
  handle: string
  raw: unknown
}

type FetchLike = typeof fetch

type OpenProviderOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: FetchLike
  token?: string
}

const DEFAULT_API_BASE = "https://api.openprovider.eu/v1beta"

export class OpenProviderApiError extends Error {
  status: number
  operation: string

  constructor(operation: string, status: number) {
    super(`${operation} failed with HTTP ${status}.`)
    this.name = "OpenProviderApiError"
    this.status = status
    this.operation = operation
  }
}

const cleanEnv = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
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

const fetcher = (options?: OpenProviderOptions): FetchLike => options?.fetchImpl ?? globalThis.fetch

export function requireOpenProviderCredentials(env: NodeJS.ProcessEnv = process.env): { username: string; password: string } {
  const username = cleanEnv(env.OPENPROVIDER_USERNAME)
  const password = cleanEnv(env.OPENPROVIDER_PASSWORD)
  if (!username || !password) throw new Error("OPENPROVIDER_USERNAME and OPENPROVIDER_PASSWORD are required.")
  return { username, password }
}

export async function loginOpenProvider(options?: OpenProviderOptions): Promise<string> {
  const env = options?.env ?? process.env
  const credentials = requireOpenProviderCredentials(env)
  const response = await fetcher(options)(`${apiBase(env)}/auth/login`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(credentials),
  })
  if (!response.ok) throw new OpenProviderApiError("OpenProvider login", response.status)

  const payload = dataObject(await json(response))
  const token = typeof payload.token === "string" ? payload.token : null
  if (!token) throw new Error("OpenProvider login response did not include a token.")
  return token
}

const normalizeMoney = (source: unknown): { amount: string; currency: string } | null => {
  const value = readObject(source)
  const amount = value.price ?? value.amount ?? value.product_price
  const currency = value.currency ?? value.product_currency
  if ((typeof amount === "string" || typeof amount === "number") && typeof currency === "string") {
    return { amount: String(amount), currency }
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

export async function checkOpenProviderDomainAvailability(
  domainInput: string,
  options?: OpenProviderOptions,
): Promise<OpenProviderAvailabilityResult> {
  const domain = splitDomain(domainInput)
  const env = options?.env ?? process.env
  const token = options?.token ?? await loginOpenProvider(options)
  const response = await fetcher(options)(`${apiBase(env)}/domains/check`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      domains: [{ name: domain.name, extension: domain.extension }],
      with_price: true,
    }),
  })

  if (!response.ok) {
    return {
      status: "internal",
      domain: domain.domain,
      available: false,
      premium: false,
      price: null,
      internalReason: `provider_http_${response.status}`,
    }
  }

  return normalizeOpenProviderAvailabilityResponse(domain.domain, await json(response))
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
  },
): OpenProviderRegistrationRequest {
  const domain = splitDomain(domainInput)
  const nsGroup = cleanEnv(input?.nsGroup ?? undefined) ?? cleanEnv(env.OPENPROVIDER_NS_GROUP)
  const nameServers = input?.nameServers && input.nameServers.length > 0
    ? input.nameServers
    : nameserversFromEnv(env)
  if (!nsGroup && !nameServers) {
    throw new Error("OPENPROVIDER_NS_GROUP or OPENPROVIDER_NAMESERVERS is required for domain registration.")
  }

  return {
    domain: { name: domain.name, extension: domain.extension },
    period: input?.period ?? 1,
    owner_handle: cleanEnv(input?.ownerHandle) ?? requiredHandle(env, "OPENPROVIDER_OWNER_HANDLE"),
    admin_handle: cleanEnv(input?.adminHandle) ?? requiredHandle(env, "OPENPROVIDER_ADMIN_HANDLE"),
    tech_handle: requiredHandle(env, "OPENPROVIDER_TECH_HANDLE"),
    billing_handle: requiredHandle(env, "OPENPROVIDER_BILLING_HANDLE"),
    autorenew: input?.autorenew ?? "on",
    ...(nsGroup ? { ns_group: nsGroup } : { name_servers: nameServers ?? [] }),
  }
}

export function buildOpenProviderCustomerRequest(details: DomainRegistrantDetails): Record<string, unknown> {
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
  }
}

export async function createOpenProviderCustomerHandle(
  details: DomainRegistrantDetails,
  options?: OpenProviderOptions,
): Promise<OpenProviderCustomerHandleResult> {
  const env = options?.env ?? process.env
  const token = options?.token ?? await loginOpenProvider(options)
  const response = await fetcher(options)(`${apiBase(env)}/customers`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(buildOpenProviderCustomerRequest(details)),
  })
  if (!response.ok) throw new OpenProviderApiError("OpenProvider customer handle creation", response.status)

  const payload = await json(response)
  const data = dataObject(payload)
  const handle =
    typeof data.handle === "string"
      ? data.handle
      : typeof data.id === "string"
        ? data.id
        : null
  if (!handle) throw new Error("OpenProvider customer creation response did not include a handle.")
  return { handle, raw: payload }
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
  })
  const response = await fetcher(options)(`${apiBase(env)}/domains`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new OpenProviderApiError("OpenProvider domain registration", response.status)

  const payload = await json(response)
  const data = dataObject(payload)
  const id = typeof data.id === "string" || typeof data.id === "number" ? data.id : null
  return {
    id,
    domain: domain.domain,
    status: "registered",
    raw: payload,
  }
}
