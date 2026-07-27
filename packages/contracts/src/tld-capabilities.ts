import { z } from "zod"

import {
  COMMERCIAL_CATALOG_CURRENCY,
  contractingPartyTypeSchema,
} from "./commerce"

export const TLD_CAPABILITY_CATALOG_VERSION = "2026-07-27.1" as const

const registrantFieldSchema = z.enum([
  "companyName",
  "firstName",
  "lastName",
  "email",
  "street",
  "number",
  "suffix",
  "zipcode",
  "city",
  "country",
  "state",
  "phoneCountryCode",
  "phoneAreaCode",
  "phoneSubscriberNumber",
  "locale",
])

const providerConfirmationSchema = z.object({
  mechanism: z.literal("provider_domain_poll"),
  activeStatuses: z.array(z.string().min(1)).min(1),
  expectedWaitState: z.literal("persisted"),
}).strict()

export const tldCapabilitySchema = z.object({
  schemaVersion: z.literal(1),
  capabilityVersion: z.string().regex(
    /^tld-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.\d+$/,
    "Use a governed TLD capability version.",
  ),
  catalogVersion: z.literal(TLD_CAPABILITY_CATALOG_VERSION),
  tld: z.string().regex(/^[a-z]{2,63}$/),
  effectiveFrom: z.iso.datetime(),
  effectiveUntil: z.iso.datetime().nullable(),
  productionEnabled: z.boolean(),
  provider: z.literal("openprovider"),
  registrant: z.object({
    customerIsRegistrant: z.literal(true),
    supportedPartyTypes: z.tuple([
      z.literal("registered_business"),
      z.literal("business_in_formation"),
    ]),
    requiredFields: z.array(registrantFieldSchema).min(1),
    registeredBusinessRequiredFields: z.tuple([z.literal("companyName")]),
    businessInFormationRequiredFields: z.tuple([]),
    siteinaboxContactRoles: z.tuple([
      z.literal("administrative"),
      z.literal("technical"),
      z.literal("billing"),
    ]),
  }).strict(),
  registration: z.object({
    supported: z.literal(true),
    periodYears: z.literal(1),
    labelLength: z.object({
      min: z.number().int().positive(),
      max: z.number().int().positive(),
    }).strict(),
    idn: z.boolean(),
    confirmation: providerConfirmationSchema,
  }).strict(),
  transfer: z.object({
    supported: z.literal(true),
    authorization: z.literal("required"),
    authorizationFormat: z.enum(["opaque", "dns_belgium_5x3"]),
    authorizationValidityDays: z.number().int().positive().nullable(),
    completion: z.literal("realtime"),
    confirmation: providerConfirmationSchema,
    validRegistrantPhoneRequired: z.boolean(),
    preservesRenewalDate: z.literal(true),
  }).strict(),
  verification: z.object({
    requirement: z.enum(["provider_reported", "conditional_registry_risk_check"]),
    evidenceSource: z.literal("openprovider.verification_email_status"),
    activationGate: z.literal("verified_or_not_required"),
  }).strict(),
  renewal: z.object({
    dateSource: z.literal("openprovider.renewal_date"),
    executionMode: z.enum(["autorenew", "explicit"]),
    providerSafeCutoffLeadDays: z.number().int().nonnegative(),
    completionEvidence: z.literal("renewal_date_advanced"),
  }).strict(),
  restoration: z.object({
    supported: z.literal(true),
    providerWindowDays: z.number().int().positive(),
    registryQuarantineDays: z.number().int().positive(),
    mode: z.literal("provider_restore"),
    ordinaryCheckout: z.literal(false),
  }).strict(),
  pricing: z.object({
    currency: z.literal(COMMERCIAL_CATALOG_CURRENCY),
    premiumDomains: z.literal("unsupported"),
    acceptedOrderEvidence: z.literal("frozen_provider_operation_quote"),
    operations: z.object({
      registration: z.literal("provider_operation_quote"),
      transfer: z.literal("provider_operation_quote"),
      renewal: z.literal("provider_operation_quote"),
      restore: z.literal("manual_provider_quote"),
    }).strict(),
  }).strict(),
  rendererTls: z.object({
    apex: z.literal("explicit_active_host"),
    www: z.literal("explicit_active_alias"),
    edge: z.literal("cloudflare"),
    https: z.literal("cloudflare_edge_certificate"),
    origin: z.literal("protected_https_matching_host"),
  }).strict(),
  evidence: z.object({
    reviewedAt: z.iso.datetime(),
    providerPolicyUrl: z.url(),
    registryPolicyUrl: z.url(),
  }).strict(),
}).strict().superRefine((capability, ctx) => {
  if (capability.registration.labelLength.min > capability.registration.labelLength.max) {
    ctx.addIssue({
      code: "custom",
      path: ["registration", "labelLength"],
      message: "Minimum label length cannot exceed maximum label length.",
    })
  }
  if (
    capability.effectiveUntil &&
    new Date(capability.effectiveUntil) <= new Date(capability.effectiveFrom)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveUntil"],
      message: "effectiveUntil must be later than effectiveFrom.",
    })
  }
  for (const partyType of capability.registrant.supportedPartyTypes) {
    if (!contractingPartyTypeSchema.safeParse(partyType).success) {
      ctx.addIssue({
        code: "custom",
        path: ["registrant", "supportedPartyTypes"],
        message: `Unsupported contracting-party type: ${partyType}`,
      })
    }
  }
})

export type TldCapability = z.infer<typeof tldCapabilitySchema>

export const tldCapabilityCatalogSchema = z.array(tldCapabilitySchema).min(1).superRefine(
  (catalog, ctx) => {
    const byTld = new Map<string, TldCapability[]>()
    for (const capability of catalog) {
      const records = byTld.get(capability.tld) ?? []
      records.push(capability)
      byTld.set(capability.tld, records)
    }
    for (const [tld, records] of byTld) {
      records.sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
      for (let index = 1; index < records.length; index += 1) {
        const previous = records[index - 1]!
        const current = records[index]!
        if (!previous.effectiveUntil || previous.effectiveUntil > current.effectiveFrom) {
          ctx.addIssue({
            code: "custom",
            path: [catalog.indexOf(current), "effectiveFrom"],
            message: `TLD capability periods overlap for .${tld}.`,
          })
        }
      }
    }
  },
)

const COMMON_REGISTRANT_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "street",
  "number",
  "zipcode",
  "city",
  "country",
  "phoneCountryCode",
  "phoneAreaCode",
  "phoneSubscriberNumber",
  "locale",
] as const

const PROVIDER_ACTIVE_STATUSES = ["ACT", "ACTIVE", "REGISTERED"] as const

const commonCapability = {
  schemaVersion: 1,
  catalogVersion: TLD_CAPABILITY_CATALOG_VERSION,
  productionEnabled: true,
  provider: "openprovider",
  registrant: {
    customerIsRegistrant: true,
    supportedPartyTypes: ["registered_business", "business_in_formation"],
    requiredFields: COMMON_REGISTRANT_FIELDS,
    registeredBusinessRequiredFields: ["companyName"],
    businessInFormationRequiredFields: [],
    siteinaboxContactRoles: ["administrative", "technical", "billing"],
  },
  registration: {
    supported: true,
    periodYears: 1,
    confirmation: {
      mechanism: "provider_domain_poll",
      activeStatuses: PROVIDER_ACTIVE_STATUSES,
      expectedWaitState: "persisted",
    },
  },
  verification: {
    evidenceSource: "openprovider.verification_email_status",
    activationGate: "verified_or_not_required",
  },
  renewal: {
    dateSource: "openprovider.renewal_date",
    executionMode: "autorenew",
    providerSafeCutoffLeadDays: 2,
    completionEvidence: "renewal_date_advanced",
  },
  pricing: {
    currency: COMMERCIAL_CATALOG_CURRENCY,
    premiumDomains: "unsupported",
    acceptedOrderEvidence: "frozen_provider_operation_quote",
    operations: {
      registration: "provider_operation_quote",
      transfer: "provider_operation_quote",
      renewal: "provider_operation_quote",
      restore: "manual_provider_quote",
    },
  },
  rendererTls: {
    apex: "explicit_active_host",
    www: "explicit_active_alias",
    edge: "cloudflare",
    https: "cloudflare_edge_certificate",
    origin: "protected_https_matching_host",
  },
} as const

const catalogInput = [
  {
    ...commonCapability,
    capabilityVersion: "tld-nl-2026-07-26.1",
    tld: "nl",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveUntil: null,
    registration: {
      ...commonCapability.registration,
      labelLength: { min: 2, max: 63 },
      idn: false,
    },
    transfer: {
      supported: true,
      authorization: "required",
      authorizationFormat: "opaque",
      authorizationValidityDays: null,
      completion: "realtime",
      confirmation: commonCapability.registration.confirmation,
      validRegistrantPhoneRequired: true,
      preservesRenewalDate: true,
    },
    verification: {
      ...commonCapability.verification,
      requirement: "provider_reported",
    },
    restoration: {
      supported: true,
      providerWindowDays: 38,
      registryQuarantineDays: 40,
      mode: "provider_restore",
      ordinaryCheckout: false,
    },
    evidence: {
      reviewedAt: "2026-07-27T00:00:00.000Z",
      providerPolicyUrl: "https://www.openprovider.com/domains/tlds/nl",
      registryPolicyUrl: "https://www.sidn.nl/en/definitions",
    },
  },
  {
    ...commonCapability,
    capabilityVersion: "tld-be-2026-07-27.1",
    tld: "be",
    effectiveFrom: "2026-07-27T00:00:00.000Z",
    effectiveUntil: null,
    registration: {
      ...commonCapability.registration,
      labelLength: { min: 2, max: 63 },
      idn: true,
    },
    transfer: {
      supported: true,
      authorization: "required",
      authorizationFormat: "dns_belgium_5x3",
      authorizationValidityDays: 7,
      completion: "realtime",
      confirmation: commonCapability.registration.confirmation,
      validRegistrantPhoneRequired: false,
      preservesRenewalDate: true,
    },
    verification: {
      ...commonCapability.verification,
      requirement: "conditional_registry_risk_check",
    },
    restoration: {
      supported: true,
      providerWindowDays: 40,
      registryQuarantineDays: 40,
      mode: "provider_restore",
      ordinaryCheckout: false,
    },
    evidence: {
      reviewedAt: "2026-07-27T00:00:00.000Z",
      providerPolicyUrl: "https://www.openprovider.com/domains/tlds/be",
      registryPolicyUrl: "https://docs.dnsbelgium.be/be/general/registrantverification.html",
    },
  },
] as const

const deepFreeze = <T extends object>(value: T): Readonly<T> => {
  for (const entry of Object.values(value)) {
    if (entry && typeof entry === "object") deepFreeze(entry)
  }
  return Object.freeze(value)
}

export const TLD_CAPABILITY_CATALOG = deepFreeze(
  tldCapabilityCatalogSchema.parse(catalogInput),
)

const normalizedTld = (value: string): string => value.trim().toLowerCase().replace(/^\./, "")

const validEffectiveDate = (value: string | Date): Date => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("TLD capability effective date is invalid.")
  return date
}

export function tldCapabilityAt(
  tld: string,
  effectiveAt: string | Date = new Date(),
): TldCapability | null {
  const normalized = normalizedTld(tld)
  const at = validEffectiveDate(effectiveAt).getTime()
  const matches = TLD_CAPABILITY_CATALOG.filter((capability) =>
    capability.tld === normalized &&
    new Date(capability.effectiveFrom).getTime() <= at &&
    (!capability.effectiveUntil || at < new Date(capability.effectiveUntil).getTime()))
  if (matches.length > 1) {
    throw new Error(`Overlapping TLD capabilities are active for .${normalized}.`)
  }
  return matches[0] ?? null
}

export function getEnabledTldCapability(
  tld: string,
  effectiveAt: string | Date = new Date(),
): TldCapability | null {
  const capability = tldCapabilityAt(tld, effectiveAt)
  return capability?.productionEnabled ? capability : null
}

export function getTldCapabilityByVersion(
  capabilityVersion: string,
): TldCapability | null {
  const matches = TLD_CAPABILITY_CATALOG.filter(
    (capability) => capability.capabilityVersion === capabilityVersion,
  )
  if (matches.length > 1) {
    throw new Error(`Duplicate TLD capability version: ${capabilityVersion}`)
  }
  return matches[0] ?? null
}

export function enabledTldCapabilitiesAt(
  effectiveAt: string | Date = new Date(),
): TldCapability[] {
  const at = validEffectiveDate(effectiveAt)
  return [...new Set(TLD_CAPABILITY_CATALOG.map((entry) => entry.tld))]
    .map((tld) => getEnabledTldCapability(tld, at))
    .filter((capability): capability is TldCapability => capability !== null)
    .sort((left, right) => left.tld.localeCompare(right.tld))
}

export function validateTldTransferAuthorization(
  capability: TldCapability,
  authorization: string,
): boolean {
  const value = authorization.trim()
  if (!value) return false
  if (capability.transfer.authorizationFormat === "dns_belgium_5x3") {
    return /^\d{3}(?:-\d{3}){4}$/.test(value)
  }
  return value.length <= 255
}

export function validateTldRegistrationLabel(
  capability: TldCapability,
  label: string,
): boolean {
  const normalized = label.trim().toLowerCase()
  if (
    normalized.length < capability.registration.labelLength.min ||
    normalized.length > capability.registration.labelLength.max ||
    normalized.includes(".") ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
  ) {
    return false
  }
  return capability.registration.idn || !normalized.startsWith("xn--")
}
