import { createTransport } from "nodemailer"
import type { SendMailOptions, Transporter } from "nodemailer"
import { z } from "zod"
import { getCloudflareEmailSmtpToken, getCloudflareEmailRestConfig, getPlatformMailSender, getMailSendTimeoutMs, inspectMailConfiguration, mailboxes } from "./configuration"
export { getCloudflareEmailSmtpToken, getCloudflareEmailRestConfig, getPlatformMailSender, getMailSendTimeoutMs, inspectMailConfiguration } from "./configuration"
import type { Payload, Where } from "payload"
import type { MailLog } from "@/payload-types"
import { recordMailFailureAlert } from "@/lib/email/alerts"
import { findCommunicationPreference } from "@/lib/legal/communicationPreferences"
import { legalStatements } from "@/lib/legal/statements"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"

const CLOUDFLARE_SMTP_HOST = "smtp.mx.cloudflare.net"
const CLOUDFLARE_SMTP_PORT = 465
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
const MAIL_LOG_ERROR_MESSAGE_LIMIT = 1000

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

export const mailStatuses = ["sent", "failed", "indeterminate", "suppressed", "preference_blocked", "missing_subscription"] as const
export type MailStatus = (typeof mailStatuses)[number]

export const mailRetryStates = ["none", "retryable", "permanent", "manual_review"] as const
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

  constructor(normalized: MailProviderError) {
    super(`Email send failed: ${normalized.providerErrorMessage}`)
    this.name = "MailSendError"
    this.normalized = normalized
    // Raw provider causes can contain credentials or message content. Retain
    // only the normalized, redacted diagnostic across SDK/caller boundaries.
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
        const parsed = cloudflareReceiptSchema.safeParse(await response.json().catch(() => null))
        if (!parsed.success) throw indeterminateMailWrite()
        const body = parsed.data
        if (!response.ok || body.success !== true) {
          if (body.success !== false || body.result?.message_id || response.status === 408 || response.status >= 500) throw indeterminateMailWrite(body.result?.message_id)
          throw cloudflareRestError(response.status, body)
        }
        const disposition = validateCloudflareRestDisposition(input.to, body)
        return {
          provider: "cloudflare-rest",
          ...(disposition.messageId ? { providerMessageId: disposition.messageId } : {}),
        }
      } catch (error) {
        const detail = error as { mailRejected?: unknown; code?: unknown }
        if (detail?.mailRejected === true || detail?.code === "E_CLOUDFLARE_PERMANENT_BOUNCE" || detail?.code === "E_PROVIDER_WRITE_INDETERMINATE") throw error
        throw indeterminateMailWrite()
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

      try {
        const info = await transport.sendMail(message)
        return normalizeProviderResponse(info, input.to)
      } catch (error) {
        const detail = error as { code?: unknown; responseCode?: unknown; command?: unknown }
        if (detail?.code === "E_SMTP_RECIPIENT_REJECTED" || detail?.code === "E_PROVIDER_WRITE_INDETERMINATE" ||
            detail?.code === "EAUTH" || detail?.code === "EENVELOPE" || detail?.code === "ECONNREFUSED" ||
            detail?.command === "CONN" || detail?.command === "AUTH" || typeof detail?.responseCode === "number") throw error
        throw indeterminateMailWrite()
      }
    },
  }
}

const cloudflareReceiptSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({ code: z.number().optional() })).optional(),
  result: z.object({
    delivered: z.array(z.string()).optional(), queued: z.array(z.string()).optional(),
    permanent_bounces: z.array(z.string()).optional(), message_id: z.string().trim().min(1).max(512).optional(),
    suppressed_recipients: z.array(z.string()).optional(),
  }).nullable().optional(),
})
type CloudflareRestResponse = z.infer<typeof cloudflareReceiptSchema>

function indeterminateMailWrite(reference?: unknown) {
  const providerMessageId = safeProviderMessageId(reference)
  return Object.assign(new Error("Mail acceptance is indeterminate; reconcile provider evidence before retrying"), { code: "E_PROVIDER_WRITE_INDETERMINATE", ...(providerMessageId ? { providerMessageId } : {}) })
}

function cloudflareRestError(status: number, body: CloudflareRestResponse | null) {
  const firstError = body?.errors?.[0]
  const message = `Cloudflare Email REST API rejected the request with HTTP ${status}; check mail configuration and provider code`
  return Object.assign(new Error(message), {
    mailRejected: true,
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
  const messageId = safeProviderMessageId(result?.message_id)
  const hasDispositionArrays = Array.isArray(result?.delivered)
    && Array.isArray(result.queued)
    && Array.isArray(result.permanent_bounces)
  const delivered = normalizeEmailSet(result?.delivered)
  const queued = normalizeEmailSet(result?.queued)
  const permanentBounces = normalizeEmailSet(result?.permanent_bounces)
  const suppressed = normalizeEmailSet(result?.suppressed_recipients)
  const requested = normalizeEmailSet(Array.isArray(recipients) ? recipients : [recipients])
  const accepted = new Set([...delivered, ...queued])
  const bouncedRequested = [...requested].filter((recipient) => permanentBounces.has(recipient))
  const suppressedRequested = [...requested].filter((recipient) => suppressed.has(recipient))
  const accounted = [...requested].every(
    (recipient) => accepted.has(recipient) || permanentBounces.has(recipient),
  )

  if (requested.size === 0 || !result || (!messageId && !hasDispositionArrays)) {
    throw cloudflareDispositionError(
      "E_PROVIDER_WRITE_INDETERMINATE",
      "Cloudflare Email REST API returned incomplete delivery evidence",
    )
  }
  if (suppressedRequested.length > 0) {
    if ([...requested].some((recipient) => accepted.has(recipient))) throw indeterminateMailWrite(messageId)
    throw cloudflareDispositionError("E_CLOUDFLARE_SUPPRESSED", "Cloudflare suppressed the requested recipients; inspect provider suppression evidence before retrying", undefined, messageId)
  }
  if (bouncedRequested.length > 0) {
    if ([...requested].some((recipient) => accepted.has(recipient))) throw indeterminateMailWrite(messageId)
    throw cloudflareDispositionError(
      "E_CLOUDFLARE_PERMANENT_BOUNCE",
      "Cloudflare Email REST API reported a permanent recipient bounce",
      undefined,
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
    mailRejected: code !== "E_PROVIDER_WRITE_INDETERMINATE",
    ...(responseCode ? { responseCode } : {}),
    ...(providerMessageId ? { providerMessageId } : {}),
    response: message,
  })
}

const smtpReceiptSchema = z.object({
  messageId: z.string().max(512).optional(),
  accepted: z.array(z.union([z.string(), z.object({ address: z.string() })])),
  rejected: z.array(z.union([z.string(), z.object({ address: z.string() })])),
})

export function normalizeProviderResponse(info: unknown, recipients: string | string[]): MailProviderSuccess {
  const parsed = smtpReceiptSchema.safeParse(info)
  if (!parsed.success) throw indeterminateMailWrite()
  const addresses = (values: (string | { address: string })[]) => {
    try { return new Set(values.flatMap((value) => mailboxes(typeof value === "string" ? value : value.address))) }
    catch { throw indeterminateMailWrite() }
  }
  const requested = mailboxes(recipients)
  const accepted = addresses(parsed.data.accepted)
  const rejected = addresses(parsed.data.rejected)
  if (requested.every((address) => rejected.has(address)) && !requested.some((address) => accepted.has(address))) {
    throw Object.assign(new Error("SMTP rejected the requested recipients; inspect the provider rejection before retrying"), { code: "E_SMTP_RECIPIENT_REJECTED" })
  }
  if (!requested.every((address) => accepted.has(address) && !rejected.has(address))) throw indeterminateMailWrite(parsed.data.messageId)
  const messageId = safeProviderMessageId(parsed.data.messageId)
  return { provider: "cloudflare-smtp", ...(messageId ? { providerMessageId: messageId } : {}) }
}

function safeProviderMessageId(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 512 || /[\r\n\0]/.test(value)) return undefined
  if ([process.env.CLOUDFLARE_EMAIL_API_TOKEN, process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN].some((secret) => secret?.trim() && value.includes(secret.trim()))) return undefined
  return value.trim()
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
  const providerErrorCode = rawCode && /^[A-Za-z0-9_-]{1,64}$/.test(rawCode) && ![process.env.CLOUDFLARE_EMAIL_API_TOKEN, process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN].some((secret) => secret?.trim() && rawCode.includes(secret.trim())) ? rawCode : responseCode ? String(responseCode) : undefined
  const providerMessageId = safeProviderMessageId(err.providerMessageId)
  let redacted = response || message
  for (const secret of [process.env.CLOUDFLARE_EMAIL_API_TOKEN, process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN]) {
    if (secret?.trim()) redacted = redacted.replaceAll(secret.trim(), "[redacted]")
  }
  const providerErrorMessage = trimProviderErrorMessage(redactOperationalMessage(redacted))

  return {
    provider,
    ...(providerMessageId ? { providerMessageId } : {}),
    ...(providerErrorCode ? { providerErrorCode } : {}),
    providerErrorMessage,
    retryState: classifyRetryState({ provider, responseCode, code: rawCode, command: typeof err.command === "string" ? err.command : undefined, message: providerErrorMessage }),
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
    if (!deps.provider) {
      const readiness = inspectMailConfiguration({ ...process.env, EMAIL_FROM: from })
      if (readiness.status !== "configured") throw Object.assign(new Error(`Mail configuration is not ready: ${readiness.issues.join(", ")}; correct the named settings before sending`), { code: "E_MAIL_CONFIGURATION_INVALID" })
    }
    try {
      if (mailboxes(from).length !== 1 || (opts.replyTo && mailboxes(opts.replyTo).length !== 1)) throw new Error("Invalid sender or reply-to")
      mailboxes(opts.to)
    } catch { throw Object.assign(new Error("Mail sender, recipient or reply-to is invalid; check address configuration"), { code: "E_MAIL_CONFIGURATION_INVALID" }) }
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
      appointment: formatTenantRef(opts.appointment),
      sender: formatRecipient(from),
      replyTo: opts.replyTo ? formatRecipient(opts.replyTo) : undefined,
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
        flow: intent, category, tenant: formatTenantRef(opts.tenant), appointment: formatTenantRef(opts.appointment), sender: formatRecipient(from),
        replyTo: opts.replyTo ? formatRecipient(opts.replyTo) : undefined, recipient: formatRecipient(opts.to), status: error.status,
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
      sender: formatRecipient(from),
      replyTo: opts.replyTo ? formatRecipient(opts.replyTo) : undefined,
      recipient: formatRecipient(opts.to),
      status: normalized.retryState === "manual_review" ? "indeterminate" : "failed",
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
      sender: formatRecipient(from),
      recipient: formatRecipient(opts.to),
      provider: normalized.provider,
      providerErrorCode: normalized.providerErrorCode,
      providerErrorMessage: normalized.providerErrorMessage,
      retryState: normalized.retryState,
      failedAt: timestamp,
    })
    throw error instanceof MailSendError ? error : new MailSendError(normalized)
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
  const invalid = () => Object.assign(new Error(`${label} must be a valid HTTPS URL without credentials or control characters`), { code: "E_MAIL_CONFIGURATION_INVALID" })
  try { url = new URL(value) } catch { throw invalid() }
  if (url.protocol !== "https:" || url.username || url.password || /[\r\n\0]/.test(value)) throw invalid()
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, provider: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      const error = Object.assign(
        new Error(`${provider} send timed out after ${timeoutMs}ms`),
        { code: "E_PROVIDER_WRITE_INDETERMINATE" },
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
  try { return mailboxes(to).join(", ") } catch { return "[invalid-address]" }
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
  command,
  message,
}: {
  provider: string
  responseCode?: number
  code?: string
  command?: string
  message: string
}): MailRetryState {
  if (code === "E_PROVIDER_WRITE_INDETERMINATE") return "manual_review"
  if (code && ["E_MAIL_CONFIGURATION_INVALID", "E_SMTP_RECIPIENT_REJECTED", "E_CLOUDFLARE_PERMANENT_BOUNCE", "E_CLOUDFLARE_SUPPRESSED"].includes(code)) return "permanent"
  if (message.includes("E_SENDER_NOT_VERIFIED") || message.includes("E_SENDER_DOMAIN_NOT_AVAILABLE")) {
    return "permanent"
  }
  if (responseCode) {
    // A REST server error/timeout can follow acceptance; do not infer an
    // unsent message from a transient HTTP failure. Explicit rate limiting is
    // retryable, while other client errors require configuration/input changes.
    // SMTP uses the opposite first-digit convention: 4xx is transient and
    // 5xx is a permanent rejection. Keep the two protocols explicit here so
    // legal-notification retries do not stop on a temporary REST outage or
    // repeatedly retry a rejected REST request.
    if (provider === "cloudflare-rest") {
      if (responseCode === 429) return "retryable"
      if (responseCode === 408 || responseCode >= 500) return "manual_review"
      if (responseCode >= 400) return "permanent"
    }
    if (responseCode >= 500) return "permanent"
    if (responseCode >= 400) return "retryable"
  }
  if (code && ["ECONNREFUSED", "EAI_AGAIN"].includes(code)) {
    return "retryable"
  }
  if (code && ["ETIMEDOUT", "ECONNRESET"].includes(code)) return command === "CONN" || command === "AUTH" ? "retryable" : "manual_review"
  if (code && ["EAUTH", "EENVELOPE"].includes(code)) {
    return "permanent"
  }
  return "manual_review"
}
