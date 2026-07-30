import "server-only"
import type { Payload } from "payload"
import type { Tenant } from "@/payload-types"
import {
  createOrReuseCloudflareEmailSendingSubdomain,
  getCloudflareEmailSendingSubdomain,
} from "@/lib/domains/cloudflare"
import { buildTenantEmailSendingFromCloudflareSubdomain, type TenantEmailSendingState } from "@/lib/tenants/emailSending"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"
import {
  recordCommerceAdminException,
  resolveCommerceAdminException,
} from "@/lib/commerce/alerts"

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
      id: tenant.id,
      data: { emailSending },
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
      id: tenant.id,
      data: { emailSending },
      depth: 0,
      overrideAccess: true,
    }) as Tenant
  }
}

export async function reconcileTenantEmailSending(
  payload: Payload,
  input: {
    createOrReuse?: typeof createOrReuseCloudflareEmailSendingSubdomain
    now?: Date
  } = {},
): Promise<{ examined: number; verified: number; pending: number; failed: number }> {
  const tenants = await payload.find({
    collection: "tenants",
    where: {
      and: [
        { status: { in: ["provisioning", "active"] } },
        { "domainVerification.status": { equals: "verified" } },
        {
          "emailSending.status": {
            in: ["not_configured", "pending", "failed"],
          },
        },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const result = {
    examined: tenants.docs.length,
    verified: 0,
    pending: 0,
    failed: 0,
  }
  const createOrReuse =
    input.createOrReuse ?? createOrReuseCloudflareEmailSendingSubdomain
  const now = input.now ?? new Date()

  for (const candidate of tenants.docs as Tenant[]) {
    const zoneId = cleanText(candidate.emailSending?.cloudflareZoneId)
    const sendingDomain =
      cleanText(candidate.emailSending?.sendingDomain)?.toLowerCase() ??
      `mail.${candidate.domain.trim().toLowerCase()}`
    const alert = {
      payload,
      source: "domains" as const,
      code: "tenant_email_sending_reconciliation",
      subjectId: candidate.id,
      now: now.toISOString(),
    }
    if (!zoneId) {
      result.failed += 1
      await recordCommerceAdminException({
        ...alert,
        tenant: candidate.id,
        severity: "warning",
        message:
          "Optional tenant-branded email cannot be reconciled without a Cloudflare zone reference; platform mail remains active.",
      })
      continue
    }
    try {
      const subdomain = await createOrReuse(zoneId, sendingDomain)
      const emailSending = buildTenantEmailSendingFromCloudflareSubdomain(
        candidate.domain,
        zoneId,
        subdomain,
        { now: now.toISOString(), lastError: null },
      )
      await payload.update({
        collection: "tenants",
        id: candidate.id,
        data: { emailSending },
        depth: 0,
        overrideAccess: true,
      })
      if (emailSending.status === "verified") {
        result.verified += 1
        await resolveCommerceAdminException(alert)
      } else {
        result.pending += 1
        await recordCommerceAdminException({
          ...alert,
          tenant: candidate.id,
          severity: "warning",
          message:
            "Optional tenant-branded email is pending Cloudflare verification; platform mail remains active.",
        })
      }
    } catch (error) {
      result.failed += 1
      const emailSending: TenantEmailSendingState = {
        ...(candidate.emailSending ?? {
          provider: "cloudflare",
          mode: "subdomain",
          sendingDomain,
          senderEmail: `noreply@${sendingDomain}`,
        }),
        status: "failed",
        verifiedAt: null,
        lastCheckedAt: now.toISOString(),
        lastError: sanitizeProviderError(error),
        cloudflareZoneId: zoneId,
      }
      await payload.update({
        collection: "tenants",
        id: candidate.id,
        data: { emailSending },
        depth: 0,
        overrideAccess: true,
      })
      await recordCommerceAdminException({
        ...alert,
        tenant: candidate.id,
        severity: "warning",
        message:
          "Optional tenant-branded email reconciliation failed; platform mail remains active.",
      })
    }
  }

  return result
}
