import { createTransport } from "nodemailer"
import type { SendMailOptions, Transporter } from "nodemailer"
import { recordMailFailureAlert } from "@/lib/email/alerts"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"

const DEFAULT_FROM = "noreply@siteinabox.nl"
const CLOUDFLARE_SMTP_HOST = "smtp.mx.cloudflare.net"
const CLOUDFLARE_SMTP_PORT = 465
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
const MAIL_LOG_ERROR_MESSAGE_LIMIT = 1000
const DEFAULT_MAIL_SEND_TIMEOUT_MS = 10_000

export const mailIntents = [
  "platform.operational",
  "auth.magic_link",
  "auth.password_reset",
  "preview.magic_link",
  "preview.site_ready",
  "privacy.data_export",
  "intake.internal_notification",
  "forms.tenant_notification",
  "site.live_notice",
] as const

export type MailIntent = (typeof mailIntents)[number]

export const mailStatuses = ["sent", "failed"] as const
export type MailStatus = (typeof mailStatuses)[number]

export const mailRetryStates = ["none", "retryable", "permanent"] as const
export type MailRetryState = (typeof mailRetryStates)[number]

export const mailIntentOptions = mailIntents.map((intent) => ({ label: intent, value: intent }))
export const mailStatusOptions = mailStatuses.map((status) => ({ label: status, value: status }))
export const mailRetryStateOptions = mailRetryStates.map((state) => ({ label: state, value: state }))

export type MailTenantRef = string | number | { id?: string | number } | null | undefined

export type SendEmailOptions = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  intent?: MailIntent
  tenant?: MailTenantRef
  from?: string
  replyTo?: string
  /**
   * Optional Payload instance for metadata logging. Email subject/body are
   * intentionally never written to the log collection.
   */
  payload?: MailLogPayload
}

export type MailProviderSendInput = {
  from: string
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export type MailProviderSuccess = {
  provider: string
  providerMessageId?: string
}

export type MailProviderError = {
  provider: string
  providerErrorCode?: string
  providerErrorMessage: string
  retryState: MailRetryState
}

export type MailTransportProvider = {
  provider: string
  send(input: MailProviderSendInput): Promise<MailProviderSuccess>
}

export type MailLogPayload = {
  create(args: {
    collection: "mail-logs" | "operational-alerts"
    data: Record<string, unknown>
    overrideAccess: true
  }): Promise<unknown>
  find?: (args: {
    collection: "mail-logs" | "operational-alerts"
    where: Record<string, unknown>
    limit: number
    depth: 0
    overrideAccess: true
  }) => Promise<{ totalDocs?: number; docs?: unknown[] }>
  update?: (args: {
    collection: "operational-alerts"
    id: string | number
    data: Record<string, unknown>
    depth: 0
    overrideAccess: true
  }) => Promise<unknown>
  logger?: {
    warn?: (message: string | Record<string, unknown>, meta?: string | Record<string, unknown>) => void
    error?: (message: string | Record<string, unknown>, meta?: string | Record<string, unknown>) => void
  }
}

export type SendEmailDeps = {
  provider?: MailTransportProvider
  now?: () => Date
}

export class MailSendError extends Error {
  normalized: MailProviderError

  constructor(normalized: MailProviderError, cause?: unknown) {
    super(`Email send failed: ${normalized.providerErrorMessage}`)
    this.name = "MailSendError"
    this.normalized = normalized
    this.cause = cause
  }
}

export function getCloudflareEmailSmtpToken() {
  const token = process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN?.trim()
  if (!token || (token.startsWith("<") && token.endsWith(">"))) {
    return null
  }
  return token
}

export function getCloudflareEmailRestConfig(env: NodeJS.ProcessEnv = process.env) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const token = env.CLOUDFLARE_API_TOKEN?.trim()
  if (!accountId || !token || (token.startsWith("<") && token.endsWith(">"))) return null
  return { accountId, token }
}

export function getPlatformMailSender(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.EMAIL_FROM?.trim()
  return configured || DEFAULT_FROM
}

export function getMailSendTimeoutMs(env: NodeJS.ProcessEnv = process.env) {
  const configured = Number(env.SIAB_MAIL_SEND_TIMEOUT_MS)
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAIL_SEND_TIMEOUT_MS
  return Math.max(1_000, Math.min(configured, 60_000))
}

export function resolveMailSender(opts: Pick<SendEmailOptions, "from">) {
  return opts.from?.trim() || getPlatformMailSender()
}

export function createCloudflareSmtpTransport(token: string): Transporter {
  const timeout = getMailSendTimeoutMs()
  return createTransport({
    host: CLOUDFLARE_SMTP_HOST,
    port: CLOUDFLARE_SMTP_PORT,
    secure: true,
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
    auth: {
      user: "api_token",
      pass: token,
    },
  })
}

export function createCloudflareSmtpProvider(): MailTransportProvider {
  const token = getCloudflareEmailSmtpToken()
  if (!token) {
    throw new Error("CLOUDFLARE_EMAIL_SMTP_TOKEN missing or invalid - cannot send email")
  }

  const transport = createCloudflareSmtpTransport(token)
  return createNodemailerProvider(transport)
}

export function createCloudflareEmailProvider(): MailTransportProvider {
  const restConfig = getCloudflareEmailRestConfig()
  if (restConfig) return createCloudflareRestProvider(restConfig)
  return createCloudflareSmtpProvider()
}

export function createCloudflareRestProvider(config: { accountId: string; token: string }): MailTransportProvider {
  return {
    provider: "cloudflare-rest",
    async send(input) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), getMailSendTimeoutMs())
      try {
        const response = await fetch(`${CLOUDFLARE_API_BASE}/accounts/${config.accountId}/email/sending/send`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: input.from,
            to: input.to,
            subject: input.subject,
            html: input.html,
            ...(input.text ? { text: input.text } : {}),
            ...(input.replyTo ? { reply_to: input.replyTo } : {}),
          }),
          signal: controller.signal,
        })
        const body = await response.json().catch(() => null) as CloudflareRestResponse | null
        if (!response.ok || body?.success === false) {
          throw cloudflareRestError(response.status, body)
        }
        return {
          provider: "cloudflare-rest",
        }
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

export function createNodemailerProvider(transport: Pick<Transporter, "sendMail">): MailTransportProvider {
  return {
    provider: "cloudflare-smtp",
    async send(input) {
      const message: SendMailOptions = {
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }
      if (input.text) message.text = input.text
      if (input.replyTo) message.replyTo = input.replyTo

      const info = await transport.sendMail(message)
      return normalizeProviderResponse(info)
    },
  }
}

type CloudflareRestResponse = {
  success?: boolean
  errors?: Array<{ code?: number; message?: string }>
}

function cloudflareRestError(status: number, body: CloudflareRestResponse | null) {
  const firstError = body?.errors?.[0]
  const message = firstError?.message || `Cloudflare Email REST API failed with HTTP ${status}`
  return Object.assign(new Error(message), {
    code: firstError?.code != null ? String(firstError.code) : String(status),
    responseCode: status,
    response: message,
  })
}

export function normalizeProviderResponse(info: unknown): MailProviderSuccess {
  const maybeInfo = info && typeof info === "object" ? info as { messageId?: unknown } : {}
  const messageId = typeof maybeInfo.messageId === "string" ? maybeInfo.messageId : undefined
  return {
    provider: "cloudflare-smtp",
    ...(messageId ? { providerMessageId: messageId } : {}),
  }
}

export function normalizeProviderError(error: unknown, provider = "cloudflare-smtp"): MailProviderError {
  const err = error && typeof error === "object"
    ? error as {
        code?: unknown
        command?: unknown
        response?: unknown
        responseCode?: unknown
        message?: unknown
      }
    : {}
  const responseCode = typeof err.responseCode === "number" ? err.responseCode : undefined
  const rawCode = typeof err.code === "string" ? err.code : undefined
  const response = typeof err.response === "string" ? err.response : undefined
  const message = typeof err.message === "string" && err.message.trim()
    ? err.message
    : "Unknown provider error"
  const providerErrorCode = rawCode || (responseCode ? String(responseCode) : undefined)
  const providerErrorMessage = trimProviderErrorMessage(redactOperationalMessage(response || message))

  return {
    provider,
    ...(providerErrorCode ? { providerErrorCode } : {}),
    providerErrorMessage,
    retryState: classifyRetryState({ responseCode, code: rawCode, message: providerErrorMessage }),
  }
}

export async function sendEmail(opts: SendEmailOptions, deps: SendEmailDeps = {}) {
  const intent = opts.intent ?? "platform.operational"
  const from = resolveMailSender(opts)
  const now = deps.now ?? (() => new Date())
  const sendTimeoutMs = getMailSendTimeoutMs()
  let providerName = deps.provider?.provider ?? "cloudflare-smtp"

  try {
    const provider = deps.provider ?? createCloudflareEmailProvider()
    providerName = provider.provider
    const result = await withTimeout(provider.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    }), sendTimeoutMs, provider.provider)
    const timestamp = now().toISOString()
    await logMailDelivery(opts.payload, {
      flow: intent,
      tenant: formatTenantRef(opts.tenant),
      sender: from,
      replyTo: opts.replyTo,
      recipient: formatRecipient(opts.to),
      status: "sent",
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      retryState: "none",
      sentAt: timestamp,
    })
    return result
  } catch (error) {
    const normalized = error instanceof MailSendError
      ? error.normalized
      : normalizeProviderError(error, providerName)
    const timestamp = now().toISOString()
    await logMailDelivery(opts.payload, {
      flow: intent,
      tenant: formatTenantRef(opts.tenant),
      sender: from,
      replyTo: opts.replyTo,
      recipient: formatRecipient(opts.to),
      status: "failed",
      provider: normalized.provider,
      providerErrorCode: normalized.providerErrorCode,
      providerErrorMessage: normalized.providerErrorMessage,
      retryState: normalized.retryState,
      failedAt: timestamp,
    })
    await recordMailFailureAlert(opts.payload, {
      flow: intent,
      tenant: opts.tenant,
      sender: from,
      recipient: formatRecipient(opts.to),
      provider: normalized.provider,
      providerErrorCode: normalized.providerErrorCode,
      providerErrorMessage: normalized.providerErrorMessage,
      retryState: normalized.retryState,
      failedAt: timestamp,
    })
    throw error instanceof MailSendError ? error : new MailSendError(normalized, error)
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, provider: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      const error = Object.assign(
        new Error(`${provider} send timed out after ${timeoutMs}ms`),
        { code: "ETIMEDOUT" },
      )
      reject(error)
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function logMailDelivery(payload: MailLogPayload | undefined, data: Record<string, unknown>) {
  if (!payload) return

  try {
    await payload.create({
      collection: "mail-logs",
      overrideAccess: true,
      data: compactLogData(data),
    })
  } catch (error) {
    payload.logger?.warn?.("Failed to write outbound mail metadata log", {
      error: redactOperationalMessage(error),
    })
  }
}

function compactLogData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ""))
}

function formatRecipient(to: string | string[]) {
  return Array.isArray(to) ? to.join(", ") : to
}

function formatTenantRef(tenant: MailTenantRef) {
  if (tenant && typeof tenant === "object") return tenant.id
  return tenant
}

function trimProviderErrorMessage(message: string) {
  return message.length > MAIL_LOG_ERROR_MESSAGE_LIMIT
    ? `${message.slice(0, MAIL_LOG_ERROR_MESSAGE_LIMIT - 3)}...`
    : message
}

function classifyRetryState({
  responseCode,
  code,
  message,
}: {
  responseCode?: number
  code?: string
  message: string
}): MailRetryState {
  if (message.includes("E_SENDER_NOT_VERIFIED") || message.includes("E_SENDER_DOMAIN_NOT_AVAILABLE")) {
    return "permanent"
  }
  if (responseCode) {
    if (responseCode >= 500) return "permanent"
    if (responseCode >= 400) return "retryable"
  }
  if (code && ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN"].includes(code)) {
    return "retryable"
  }
  if (code && ["EAUTH", "EENVELOPE"].includes(code)) {
    return "permanent"
  }
  return "none"
}
