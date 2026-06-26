import "server-only"
import crypto from "node:crypto"

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
  metadata?: Record<string, unknown> | null
  _links?: {
    checkout?: { href?: string }
  }
}

export type CreateMolliePaymentInput = {
  amount: MollieAmount
  description: string
  redirectUrl: string
  webhookUrl: string
  metadata: Record<string, string | number | null>
  idempotencyKey: string
}

const MOLLIE_API_BASE = "https://api.mollie.com/v2"

export class MollieApiError extends Error {
  status: number

  constructor(operation: string, status: number) {
    super(`${operation} failed with HTTP ${status}.`)
    this.name = "MollieApiError"
    this.status = status
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

export function publicCmsOrigin(env = process.env): string {
  const origin = cleanEnv(env.MOLLIE_WEBHOOK_BASE_URL) ?? cleanEnv(env.SITE_URL)
  if (!origin) throw new Error("SITE_URL or MOLLIE_WEBHOOK_BASE_URL is required for Mollie webhook URLs.")
  return origin.replace(/\/+$/, "")
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
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
      metadata: input.metadata,
    }),
  })
  if (!response.ok) {
    throw new MollieApiError("Mollie payment creation", response.status)
  }
  return await response.json() as MolliePayment
}

export async function retrieveMolliePayment(paymentId: string): Promise<MolliePayment> {
  const response = await fetch(`${MOLLIE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${requireMollieApiKey()}`,
      Accept: "application/json",
    },
  })
  if (!response.ok) {
    throw new MollieApiError("Mollie payment lookup", response.status)
  }
  return await response.json() as MolliePayment
}

export function verifyMollieWebhookSignature(rawBody: string, signature: string | null, env = process.env): boolean {
  const secret = cleanEnv(env.MOLLIE_WEBHOOK_SIGNING_SECRET)
  if (!secret) return true
  if (!signature) return false
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  const received = signature.replace(/^sha256=/, "")
  const expectedBuffer = Buffer.from(expected, "hex")
  const receivedBuffer = Buffer.from(received, "hex")
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}
