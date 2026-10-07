import { createTransport } from "nodemailer"
import addressparser from "nodemailer/lib/addressparser"
import type { SendMailOptions, Transporter } from "nodemailer"
import type { Payload, Where } from "payload"
import type { MailLog } from "@/payload-types"
import { z } from "zod"
import { requestProviderJson } from "@/lib/providers/http"
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
  "appointments.visitor_notification",
  "appointments.tenant_notification",
  "site.live_notice",
  "legal.reacceptance",
  "commerce.billing",
  "commerce.domain",
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
  /** Optional appointment context so its metadata log follows appointment retention. */
  appointment?: MailTenantRef
  from?: string
  replyTo?: string
  category?: MailCategory
  tenantSubscriptionCategory?: "formSubmissions" | "publishingAndSiteStatus" | "domainAndDns" | "billingAndPayments" | "teamAndAccess" | "operationalDigest" | "appointmentBookings"
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
  signal?: AbortSignal
}

export type MailProviderSuccess = {
  provider: string
  providerMessageId?: string
}

export type MailProviderError = {
  provider: string
  providerMessageId?: string
  providerErrorCode?: string
  providerErrorMessage: string
  retryState: MailRetryState
}

export type MailTransportProvider = {
  provider: string
  send(input: MailProviderSendInput): Promise<MailProviderSuccess>
}

export type MailLogPayload = Pick<Payload, "create"> & Partial<Pick<Payload, "find" | "update" | "logger">>

export function asMailLogPayload(
  payload: Pick<Payload, "create"> & Partial<Pick<Payload, "find" | "update" | "logger">>,
): MailLogPayload {
  return payload
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
  const token = env.CLOUDFLARE_EMAIL_API_TOKEN?.trim()
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
      try {
        const response = await requestProviderJson(`${CLOUDFLARE_API_BASE}/accounts/${config.accountId}/email/sending/send`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: input.from, to: input.to, subject: input.subject, html: input.html,
            ...(input.text ? { text: input.text } : {}),
            ...(input.replyTo ? { reply_to: input.replyTo } : {}),
            ...(input.headers ? { headers: input.headers } : {}),
          }),
        }, { operation: "Cloudflare mail send", timeoutMs: getMailSendTimeoutMs(), maxBodyBytes: 65_536, signal: input.signal })
        const parsed = cloudflareReceiptSchema.safeParse(response.body)
        if (!response.ok) {
          // Only a documented rejection is safe to retry: a lost/ambiguous receipt
          // cannot establish that the provider did not accept this message.
          if (!parsed.success || parsed.data.success !== false || response.status === 408 || response.status >= 500) {
            throw indeterminateMailWrite()
          }
          throw cloudflareRestError(response.status, parsed.data)
        }
        if (!parsed.success || parsed.data.success !== true) throw indeterminateMailWrite()
        const disposition = validateCloudflareRestDisposition(input.to, parsed.data)
        return { provider: "cloudflare-rest", ...(disposition.messageId ? { providerMessageId: disposition.messageId } : {}) }
      } catch (error) {
        if (error instanceof Error && "code" in error) throw error
        throw indeterminateMailWrite()
      }
    },
  }
}

export function createNodemailerProvider(transport: Pick<Transporter<unknown>, "sendMail"> & Partial<Pick<Transporter<unknown>, "close">>): MailTransportProvider {
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

      const cancel = () => transport.close?.()
      input.signal?.throwIfAborted()
      input.signal?.addEventListener("abort", cancel, { once: true })
      try {
        const info: unknown = await transport.sendMail(message)
        return normalizeProviderResponse(info, input.to)
      } catch (error) {
        if (input.signal?.aborted) throw indeterminateMailWrite()
        if (error instanceof Error && "code" in error && ["ETIMEDOUT", "ECONNRESET", "EPROTOCOL"].includes(String(error.code))) throw indeterminateMailWrite()
        throw error
      } finally {
        input.signal?.removeEventListener("abort", cancel)
      }
    },
  }
}

const recipientArray = z.array(z.string().trim().min(1).max(512)).max(1000)
const cloudflareReceiptSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({ code: z.number().int().optional() })).max(100).optional(),
  result: z.object({
    message_id: z.string().trim().min(1).max(998).optional(),
    delivered: recipientArray.optional(), queued: recipientArray.optional(), permanent_bounces: recipientArray.optional(),
  }).optional(),
})
type CloudflareRestResponse = z.infer<typeof cloudflareReceiptSchema>

function indeterminateMailWrite() {
  return cloudflareDispositionError("E_PROVIDER_WRITE_INDETERMINATE", "Mail provider acceptance is unknown; reconcile before resending")
}

function cloudflareRestError(status: number, body: CloudflareRestResponse | null) {
  const firstError = body?.errors?.[0]
  const message = `Cloudflare Email REST API rejected the request with HTTP ${status}`
  return Object.assign(new Error(message), {
    code: firstError?.code != null ? String(firstError.code) : String(status),
    responseCode: status,
    response: message,
  })
}

function validateCloudflareRestDisposition(
  recipients: string | string[],
  body: CloudflareRestResponse,
) {
  const result = body.result
  const messageId = result?.message_id?.trim() || undefined
  const hasDispositionArrays = Array.isArray(result?.delivered)
    && Array.isArray(result.queued)
    && Array.isArray(result.permanent_bounces)
  const delivered = normalizeEmailSet(result?.delivered)
  const queued = normalizeEmailSet(result?.queued)
  const permanentBounces = normalizeEmailSet(result?.permanent_bounces)
  const requested = normalizeEmailSet(Array.isArray(recipients) ? recipients : [recipients])
  const accepted = new Set([...delivered, ...queued])
  const bouncedRequested = [...requested].filter((recipient) => permanentBounces.has(recipient))
  const accounted = [...requested].every(
    (recipient) => accepted.has(recipient) || permanentBounces.has(recipient),
  )

  if (requested.size === 0 || !result || (!messageId && !hasDispositionArrays)) {
    throw cloudflareDispositionError(
      "E_PROVIDER_WRITE_INDETERMINATE",
      "Cloudflare Email REST API returned incomplete delivery evidence",
    )
  }
  if (bouncedRequested.length > 0 && [...requested].some((recipient) => accepted.has(recipient))) throw indeterminateMailWrite()
  if (bouncedRequested.length > 0) {
    throw cloudflareDispositionError(
      "E_CLOUDFLARE_PERMANENT_BOUNCE",
      "Cloudflare Email REST API reported a permanent recipient bounce",
      400,
      messageId,
    )
  }
  // Cloudflare often accepts the message asynchronously: success + message_id
  // with empty delivered/queued/permanent_bounces. Treat message acceptance as
  // success unless a requested recipient permanently bounced.
  if (messageId) return { messageId }
  if (hasDispositionArrays && accounted && accepted.size === requested.size) {
    return { messageId: undefined }
  }
  throw cloudflareDispositionError(
    "E_PROVIDER_WRITE_INDETERMINATE",
    "Cloudflare Email REST API did not account for every requested recipient",
    undefined,
    messageId,
  )
}

function normalizeEmailAddress(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ""
  const angle = trimmed.match(/<([^<>@\s]+@[^<>@\s]+)>/)
  if (angle?.[1]) return angle[1]
  return trimmed
}

function normalizeEmailSet(values: string[] | undefined) {
  return new Set(
    (values ?? [])
      .map((value) => normalizeEmailAddress(value))
      .filter(Boolean),
  )
}

function cloudflareDispositionError(
  code: string,
  message: string,
  responseCode?: number,
  providerMessageId?: string,
) {
  return Object.assign(new Error(message), {
    code,
    ...(responseCode ? { responseCode } : {}),
    ...(providerMessageId ? { providerMessageId } : {}),
    response: message,
  })
}

const smtpReceiptSchema = z.object({
  messageId: z.string().trim().min(1).max(998),
  accepted: recipientArray,
  rejected: recipientArray,
})

export function normalizeProviderResponse(info: unknown, recipients: string | string[]): MailProviderSuccess {
  const parsed = smtpReceiptSchema.safeParse(info)
  if (!parsed.success) throw indeterminateMailWrite()
  const requested = normalizeEmailSet((Array.isArray(recipients) ? recipients : [recipients])
    .flatMap((value) => addressparser(value, { flatten: true }).map((address) => address.address)))
  const accepted = normalizeEmailSet(parsed.data.accepted)
  const rejected = normalizeEmailSet(parsed.data.rejected)
  if (requested.size === 0 || [...requested].some((recipient) => !accepted.has(recipient) || rejected.has(recipient))) {
    if (accepted.size === 0 && [...requested].every((recipient) => rejected.has(recipient))) {
      throw cloudflareDispositionError("E_SMTP_RECIPIENT_REJECTED", "SMTP rejected every requested recipient", 550, parsed.data.messageId)
    }
    throw indeterminateMailWrite()
  }
  return { provider: "cloudflare-smtp", providerMessageId: parsed.data.messageId }
}

export function normalizeProviderError(error: unknown, provider = "cloudflare-smtp"): MailProviderError {
  const err = error && typeof error === "object"
    ? error as {
        code?: unknown
        command?: unknown
        response?: unknown
        responseCode?: unknown
        message?: unknown
        providerMessageId?: unknown
      }
    : {}
  const responseCode = typeof err.responseCode === "number" ? err.responseCode : undefined
  const rawCode = typeof err.code === "string" ? err.code : undefined
  const response = typeof err.response === "string" ? err.response : undefined
  const message = typeof err.message === "string" && err.message.trim()
    ? err.message
    : "Unknown provider error"
  const providerErrorCode = rawCode || (responseCode ? String(responseCode) : undefined)
  const providerMessageId = typeof err.providerMessageId === "string"
    ? err.providerMessageId
    : undefined
  const providerErrorMessage = trimProviderErrorMessage(redactOperationalMessage(response || message))

  return {
    provider,
    ...(providerMessageId ? { providerMessageId } : {}),
    ...(providerErrorCode ? { providerErrorCode } : {}),
    providerErrorMessage,
    retryState: classifyRetryState({ provider, responseCode, code: rawCode, message: providerErrorMessage }),
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
    const controller = new AbortController()
    const result = await withTimeout(provider.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
      headers: buildMailHeaders(opts.listUnsubscribe),
      signal: controller.signal,
    }), sendTimeoutMs, controller)
    const timestamp = now().toISOString()
    await logMailDelivery(opts.payload, {
      flow: intent,
      category,
      tenant: formatTenantRef(opts.tenant),
      appointment: formatTenantRef(opts.appointment),
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
        flow: intent, category, tenant: formatTenantRef(opts.tenant), appointment: formatTenantRef(opts.appointment), sender: from,
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
      appointment: formatTenantRef(opts.appointment),
      sender: from,
      replyTo: opts.replyTo,
      recipient: formatRecipient(opts.to),
      status: "failed",
      provider: normalized.provider,
      providerMessageId: normalized.providerMessageId,
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
    const find = opts.payload.find.bind(opts.payload)
    const subscriptions = await find({
      collection: "tenant-notification-subscriptions",
      where: { and: [
        { tenant: { equals: formatTenantRef(opts.tenant) } },
        { email: { equals: recipient } },
        { [opts.tenantSubscriptionCategory]: { equals: true } },
      ] },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const subscription = subscriptions.docs[0]
    const subscriptionUser = subscription?.user
    const memberEmail = normalizePolicyEmail(
      typeof subscriptionUser === "object" && subscriptionUser ? subscriptionUser.email : undefined,
    )
    const memberTenant = typeof subscriptionUser === "object" && subscriptionUser
      ? subscriptionUser.tenants?.[0]?.tenant
      : undefined
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
  const preference = await findCommunicationPreference({ find: opts.payload.find.bind(opts.payload) }, opts.preferenceSubject)
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
  if (intent === "forms.tenant_notification" || intent === "appointments.tenant_notification" || intent === "intake.internal_notification" || intent === "platform.operational") return "tenant_operational"
  return "transactional"
}

function normalizePolicyEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, controller: AbortController): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      const error = indeterminateMailWrite()
      controller.abort(error)
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
      data: compactLogData(data) as Omit<MailLog, "id" | "updatedAt" | "createdAt">,
    })
  } catch (error) {
    payload.logger?.warn?.({ error: redactOperationalMessage(error) }, "Failed to write outbound mail metadata log")
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
  provider,
  responseCode,
  code,
  message,
}: {
  provider: string
  responseCode?: number
  code?: string
  message: string
}): MailRetryState {
  if (code === "E_PROVIDER_WRITE_INDETERMINATE") return "permanent"
  if (message.includes("E_SENDER_NOT_VERIFIED") || message.includes("E_SENDER_DOMAIN_NOT_AVAILABLE")) {
    return "permanent"
  }
  if (responseCode) {
    // Cloudflare REST exposes HTTP status codes, where server errors are
    // transient and most client errors require configuration/input changes.
    // SMTP uses the opposite first-digit convention: 4xx is transient and
    // 5xx is a permanent rejection. Keep the two protocols explicit here so
    // legal-notification retries do not stop on a temporary REST outage or
    // repeatedly retry a rejected REST request.
    if (provider === "cloudflare-rest") {
      if (responseCode === 408 || responseCode === 429) return "retryable"
      if (responseCode >= 500) return "retryable"
      if (responseCode >= 400) return "permanent"
    }
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
