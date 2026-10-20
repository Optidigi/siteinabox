import addressparser from "nodemailer/lib/addressparser"

type MailEnvironment = Readonly<Record<string, string | undefined>>

const DEFAULT_FROM = "noreply@siteinabox.nl"
const DEFAULT_MAIL_SEND_TIMEOUT_MS = 10_000

export function mailboxes(value: string | string[]): string[] {
  const addresses = (Array.isArray(value) ? value : [value]).flatMap((entry) => {
    if (typeof entry !== "string" || /[\r\n\0]/.test(entry)) throw new Error("Mail address configuration is invalid")
    return addressparser(entry, { flatten: true }).map((item) => item.address.trim().toLowerCase())
  })
  if (!addresses.length || addresses.some((address) => !/^[^\s@<>]+@[^\s@<>]+$/.test(address))) {
    throw new Error("Mail address configuration is invalid")
  }
  return [...new Set(addresses)]
}

const credential = (value: string | undefined) => {
  const trimmed = value?.trim()
  return !trimmed || /[\s<>]/.test(trimmed) ? null : trimmed
}

export function getCloudflareEmailSmtpToken(env: MailEnvironment = process.env) {
  return credential(env.CLOUDFLARE_EMAIL_SMTP_TOKEN)
}

export function getCloudflareEmailRestConfig(env: MailEnvironment = process.env) {
  const accountId = credential(env.CLOUDFLARE_ACCOUNT_ID)
  const token = credential(env.CLOUDFLARE_EMAIL_API_TOKEN)
  return accountId && token ? { accountId, token } : null
}

export function getPlatformMailSender(env: MailEnvironment = process.env) {
  return env.EMAIL_FROM?.trim() || DEFAULT_FROM
}

export function getMailSendTimeoutMs(env: MailEnvironment = process.env) {
  const configured = Number(env.SIAB_MAIL_SEND_TIMEOUT_MS)
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAIL_SEND_TIMEOUT_MS
  return Math.max(1_000, Math.min(configured, 60_000))
}

/** Pure configuration evidence: no transport, DNS, authentication or message. */
export function inspectMailConfiguration(env: MailEnvironment = process.env) {
  const issues: string[] = []
  try { if (mailboxes(getPlatformMailSender(env)).length !== 1) issues.push("EMAIL_FROM_INVALID") }
  catch { issues.push("EMAIL_FROM_INVALID") }
  const rest = getCloudflareEmailRestConfig(env)
  const smtp = getCloudflareEmailSmtpToken(env)
  if (env.CLOUDFLARE_EMAIL_API_TOKEN?.trim() && !rest) issues.push("CLOUDFLARE_EMAIL_API_TOKEN_OR_ACCOUNT_ID_INVALID")
  if (!rest && !smtp) issues.push("MAIL_TRANSPORT_NOT_CONFIGURED")
  if (!rest && env.CLOUDFLARE_EMAIL_SMTP_TOKEN?.trim() && !smtp) issues.push("CLOUDFLARE_EMAIL_SMTP_TOKEN_INVALID")
  if (env.SIAB_MAIL_SEND_TIMEOUT_MS?.trim() && (!Number.isFinite(Number(env.SIAB_MAIL_SEND_TIMEOUT_MS)) || Number(env.SIAB_MAIL_SEND_TIMEOUT_MS) <= 0)) {
    issues.push("SIAB_MAIL_SEND_TIMEOUT_MS_INVALID")
  }
  return {
    status: issues.length ? "not_ready" as const : "configured" as const,
    provider: rest ? "cloudflare-rest" as const : smtp ? "cloudflare-smtp" as const : null,
    issues,
    deliveryVerified: false as const,
  }
}
