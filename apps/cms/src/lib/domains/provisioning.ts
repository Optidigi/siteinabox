import "server-only"

import {
  getTldCapabilityForProductionOperation,
  getTldCapabilityByVersion,
  tldCapabilityOperationFlagEnabled,
  type TldCapability,
  validateTldRegistrationLabel,
} from "@siteinabox/contracts/tld-capabilities"
import type { Payload } from "payload"
import type {
  CheckoutProfile,
  ManagedDomain,
  Order,
  SiteGenerationRun,
  Tenant,
} from "@/payload-types"
import { recordCommerceAdminException } from "@/lib/commerce/alerts"
import {
  buildCloudflareDnsRecordRequests,
  createCloudflareZoneDnsRecords,
  createOrReuseCloudflareEmailSendingSubdomain,
  createOrReuseCloudflareZone,
  CloudflareIndeterminateWriteError,
  getCloudflareSslVerification,
  listCloudflareDnsRecords,
  listCloudflareEmailSendingSubdomains,
  listCloudflareZones,
} from "@/lib/domains/cloudflare"
import {
  checkOpenProviderDomainAvailability,
  createOpenProviderCustomerHandle,
  findOpenProviderCustomerByReference,
  findOpenProviderDomain,
  loginOpenProvider,
  normalizeOpenProviderTimestamp,
  OpenProviderIndeterminateWriteError,
  registerOpenProviderDomain,
  type OpenProviderDomainRecord,
} from "@/lib/domains/openprovider"
import {
  createDomainOrderState,
  normalizeDomainOrderState,
  normalizeDomainRegistrantDetails,
} from "@/lib/domains/orderState"
import { normalizeDomain } from "@/lib/domains/normalize"
import type { domainRegistrantFromCheckoutProfile } from "@/lib/checkout/checkoutProfile"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import {
  buildFailedTenantEmailSending,
  buildTenantEmailSendingFromCloudflareSubdomain,
  type TenantEmailSendingState,
} from "@/lib/tenants/emailSending"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"
import {
  verifyAuthoritativeDns,
  verifyHttpsEndpoint,
  type AuthoritativeDnsVerification,
  type HttpsVerification,
} from "@/lib/domains/verification"

type ManagedDomainLifecycleData = Partial<ManagedDomain> & Record<string, unknown>

export type ProvisionPaidDomainResult = {
  status: "ready_for_activation" | "already_active" | "waiting" | "unfulfillable"
  domain: string
  run: SiteGenerationRun
  managedDomain: ManagedDomain
  message?: string
}

type ProvisioningDependencies = {
  now: () => string
  loginOpenProvider: typeof loginOpenProvider
  checkOpenProviderDomainAvailability: typeof checkOpenProviderDomainAvailability
  findOpenProviderDomain: typeof findOpenProviderDomain
  findOpenProviderCustomerByReference: typeof findOpenProviderCustomerByReference
  createOpenProviderCustomerHandle: typeof createOpenProviderCustomerHandle
  registerOpenProviderDomain: typeof registerOpenProviderDomain
  createOrReuseCloudflareZone: typeof createOrReuseCloudflareZone
  listCloudflareZones: typeof listCloudflareZones
  createCloudflareZoneDnsRecords: typeof createCloudflareZoneDnsRecords
  listCloudflareDnsRecords: typeof listCloudflareDnsRecords
  buildCloudflareDnsRecordRequests: typeof buildCloudflareDnsRecordRequests
  createOrReuseCloudflareEmailSendingSubdomain: typeof createOrReuseCloudflareEmailSendingSubdomain
  listCloudflareEmailSendingSubdomains: typeof listCloudflareEmailSendingSubdomains
  getCloudflareSslVerification: typeof getCloudflareSslVerification
  verifyAuthoritativeDns: (
    domain: string,
    expectedNameServers: string[],
  ) => Promise<AuthoritativeDnsVerification>
  verifyHttpsEndpoint: (domain: string) => Promise<HttpsVerification>
}

const defaultDependencies: ProvisioningDependencies = {
  now: () => new Date().toISOString(),
  loginOpenProvider,
  checkOpenProviderDomainAvailability,
  findOpenProviderDomain,
  findOpenProviderCustomerByReference,
  createOpenProviderCustomerHandle,
  registerOpenProviderDomain,
  createOrReuseCloudflareZone,
  listCloudflareZones,
  createCloudflareZoneDnsRecords,
  listCloudflareDnsRecords,
  buildCloudflareDnsRecordRequests,
  createOrReuseCloudflareEmailSendingSubdomain,
  listCloudflareEmailSendingSubdomains,
  getCloudflareSslVerification,
  verifyAuthoritativeDns,
  verifyHttpsEndpoint,
}

const readObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

const capabilityForAcceptedOrder = (
  order: Order,
  tld: string,
): TldCapability => {
  const quoteEvidence = readObject(order.quoteEvidence)
  const evidence = readObject(quoteEvidence?.tldCapability)
  const capabilityVersion = typeof evidence?.capabilityVersion === "string"
    ? evidence.capabilityVersion
    : null
  if (capabilityVersion) {
    const capability = getTldCapabilityByVersion(capabilityVersion)
    if (
      !capability ||
      capability.tld !== tld ||
      evidence?.tld !== tld ||
      !tldCapabilityOperationFlagEnabled(capability, "registration")
    ) {
      throw new Error("Accepted-order TLD capability evidence is invalid.")
    }
    return capability
  }
  if (tld !== "nl") {
    throw new Error(`Paid .${tld} fulfillment requires frozen TLD capability evidence.`)
  }
  const legacyCapability = getTldCapabilityForProductionOperation(
    tld,
    "registration",
    order.acceptedAt ?? order.createdAt,
  )
  if (!legacyCapability) {
    throw new Error("Legacy .nl order has no applicable TLD capability.")
  }
  return legacyCapability
}

const historyWith = (
  domain: ManagedDomain,
  at: string,
  state: string,
  reason: string,
): Array<Record<string, string>> => [
  ...(Array.isArray(domain.stateHistory)
    ? domain.stateHistory.filter(
      (entry): entry is Record<string, string> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    )
    : []),
  { at, state, reason },
]

async function updateManagedDomain(
  payload: Payload,
  domain: ManagedDomain,
  data: ManagedDomainLifecycleData,
  reason?: string,
  now?: string,
): Promise<ManagedDomain> {
  const at = now ?? new Date().toISOString()
  const state = typeof data.state === "string" ? data.state : domain.state
  return payload.update({
    collection: "managed-domains",
    id: domain.id,
    data: {
      ...data,
      ...(reason ? { stateHistory: historyWith(domain, at, state, reason) } : {}),
    },
    depth: 0,
    overrideAccess: true,
    context: { managedDomainLifecycleMutation: true },
  }) as Promise<ManagedDomain>
}

async function compatibilityProjection(
  payload: Payload,
  run: SiteGenerationRun,
  domain: ManagedDomain,
  status: "registration_requested" | "registered" | "failed",
  reason: string,
  registrant: ReturnType<typeof domainRegistrantFromCheckoutProfile>,
  emailSending?: TenantEmailSendingState,
): Promise<SiteGenerationRun> {
  const current = normalizeDomainOrderState(run.domainOrder)
  const now = new Date().toISOString()
  const projected = {
    ...createDomainOrderState({
      status,
      domain: domain.domainNameAscii,
      fixedPrice: current.fixedPriceAmount && current.fixedPriceCurrency
        ? { amount: current.fixedPriceAmount, currency: current.fixedPriceCurrency }
        : null,
      providerPrice: current.providerPriceAmount && current.providerPriceCurrency
        ? { amount: current.providerPriceAmount, currency: current.providerPriceCurrency }
        : null,
      providerReference: domain.providerDomainId ?? null,
      reason,
      registrant,
      ownerHandle: domain.providerCustomerHandle ?? null,
      // The customer is the registrant/owner. Siteinabox's configured
      // administrative contact is intentionally not projected as customer evidence.
      adminHandle: null,
      maxProviderPrice: current.maxProviderPriceAmount && current.maxProviderPriceCurrency
        ? { amount: current.maxProviderPriceAmount, currency: current.maxProviderPriceCurrency }
        : null,
      maxOfferPrice: current.maxOfferPriceAmount && current.maxOfferPriceCurrency
        ? { amount: current.maxOfferPriceAmount, currency: current.maxOfferPriceCurrency }
        : null,
      now,
    }),
    cloudflareZoneId: domain.cloudflareZoneId ?? null,
    cloudflareNameservers: domain.cloudflareNameservers ?? [],
    cloudflareDnsRecordIds: domain.cloudflareDnsRecordIds ?? [],
    ...(emailSending ? { emailSending } : {}),
  }
  return payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: { domainOrder: projected },
    depth: 0,
    overrideAccess: true,
  }) as Promise<SiteGenerationRun>
}

async function checkoutProfileForOrder(payload: Payload, order: Order): Promise<CheckoutProfile> {
  if (!order.checkoutProfileKey) {
    throw new Error("Paid domain fulfillment requires an authoritative checkout profile.")
  }
  const result = await payload.find({
    collection: "checkout-profiles",
    where: { profileKey: { equals: order.checkoutProfileKey } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  const profile = result.docs[0] as CheckoutProfile | undefined
  if (!profile || result.docs.length !== 1) {
    throw new Error("Paid domain fulfillment could not resolve one authoritative checkout profile.")
  }
  if (!sameRelationshipId(profile.tenant, order.tenant)) {
    throw new Error("Checkout profile tenant does not match the paid order.")
  }
  return profile
}

async function getOrCreateManagedDomain(
  payload: Payload,
  input: {
    order: Order
    profile: CheckoutProfile
    domain: string
    tld: string
    now: string
  },
): Promise<ManagedDomain> {
  const existing = await payload.find({
    collection: "managed-domains",
    where: {
      or: [
        { domainNameAscii: { equals: input.domain } },
        { provisioningIdempotencyKey: { equals: `domain-registration:order:${input.order.id}:v1` } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) return existing.docs[0] as ManagedDomain

  try {
    return await payload.create({
      collection: "managed-domains",
      data: {
        domainNameAscii: input.domain,
        tld: input.tld,
        provisioningIdempotencyKey: `domain-registration:order:${input.order.id}:v1`,
        originatingOrder: input.order.id,
        registrantProfile: input.profile.id,
        tenant: relationshipId(input.order.tenant) == null
          ? undefined
          : Number(relationshipId(input.order.tenant)),
        state: "pending",
        custodyStatus: "managed",
        initialOperation: "registration",
        registrantOwnership: "customer",
        provider: "openprovider",
        providerRegistrationState: "not_started",
        registrantVerificationStatus: "not_checked",
        authoritativeDnsStatus: "pending",
        httpsStatus: "pending",
        entitlementStatus: "pending",
        customerStatus: "provisioning",
        renewalIntent: true,
        providerAutorenew: "unknown",
        transferOutProviderMissingCount: 0,
        reconciliationRequired: false,
        stateHistory: [{ at: input.now, state: "pending", reason: "paid_order_accepted" }],
        createdAt: input.now,
      },
      depth: 0,
      overrideAccess: true,
    }) as ManagedDomain
  } catch {
    const raced = await payload.find({
      collection: "managed-domains",
      where: {
        or: [
          { domainNameAscii: { equals: input.domain } },
          { provisioningIdempotencyKey: { equals: `domain-registration:order:${input.order.id}:v1` } },
        ],
      },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    if (raced.docs[0]) return raced.docs[0] as ManagedDomain
    throw new Error("Managed-domain creation failed without a reconcilable record.")
  }
}

const registrationIsActive = (
  status: string,
  capability: TldCapability,
): boolean => capability.registration.confirmation.activeStatuses.includes(
  status.trim().toUpperCase(),
)

const registrantVerification = (
  record: OpenProviderDomainRecord | null,
  capability: TldCapability,
): {
  status: "not_required" | "pending" | "verified" | "overdue" | "suspended" | "failed"
  description: string
} => {
  const status = record?.verificationEmailStatus?.trim().toLowerCase() ?? ""
  const description = record?.verificationEmailDescription?.trim() ||
    `Provider reports no registrant verification requirement for .${capability.tld}.`
  if (!status || ["not applicable", "not required", "n/a"].includes(status)) {
    return { status: "not_required", description }
  }
  if (["verified", "valid", "completed"].includes(status)) {
    return { status: "verified", description }
  }
  if (status.includes("suspend")) {
    return { status: "suspended", description }
  }
  if (status.includes("overdue") || status.includes("expired")) {
    return { status: "overdue", description }
  }
  if (status.includes("fail") || status.includes("reject")) {
    return { status: "failed", description }
  }
  return { status: "pending", description }
}

const canonicalDnsValue = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "")

const matchingDnsRecord = (
  records: Awaited<ReturnType<typeof listCloudflareDnsRecords>>,
  requested: ReturnType<typeof buildCloudflareDnsRecordRequests>[number],
) => records.find((record) =>
  record.type === requested.type &&
  canonicalDnsValue(record.name) === canonicalDnsValue(requested.name) &&
  canonicalDnsValue(record.content) === canonicalDnsValue(requested.content) &&
  record.proxied === requested.proxied)

const waiting = (
  domain: string,
  run: SiteGenerationRun,
  managedDomain: ManagedDomain,
  message: string,
): ProvisionPaidDomainResult => ({
  status: "waiting",
  domain,
  run,
  managedDomain,
  message,
})

export async function provisionPaidDomainOrder(
  payload: Payload,
  run: SiteGenerationRun,
  input: {
    order: Order
    selectedDomain?: string | null
    dependencies?: Partial<ProvisioningDependencies>
  },
): Promise<ProvisionPaidDomainResult> {
  const dependencies = { ...defaultDependencies, ...input.dependencies }
  const selectedDomain = input.selectedDomain ?? input.order.domain
  const normalized = normalizeDomain(selectedDomain)
  if (!normalized.ok) throw new Error(`Cannot provision paid domain: ${normalized.reason}.`)
  const capability = capabilityForAcceptedOrder(input.order, normalized.extension)
  if (!validateTldRegistrationLabel(capability, normalized.name)) {
    throw new Error(`Domain label is not supported for .${normalized.extension}.`)
  }
  const orderDomain = normalizeDomain(input.order.domain)
  if (!orderDomain.ok || orderDomain.domain !== normalized.domain) {
    throw new Error("Paid order domain does not match the requested managed domain.")
  }

  const tenantId = relationshipId(run.tenant)
  if (!tenantId || !sameRelationshipId(input.order.tenant, tenantId)) {
    throw new Error("Paid order, generation run, and tenant must match.")
  }
  let tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  if (tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Cannot provision a paid domain for an unavailable tenant.")
  }

  const profile = await checkoutProfileForOrder(payload, input.order)
  const registrant = normalizeDomainRegistrantDetails(input.order.domainRegistrant)
  if (!registrant) {
    throw new Error("Paid domain fulfillment requires the frozen accepted registrant evidence.")
  }
  if (!capability.registrant.supportedPartyTypes.includes(profile.partyType)) {
    throw new Error(`Contracting-party type is not supported for .${capability.tld}.`)
  }
  for (const field of capability.registrant.requiredFields) {
    if (!registrant[field]) {
      throw new Error(`Authoritative registrant field ${field} is required for .${capability.tld}.`)
    }
  }
  if (profile.partyType === "registered_business" && !registrant.companyName) {
    throw new Error(`Authoritative registrant field companyName is required for .${capability.tld}.`)
  }
  const now = dependencies.now()
  let managedDomain = await getOrCreateManagedDomain(payload, {
    order: input.order,
    profile,
    domain: normalized.domain,
    tld: capability.tld,
    now,
  })
  if (
    managedDomain.domainNameAscii !== normalized.domain ||
    managedDomain.tld !== capability.tld ||
    managedDomain.provider !== "openprovider" ||
    managedDomain.initialOperation !== "registration" ||
    managedDomain.registrantOwnership !== "customer" ||
    !sameRelationshipId(managedDomain.tenant, tenantId) ||
    !sameRelationshipId(managedDomain.originatingOrder, input.order.id) ||
    !sameRelationshipId(managedDomain.registrantProfile, profile.id)
  ) {
    throw new Error("Managed domain is already bound to different accepted evidence or ownership.")
  }
  const initialProviderRegistrationState = managedDomain.providerRegistrationState
  const initialFailureReason = managedDomain.failureReason
  if (
    managedDomain.state === "manual_review" &&
    [
      "paid_domain_became_unavailable_before_provider_commit",
      "provider_domain_owner_mismatch",
    ].includes(initialFailureReason ?? "")
  ) {
    run = await compatibilityProjection(
      payload,
      run,
      managedDomain,
      "failed",
      initialFailureReason ?? "managed_domain_manual_review",
      registrant,
    )
    return {
      status: "unfulfillable",
      domain: normalized.domain,
      run,
      managedDomain,
      message: "The managed domain remains in terminal manual review.",
    }
  }
  if (managedDomain.state === "active" && managedDomain.entitlementStatus === "active") {
    run = await compatibilityProjection(
      payload,
      run,
      managedDomain,
      "registered",
      "managed_domain_already_active",
      registrant,
    )
    return {
      status: "already_active",
      domain: normalized.domain,
      run,
      managedDomain,
    }
  }
  if (managedDomain.state === "pending" || managedDomain.state === "manual_review") {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      state: "registration_pending",
      customerStatus: "provisioning",
      reconciliationRequired: managedDomain.reconciliationRequired,
      failureReason: null,
    }, "registration_workflow_started", now)
  }
  run = await compatibilityProjection(
    payload,
    run,
    managedDomain,
    "registration_requested",
    "managed_domain_registration_pending",
    registrant,
  )

  const token = await dependencies.loginOpenProvider()
  let providerDomain = await dependencies.findOpenProviderDomain(normalized.domain, { token })
  if (
    providerDomain &&
    managedDomain.providerCustomerHandle &&
    providerDomain.ownerHandle !== managedDomain.providerCustomerHandle
  ) {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      state: "manual_review",
      customerStatus: "manual_review",
      reconciliationRequired: false,
      failureReason: "provider_domain_owner_mismatch",
    }, "provider_domain_owner_mismatch", dependencies.now())
    run = await compatibilityProjection(
      payload,
      run,
      managedDomain,
      "failed",
      "provider_domain_owner_mismatch",
      registrant,
    )
    return {
      status: "unfulfillable",
      domain: normalized.domain,
      run,
      managedDomain,
      message: "The paid domain exists under a different provider owner.",
    }
  }

  if (
    !providerDomain &&
    (initialFailureReason === "openprovider_registration_indeterminate" ||
      initialProviderRegistrationState === "prepared")
  ) {
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "Openprovider registration outcome remains indeterminate; no registration retry was sent.",
    )
  }

  if (!providerDomain && managedDomain.providerRegistrationState === "not_started") {
    const availability = await dependencies.checkOpenProviderDomainAvailability(normalized.domain, {
      token,
      withPrice: false,
    })
    if (!availability.available) {
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        state: "manual_review",
        customerStatus: "manual_review",
        reconciliationRequired: false,
        failureReason: "paid_domain_became_unavailable_before_provider_commit",
      }, "paid_domain_race_lost", dependencies.now())
      run = await compatibilityProjection(
        payload,
        run,
        managedDomain,
        "failed",
        "paid_domain_became_unavailable_before_provider_commit",
        registrant,
      )
      return {
        status: "unfulfillable",
        domain: normalized.domain,
        run,
        managedDomain,
        message: "The paid domain became unavailable before provider commitment.",
      }
    }
  }

  let customerHandle = managedDomain.providerCustomerHandle ?? null
  if (!customerHandle) {
    const existingCustomer = await dependencies.findOpenProviderCustomerByReference(
      managedDomain.provisioningIdempotencyKey,
      { token },
    )
    if (existingCustomer) {
      customerHandle = existingCustomer.handle
    } else {
      if (initialFailureReason === "openprovider_customer_handle_indeterminate") {
        return waiting(
          normalized.domain,
          run,
          managedDomain,
          "Openprovider customer-handle creation remains indeterminate; no retry was sent.",
        )
      }
      try {
        customerHandle = (await dependencies.createOpenProviderCustomerHandle(registrant, {
          token,
          reference: managedDomain.provisioningIdempotencyKey,
        })).handle
      } catch (error) {
        if (!(error instanceof OpenProviderIndeterminateWriteError)) throw error
        managedDomain = await updateManagedDomain(payload, managedDomain, {
          providerRegistrationState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_customer_handle_indeterminate",
        }, "openprovider_customer_handle_indeterminate", dependencies.now())
        return waiting(
          normalized.domain,
          run,
          managedDomain,
          "Openprovider customer-handle creation is awaiting reconciliation.",
        )
      }
    }
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      providerCustomerHandle: customerHandle,
      providerRegistrationState: "not_started",
      reconciliationRequired: false,
      failureReason: null,
    }, "provider_customer_handle_persisted", dependencies.now())
  }

  const visibleZones = await dependencies.listCloudflareZones(normalized.domain)
  let zone = managedDomain.cloudflareZoneId
    ? visibleZones.find((candidate) => candidate.id === managedDomain.cloudflareZoneId) ?? null
    : visibleZones[0] ?? null
  if (!zone) {
    if (initialFailureReason === "cloudflare_zone_creation_indeterminate") {
      return waiting(
        normalized.domain,
        run,
        managedDomain,
        "Cloudflare zone creation remains indeterminate; no retry was sent.",
      )
    }
    try {
      zone = await dependencies.createOrReuseCloudflareZone(normalized.domain)
    } catch (error) {
      if (!(error instanceof CloudflareIndeterminateWriteError)) throw error
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        reconciliationRequired: true,
        failureReason: "cloudflare_zone_creation_indeterminate",
      }, "cloudflare_zone_creation_indeterminate", dependencies.now())
      return waiting(
        normalized.domain,
        run,
        managedDomain,
        "Cloudflare zone creation is awaiting reconciliation.",
      )
    }
  }
  if (
    managedDomain.cloudflareZoneId !== zone.id ||
    managedDomain.cloudflareZoneStatus !== zone.status
  ) {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      cloudflareZoneId: zone.id,
      cloudflareNameservers: zone.nameServers,
      cloudflareZoneStatus: zone.status,
      reconciliationRequired: false,
      failureReason: null,
    }, "cloudflare_zone_persisted", dependencies.now())
  }

  if (!providerDomain) {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      providerRegistrationState: "prepared",
      registrationRequestedAt: managedDomain.registrationRequestedAt ?? dependencies.now(),
      reconciliationRequired: true,
      failureReason: null,
    }, "provider_registration_prepared", dependencies.now())
    try {
      const registration = await dependencies.registerOpenProviderDomain(normalized.domain, {
        token,
        ownerHandle: customerHandle,
        nameServers: zone.nameServers.map((name) => ({ name })),
        nsGroup: null,
        period: capability.registration.periodYears,
        autorenew: capability.renewal.executionMode === "provider_autorenew" ? "on" : "off",
        reference: managedDomain.provisioningIdempotencyKey,
        acceptedCapabilityVersion: capability.capabilityVersion,
      })
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        providerDomainId: registration.id == null
          ? managedDomain.providerDomainId
          : String(registration.id),
        providerRegistrationState: "confirmed",
        registeredAt: registration.status === "registered"
          ? managedDomain.registeredAt ?? dependencies.now()
          : managedDomain.registeredAt,
        reconciliationRequired: registration.status !== "registered",
        failureReason: null,
      }, `provider_registration_${registration.status}`, dependencies.now())
      providerDomain = registration.status === "registered" && registration.id != null
        ? {
            id: registration.id,
            domain: normalized.domain,
            status: "ACT",
            ownerHandle: customerHandle,
            adminHandle: null,
            nameServers: zone.nameServers,
            renewalDate: null,
            autorenew: capability.renewal.executionMode === "provider_autorenew" ? "on" : "off",
            verificationEmailStatus: null,
            verificationEmailExpiresAt: null,
            verificationEmailDescription: null,
            raw: registration.raw,
          }
        : null
    } catch (error) {
      let reconciled: OpenProviderDomainRecord | null = null
      try {
        reconciled = await dependencies.findOpenProviderDomain(normalized.domain, { token })
      } catch {
        // The original indeterminate write remains authoritative until a read succeeds.
      }
      if (reconciled?.ownerHandle === customerHandle) {
        providerDomain = reconciled
      } else if (error instanceof OpenProviderIndeterminateWriteError) {
        managedDomain = await updateManagedDomain(payload, managedDomain, {
          providerRegistrationState: "indeterminate",
          reconciliationRequired: true,
          failureReason: "openprovider_registration_indeterminate",
        }, "openprovider_registration_indeterminate", dependencies.now())
        return waiting(
          normalized.domain,
          run,
          managedDomain,
          "Openprovider registration is awaiting reconciliation; no retry was sent.",
        )
      } else {
        throw error
      }
    }
  }

  if (!providerDomain) {
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "Openprovider is still processing the domain registration.",
    )
  }
  if (providerDomain.ownerHandle !== customerHandle) {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      state: "manual_review",
      customerStatus: "manual_review",
      reconciliationRequired: false,
      failureReason: "provider_domain_owner_mismatch",
    }, "provider_domain_owner_mismatch", dependencies.now())
    return {
      status: "unfulfillable",
      domain: normalized.domain,
      run,
      managedDomain,
      message: "Openprovider returned the domain under a different registrant handle.",
    }
  }
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    providerDomainId: String(providerDomain.id),
    providerRegistrationState: "confirmed",
    expiresAt: normalizeOpenProviderTimestamp(providerDomain.renewalDate),
    providerRenewalDate: normalizeOpenProviderTimestamp(providerDomain.renewalDate),
    registryExpiryDate: normalizeOpenProviderTimestamp(providerDomain.registryExpiryDate),
    registeredAt: registrationIsActive(providerDomain.status, capability)
      ? managedDomain.registeredAt ?? dependencies.now()
      : managedDomain.registeredAt,
    reconciliationRequired: !registrationIsActive(providerDomain.status, capability),
    failureReason: null,
  }, "provider_registration_reconciled", dependencies.now())
  if (!registrationIsActive(providerDomain.status, capability)) {
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "Openprovider has accepted the registration and is still processing it.",
    )
  }

  const verification = registrantVerification(providerDomain, capability)
  const recovered = verification.status === "verified" &&
    ["pending", "overdue", "suspended", "failed"].includes(
      managedDomain.registrantVerificationStatus,
    )
  const verificationStatus = recovered ? "recovered" : verification.status
  const verificationActionRequired = [
    "pending",
    "overdue",
    "suspended",
    "failed",
  ].includes(verificationStatus)
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    registrantVerificationStatus: verificationStatus,
    registrantVerificationCheckedAt: dependencies.now(),
    registrantVerificationDueAt: normalizeOpenProviderTimestamp(
      providerDomain.verificationEmailExpiresAt,
    ) ?? managedDomain.registrantVerificationDueAt,
    registrantVerificationRecoveredAt: recovered ? dependencies.now() : undefined,
    registrantVerificationDescription: verification.description,
    customerStatus: verificationActionRequired
      ? "verification_required"
      : "provisioning",
    reconciliationRequired: verificationActionRequired,
    failureReason: verificationActionRequired ? `registrant_verification_${verificationStatus}` : null,
  }, `registrant_verification_${verificationStatus}`, dependencies.now())
  if (["overdue", "suspended", "failed"].includes(verificationStatus)) {
    await recordCommerceAdminException({
      payload,
      source: "domains",
      code: `registrant_verification_${verificationStatus}`,
      message: "Provider-reported registrant verification requires immediate customer recovery.",
      tenant: managedDomain.tenant,
      subjectId: managedDomain.id,
      severity: verificationStatus === "suspended" ? "critical" : "error",
      now: dependencies.now(),
    })
  }
  if (verificationActionRequired) {
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "Customer registrant verification is required before activation.",
    )
  }

  let dnsRecords: Awaited<ReturnType<typeof createCloudflareZoneDnsRecords>>
  if (initialFailureReason === "cloudflare_dns_write_indeterminate") {
    const existingRecords = await dependencies.listCloudflareDnsRecords(zone.id)
    const requestedRecords = dependencies.buildCloudflareDnsRecordRequests(normalized.domain)
    const reconciledRecords = requestedRecords
      .map((requested) => matchingDnsRecord(existingRecords, requested))
    if (reconciledRecords.some((record) => !record)) {
      return waiting(
        normalized.domain,
        run,
        managedDomain,
        "Cloudflare DNS creation remains indeterminate; no retry was sent.",
      )
    }
    dnsRecords = reconciledRecords.filter(
      (record): record is NonNullable<typeof record> => Boolean(record),
    )
  } else {
    try {
      dnsRecords = await dependencies.createCloudflareZoneDnsRecords(zone.id, normalized.domain)
    } catch (error) {
      if (!(error instanceof CloudflareIndeterminateWriteError)) throw error
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        reconciliationRequired: true,
        failureReason: "cloudflare_dns_write_indeterminate",
      }, "cloudflare_dns_write_indeterminate", dependencies.now())
      return waiting(
        normalized.domain,
        run,
        managedDomain,
        "Cloudflare DNS record creation is awaiting reconciliation.",
      )
    }
  }
  const refreshedZone = (await dependencies.listCloudflareZones(normalized.domain))
    .find((candidate) => candidate.id === zone?.id) ?? zone
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    cloudflareDnsRecordIds: dnsRecords.map((record) => record.id).filter(Boolean),
    cloudflareZoneStatus: refreshedZone.status,
  }, "cloudflare_dns_records_reconciled", dependencies.now())
  if (refreshedZone.status !== "active") {
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "Cloudflare is waiting for authoritative nameserver activation.",
    )
  }

  const authoritativeDns = await dependencies.verifyAuthoritativeDns(
    normalized.domain,
    refreshedZone.nameServers,
  )
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    authoritativeDnsStatus: authoritativeDns.status === "verified" ? "verified" : "pending",
    authoritativeDnsCheckedAt: dependencies.now(),
    authoritativeDnsEvidence: authoritativeDns,
    reconciliationRequired: authoritativeDns.status !== "verified",
  }, `authoritative_dns_${authoritativeDns.status}`, dependencies.now())
  if (authoritativeDns.status !== "verified") {
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "Authoritative DNS delegation is not verified yet.",
    )
  }

  const ssl = await dependencies.getCloudflareSslVerification(zone.id)
  if (ssl.status !== "active") {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      httpsStatus: ssl.status === "failed" ? "failed" : "pending",
      httpsCheckedAt: dependencies.now(),
      httpsEvidence: { certificateStatuses: ssl.providerStatuses },
      reconciliationRequired: true,
      failureReason: ssl.status === "failed" ? "cloudflare_ssl_verification_failed" : null,
    }, `cloudflare_ssl_${ssl.status}`, dependencies.now())
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "Cloudflare HTTPS certificate activation is not complete.",
    )
  }
  const https = await dependencies.verifyHttpsEndpoint(normalized.domain)
  managedDomain = await updateManagedDomain(payload, managedDomain, {
    httpsStatus: https.status === "verified" ? "verified" : "pending",
    httpsCheckedAt: dependencies.now(),
    httpsEvidence: {
      certificateStatuses: ssl.providerStatuses,
      httpStatus: https.httpStatus,
      reason: https.reason,
    },
    reconciliationRequired: https.status !== "verified",
  }, `https_endpoint_${https.status}`, dependencies.now())
  if (https.status !== "verified") {
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "The HTTPS endpoint is not reachable yet.",
    )
  }

  let emailSending: TenantEmailSendingState
  try {
    const sendingDomain = `mail.${normalized.domain}`
    const subdomain = initialFailureReason === "cloudflare_email_sending_write_indeterminate"
      ? (await dependencies.listCloudflareEmailSendingSubdomains(zone.id))
        .find((candidate) => candidate.name.toLowerCase() === sendingDomain)
      : await dependencies.createOrReuseCloudflareEmailSendingSubdomain(zone.id, sendingDomain)
    if (!subdomain) {
      return waiting(
        normalized.domain,
        run,
        managedDomain,
        "Cloudflare Email Sending creation remains indeterminate; no retry was sent.",
      )
    }
    emailSending = buildTenantEmailSendingFromCloudflareSubdomain(
      normalized.domain,
      zone.id,
      subdomain,
    )
  } catch (error) {
    if (error instanceof CloudflareIndeterminateWriteError) {
      managedDomain = await updateManagedDomain(payload, managedDomain, {
        reconciliationRequired: true,
        failureReason: "cloudflare_email_sending_write_indeterminate",
      }, "cloudflare_email_sending_write_indeterminate", dependencies.now())
      return waiting(
        normalized.domain,
        run,
        managedDomain,
        "Cloudflare Email Sending creation is awaiting reconciliation.",
      )
    }
    emailSending = buildFailedTenantEmailSending(
      normalized.domain,
      zone.id,
      redactOperationalMessage(error),
    )
  }
  tenant = await payload.update({
    collection: "tenants",
    id: tenantId,
    data: {
      domain: normalized.domain,
      domainVerification: {
        status: "verified",
        checkedAt: dependencies.now(),
        notes: "Verified from active Cloudflare zone and authoritative nameserver response.",
      },
      emailSending,
    },
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  if (tenant.emailSending?.status !== "verified") {
    managedDomain = await updateManagedDomain(payload, managedDomain, {
      reconciliationRequired: true,
      failureReason: "tenant_email_sending_not_verified",
    }, "tenant_email_sending_waiting", dependencies.now())
    run = await compatibilityProjection(
      payload,
      run,
      managedDomain,
      "registration_requested",
      "tenant_email_sending_not_verified",
      registrant,
      emailSending,
    )
    return waiting(
      normalized.domain,
      run,
      managedDomain,
      "Tenant email sending must be verified before publication.",
    )
  }

  managedDomain = await updateManagedDomain(payload, managedDomain, {
    reconciliationRequired: false,
    failureReason: null,
    customerStatus: "provisioning",
  }, "domain_ready_for_entitlement_activation", dependencies.now())
  run = await compatibilityProjection(
    payload,
    run,
    managedDomain,
    "registered",
    "domain_ready_for_entitlement_activation",
    registrant,
    emailSending,
  )
  return {
    status: "ready_for_activation",
    domain: normalized.domain,
    run,
    managedDomain,
  }
}

export async function activateManagedDomainEntitlement(
  payload: Payload,
  domain: ManagedDomain,
  now = new Date().toISOString(),
): Promise<ManagedDomain> {
  if (domain.authoritativeDnsStatus !== "verified" || domain.httpsStatus !== "verified") {
    throw new Error("Managed-domain entitlement requires verified authoritative DNS and HTTPS.")
  }
  return updateManagedDomain(payload, domain, {
    state: "active",
    entitlementStatus: "active",
    entitlementActivatedAt: domain.entitlementActivatedAt ?? now,
    customerStatus: "active",
    reconciliationRequired: false,
    failureReason: null,
  }, "entitlement_activated", now)
}
