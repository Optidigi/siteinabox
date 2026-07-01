import "server-only"
import type { Payload } from "payload"
import type { SiteGenerationRun, Tenant } from "@/payload-types"
import {
  createCloudflareZone,
  createCloudflareZoneDnsRecords,
  createOrReuseCloudflareEmailSendingSubdomain,
} from "@/lib/domains/cloudflare"
import { createDomainOrderState, fixedDomainOrderPriceFromEnv, normalizeDomainOrderState } from "@/lib/domains/orderState"
import { createOpenProviderCustomerHandle, loginOpenProvider, registerOpenProviderDomain } from "@/lib/domains/openprovider"
import { normalizeDomain } from "@/lib/domains/normalize"
import { relationshipId } from "@/lib/relationshipId"
import {
  buildFailedTenantEmailSending,
  buildTenantEmailSendingFromCloudflareSubdomain,
  type TenantEmailSendingState,
} from "@/lib/tenants/emailSending"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"

export type ProvisionPaidDomainResult = {
  status: "registered" | "already_registered"
  domain: string
  run: SiteGenerationRun
}

export async function provisionPaidDomainOrder(
  payload: Payload,
  run: SiteGenerationRun,
  input?: { selectedDomain?: string | null; now?: string },
): Promise<ProvisionPaidDomainResult> {
  const current = normalizeDomainOrderState(run.domainOrder)
  const domain = input?.selectedDomain ?? current.domain
  const normalized = normalizeDomain(domain)
  if (!normalized.ok) throw new Error(`Cannot provision paid domain: ${normalized.reason}.`)
  if (current.status === "registered" && current.domain === normalized.domain) {
    return { status: "already_registered", domain: normalized.domain, run }
  }

  const tenantId = relationshipId(run.tenant)
  if (!tenantId) throw new Error("Cannot provision paid domain without a linked tenant.")
  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId as any,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  if (!tenant || tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Cannot provision paid domain for an unavailable tenant.")
  }

  const now = input?.now ?? new Date().toISOString()
  const registrant = current.registrant
  if (!registrant) throw new Error("Cannot provision paid domain without domain holder details.")
  const requested = {
    ...createDomainOrderState({
      status: "registration_requested",
      domain: normalized.domain,
      fixedPrice: current.fixedPriceAmount && current.fixedPriceCurrency
        ? { amount: current.fixedPriceAmount, currency: current.fixedPriceCurrency }
        : fixedDomainOrderPriceFromEnv(),
      providerPrice: current.providerPriceAmount && current.providerPriceCurrency
        ? { amount: current.providerPriceAmount, currency: current.providerPriceCurrency }
        : null,
      registrant,
      ownerHandle: current.ownerHandle,
      adminHandle: current.adminHandle,
      maxProviderPrice: current.maxProviderPriceAmount && current.maxProviderPriceCurrency
        ? { amount: current.maxProviderPriceAmount, currency: current.maxProviderPriceCurrency }
        : null,
      maxOfferPrice: current.maxOfferPriceAmount && current.maxOfferPriceCurrency
        ? { amount: current.maxOfferPriceAmount, currency: current.maxOfferPriceCurrency }
        : null,
      now,
    }),
    reason: "payment_completed",
  }
  await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { domainOrder: requested } as any,
    depth: 0,
    overrideAccess: true,
  })

  let ownerHandle = current.ownerHandle
  let adminHandle = current.adminHandle
  try {
    const openProviderToken = await loginOpenProvider()
    ownerHandle = ownerHandle ?? (await createOpenProviderCustomerHandle(registrant, {
      token: openProviderToken,
    })).handle
    adminHandle = adminHandle ?? ownerHandle
    const zone = await createCloudflareZone(normalized.domain)
    const registration = await registerOpenProviderDomain(normalized.domain, {
      token: openProviderToken,
      ownerHandle,
      adminHandle,
      nameServers: zone.nameServers.map((name) => ({ name })),
      nsGroup: null,
      autorenew: "on",
    })
    const dnsRecords = await createCloudflareZoneDnsRecords(zone.id, normalized.domain)
    let emailSending: TenantEmailSendingState
    try {
      const subdomain = await createOrReuseCloudflareEmailSendingSubdomain(zone.id, `mail.${normalized.domain}`)
      emailSending = buildTenantEmailSendingFromCloudflareSubdomain(normalized.domain, zone.id, subdomain)
    } catch (error) {
      emailSending = buildFailedTenantEmailSending(
        normalized.domain,
        zone.id,
        redactOperationalMessage(error),
      )
    }
    const registered = {
      ...createDomainOrderState({
        status: "registered",
        domain: normalized.domain,
        fixedPrice: requested.fixedPriceAmount && requested.fixedPriceCurrency
          ? { amount: requested.fixedPriceAmount, currency: requested.fixedPriceCurrency }
          : null,
        providerPrice: requested.providerPriceAmount && requested.providerPriceCurrency
          ? { amount: requested.providerPriceAmount, currency: requested.providerPriceCurrency }
          : null,
        providerReference: registration.id == null ? null : String(registration.id),
        reason: "domain_registered",
        registrant,
        ownerHandle,
        adminHandle,
        maxProviderPrice: requested.maxProviderPriceAmount && requested.maxProviderPriceCurrency
          ? { amount: requested.maxProviderPriceAmount, currency: requested.maxProviderPriceCurrency }
          : null,
        maxOfferPrice: requested.maxOfferPriceAmount && requested.maxOfferPriceCurrency
          ? { amount: requested.maxOfferPriceAmount, currency: requested.maxOfferPriceCurrency }
          : null,
        now: new Date().toISOString(),
      }),
      cloudflareZoneId: zone.id,
      cloudflareNameservers: zone.nameServers,
      cloudflareDnsRecordIds: dnsRecords.map((record) => record.id).filter(Boolean),
      emailSending: {
        provider: emailSending.provider,
        mode: emailSending.mode,
        status: emailSending.status,
        sendingDomain: emailSending.sendingDomain,
        senderEmail: emailSending.senderEmail,
        cloudflareZoneId: emailSending.cloudflareZoneId,
        cloudflareSubdomainId: emailSending.cloudflareSubdomainId,
        returnPathDomain: emailSending.returnPathDomain,
        dkimSelector: emailSending.dkimSelector,
        lastCheckedAt: emailSending.lastCheckedAt,
        lastError: emailSending.lastError,
      },
    }
    const [updatedRun] = await Promise.all([
      payload.update({
        collection: "site-generation-runs",
        id: run.id,
        data: { domainOrder: registered } as any,
        depth: 0,
        overrideAccess: true,
      }) as Promise<SiteGenerationRun>,
      payload.update({
        collection: "tenants",
        id: tenantId as any,
        data: {
          domain: normalized.domain,
          domainVerification: {
            status: "verified",
            checkedAt: new Date().toISOString(),
            notes: "Domain registered with OpenProvider and Cloudflare DNS records created by checkout automation.",
          },
          emailSending,
        } as any,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    return { status: "registered", domain: normalized.domain, run: updatedRun }
  } catch (error) {
    const failed = {
      ...requested,
      status: "failed" as const,
      reason: error instanceof Error ? error.message : "domain_provisioning_failed",
      updatedAt: new Date().toISOString(),
      ownerHandle,
      adminHandle,
    }
    const updatedRun = await payload.update({
      collection: "site-generation-runs",
      id: run.id,
      data: { domainOrder: failed } as any,
      depth: 0,
      overrideAccess: true,
    }) as SiteGenerationRun
    throw Object.assign(error instanceof Error ? error : new Error("Domain provisioning failed."), {
      run: updatedRun,
    })
  }
}
