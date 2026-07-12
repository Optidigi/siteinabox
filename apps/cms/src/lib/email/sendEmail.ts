import { createTransport } from "nodemailer"
import type { SendMailOptions, Transporter } from "nodemailer"
import type { Payload } from "payload"
import { recordMailFailureAlert } from "@/lib/email/alerts"
import { findCommunicationPreference } from "@/lib/legal/communicationPreferences"
import { legalStatements } from "@/lib/legal/statements"
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
  "legal.reacceptance",
  "product.notification",
  "marketing.campaign",
] as const

export type MailIntent = (typeof mailIntents)[number]

export const mailStatuses = ["sent", "failed", "suppressed", "preference_blocked", "missing_subscription"] as const
export type MailStatus = (typeof mailStatuses)[number]

export const mailRetryStates = ["none", "retryable", "permanent"] as const
export type MailRetryState = (typeof mailRetryStates)[number]

export const mailIntentOptions = mailIntents.map((intent) => ({ label: intent, value: intent }))
export const mailStatusOptions = mailStatuses.map((status) => ({ label: status, value: status }))
export const mailRetryStateOptions = mailRetryStates.map((state) => ({ label: state, value: state }))

export type MailTenantRef = string | number | { id?: string | number } | null | undefined

export const mailCategories = ["security", "transactional", "legal", "tenant_operational", "product_notification", "marketing"] as const
export type MailCategory = (typeof mailCategories)[number]
export const mailCategoryOptions = mailCategories.map((category) => ({ label: category, value: category }))

export type MailListUnsubscribe = {
  /** Browser-safe confirmation/preferences URL rendered in the message body. */
  unsubscribeUrl: string
  preferencesUrl?: string
  /** RFC 8058 POST endpoint used only by mailbox-provider one-click actions. */
  oneClickUrl?: string
}

export type SendEmailOptions = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  intent?: MailIntent
  tenant?: MailTenantRef
  from?: string
  replyTo?: string
  category?: MailCategory
  tenantSubscriptionCategory?: "formSubmissions" | "publishingAndSiteStatus" | "domainAndDns" | "billingAndPayments" | "teamAndAccess" | "operationalDigest"
  /** Email whose effective personal preference must be checked for optional mail. */
  preferenceSubject?: string
  listUnsubscribe?: MailListUnsubscribe
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
  headers?: Record<string, string>
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

export class MailPolicyBlockedError extends Error {
  status: Extract<MailStatus, "suppressed" | "preference_blocked" | "missing_subscription">

  constructor(status: MailPolicyBlockedError["status"], message: string) {
    super(message)
    this.name = "MailPolicyBlockedError"
    this.status = status
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
            ...(input.headers ? { headers: input.headers } : {}),
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
      if (input.headers) message.headers = input.headers

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
  const category = inferMailCategory(intent)
  if (opts.category && opts.category !== category) {
    throw new MailPolicyBlockedError("preference_blocked", `Mail category ${opts.category} is not valid for ${intent}`)
  }
  const from = resolveMailSender(opts)
  const now = deps.now ?? (() => new Date())
  const sendTimeoutMs = getMailSendTimeoutMs()
  let providerName = deps.provider?.provider ?? "cloudflare-smtp"

  try {
    await enforceMailPolicy(opts, category, from, now)
    const provider = deps.provider ?? createCloudflareEmailProvider()
    providerName = provider.provider
    const result = await withTimeout(provider.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
      headers: buildMailHeaders(opts.listUnsubscribe),
    }), sendTimeoutMs, provider.provider)
    const timestamp = now().toISOString()
    await logMailDelivery(opts.payload, {
      flow: intent,
      category,
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
    if (error instanceof MailPolicyBlockedError) {
      await logMailDelivery(opts.payload, {
        flow: intent, category, tenant: formatTenantRef(opts.tenant), sender: from,
        replyTo: opts.replyTo, recipient: formatRecipient(opts.to), status: error.status,
        provider: "policy", providerErrorMessage: error.message, retryState: "none",
        failedAt: now().toISOString(),
      })
      throw error
    }
    const normalized = error instanceof MailSendError
      ? error.normalized
      : normalizeProviderError(error, providerName)
    const timestamp = now().toISOString()
    await logMailDelivery(opts.payload, {
      flow: intent,
      category,
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

async function enforceMailPolicy(opts: SendEmailOptions, category: MailCategory, _from: string, _now: () => Date) {
  const needsPreference = category === "marketing" || category === "product_notification"
  if (needsPreference) {
    if (Array.isArray(opts.to)) {
      throw new MailPolicyBlockedError("preference_blocked", "Optional email must be sent to one recipient at a time")
    }
    const recipient = normalizePolicyEmail(opts.to)
    const preferenceSubject = normalizePolicyEmail(opts.preferenceSubject ?? opts.to)
    if (!recipient || recipient !== preferenceSubject) {
      throw new MailPolicyBlockedError("preference_blocked", "Optional email preference must match the recipient")
    }
  }
  if (category === "marketing") {
    const unsubscribeUrl = opts.listUnsubscribe?.unsubscribeUrl
    const preferencesUrl = opts.listUnsubscribe?.preferencesUrl
    if (!unsubscribeUrl || !preferencesUrl || !opts.text || !opts.html.includes(unsubscribeUrl) ||
      !opts.html.includes(preferencesUrl) || !opts.text.includes(unsubscribeUrl) || !opts.text.includes(preferencesUrl)) {
      throw new MailPolicyBlockedError("preference_blocked", "Marketing email requires visible HTML and text unsubscribe and preference links")
    }
  }
  if (category === "tenant_operational" && opts.tenantSubscriptionCategory) {
    if (Array.isArray(opts.to) || !opts.payload?.find || formatTenantRef(opts.tenant) == null) {
      throw new MailPolicyBlockedError("missing_subscription", "Tenant operational email requires one subscribed recipient")
    }
    const recipient = normalizePolicyEmail(opts.to)
    const payload = opts.payload as unknown as Payload
    const subscriptions = await payload.find({
      collection: "tenant-notification-subscriptions" as any,
      where: { and: [
        { tenant: { equals: formatTenantRef(opts.tenant) } },
        { email: { equals: recipient } },
        { [opts.tenantSubscriptionCategory]: { equals: true } },
      ] },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    } as any)
    const subscription = subscriptions.docs[0] as any
    const memberEmail = normalizePolicyEmail(subscription?.user?.email)
    const memberTenant = subscription?.user?.tenants?.[0]?.tenant
    const memberTenantId = memberTenant && typeof memberTenant === "object" ? memberTenant.id : memberTenant
    if (!subscription || memberEmail !== recipient || String(memberTenantId) !== String(formatTenantRef(opts.tenant))) {
      throw new MailPolicyBlockedError("missing_subscription", "Recipient has no active tenant notification subscription")
    }
  }
  if (!needsPreference && !opts.preferenceSubject) return
  if (!opts.preferenceSubject || !opts.payload || typeof opts.payload.find !== "function") {
    if (needsPreference) throw new MailPolicyBlockedError("preference_blocked", "Optional email requires an effective recipient preference")
    return
  }
  const preference = await findCommunicationPreference(opts.payload as unknown as Payload, opts.preferenceSubject)
  if (preference?.suppressed === true) {
    throw new MailPolicyBlockedError("suppressed", "Recipient is suppressed")
  }
  if (category === "marketing" && (preference?.marketing !== true || preference.marketingConsentVersion !== legalStatements.marketingOptIn.version)) {
    throw new MailPolicyBlockedError("preference_blocked", "Recipient has no current marketing email consent")
  }
  if (category === "product_notification" && preference?.productNotifications !== true) {
    throw new MailPolicyBlockedError("preference_blocked", "Recipient has disabled product notifications")
  }
}

export function buildMailHeaders(listUnsubscribe: MailListUnsubscribe | undefined) {
  if (!listUnsubscribe) return undefined
  const unsubscribeUrl = requireHttpsUrl(listUnsubscribe.oneClickUrl ?? listUnsubscribe.unsubscribeUrl, "oneClickUrl")
  const preferencesUrl = listUnsubscribe.preferencesUrl
    ? requireHttpsUrl(listUnsubscribe.preferencesUrl, "preferencesUrl")
    : undefined
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    ...(preferencesUrl ? { "X-SIAB-Email-Preferences": preferencesUrl } : {}),
  }
}

function requireHttpsUrl(value: string, label: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new Error(`${label} must be a valid HTTPS URL`) }
  if (url.protocol !== "https:") throw new Error(`${label} must be a valid HTTPS URL`)
  return url.toString()
}

export function inferMailCategory(intent: MailIntent): MailCategory {
  if (intent === "marketing.campaign") return "marketing"
  if (intent === "product.notification") return "product_notification"
  if (intent.startsWith("auth.")) return "security"
  if (intent.startsWith("legal.")) return "legal"
  if (intent === "forms.tenant_notification" || intent === "intake.internal_notification" || intent === "platform.operational") return "tenant_operational"
  return "transactional"
}

function normalizePolicyEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ""
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
  const id = tenant && typeof tenant === "object" ? tenant.id : tenant
  if (typeof id === "string") {
    const numeric = Number(id)
    return Number.isSafeInteger(numeric) && String(numeric) === id ? numeric : id
  }
  return id
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
