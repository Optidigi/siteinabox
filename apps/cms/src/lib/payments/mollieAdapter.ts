import "server-only"
import crypto from "node:crypto"
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

export function mollieAmountFromEnv(env = process.env): MollieAmount {
  const currency = cleanEnv(env.MOLLIE_SITE_PAYMENT_CURRENCY) ?? "EUR"
  const value = cleanEnv(env.MOLLIE_SITE_PAYMENT_AMOUNT)
  if (!value) throw new Error("MOLLIE_SITE_PAYMENT_AMOUNT is required to create Mollie checkout.")
  if (!/^\d+\.\d{2}$/.test(value)) {
    throw new Error("MOLLIE_SITE_PAYMENT_AMOUNT must use Mollie's decimal format, for example 499.00.")
  }
  return { currency, value }
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

export function publicCmsOrigin(env = process.env): string {
  const origin = cleanEnv(env.MOLLIE_WEBHOOK_BASE_URL) ?? cleanEnv(env.SITE_URL)
  if (!origin) throw new Error("SITE_URL or MOLLIE_WEBHOOK_BASE_URL is required for Mollie webhook URLs.")
  return origin.replace(/\/+$/, "")
}

export async function createMollieCustomer(input: CreateMollieCustomerInput): Promise<MollieCustomer> {
  const response = await fetch(`${MOLLIE_API_BASE}/customers`, {
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
  return await response.json() as MollieCustomer
}

export async function listRecentMollieCustomers(
  limit = 250,
): Promise<MollieCustomer[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 250) {
    throw new Error("Mollie customer-list limit must be between 1 and 250.")
  }
  const query = new URLSearchParams({ limit: String(limit), sort: "desc" })
  let nextUrl: string | null = `${MOLLIE_API_BASE}/customers?${query.toString()}`
  const visited = new Set<string>()
  const customers: MollieCustomer[] = []
  while (nextUrl) {
    if (visited.size >= 1_000 || visited.has(nextUrl)) {
      throw new Error("Mollie customer-list pagination did not terminate safely.")
    }
    visited.add(nextUrl)
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${requireMollieApiKey()}`,
        Accept: "application/json",
      },
    })
    if (!response.ok) {
      throw new MollieApiError(
        "Mollie customer listing",
        response.status,
        await readMollieErrorBody(response),
      )
    }
    const result = await response.json() as MollieCustomerList
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
      parsed.pathname !== "/v2/customers"
    ) {
      throw new Error("Mollie customer-list pagination returned an untrusted next URL.")
    }
    nextUrl = parsed.toString()
  }
  return customers
}

export async function createMolliePayment(input: CreateMolliePaymentInput): Promise<MolliePayment> {
  const response = await fetch(`${MOLLIE_API_BASE}/payments`, {
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
      ...(input.sequenceType ? { sequenceType: input.sequenceType } : {}),
      metadata: input.metadata,
    }),
  })
  if (!response.ok) {
    throw new MollieApiError("Mollie payment creation", response.status, await readMollieErrorBody(response))
  }
  return await response.json() as MolliePayment
}

export async function retrieveMolliePayment(paymentId: string): Promise<MolliePayment> {
  const response = await fetch(
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
  return await response.json() as MolliePayment
}

export async function listRecentMolliePayments(
  limit = 250,
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
    if (visited.size >= 1_000 || visited.has(nextUrl)) {
      throw new Error("Mollie payment-list pagination did not terminate safely.")
    }
    visited.add(nextUrl)
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${requireMollieApiKey()}`,
        Accept: "application/json",
      },
    })
    if (!response.ok) {
      throw new MollieApiError(
        "Mollie payment listing",
        response.status,
        await readMollieErrorBody(response),
      )
    }
    const result = await response.json() as MolliePaymentList
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
      parsed.pathname !== "/v2/payments"
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
  const response = await fetch(
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
  return await response.json() as MollieMandate
}

export async function createMollieRefund(input: CreateMollieRefundInput): Promise<MollieRefund> {
  const response = await fetch(
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
  return await response.json() as MollieRefund
}

async function readMollieErrorBody(response: Response): Promise<{ title?: unknown; detail?: unknown } | undefined> {
  try {
    const body = await response.json()
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as { title?: unknown; detail?: unknown }
      : undefined
  } catch {
    return undefined
  }
}

export function verifyMollieWebhookSignature(rawBody: string, signature: string | null, env = process.env): boolean {
  const secret = cleanEnv(env.MOLLIE_WEBHOOK_SIGNING_SECRET)
  if (!secret) return env.NODE_ENV !== "production"
  if (!signature) return false
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  const received = signature.replace(/^sha256=/, "")
  const expectedBuffer = Buffer.from(expected, "hex")
  const receivedBuffer = Buffer.from(received, "hex")
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}
