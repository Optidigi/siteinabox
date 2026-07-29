import { z } from "zod"

export const LEGACY_ASSISTED_MIGRATION_CATALOG_VERSION = "2026-07-26.1" as const
export const COMMERCIAL_CATALOG_VERSION = "2026-07-29.1" as const
export const COMMERCIAL_CATALOG_CURRENCY = "EUR" as const
export const DUTCH_VAT_RATE_BASIS_POINTS = 2_100 as const
export const BILLING_GRACE_DAYS = 14 as const
export const BILLING_UPCOMING_CHARGE_REMINDER_DAYS = Object.freeze([7] as const)
export const BILLING_DUNNING_OFFSETS_DAYS = Object.freeze([0, 3, 7, 13] as const)
export const DOMAIN_RENEWAL_REMINDER_OFFSETS_DAYS = Object.freeze([90, 60, 30, 14, 7, 1] as const)
export const NL_OPENPROVIDER_SAFE_CUTOFF_LEAD_DAYS = 2 as const

export type CommercialCatalog = {
  readonly schemaVersion: 1
  readonly catalogVersion: string
  readonly audience: "business_professional_only"
  readonly currency: "EUR"
  readonly vat: {
    readonly jurisdiction: "NL"
    readonly rateBasisPoints: number
  }
  readonly subscriptions: {
    readonly monthly: {
      readonly code: string
      readonly billingPeriod: "monthly"
      readonly netAmountMinor: number
    }
    readonly annual: {
      readonly code: string
      readonly billingPeriod: "annual"
      readonly netAmountMinor: number
    }
  }
  readonly domain: {
    readonly registrant: "customer"
    readonly siteinaboxContactRoles: readonly ["administrative", "technical", "billing"]
    readonly includedOperations: readonly ["registration", "transfer", "renewal"]
    readonly includedAllowanceNetMinor: number
    readonly surchargeFormula: "max(provider_operation_price_net_minor - included_allowance_net_minor, 0)"
  }
  readonly migrations: {
    readonly automatic: {
      readonly netAmountMinor: number
      readonly checkout: "ordinary"
      readonly expectedOperatorTechnicalAction: false
    }
    readonly assisted_standard: {
      readonly netAmountMinor: number
      readonly checkout: "ordinary" | "historical_only"
      readonly expectedOperatorTechnicalAction: true
      readonly unit: "per_domain"
    }
    readonly complex: {
      readonly netAmountMinor: null
      readonly checkout: "custom_quote_only" | "unavailable"
      readonly expectedOperatorTechnicalAction: true
    }
  }
}

const catalogBase = {
  schemaVersion: 1,
  audience: "business_professional_only",
  currency: COMMERCIAL_CATALOG_CURRENCY,
  vat: Object.freeze({
    jurisdiction: "NL",
    rateBasisPoints: DUTCH_VAT_RATE_BASIS_POINTS,
  }),
  subscriptions: Object.freeze({
    monthly: Object.freeze({
      code: "siteinabox-monthly",
      billingPeriod: "monthly",
      netAmountMinor: 1_900,
    }),
    annual: Object.freeze({
      code: "siteinabox-annual",
      billingPeriod: "annual",
      netAmountMinor: 19_000,
    }),
  }),
  domain: Object.freeze({
    registrant: "customer",
    siteinaboxContactRoles: Object.freeze(["administrative", "technical", "billing"] as const),
    includedOperations: Object.freeze(["registration", "transfer", "renewal"] as const),
    includedAllowanceNetMinor: 1_000,
    surchargeFormula: "max(provider_operation_price_net_minor - included_allowance_net_minor, 0)",
  }),
} as const

export const LEGACY_ASSISTED_MIGRATION_CATALOG = Object.freeze({
  ...catalogBase,
  catalogVersion: LEGACY_ASSISTED_MIGRATION_CATALOG_VERSION,
  migrations: Object.freeze({
    automatic: Object.freeze({
      netAmountMinor: 0,
      checkout: "ordinary",
      expectedOperatorTechnicalAction: false,
    }),
    assisted_standard: Object.freeze({
      netAmountMinor: 4_900,
      checkout: "ordinary",
      expectedOperatorTechnicalAction: true,
      unit: "per_domain",
    }),
    complex: Object.freeze({
      netAmountMinor: null,
      checkout: "custom_quote_only",
      expectedOperatorTechnicalAction: true,
    }),
  }),
}) satisfies CommercialCatalog

export const COMMERCIAL_CATALOG = Object.freeze({
  ...catalogBase,
  catalogVersion: COMMERCIAL_CATALOG_VERSION,
  migrations: Object.freeze({
    automatic: Object.freeze({
      netAmountMinor: 0,
      checkout: "ordinary",
      expectedOperatorTechnicalAction: false,
    }),
    assisted_standard: Object.freeze({
      netAmountMinor: 0,
      checkout: "historical_only",
      expectedOperatorTechnicalAction: true,
      unit: "per_domain",
    }),
    complex: Object.freeze({
      netAmountMinor: null,
      checkout: "unavailable",
      expectedOperatorTechnicalAction: true,
    }),
  }),
}) satisfies CommercialCatalog

export const COMMERCIAL_CATALOGS = Object.freeze([
  LEGACY_ASSISTED_MIGRATION_CATALOG,
  COMMERCIAL_CATALOG,
])

export function getCommercialCatalog(
  version: string = COMMERCIAL_CATALOG_VERSION,
): CommercialCatalog {
  const catalog = COMMERCIAL_CATALOGS.find((entry) => entry.catalogVersion === version)
  if (!catalog) throw new Error(`Unknown commercial catalog: ${version}`)
  return catalog
}

export const ACCEPTED_ORDER_EVIDENCE_POLICY = Object.freeze({
  mutation: "append_only",
  frozenFields: Object.freeze([
    "catalogVersion",
    "quoteEvidence",
    "netLineItems",
    "vatRate",
    "vatAmount",
    "grossAmount",
    "contractingPartyProfileVersion",
    "termsVersion",
    "privacyVersion",
    "businessUseDeclarationVersion",
    "acceptedAt",
    "ipAddress",
    "userAgent",
  ] as const),
})

export type CommercialAmount = {
  currency: "EUR"
  netAmountMinor: number
  vatAmountMinor: number
  grossAmountMinor: number
}

const requireMinorAmount = (value: number, field: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer in minor currency units.`)
  }
}

export function calculateDutchVatMinor(netAmountMinor: number): number {
  requireMinorAmount(netAmountMinor, "netAmountMinor")
  return Math.round((netAmountMinor * DUTCH_VAT_RATE_BASIS_POINTS) / 10_000)
}

export function commercialAmountFromNet(netAmountMinor: number): CommercialAmount {
  const vatAmountMinor = calculateDutchVatMinor(netAmountMinor)
  return {
    currency: COMMERCIAL_CATALOG_CURRENCY,
    netAmountMinor,
    vatAmountMinor,
    grossAmountMinor: netAmountMinor + vatAmountMinor,
  }
}

export const commercialAmountSchema = z.object({
  currency: z.literal(COMMERCIAL_CATALOG_CURRENCY),
  netAmountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  vatAmountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  grossAmountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict().superRefine((amount, ctx) => {
  const expectedVat = calculateDutchVatMinor(amount.netAmountMinor)
  if (amount.vatAmountMinor !== expectedVat) {
    ctx.addIssue({
      code: "custom",
      path: ["vatAmountMinor"],
      message: "VAT must equal the catalog Dutch VAT calculation.",
    })
  }
  if (amount.grossAmountMinor !== amount.netAmountMinor + amount.vatAmountMinor) {
    ctx.addIssue({
      code: "custom",
      path: ["grossAmountMinor"],
      message: "Gross amount must equal net amount plus VAT.",
    })
  }
})

export function calculateDomainSurchargeNetMinor(providerOperationPriceNetMinor: number): number {
  requireMinorAmount(providerOperationPriceNetMinor, "providerOperationPriceNetMinor")
  return Math.max(
    providerOperationPriceNetMinor - COMMERCIAL_CATALOG.domain.includedAllowanceNetMinor,
    0,
  )
}

const validDate = (value: string | Date, field: string): Date => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid date.`)
  return date
}

export function addBillingPeriod(
  startsAt: string | Date,
  billingPeriod: "monthly" | "annual",
): string {
  const date = validDate(startsAt, "startsAt")
  const day = date.getUTCDate()
  date.setUTCDate(1)
  if (billingPeriod === "annual") date.setUTCFullYear(date.getUTCFullYear() + 1)
  else date.setUTCMonth(date.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    0,
  )).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.toISOString()
}

export function billingGraceEndsAt(dueAt: string | Date): string {
  const date = validDate(dueAt, "dueAt")
  date.setUTCDate(date.getUTCDate() + BILLING_GRACE_DAYS)
  return date.toISOString()
}

export type BillingDunningStage =
  | "not_due"
  | "due"
  | "retry_3d"
  | "retry_7d"
  | "retry_13d"
  | "suspend"

export function billingDunningStage(
  dueAt: string | Date,
  now: string | Date,
): BillingDunningStage {
  const due = validDate(dueAt, "dueAt").getTime()
  const current = validDate(now, "now").getTime()
  if (current < due) return "not_due"
  const elapsedDays = Math.floor((current - due) / (24 * 60 * 60_000))
  if (elapsedDays >= BILLING_GRACE_DAYS) return "suspend"
  if (elapsedDays >= 13) return "retry_13d"
  if (elapsedDays >= 7) return "retry_7d"
  if (elapsedDays >= 3) return "retry_3d"
  return "due"
}

export function providerSafeCutoffAt(
  renewalDate: string | Date,
  leadDays: number,
): string {
  if (!Number.isSafeInteger(leadDays) || leadDays < 0) {
    throw new Error("leadDays must be a non-negative safe integer.")
  }
  const date = validDate(renewalDate, "renewalDate")
  date.setUTCDate(date.getUTCDate() - leadDays)
  return date.toISOString()
}

export const providerRenewalModes = ["provider_autorenew", "explicit_renew"] as const
export const providerRenewalModeSchema = z.enum(providerRenewalModes)
export type ProviderRenewalMode = z.infer<typeof providerRenewalModeSchema>

export function assertExclusiveProviderRenewalExecution(input: {
  mode: ProviderRenewalMode
  providerAutorenewEnabled: boolean
  explicitRenewalRequested: boolean
}): void {
  if (input.providerAutorenewEnabled && input.explicitRenewalRequested) {
    throw new Error("A renewal cycle cannot use provider autorenew and explicit renewal together.")
  }
  if (input.mode === "provider_autorenew" && input.explicitRenewalRequested) {
    throw new Error("An autorenew cycle cannot request explicit provider renewal.")
  }
  if (input.mode === "explicit_renew" && input.providerAutorenewEnabled) {
    throw new Error("An explicit renewal cycle requires provider autorenew to be off.")
  }
}

export const renewalFinancialCoverageStates = [
  "uncovered",
  "included_allowance",
  "payment_pending",
  "payment_secured",
  "provider_committed",
  "covered",
] as const
export const renewalFinancialCoverageStateSchema = z.enum(renewalFinancialCoverageStates)
export type RenewalFinancialCoverageState = z.infer<typeof renewalFinancialCoverageStateSchema>

export function renewalFinancialCoverage(
  providerOperationPriceNetMinor: number,
): {
  providerOperationPriceNetMinor: number
  includedAllowanceNetMinor: number
  surchargeNetMinor: number
  initialState: Extract<RenewalFinancialCoverageState, "included_allowance" | "uncovered">
} {
  requireMinorAmount(providerOperationPriceNetMinor, "providerOperationPriceNetMinor")
  const surchargeNetMinor = calculateDomainSurchargeNetMinor(providerOperationPriceNetMinor)
  return {
    providerOperationPriceNetMinor,
    includedAllowanceNetMinor: COMMERCIAL_CATALOG.domain.includedAllowanceNetMinor,
    surchargeNetMinor,
    initialState: surchargeNetMinor === 0 ? "included_allowance" : "uncovered",
  }
}

export const contractingPartyTypes = [
  "registered_business",
  "business_in_formation",
] as const

export const contractingPartyTypeSchema = z.enum(contractingPartyTypes)
export const commercialCatalogVersionSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}\.\d+$/,
  "Use a governed commercial catalog version.",
)

const kvkNumberSchema = z.string().regex(/^\d{8}$/, "KVK number must contain exactly eight digits.")
const optionalTradingNameSchema = z.string().trim().min(1).max(200).nullable().optional()

export const contractingPartyClassificationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("registered_business"),
    kvkNumber: kvkNumberSchema,
    domainRegistrantSource: z.literal("contracting_party"),
  }).strict(),
  z.object({
    type: z.literal("business_in_formation"),
    kvkNumber: z.null(),
    contractingPartyKind: z.literal("natural_person"),
    domainRegistrantSource: z.literal("contracting_party"),
    intendedCompanyName: optionalTradingNameSchema,
  }).strict(),
])

export type ContractingPartyType = z.infer<typeof contractingPartyTypeSchema>
export type ContractingPartyClassification = z.infer<typeof contractingPartyClassificationSchema>

export const businessUseDeclarationAcceptanceSchema = z.object({
  declarationVersion: z.string().regex(
    /^business-use-declaration-\d{4}-\d{2}-\d{2}\.\d+$/,
    "Use the governed business-use declaration version.",
  ),
  accepted: z.literal(true),
}).strict()

export type BusinessUseDeclarationAcceptance = z.infer<typeof businessUseDeclarationAcceptanceSchema>

export const commercialContractSelectionSchema = z.object({
  catalogVersion: commercialCatalogVersionSchema,
  contractingParty: contractingPartyClassificationSchema,
  businessUseDeclaration: businessUseDeclarationAcceptanceSchema,
}).strict()

export type CommercialContractSelection = z.infer<typeof commercialContractSelectionSchema>

export const migrationClassifications = [
  "automatic",
  "assisted_standard",
  "complex",
] as const

export const migrationClassificationSchema = z.enum(migrationClassifications)
export type MigrationClassification = z.infer<typeof migrationClassificationSchema>

export function migrationClassificationAvailableForCheckout(
  classification: MigrationClassification,
  catalogVersion: string = COMMERCIAL_CATALOG_VERSION,
): boolean {
  const migration = getCommercialCatalog(catalogVersion).migrations[classification]
  return migration.checkout === "ordinary"
}

export const migrationCustomerActions = [
  "provide_epp_code",
  "authorize_provider",
  "upload_complete_zone",
  "confirm_transfer",
  "verify_registrant",
  "remove_dnssec_ds",
] as const

export const migrationCustomerActionSchema = z.enum(migrationCustomerActions)
export type MigrationCustomerAction = z.infer<typeof migrationCustomerActionSchema>

export const MIGRATION_CUSTOMER_ACTION_FEES_NET_MINOR = Object.freeze({
  provide_epp_code: 0,
  authorize_provider: 0,
  upload_complete_zone: 0,
  confirm_transfer: 0,
  verify_registrant: 0,
  remove_dnssec_ds: 0,
}) satisfies Readonly<Record<MigrationCustomerAction, 0>>

export type MigrationAssessment = {
  supported: boolean
  expectedSiteinaboxOperatorTechnicalAction: boolean
}

export function classifyMigration(assessment: MigrationAssessment): MigrationClassification {
  if (!assessment.supported) return "complex"
  return assessment.expectedSiteinaboxOperatorTechnicalAction
    ? "assisted_standard"
    : "automatic"
}

export type MigrationWorkCause = "customer_migration" | "siteinabox_incident_recovery"

export const ASSISTED_STANDARD_MIGRATION_LINE_ITEM_CODE =
  "migration-assisted-standard-per-domain" as const

export const migrationOperatorAuthorizationStates = [
  "not_required",
  "awaiting_customer_acceptance",
  "awaiting_payment",
  "paid_authorized",
  "non_billable_incident_authorized",
  "custom_quote_required",
] as const
export const migrationOperatorAuthorizationStateSchema = z.enum(
  migrationOperatorAuthorizationStates,
)
export type MigrationOperatorAuthorizationState = z.infer<
  typeof migrationOperatorAuthorizationStateSchema
>

export type MigrationOperatorAuthorizationRequirement =
  | "none"
  | "originating_order_payment"
  | "supplemental_order_payment"
  | "non_billable_incident_authorization"
  | "custom_quote"

export function migrationOperatorAuthorizationRequirement(input: {
  acceptedClassification: MigrationClassification
  requestedClassification: MigrationClassification
  workCause: MigrationWorkCause
}): MigrationOperatorAuthorizationRequirement {
  if (input.workCause === "siteinabox_incident_recovery") {
    return "non_billable_incident_authorization"
  }
  if (input.requestedClassification === "complex") return "custom_quote"
  if (input.acceptedClassification === "assisted_standard") {
    return "originating_order_payment"
  }
  if (input.requestedClassification === "assisted_standard") {
    return "supplemental_order_payment"
  }
  return "none"
}

export const assistedMigrationSupplementalEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("migration_assisted_standard_supplemental"),
  migrationId: z.union([z.string().trim().min(1), z.number().int().positive()]),
  originatingOrderId: z.union([z.string().trim().min(1), z.number().int().positive()]),
  catalogVersion: commercialCatalogVersionSchema,
  classification: z.literal("assisted_standard"),
  workCause: z.literal("customer_migration"),
  workScope: z.string().trim().min(1).max(2_000),
  domain: z.string().trim().toLowerCase().min(3).max(253),
  unit: z.literal("per_domain"),
  quantity: z.literal(1),
  lineItemCode: z.literal(ASSISTED_STANDARD_MIGRATION_LINE_ITEM_CODE),
  amount: commercialAmountSchema,
  acceptedAt: z.iso.datetime(),
}).strict().superRefine((evidence, ctx) => {
  let catalog: CommercialCatalog
  try {
    catalog = getCommercialCatalog(evidence.catalogVersion)
  } catch {
    ctx.addIssue({
      code: "custom",
      path: ["catalogVersion"],
      message: "Supplemental evidence references an unknown commercial catalog.",
    })
    return
  }
  if (
    evidence.catalogVersion !== LEGACY_ASSISTED_MIGRATION_CATALOG_VERSION ||
    catalog.migrations.assisted_standard.checkout !== "ordinary"
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["catalogVersion"],
      message: "Supplemental assisted-migration evidence is historical-only.",
    })
    return
  }
  const expected = commercialAmountFromNet(
    catalog.migrations.assisted_standard.netAmountMinor,
  )
  if (
    evidence.amount.currency !== expected.currency ||
    evidence.amount.netAmountMinor !== expected.netAmountMinor ||
    evidence.amount.vatAmountMinor !== expected.vatAmountMinor ||
    evidence.amount.grossAmountMinor !== expected.grossAmountMinor
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["amount"],
      message: "Supplemental assisted-migration evidence must use the frozen catalog fee.",
    })
  }
})

export type AssistedMigrationSupplementalEvidence = z.infer<
  typeof assistedMigrationSupplementalEvidenceSchema
>

export function migrationChargeNetMinor(
  classification: MigrationClassification,
  cause: MigrationWorkCause = "customer_migration",
  catalogVersion: string = COMMERCIAL_CATALOG_VERSION,
): number | null {
  if (cause === "siteinabox_incident_recovery") return 0
  const catalog = getCommercialCatalog(catalogVersion)
  if (
    classification === "assisted_standard" &&
    catalog.migrations.assisted_standard.checkout !== "ordinary"
  ) {
    return null
  }
  return catalog.migrations[classification].netAmountMinor
}

export type MigrationScopeDecision =
  | "proceed_accepted_scope"
  | "proceed_non_billable_incident_recovery"
  | "stop_for_automated_recovery"
  | "stop_for_custom_quote"

export function decideMigrationScope(input: {
  acceptedClassification: MigrationClassification
  unexpectedOperatorTechnicalAction: boolean
  workCause: MigrationWorkCause
}): MigrationScopeDecision {
  if (input.acceptedClassification === "complex") return "stop_for_custom_quote"
  if (!input.unexpectedOperatorTechnicalAction) return "proceed_accepted_scope"
  if (input.workCause === "siteinabox_incident_recovery") {
    return "proceed_non_billable_incident_recovery"
  }
  if (input.acceptedClassification === "automatic") return "stop_for_automated_recovery"
  return "proceed_accepted_scope"
}

type TransitionMap<State extends string> = Readonly<Record<State, readonly State[]>>

export const orderStates = [
  "draft",
  "accepted",
  "fulfillment_pending",
  "fulfilled",
  "exception",
  "cancelled",
] as const
export const orderStateSchema = z.enum(orderStates)
export type OrderState = z.infer<typeof orderStateSchema>
export const orderStateTransitions = {
  draft: ["accepted", "cancelled"],
  accepted: ["fulfillment_pending", "cancelled"],
  fulfillment_pending: ["fulfilled", "exception"],
  fulfilled: [],
  exception: ["fulfillment_pending", "cancelled"],
  cancelled: [],
} as const satisfies TransitionMap<OrderState>

export const paymentAttemptStates = [
  "created",
  "pending_provider",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "refund_pending",
  "partially_refunded",
  "refunded",
  "refund_failed",
  "chargeback",
] as const
export const paymentAttemptStateSchema = z.enum(paymentAttemptStates)
export type PaymentAttemptState = z.infer<typeof paymentAttemptStateSchema>
export const paymentAttemptStateTransitions = {
  created: ["pending_provider", "failed", "cancelled"],
  pending_provider: ["authorized", "paid", "failed", "cancelled", "expired"],
  authorized: ["paid", "failed", "cancelled", "expired"],
  paid: ["refund_pending", "chargeback"],
  failed: [],
  cancelled: [],
  expired: [],
  refund_pending: ["partially_refunded", "refunded", "refund_failed", "chargeback"],
  partially_refunded: ["refund_pending", "refunded", "chargeback"],
  refunded: ["chargeback"],
  refund_failed: ["refund_pending", "chargeback"],
  chargeback: [],
} as const satisfies TransitionMap<PaymentAttemptState>

export const billingAgreementStates = [
  "pending_first_payment",
  "mandate_pending",
  "active",
  "past_due",
  "suspended",
  "cancellation_scheduled",
  "cancelled",
] as const
export const billingAgreementStateSchema = z.enum(billingAgreementStates)
export type BillingAgreementState = z.infer<typeof billingAgreementStateSchema>
export const billingAgreementStateTransitions = {
  pending_first_payment: ["mandate_pending", "cancelled"],
  mandate_pending: ["active", "past_due", "cancelled"],
  active: ["past_due", "cancellation_scheduled"],
  past_due: ["active", "suspended", "cancellation_scheduled", "cancelled"],
  suspended: ["active", "cancellation_scheduled", "cancelled"],
  cancellation_scheduled: ["active", "past_due", "cancelled"],
  cancelled: [],
} as const satisfies TransitionMap<BillingAgreementState>

export const managedDomainStates = [
  "pending",
  "registration_pending",
  "transfer_pending",
  "active",
  "renewal_pending",
  "provider_hold",
  "expired",
  "manual_review",
] as const
export const managedDomainStateSchema = z.enum(managedDomainStates)
export type ManagedDomainState = z.infer<typeof managedDomainStateSchema>
export const managedDomainStateTransitions = {
  pending: ["registration_pending", "transfer_pending", "manual_review"],
  registration_pending: ["active", "manual_review"],
  transfer_pending: ["active", "manual_review"],
  active: ["renewal_pending", "provider_hold", "expired", "manual_review"],
  renewal_pending: ["active", "provider_hold", "expired", "manual_review"],
  provider_hold: ["active", "expired", "manual_review"],
  expired: ["active", "manual_review"],
  manual_review: ["registration_pending", "transfer_pending", "active", "renewal_pending", "provider_hold", "expired"],
} as const satisfies TransitionMap<ManagedDomainState>

export const managedDomainCustodyStates = [
  "managed",
  "offboarding_requested",
  "transfer_code_ready",
  "transfer_pending",
  "transferred_out",
  "manual_review",
] as const
export const managedDomainCustodyStateSchema = z.enum(managedDomainCustodyStates)
export type ManagedDomainCustodyState = z.infer<typeof managedDomainCustodyStateSchema>
export const managedDomainCustodyStateTransitions = {
  managed: ["offboarding_requested"],
  offboarding_requested: ["transfer_code_ready", "manual_review"],
  transfer_code_ready: ["transfer_pending", "manual_review"],
  transfer_pending: ["transferred_out", "manual_review"],
  transferred_out: [],
  manual_review: ["offboarding_requested", "transfer_code_ready", "transfer_pending"],
} as const satisfies TransitionMap<ManagedDomainCustodyState>

const domainOffboardingContinuityEvidenceFields = {
  domain: z.string().trim().toLowerCase().min(3).max(253),
  capturedAt: z.iso.datetime(),
  authoritativeNameservers: z.array(z.string().trim().toLowerCase().min(1)).min(2),
  zoneSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  mailRecordSetHash: z.string().regex(/^[a-f0-9]{64}$/),
  serviceRecordSetHash: z.string().regex(/^[a-f0-9]{64}$/),
  preservationMode: z.literal("retain_existing_dns_and_mail"),
} as const

const domainOffboardingContinuityEvidenceV1Schema = z.object({
  schemaVersion: z.literal(1),
  ...domainOffboardingContinuityEvidenceFields,
  dnssecStatus: z.enum(["unsigned", "signed", "unknown"]),
}).strict()

const domainOffboardingContinuityEvidenceV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...domainOffboardingContinuityEvidenceFields,
  dnssecStatus: z.enum(["unsigned", "signed"]),
  parentDsRecords: z.array(z.string().trim().min(1).max(1_024)).max(20),
}).strict().superRefine((evidence, context) => {
  if (evidence.dnssecStatus === "signed" && evidence.parentDsRecords.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["parentDsRecords"],
      message: "Signed DNSSEC evidence requires the observed parent DS records.",
    })
  }
  if (evidence.dnssecStatus === "unsigned" && evidence.parentDsRecords.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["parentDsRecords"],
      message: "Unsigned DNSSEC evidence cannot contain parent DS records.",
    })
  }
})
export const domainOffboardingContinuityEvidenceSchema = z.union([
  domainOffboardingContinuityEvidenceV1Schema,
  domainOffboardingContinuityEvidenceV2Schema,
])
export type DomainOffboardingContinuityEvidence = z.infer<
  typeof domainOffboardingContinuityEvidenceSchema
>

export const commerceReleaseStages = [
  "disabled",
  "shadow",
  "sandbox",
  "production",
] as const
export const commerceReleaseStageSchema = z.enum(commerceReleaseStages)
export type CommerceReleaseStage = z.infer<typeof commerceReleaseStageSchema>

export const COMMERCE_RELEASE_EVIDENCE_VERSION =
  "commerce-production-readiness-2026-07-28.1" as const

export type CommerceReleaseGateDecision = {
  providerReadsAllowed: boolean
  providerWritesAllowed: boolean
  blockers: string[]
}

const providerHostname = (value: string | null): string | null => {
  if (!value) return null
  const authority = /^https:\/\/([^/?#]+)/i.exec(value.trim())?.[1]
  if (!authority || authority.includes("@") || authority.includes(":")) return null
  const hostname = authority.toLowerCase()
  return hostname || null
}

export function evaluateCommerceReleaseGate(input: {
  stage: CommerceReleaseStage
  evidenceVersion: string | null
  providerWritesAcknowledged: boolean
  nodeEnvironment: string | null
  mollieApiKeyMode: "test" | "live" | "unknown" | "missing"
  openproviderApiBaseUrl: string | null
  cloudflareApiBaseUrl: string | null
  productionSecretsConfigured?: boolean
  originIsolationVerified?: boolean
}): CommerceReleaseGateDecision {
  if (input.stage === "disabled") {
    return {
      providerReadsAllowed: false,
      providerWritesAllowed: false,
      blockers: ["commerce_release_disabled"],
    }
  }
  if (input.stage === "shadow") {
    return {
      providerReadsAllowed: true,
      providerWritesAllowed: false,
      blockers: ["commerce_release_shadow_read_only"],
    }
  }
  const blockers: string[] = []
  if (input.evidenceVersion !== COMMERCE_RELEASE_EVIDENCE_VERSION) {
    blockers.push("release_evidence_version_mismatch")
  }
  if (!input.providerWritesAcknowledged) {
    blockers.push("provider_writes_not_acknowledged")
  }
  const openproviderHost = providerHostname(input.openproviderApiBaseUrl)
  const cloudflareHost = providerHostname(input.cloudflareApiBaseUrl)
  if (input.stage === "sandbox") {
    if (input.mollieApiKeyMode !== "test") blockers.push("sandbox_requires_mollie_test_key")
    if (!openproviderHost?.endsWith(".test")) {
      blockers.push("sandbox_requires_reserved_openprovider_host")
    }
    if (!cloudflareHost?.endsWith(".test")) {
      blockers.push("sandbox_requires_reserved_cloudflare_host")
    }
  } else {
    if (input.nodeEnvironment !== "production") blockers.push("production_requires_node_production")
    if (input.mollieApiKeyMode !== "live") blockers.push("production_requires_mollie_live_key")
    if (openproviderHost !== "api.openprovider.eu") {
      blockers.push("production_requires_official_openprovider")
    }
    if (cloudflareHost !== "api.cloudflare.com") {
      blockers.push("production_requires_official_cloudflare")
    }
    if (!input.productionSecretsConfigured) {
      blockers.push("production_provider_or_encryption_prerequisite_missing")
    }
    if (!input.originIsolationVerified) {
      blockers.push("production_origin_isolation_not_verified")
    }
  }
  return {
    providerReadsAllowed: true,
    providerWritesAllowed: blockers.length === 0,
    blockers,
  }
}

export const domainRenewalCycleStates = [
  "scheduled",
  "payment_required",
  "payment_committed",
  "provider_requested",
  "renewed",
  "cancelled",
  "failed",
  "manual_review",
] as const
export const domainRenewalCycleStateSchema = z.enum(domainRenewalCycleStates)
export type DomainRenewalCycleState = z.infer<typeof domainRenewalCycleStateSchema>
export const domainRenewalCycleStateTransitions = {
  scheduled: ["payment_required", "payment_committed", "renewed", "cancelled"],
  payment_required: ["payment_committed", "renewed", "cancelled", "failed", "manual_review"],
  payment_committed: ["provider_requested", "renewed", "manual_review"],
  provider_requested: ["renewed", "failed", "manual_review"],
  renewed: [],
  cancelled: [],
  failed: ["payment_required", "provider_requested", "renewed", "manual_review", "cancelled"],
  manual_review: ["payment_required", "provider_requested", "renewed", "cancelled", "failed"],
} as const satisfies TransitionMap<DomainRenewalCycleState>

export const domainMigrationStates = [
  "assessment",
  "awaiting_customer",
  "ready_to_prepare",
  "preparing",
  "awaiting_provider",
  "ready_for_cutover",
  "cutover_in_progress",
  "verifying",
  "completed",
  "paused_supplemental_order",
  "custom_quote_required",
  "failed",
  "rolled_back",
] as const
export const domainMigrationStateSchema = z.enum(domainMigrationStates)
export type DomainMigrationState = z.infer<typeof domainMigrationStateSchema>
export const domainMigrationStateTransitions = {
  assessment: ["awaiting_customer", "ready_to_prepare", "custom_quote_required"],
  awaiting_customer: ["ready_to_prepare", "custom_quote_required", "failed"],
  ready_to_prepare: ["preparing", "paused_supplemental_order", "custom_quote_required", "failed"],
  preparing: ["awaiting_customer", "awaiting_provider", "ready_for_cutover", "paused_supplemental_order", "custom_quote_required", "failed"],
  awaiting_provider: ["ready_for_cutover", "paused_supplemental_order", "custom_quote_required", "failed"],
  ready_for_cutover: ["awaiting_provider", "cutover_in_progress", "paused_supplemental_order", "custom_quote_required", "failed"],
  cutover_in_progress: ["verifying", "failed", "rolled_back"],
  verifying: ["completed", "failed", "rolled_back"],
  completed: [],
  paused_supplemental_order: ["preparing", "custom_quote_required", "failed"],
  custom_quote_required: [],
  failed: ["awaiting_customer", "ready_to_prepare", "preparing", "rolled_back"],
  rolled_back: ["ready_for_cutover", "failed"],
} as const satisfies TransitionMap<DomainMigrationState>

export const commerceStateMachines = Object.freeze({
  order: Object.freeze({ states: orderStates, transitions: orderStateTransitions }),
  paymentAttempt: Object.freeze({ states: paymentAttemptStates, transitions: paymentAttemptStateTransitions }),
  billingAgreement: Object.freeze({ states: billingAgreementStates, transitions: billingAgreementStateTransitions }),
  managedDomain: Object.freeze({ states: managedDomainStates, transitions: managedDomainStateTransitions }),
  domainRenewalCycle: Object.freeze({ states: domainRenewalCycleStates, transitions: domainRenewalCycleStateTransitions }),
  domainMigration: Object.freeze({ states: domainMigrationStates, transitions: domainMigrationStateTransitions }),
})

export const commerceLifecycleSnapshotSchema = z.object({
  order: orderStateSchema,
  paymentAttempt: paymentAttemptStateSchema.nullable(),
  billingAgreement: billingAgreementStateSchema.nullable(),
  managedDomain: managedDomainStateSchema.nullable(),
  domainRenewalCycle: domainRenewalCycleStateSchema.nullable(),
  domainMigration: domainMigrationStateSchema.nullable(),
}).strict()

export type CommerceLifecycleSnapshot = z.infer<typeof commerceLifecycleSnapshotSchema>

export type RenewalCancellationDecision =
  | "continue_cycle"
  | "cancel_uncovered_cycle"
  | "complete_committed_cycle"

export function decideRenewalCancellation(input: {
  cycleState: DomainRenewalCycleState
  billingAgreementCancelled: boolean
  paymentSecured: boolean
  providerSafeCutoffReached: boolean
}): RenewalCancellationDecision {
  if (
    input.paymentSecured ||
    ["payment_committed", "provider_requested", "renewed"].includes(input.cycleState)
  ) {
    return "complete_committed_cycle"
  }
  if (input.cycleState === "cancelled") return "cancel_uncovered_cycle"
  if (
    input.billingAgreementCancelled ||
    (!input.paymentSecured && input.providerSafeCutoffReached)
  ) {
    return "cancel_uncovered_cycle"
  }
  return "continue_cycle"
}

export const refundScenarios = [
  "payment_not_collected",
  "failed_payment_customer_domain_exists",
  "duplicate_payment",
  "unfulfillable_before_provider_commit",
  "siteinabox_failure_after_provider_commit",
  "customer_cancellation_before_provider_commit",
  "customer_cancellation_after_provider_commit",
  "incident_recovery_migration_fee_charged",
  "automatic_migration_scope_increase",
  "complex_migration",
] as const

export type RefundScenario = (typeof refundScenarios)[number]
export type RefundScope =
  | "none"
  | "full_captured_payment"
  | "duplicate_captured_payment"
  | "migration_service_fee"
  | "manual_review"

export type RefundDecision = {
  readonly scenario: RefundScenario
  readonly refundScope: RefundScope
  readonly automatic: boolean
  readonly acceptedOrderMutation: "forbidden"
  readonly domainDisposition: "unchanged" | "customer_retains"
  readonly committedProviderOperation: "not_applicable" | "complete"
  readonly nextAction:
    | "none"
    | "issue_refund"
    | "manual_review"
    | "cancel_uncovered_cycle"
    | "pause_for_supplemental_order"
    | "stop_before_payment"
}

export const REFUND_DECISION_MATRIX = Object.freeze({
  payment_not_collected: Object.freeze({
    scenario: "payment_not_collected",
    refundScope: "none",
    automatic: true,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "unchanged",
    committedProviderOperation: "not_applicable",
    nextAction: "none",
  }),
  failed_payment_customer_domain_exists: Object.freeze({
    scenario: "failed_payment_customer_domain_exists",
    refundScope: "none",
    automatic: true,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "customer_retains",
    committedProviderOperation: "not_applicable",
    nextAction: "none",
  }),
  duplicate_payment: Object.freeze({
    scenario: "duplicate_payment",
    refundScope: "duplicate_captured_payment",
    automatic: true,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "unchanged",
    committedProviderOperation: "not_applicable",
    nextAction: "issue_refund",
  }),
  unfulfillable_before_provider_commit: Object.freeze({
    scenario: "unfulfillable_before_provider_commit",
    refundScope: "full_captured_payment",
    automatic: true,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "unchanged",
    committedProviderOperation: "not_applicable",
    nextAction: "issue_refund",
  }),
  siteinabox_failure_after_provider_commit: Object.freeze({
    scenario: "siteinabox_failure_after_provider_commit",
    refundScope: "manual_review",
    automatic: false,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "customer_retains",
    committedProviderOperation: "complete",
    nextAction: "manual_review",
  }),
  customer_cancellation_before_provider_commit: Object.freeze({
    scenario: "customer_cancellation_before_provider_commit",
    refundScope: "manual_review",
    automatic: false,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "unchanged",
    committedProviderOperation: "not_applicable",
    nextAction: "cancel_uncovered_cycle",
  }),
  customer_cancellation_after_provider_commit: Object.freeze({
    scenario: "customer_cancellation_after_provider_commit",
    refundScope: "manual_review",
    automatic: false,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "customer_retains",
    committedProviderOperation: "complete",
    nextAction: "manual_review",
  }),
  incident_recovery_migration_fee_charged: Object.freeze({
    scenario: "incident_recovery_migration_fee_charged",
    refundScope: "migration_service_fee",
    automatic: true,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "customer_retains",
    committedProviderOperation: "not_applicable",
    nextAction: "issue_refund",
  }),
  automatic_migration_scope_increase: Object.freeze({
    scenario: "automatic_migration_scope_increase",
    refundScope: "full_captured_payment",
    automatic: true,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "unchanged",
    committedProviderOperation: "not_applicable",
    nextAction: "issue_refund",
  }),
  complex_migration: Object.freeze({
    scenario: "complex_migration",
    refundScope: "none",
    automatic: true,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "unchanged",
    committedProviderOperation: "not_applicable",
    nextAction: "stop_before_payment",
  }),
}) satisfies Readonly<Record<RefundScenario, RefundDecision>>

export function refundDecisionFor(scenario: RefundScenario): RefundDecision {
  return REFUND_DECISION_MATRIX[scenario]
}
