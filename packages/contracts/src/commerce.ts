import { z } from "zod"

export const COMMERCIAL_CATALOG_VERSION = "2026-07-26.1" as const
export const COMMERCIAL_CATALOG_CURRENCY = "EUR" as const
export const DUTCH_VAT_RATE_BASIS_POINTS = 2_100 as const

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
      readonly checkout: "ordinary"
      readonly expectedOperatorTechnicalAction: true
      readonly unit: "per_domain"
    }
    readonly complex: {
      readonly netAmountMinor: null
      readonly checkout: "custom_quote_only"
      readonly expectedOperatorTechnicalAction: true
    }
  }
}

export const COMMERCIAL_CATALOG = Object.freeze({
  schemaVersion: 1,
  catalogVersion: COMMERCIAL_CATALOG_VERSION,
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

export const COMMERCIAL_CATALOGS = Object.freeze([COMMERCIAL_CATALOG])

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

export const migrationCustomerActions = [
  "provide_epp_code",
  "authorize_provider",
  "upload_complete_zone",
  "confirm_transfer",
  "verify_registrant",
] as const

export const migrationCustomerActionSchema = z.enum(migrationCustomerActions)
export type MigrationCustomerAction = z.infer<typeof migrationCustomerActionSchema>

export const MIGRATION_CUSTOMER_ACTION_FEES_NET_MINOR = Object.freeze({
  provide_epp_code: 0,
  authorize_provider: 0,
  upload_complete_zone: 0,
  confirm_transfer: 0,
  verify_registrant: 0,
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

export function migrationChargeNetMinor(
  classification: MigrationClassification,
  cause: MigrationWorkCause = "customer_migration",
): number | null {
  if (cause === "siteinabox_incident_recovery") return 0
  return COMMERCIAL_CATALOG.migrations[classification].netAmountMinor
}

export type MigrationScopeDecision =
  | "proceed_accepted_scope"
  | "proceed_non_billable_incident_recovery"
  | "pause_for_supplemental_order"
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
  if (input.acceptedClassification === "automatic") return "pause_for_supplemental_order"
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
  created: ["pending_provider", "cancelled"],
  pending_provider: ["authorized", "paid", "failed", "cancelled", "expired"],
  authorized: ["paid", "failed", "cancelled", "expired"],
  paid: ["refund_pending", "chargeback"],
  failed: [],
  cancelled: [],
  expired: [],
  refund_pending: ["partially_refunded", "refunded", "refund_failed"],
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
  "cancellation_scheduled",
  "cancelled",
] as const
export const billingAgreementStateSchema = z.enum(billingAgreementStates)
export type BillingAgreementState = z.infer<typeof billingAgreementStateSchema>
export const billingAgreementStateTransitions = {
  pending_first_payment: ["mandate_pending", "cancelled"],
  mandate_pending: ["active", "past_due", "cancelled"],
  active: ["past_due", "cancellation_scheduled"],
  past_due: ["active", "cancellation_scheduled", "cancelled"],
  cancellation_scheduled: ["active", "cancelled"],
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
  scheduled: ["payment_required", "cancelled"],
  payment_required: ["payment_committed", "cancelled", "failed"],
  payment_committed: ["provider_requested"],
  provider_requested: ["renewed", "failed", "manual_review"],
  renewed: [],
  cancelled: [],
  failed: ["payment_required", "provider_requested", "manual_review", "cancelled"],
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
  ready_to_prepare: ["preparing", "paused_supplemental_order", "failed"],
  preparing: ["awaiting_customer", "awaiting_provider", "ready_for_cutover", "paused_supplemental_order", "failed"],
  awaiting_provider: ["ready_for_cutover", "failed"],
  ready_for_cutover: ["cutover_in_progress", "failed"],
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
    refundScope: "none",
    automatic: true,
    acceptedOrderMutation: "forbidden",
    domainDisposition: "customer_retains",
    committedProviderOperation: "not_applicable",
    nextAction: "pause_for_supplemental_order",
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
