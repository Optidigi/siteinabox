import type { Tenant } from "@/payload-types"
import type { CloudflareEmailSendingSubdomainResult } from "@/lib/domains/cloudflare"

export const tenantEmailSendingStatuses = [
  "not_configured",
  "pending",
  "verified",
  "failed",
] as const

export type TenantEmailSendingStatus = (typeof tenantEmailSendingStatuses)[number]

export type TenantEmailSendingState = NonNullable<Tenant["emailSending"]>

export type VerifiedTenantSender = {
  provider: "cloudflare"
  senderEmail: string
  sendingDomain: string
  mode: "subdomain" | "apex"
}

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const PLATFORM_FALLBACK_SENDER = "noreply@siteinabox.nl"

export const buildDefaultTenantEmailSending = (domain: string | null | undefined): TenantEmailSendingState => {
  const normalizedDomain = typeof domain === "string" ? domain.trim().toLowerCase() : ""
  const sendingDomain = normalizedDomain ? `mail.${normalizedDomain}` : undefined
  return {
    provider: "cloudflare",
    mode: "subdomain",
    status: "not_configured",
    sendingDomain,
    senderEmail: sendingDomain ? `noreply@${sendingDomain}` : undefined,
  }
}

export const buildTenantEmailSendingFromCloudflareSubdomain = (
  domain: string,
  zoneId: string,
  subdomain: CloudflareEmailSendingSubdomainResult,
  input?: { now?: string; lastError?: string | null },
): TenantEmailSendingState => {
  const now = input?.now ?? new Date().toISOString()
  const sendingDomain = subdomain.name.toLowerCase()
  const status: TenantEmailSendingStatus = subdomain.enabled ? "verified" : "pending"
  return {
    provider: "cloudflare",
    mode: "subdomain",
    status,
    sendingDomain,
    senderEmail: `noreply@${sendingDomain}`,
    verifiedAt: status === "verified" ? now : null,
    lastCheckedAt: now,
    lastError: input?.lastError ?? null,
    cloudflareZoneId: zoneId,
    cloudflareSubdomainId: subdomain.id,
    returnPathDomain: subdomain.returnPathDomain,
    dkimSelector: subdomain.dkimSelector,
    testMessageId: null,
  }
}

export const buildFailedTenantEmailSending = (
  domain: string,
  zoneId: string,
  message: string,
  input?: { now?: string },
): TenantEmailSendingState => {
  const now = input?.now ?? new Date().toISOString()
  const fallback = buildDefaultTenantEmailSending(domain)
  return {
    ...fallback,
    status: "failed",
    verifiedAt: null,
    lastCheckedAt: now,
    lastError: message,
    cloudflareZoneId: zoneId,
  }
}

export const hasVerifiedTenantSender = (
  tenant: Pick<Tenant, "emailSending"> | null | undefined,
): boolean => resolveVerifiedTenantSender(tenant) !== null

export const resolveVerifiedTenantSender = (
  tenant: Pick<Tenant, "emailSending"> | null | undefined,
): VerifiedTenantSender | null => {
  const emailSending = tenant?.emailSending
  if (!emailSending || emailSending.provider !== "cloudflare" || emailSending.status !== "verified") return null
  const senderEmail = cleanText(emailSending.senderEmail)?.toLowerCase()
  const sendingDomain = cleanText(emailSending.sendingDomain)?.toLowerCase()
  const mode = emailSending.mode === "apex" ? "apex" : emailSending.mode === "subdomain" ? "subdomain" : null
  if (!senderEmail || !sendingDomain || !mode) return null
  if (senderEmail === PLATFORM_FALLBACK_SENDER) return null
  if (!senderEmail.endsWith(`@${sendingDomain}`)) return null
  return {
    provider: "cloudflare",
    mode,
    senderEmail,
    sendingDomain,
  }
}
