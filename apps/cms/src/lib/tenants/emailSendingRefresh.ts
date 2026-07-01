import "server-only"
import type { Payload } from "payload"
import type { Tenant } from "@/payload-types"
import { getCloudflareEmailSendingSubdomain } from "@/lib/domains/cloudflare"
import { buildTenantEmailSendingFromCloudflareSubdomain, type TenantEmailSendingState } from "@/lib/tenants/emailSending"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const sanitizeProviderError = (error: unknown): string => redactOperationalMessage(error)

const canRefreshCloudflareSubdomain = (emailSending: Tenant["emailSending"]): emailSending is TenantEmailSendingState & {
  cloudflareZoneId: string
  cloudflareSubdomainId: string
} => {
  return Boolean(
    emailSending
    && emailSending.provider === "cloudflare"
    && emailSending.mode === "subdomain"
    && cleanText(emailSending.cloudflareZoneId)
    && cleanText(emailSending.cloudflareSubdomainId),
  )
}

export async function refreshTenantEmailSendingFromCloudflare(
  payload: Payload,
  tenant: Tenant,
): Promise<Tenant> {
  if (!canRefreshCloudflareSubdomain(tenant.emailSending)) return tenant

  const zoneId = cleanText(tenant.emailSending.cloudflareZoneId)!
  const subdomainId = cleanText(tenant.emailSending.cloudflareSubdomainId)!
  try {
    const subdomain = await getCloudflareEmailSendingSubdomain(zoneId, subdomainId)
    const emailSending = buildTenantEmailSendingFromCloudflareSubdomain(
      tenant.domain,
      zoneId,
      subdomain,
      { lastError: null },
    )
    return await payload.update({
      collection: "tenants",
      id: tenant.id as any,
      data: { emailSending } as any,
      depth: 0,
      overrideAccess: true,
    }) as Tenant
  } catch (error) {
    const emailSending: TenantEmailSendingState = {
      ...tenant.emailSending,
      status: "failed",
      verifiedAt: null,
      lastCheckedAt: new Date().toISOString(),
      lastError: sanitizeProviderError(error),
    }
    return await payload.update({
      collection: "tenants",
      id: tenant.id as any,
      data: { emailSending } as any,
      depth: 0,
      overrideAccess: true,
    }) as Tenant
  }
}
