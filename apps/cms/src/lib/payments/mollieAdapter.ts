import "server-only"
import { z } from "zod"
import { ProviderBoundaryError, requestProviderJson, type ProviderJsonResponse } from "@/lib/providers/http"
import { assertMollieId, mollieAmountSchema, parseMollieCustomer, parseMollieCustomerList, parseMolliePayment, parseMolliePaymentList, parseMollieMandate, parseMollieRefund, parseMollieMethods } from "./mollieResponse"
import { commerceProviderWritesAllowed } from "@/lib/commerce/releaseGate"

export type MollieAmount = {
  currency: string
  value: string
}

export type MolliePaymentStatus =
  | "open"
  | "canceled"
  | "pending"
  | "authorized"
  | "expired"
  | "failed"
  | "paid"

export type MolliePayment = {
  id: string
  status: MolliePaymentStatus | string
  amount?: MollieAmount
  amountChargedBack?: MollieAmount
  amountRefunded?: MollieAmount
  amountRemaining?: MollieAmount
  customerId?: string | null
  mandateId?: string | null
  sequenceType?: "first" | "recurring" | "oneoff" | string | null
  authorizedAt?: string | null
  paidAt?: string | null
  failedAt?: string | null
  canceledAt?: string | null
  expiredAt?: string | null
  createdAt?: string | null
  metadata?: Record<string, unknown> | null
  _embedded?: {
    refunds?: MollieRefund[]
    chargebacks?: MollieChargeback[]
  }
  _links?: {
    checkout?: { href?: string }
  }
}

export type MolliePaymentList = {
  _embedded?: {
    payments?: MolliePayment[]
  }
  _links?: {
    next?: { href?: string | null } | null
  }
}

export type MollieRefund = {
  id: string
  status: "queued" | "pending" | "processing" | "refunded" | "failed" | "canceled" | string
  amount: MollieAmount
  createdAt?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
}

export type MollieChargeback = {
  id: string
  amount: MollieAmount
  createdAt?: string | null
  reason?: {
    code?: string | null
    description?: string | null
  } | null
}

export type MollieMandate = {
  id: string
  status: "valid" | "pending" | "invalid" | string
  method?: string | null
  createdAt?: string | null
}

export type MollieCustomer = {
  id: string
  name?: string | null
  email?: string | null
  metadata?: Record<string, unknown> | null
}

export type MollieCustomerList = {
  _embedded?: {
    customers?: MollieCustomer[]
  }
  _links?: {
    next?: { href?: string | null } | null
  }
}

export type CreateMolliePaymentInput = {
  amount: MollieAmount
  customerId?: string | null
  mandateId?: string | null
  sequenceType?: "first" | "recurring" | "oneoff"
  description: string
  redirectUrl?: string | null
  webhookUrl: string
  metadata: Record<string, string | number | null>
  idempotencyKey: string
}

export type CreateMollieRefundInput = {
  paymentId: string
  amount: MollieAmount
  description: string
  metadata?: Record<string, string | number | null>
  idempotencyKey: string
}

export type CreateMollieCustomerInput = {
  name: string
  email: string
  metadata?: Record<string, string | number | null>
  idempotencyKey: string
}

const MOLLIE_API_BASE = "https://api.mollie.com/v2"

type MollieReadOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

export class MollieApiError extends Error {
  status: number
  detail?: string | null
  title?: string | null

  constructor(operation: string, status: number, body?: { title?: unknown; detail?: unknown }) {
    super(`${operation} failed with HTTP ${status}.`)
    this.name = "MollieApiError"
    this.status = status
    this.title = typeof body?.title === "string" ? body.title : null
    this.detail = typeof body?.detail === "string" ? body.detail : null
  }
}

const cleanEnv = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function requireMollieApiKey(env = process.env): string {
  const apiKey = cleanEnv(env.MOLLIE_API_KEY)
  if (!apiKey) throw new Error("MOLLIE_API_KEY is required for Mollie payments.")
  return apiKey
}

export type MollieApiKeyMode = "test" | "live" | "unknown" | "missing"

export function mollieApiKeyMode(env = process.env): MollieApiKeyMode {
  const apiKey = cleanEnv(env.MOLLIE_API_KEY)
  if (!apiKey) return "missing"
  if (apiKey.startsWith("test_")) return "test"
  if (apiKey.startsWith("live_")) return "live"
  return "unknown"
}

export function mollieDomainProvisioningEnabled(env = process.env): boolean {
  return commerceProviderWritesAllowed(env)
}

async function mollieRequest(url: string, init: RequestInit, options?: MollieReadOptions): Promise<ProviderJsonResponse> {
  return requestProviderJson(url, init, {
    operation: "Mollie API", timeoutMs: 15_000, maxBodyBytes: 1_048_576,
    readAttempts: 2, fetchImpl: options?.fetchImpl, signal: options?.signal,
  })
}

// One operation budget spans every page, capability read and read retry.
const withMollieReadBudget = async <T>(options: MollieReadOptions | undefined, work: (bounded: MollieReadOptions) => Promise<T>): Promise<T> => {
  const controller = new AbortController()
  const cancel = () => controller.abort(new ProviderBoundaryError("Mollie API", "cancelled"))
  if (options?.signal?.aborted) cancel()
  options?.signal?.addEventListener("abort", cancel, { once: true })
  const timer = setTimeout(() => controller.abort(new ProviderBoundaryError("Mollie API", "timeout")), 30_000)
  try {
    controller.signal.throwIfAborted()
    return await work({ ...options, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason
    throw error
  } finally {
    clearTimeout(timer)
    options?.signal?.removeEventListener("abort", cancel)
  }
}

export async function inspectMollieProfileCapabilities(options?: MollieReadOptions): Promise<void> {
  return withMollieReadBudget(options, inspectMollieProfileCapabilitiesRead)
}

async function inspectMollieProfileCapabilitiesRead(
  options: MollieReadOptions,
): Promise<void> {
  const env = options?.env ?? process.env
  const request = (url: string, init: RequestInit) => mollieRequest(url, init, options)
  const headers = {
    Authorization: `Bearer ${requireMollieApiKey(env)}`,
    Accept: "application/json",
  }
  const profileResponse = await request(`${MOLLIE_API_BASE}/profiles/me`, {
    method: "GET",
    headers,
  })
  if (!profileResponse.ok) {
    throw new MollieApiError(
      "Mollie current profile lookup",
      profileResponse.status,
    )
  }
  const profile = profileResponse.body
  if (
    !profile ||
    typeof profile !== "object" ||
    Array.isArray(profile) ||
    !(
      "id" in profile &&
      typeof profile.id === "string" &&
      /^pfl_[A-Za-z0-9]+$/.test(profile.id)
    )
  ) {
    throw new Error("Mollie current profile response is invalid.")
  }

  for (const sequenceType of ["first", "recurring"] as const) {
    const methodsResponse = await request(
      `${MOLLIE_API_BASE}/methods?sequenceType=${sequenceType}`,
      { method: "GET", headers },
    )
    if (!methodsResponse.ok) {
      throw new MollieApiError(
        `Mollie ${sequenceType} payment-method lookup`,
        methodsResponse.status,
      )
    }
    parseMollieMethods(methodsResponse.body)
  }
}

export function publicCmsOrigin(env = process.env): string {
  const origin = cleanEnv(env.MOLLIE_WEBHOOK_BASE_URL) ?? cleanEnv(env.SITE_URL)
  if (!origin) throw new Error("SITE_URL or MOLLIE_WEBHOOK_BASE_URL is required for Mollie webhook URLs.")
  return origin.replace(/\/+$/, "")
}

export async function createMollieCustomer(input: CreateMollieCustomerInput): Promise<MollieCustomer> {
  const response = await mollieRequest(`${MOLLIE_API_BASE}/customers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireMollieApiKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      metadata: input.metadata,
    }),
  })
  if (!response.ok) {
    throw new MollieApiError("Mollie customer creation", response.status, await readMollieErrorBody(response))
  }
  return parseMollieCustomer(response.body)
}

export async function listRecentMollieCustomers(limit = 250, options?: MollieReadOptions): Promise<MollieCustomer[]> {
  return withMollieReadBudget(options, bounded => listRecentMollieCustomersRead(limit, bounded))
}

async function listRecentMollieCustomersRead(
  limit: number, options: MollieReadOptions,
): Promise<MollieCustomer[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 250) {
    throw new Error("Mollie customer-list limit must be between 1 and 250.")
  }
  const query = new URLSearchParams({ limit: String(limit), sort: "desc" })
  let nextUrl: string | null = `${MOLLIE_API_BASE}/customers?${query.toString()}`
  const visited = new Set<string>()
  const customers: MollieCustomer[] = []
  while (nextUrl) {
    if (visited.size >= 20 || visited.has(nextUrl)) {
      throw new Error("Mollie customer-list pagination did not terminate safely.")
    }
    visited.add(nextUrl)
    const response = await mollieRequest(nextUrl, {
      headers: {
        Authorization: `Bearer ${requireMollieApiKey(options.env ?? process.env)}`,
        Accept: "application/json",
      },
    }, options)
    if (!response.ok) {
      throw new MollieApiError(
        "Mollie customer listing",
        response.status,
        await readMollieErrorBody(response),
      )
    }
    const result = parseMollieCustomerList(response.body)
    if (Array.isArray(result._embedded?.customers)) {
      customers.push(...result._embedded.customers)
    }
    const candidate = result._links?.next?.href?.trim() || null
    if (!candidate) {
      nextUrl = null
      continue
    }
    const parsed = new URL(candidate)
    if (
      parsed.origin !== "https://api.mollie.com" ||
      parsed.pathname !== "/v2/customers" || parsed.username || parsed.password || parsed.hash
    ) {
      throw new Error("Mollie customer-list pagination returned an untrusted next URL.")
    }
    nextUrl = parsed.toString()
  }
  return customers
}

export async function createMolliePayment(input: CreateMolliePaymentInput): Promise<MolliePayment> {
  mollieAmountSchema.parse(input.amount)
  if (input.customerId) assertMollieId(input.customerId, "cst")
  if (input.mandateId) assertMollieId(input.mandateId, "mdt")
  const response = await mollieRequest(`${MOLLIE_API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireMollieApiKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      amount: input.amount,
      description: input.description,
      ...(input.redirectUrl ? { redirectUrl: input.redirectUrl } : {}),
      webhookUrl: input.webhookUrl,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.mandateId ? { mandateId: input.mandateId } : {}),
      ...(input.sequenceType ? { sequenceType: input.sequenceType } : {}),
      metadata: input.metadata,
    }),
  })
  if (!response.ok) {
    throw new MollieApiError("Mollie payment creation", response.status, await readMollieErrorBody(response))
  }
  const payment = parseMolliePayment(response.body)
  if (payment.amount?.currency !== input.amount.currency || payment.amount.value !== input.amount.value ||
      (input.customerId && payment.customerId !== input.customerId) ||
      (input.mandateId && payment.mandateId !== input.mandateId) ||
      (input.sequenceType && payment.sequenceType !== input.sequenceType)) throw new Error("Mollie payment creation identity or amount mismatch.")
  return payment
}

export async function retrieveMolliePayment(paymentId: string): Promise<MolliePayment> {
  assertMollieId(paymentId, "tr")
  const response = await mollieRequest(
    `${MOLLIE_API_BASE}/payments/${encodeURIComponent(paymentId)}?embed=refunds,chargebacks`,
    {
    headers: {
      Authorization: `Bearer ${requireMollieApiKey()}`,
      Accept: "application/json",
    },
    },
  )
  if (!response.ok) {
    throw new MollieApiError("Mollie payment lookup", response.status, await readMollieErrorBody(response))
  }
  return parseMolliePayment(response.body, paymentId)
}

export async function listRecentMolliePayments(limit = 250, options?: MollieReadOptions): Promise<MolliePayment[]> {
  return withMollieReadBudget(options, bounded => listRecentMolliePaymentsRead(limit, bounded))
}

async function listRecentMolliePaymentsRead(
  limit: number, options: MollieReadOptions,
): Promise<MolliePayment[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 250) {
    throw new Error("Mollie payment-list limit must be between 1 and 250.")
  }
  const query = new URLSearchParams({
    limit: String(limit),
    sort: "desc",
  })
  let nextUrl: string | null = `${MOLLIE_API_BASE}/payments?${query.toString()}`
  const visited = new Set<string>()
  const payments: MolliePayment[] = []
  while (nextUrl) {
    if (visited.size >= 20 || visited.has(nextUrl)) {
      throw new Error("Mollie payment-list pagination did not terminate safely.")
    }
    visited.add(nextUrl)
    const response = await mollieRequest(nextUrl, {
      headers: {
        Authorization: `Bearer ${requireMollieApiKey(options.env ?? process.env)}`,
        Accept: "application/json",
      },
    }, options)
    if (!response.ok) {
      throw new MollieApiError(
        "Mollie payment listing",
        response.status,
        await readMollieErrorBody(response),
      )
    }
    const result = parseMolliePaymentList(response.body)
    if (Array.isArray(result._embedded?.payments)) {
      payments.push(...result._embedded.payments)
    }
    const candidate = result._links?.next?.href?.trim() || null
    if (!candidate) {
      nextUrl = null
      continue
    }
    const parsed = new URL(candidate)
    if (
      parsed.origin !== "https://api.mollie.com" ||
      parsed.pathname !== "/v2/payments" || parsed.username || parsed.password || parsed.hash
    ) {
      throw new Error("Mollie payment-list pagination returned an untrusted next URL.")
    }
    nextUrl = parsed.toString()
  }
  return payments
}

export async function retrieveMollieMandate(
  customerId: string,
  mandateId: string,
): Promise<MollieMandate> {
  assertMollieId(customerId, "cst")
  assertMollieId(mandateId, "mdt")
  const response = await mollieRequest(
    `${MOLLIE_API_BASE}/customers/${encodeURIComponent(customerId)}/mandates/${encodeURIComponent(mandateId)}`,
    {
      headers: {
        Authorization: `Bearer ${requireMollieApiKey()}`,
        Accept: "application/json",
      },
    },
  )
  if (!response.ok) {
    throw new MollieApiError("Mollie mandate lookup", response.status, await readMollieErrorBody(response))
  }
  return parseMollieMandate(response.body, mandateId)
}

export async function createMollieRefund(input: CreateMollieRefundInput): Promise<MollieRefund> {
  assertMollieId(input.paymentId, "tr")
  mollieAmountSchema.parse(input.amount)
  const response = await mollieRequest(
    `${MOLLIE_API_BASE}/payments/${encodeURIComponent(input.paymentId)}/refunds`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireMollieApiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        amount: input.amount,
        description: input.description,
        metadata: input.metadata,
      }),
    },
  )
  if (!response.ok) {
    throw new MollieApiError("Mollie refund creation", response.status, await readMollieErrorBody(response))
  }
  const refund = parseMollieRefund(response.body)
  if (refund.amount.currency !== input.amount.currency || refund.amount.value !== input.amount.value) throw new Error("Mollie refund amount mismatch.")
  return refund
}

async function readMollieErrorBody(response: ProviderJsonResponse): Promise<undefined> {
  const result = z.object({ status: z.number().int(), title: z.string(), detail: z.string().optional() }).safeParse(response.body)
  if (!result.success || result.data.status !== response.status) throw new Error("Mollie API returned an invalid error response.")
  // The HTTP status is diagnostic; provider prose may contain credentials or personal data.
  return undefined
}
