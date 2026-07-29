import "server-only"

import {
  ASSISTED_STANDARD_MIGRATION_LINE_ITEM_CODE,
  assistedMigrationSupplementalEvidenceSchema,
  commercialAmountFromNet,
  getCommercialCatalog,
  migrationOperatorAuthorizationRequirement,
  type MigrationClassification,
  type MigrationWorkCause,
} from "@siteinabox/contracts/commerce"
import type { Payload } from "payload"
import type {
  DomainMigration,
  Order,
  PaymentAttempt,
  User,
} from "@/payload-types"

import { findOneDoc } from "@/lib/payloadCollection"
import { queueDomainMigrationPreparation } from "@/lib/jobs/prepareDomainMigrationTask"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"

type OperatorActor = Pick<User, "id" | "email" | "role">

type SupplementalAcceptance = {
  actorEmail: string
  acceptedAt: string
  ipAddress?: string | null
  userAgent?: string | null
}

const numericRelationshipId = (
  value: Parameters<typeof relationshipId>[0],
): number => {
  const id = relationshipId(value)
  const numeric = id == null ? Number.NaN : Number(id)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error("A numeric relationship id is required.")
  }
  return numeric
}

const history = (
  migration: DomainMigration,
  state: DomainMigration["state"],
  at: string,
  reason: string,
) => [
  ...(Array.isArray(migration.stateHistory) ? migration.stateHistory : []),
  { state, at, reason },
]

const updateMigration = async (
  payload: Payload,
  migration: DomainMigration,
  data: Partial<DomainMigration>,
  reason: string,
  now: string,
): Promise<DomainMigration> => {
  if (!migration.updatedAt) {
    throw new Error("Domain migration is missing its concurrency version.")
  }
  const state = data.state ?? migration.state
  const result = await payload.update({
    collection: "domain-migrations",
    where: {
      and: [
        { id: { equals: migration.id } },
        { updatedAt: { equals: migration.updatedAt } },
        { state: { equals: migration.state } },
      ],
    },
    data: {
      ...data,
      updatedAt: now,
      stateHistory: history(migration, state, now, reason),
    },
    depth: 0,
    overrideAccess: true,
    context: { domainMigrationLifecycleMutation: true },
  })
  const updated = Array.isArray(result.docs)
    ? result.docs[0] as DomainMigration | undefined
    : undefined
  if (!updated) {
    throw new Error(
      "Domain migration changed concurrently; reload current operator state.",
    )
  }
  return updated
}

const requireOperator = (actor: OperatorActor): OperatorActor => {
  if (actor.role !== "super-admin" || !actor.id || !actor.email?.trim()) {
    throw new Error("Migration operator work requires an authenticated super-admin.")
  }
  return actor
}

const orderCatalog = (order: Order) => {
  if (!order.catalogVersion) {
    throw new Error("Migration operator authorization requires frozen catalog evidence.")
  }
  return getCommercialCatalog(order.catalogVersion)
}

const requireLegacyAssistedCatalog = (order: Order): void => {
  const catalog = orderCatalog(order)
  if (catalog.migrations.assisted_standard.checkout !== "ordinary") {
    throw new Error(
      "Assisted and supplemental migration work is retired for this commercial catalog.",
    )
  }
}

const lineItemHasAssistedFee = (order: Order): boolean => {
  const catalog = orderCatalog(order)
  const expected = catalog.migrations.assisted_standard.netAmountMinor
  if (!Array.isArray(order.netLineItems)) return false
  const matching = order.netLineItems.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false
    const line = item as Record<string, unknown>
    return line.code === ASSISTED_STANDARD_MIGRATION_LINE_ITEM_CODE &&
      line.quantity === 1 &&
      line.netAmountMinor === expected
  })
  return matching.length === 1
}

const paidAttemptForOrder = async (
  payload: Payload,
  order: Order,
  purpose: "first_payment" | "supplemental",
): Promise<PaymentAttempt> => {
  if (order.paymentStatus !== "paid") {
    throw new Error("Operator work requires a paid authorization order.")
  }
  const result = await payload.find({
    collection: "payment-attempts",
    where: {
      and: [
        { order: { equals: order.id } },
        { purpose: { equals: purpose } },
        { state: { equals: "paid" } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (result.docs.length !== 1) {
    throw new Error("Operator work requires exactly one paid authorization attempt.")
  }
  const attempt = result.docs[0] as PaymentAttempt
  if (!sameRelationshipId(attempt.order, order.id)) {
    throw new Error("Operator-work payment evidence belongs to another order.")
  }
  return attempt
}

const originatingOrder = async (
  payload: Payload,
  migration: DomainMigration,
): Promise<Order> => {
  const orderId = relationshipId(migration.originatingOrder)
  if (!orderId) throw new Error("Domain migration is missing its originating order.")
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as Order
  if (
    !sameRelationshipId(order.tenant, migration.tenant) ||
    order.domain.trim().toLowerCase() !== migration.domainNameAscii
  ) {
    throw new Error("Domain migration and originating order authority do not match.")
  }
  return order
}

const createSupplementalOrder = async (
  payload: Payload,
  migration: DomainMigration,
  workScope: string,
  acceptance: SupplementalAcceptance,
  now: string,
): Promise<Order> => {
  const origin = await originatingOrder(payload, migration)
  requireLegacyAssistedCatalog(origin)
  const normalizedActor = acceptance.actorEmail.trim().toLowerCase()
  if (!normalizedActor || normalizedActor !== origin.customerEmail.trim().toLowerCase()) {
    throw new Error("Supplemental order acceptance must come from the contracting customer.")
  }
  if (acceptance.acceptedAt !== now) {
    throw new Error("Supplemental order acceptance timestamp must match the frozen creation time.")
  }
  const billingCycleKey = `migration-supplemental:${migration.id}:assisted-standard:v1`
  const existing = await findOneDoc(payload, "orders", {
    billingCycleKey: { equals: billingCycleKey },
  })
  if (existing) {
    if (!sameRelationshipId(existing.supplementalForMigration, migration.id)) {
      throw new Error("Supplemental migration order idempotency key belongs to another migration.")
    }
    return existing
  }
  const catalog = orderCatalog(origin)
  const amount = commercialAmountFromNet(
    catalog.migrations.assisted_standard.netAmountMinor,
  )
  const evidence = assistedMigrationSupplementalEvidenceSchema.parse({
    schemaVersion: 1,
    kind: "migration_assisted_standard_supplemental",
    migrationId: migration.id,
    originatingOrderId: origin.id,
    catalogVersion: catalog.catalogVersion,
    classification: "assisted_standard",
    workCause: "customer_migration",
    workScope,
    domain: migration.domainNameAscii,
    unit: "per_domain",
    quantity: 1,
    lineItemCode: ASSISTED_STANDARD_MIGRATION_LINE_ITEM_CODE,
    amount,
    acceptedAt: now,
  })
  const lineItems = [{
    code: ASSISTED_STANDARD_MIGRATION_LINE_ITEM_CODE,
    description: `Standaard begeleide domeinmigratie ${migration.domainNameAscii}`,
    quantity: 1,
    netAmountMinor: amount.netAmountMinor,
  }]
  const legalDocuments = Array.isArray(origin.legalDocuments)
    ? origin.legalDocuments.map(numericRelationshipId)
    : []
  if (legalDocuments.length === 0) {
    throw new Error("Supplemental order requires the originating legal-document evidence.")
  }
  try {
    return await payload.create({
      collection: "orders",
      data: {
        orderNumber: `SIAB-MIG-SUP-${migration.id}-1`,
        tenant: numericRelationshipId(migration.tenant),
        generationRun: numericRelationshipId(origin.generationRun),
        state: "accepted",
        checkoutProfileKey: origin.checkoutProfileKey,
        catalogVersion: catalog.catalogVersion,
        billingCycleKey,
        orderKind: "migration_supplemental",
        parentOrder: numericRelationshipId(origin.id),
        supplementalForMigration: numericRelationshipId(migration.id),
        quoteEvidence: evidence,
        netLineItems: lineItems,
        vatRateBasisPoints: catalog.vat.rateBasisPoints,
        subtotalNetMinor: amount.netAmountMinor,
        vatAmountMinor: amount.vatAmountMinor,
        totalGrossMinor: amount.grossAmountMinor,
        contractingPartyProfileVersion: origin.contractingPartyProfileVersion,
        termsVersion: origin.termsVersion,
        privacyVersion: origin.privacyVersion,
        businessUseDeclarationVersion: origin.businessUseDeclarationVersion,
        acceptedAt: now,
        acceptanceIpAddress: acceptance.ipAddress ?? undefined,
        acceptanceUserAgent: acceptance.userAgent ?? undefined,
        customerName: origin.customerName,
        customerEmail: origin.customerEmail,
        companyName: origin.companyName,
        billingAddress: origin.billingAddress,
        packageCode: ASSISTED_STANDARD_MIGRATION_LINE_ITEM_CODE,
        billingPeriod: "one_time",
        renewalTerms: "Eenmalige begeleide migratiedienst; geen verlenging.",
        lineItems,
        currency: amount.currency,
        subtotalNet: amount.netAmountMinor / 100,
        vatAmount: amount.vatAmountMinor / 100,
        totalGross: amount.grossAmountMinor / 100,
        domain: migration.domainNameAscii,
        domainRegistrant: origin.domainRegistrant,
        legalDocuments,
        paymentStatus: "pending",
        paymentProvider: "mollie",
        createdAt: now,
      },
      depth: 0,
      overrideAccess: true,
    }) as Order
  } catch (error) {
    const raced = await findOneDoc(payload, "orders", {
      billingCycleKey: { equals: billingCycleKey },
    })
    if (raced) return raced
    throw error
  }
}

export async function pauseAcceptedAssistedMigration(
  payload: Payload,
  migration: DomainMigration,
  workScope = "standard_assisted_migration",
  now = new Date().toISOString(),
): Promise<DomainMigration> {
  if (migration.acceptedClassification !== "assisted_standard") return migration
  if (migration.operatorWorkAuthorizationState === "paid_authorized") return migration
  const order = await originatingOrder(payload, migration)
  requireLegacyAssistedCatalog(order)
  if (!lineItemHasAssistedFee(order)) {
    throw new Error("Accepted assisted migration order does not freeze the catalog service fee.")
  }
  const attempt = await paidAttemptForOrder(payload, order, "first_payment")
  return updateMigration(payload, migration, {
    state: "paused_supplemental_order",
    operatorWorkClassification: "assisted_standard",
    operatorWorkCause: "customer_migration",
    operatorWorkScope: workScope,
    operatorWorkAuthorizationState: "paid_authorized",
    operatorWorkAuthorizationOrder: order.id,
    operatorWorkAuthorizationPaymentAttempt: attempt.id,
    operatorWorkAuthorizedAt: attempt.paidAt ?? now,
    reconciliationRequired: false,
    failureReason: null,
  }, "accepted_assisted_operator_work_paid", now)
}

export async function proposeMigrationOperatorWork(
  _payload: Payload,
  _input: {
    migrationId: string | number
    workScope: string
    now?: string
  },
): Promise<DomainMigration> {
  throw new Error(
    "Customer-billable migration work is retired; use automated recovery or rollback.",
  )
}

export async function requestMigrationOperatorWork(
  payload: Payload,
  input: {
    migrationId: string | number
    requestedClassification: Extract<MigrationClassification, "assisted_standard" | "complex">
    workCause: MigrationWorkCause
    workScope: string
    supplementalAcceptance?: SupplementalAcceptance
    now?: string
  },
): Promise<{ migration: DomainMigration; supplementalOrder: Order | null }> {
  const now = input.now ?? new Date().toISOString()
  const workScope = input.workScope.trim()
  if (!workScope) throw new Error("Operator work requires a bounded scope.")
  if (input.workCause === "customer_migration") {
    throw new Error(
      "Customer-billable migration work is retired; use automated recovery or rollback.",
    )
  }
  let migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  const origin = await originatingOrder(payload, migration)
  void orderCatalog(origin)
  if (![
    "ready_to_prepare",
    "preparing",
    "awaiting_provider",
    "ready_for_cutover",
    "paused_supplemental_order",
  ].includes(migration.state)) {
    throw new Error(
      "Operator-work scope can change only after customer inputs and before cutover.",
    )
  }
  const requirement = migrationOperatorAuthorizationRequirement({
    acceptedClassification: migration.acceptedClassification,
    requestedClassification: input.requestedClassification,
    workCause: input.workCause,
  })
  if (requirement === "custom_quote") {
    migration = await updateMigration(payload, migration, {
      state: "custom_quote_required",
      operatorWorkClassification: "complex",
      operatorWorkCause: input.workCause,
      operatorWorkScope: workScope,
      operatorWorkAuthorizationState: "custom_quote_required",
      encryptedTransferCode: null,
      transferCodeDeletedAt: now,
      reconciliationRequired: false,
      failureReason: "complex_migration_requires_custom_quote",
    }, "complex_migration_stopped_before_payment", now)
    return { migration, supplementalOrder: null }
  }
  if (requirement === "non_billable_incident_authorization") {
    migration = await updateMigration(payload, migration, {
      state: "paused_supplemental_order",
      operatorWorkClassification: "assisted_standard",
      operatorWorkCause: "siteinabox_incident_recovery",
      operatorWorkScope: workScope,
      operatorWorkAuthorizationState: "non_billable_incident_authorized",
      operatorWorkAuthorizedAt: now,
      reconciliationRequired: false,
      failureReason: null,
    }, "siteinabox_incident_recovery_non_billable", now)
    return { migration, supplementalOrder: null }
  }
  if (requirement === "originating_order_payment") {
    migration = await pauseAcceptedAssistedMigration(payload, migration, workScope, now)
    return { migration, supplementalOrder: null }
  }
  if (requirement !== "supplemental_order_payment") {
    throw new Error("Automatic migration scope does not justify operator work.")
  }
  if (!input.supplementalAcceptance) {
    throw new Error("Unexpected billable operator work requires customer acceptance.")
  }
  if (
    migration.operatorWorkAuthorizationState !== "awaiting_customer_acceptance" ||
    migration.operatorWorkScope !== workScope
  ) {
    throw new Error("Supplemental acceptance does not match the frozen operator proposal.")
  }
  const supplementalOrder = await createSupplementalOrder(
    payload,
    migration,
    workScope,
    input.supplementalAcceptance,
    now,
  )
  migration = await updateMigration(payload, migration, {
    state: "paused_supplemental_order",
    supplementalOrder: supplementalOrder.id,
    operatorWorkClassification: "assisted_standard",
    operatorWorkCause: "customer_migration",
    operatorWorkScope: workScope,
    operatorWorkAuthorizationState: "awaiting_payment",
    operatorWorkAuthorizationOrder: supplementalOrder.id,
    reconciliationRequired: false,
    failureReason: null,
  }, "unexpected_operator_work_supplemental_order_created", now)
  return { migration, supplementalOrder }
}

export async function authorizeMigrationOperatorWorkFromPayment(
  payload: Payload,
  order: Order,
  attempt: PaymentAttempt,
  now = new Date().toISOString(),
): Promise<DomainMigration> {
  if (
    order.orderKind !== "migration_supplemental" ||
    attempt.purpose !== "supplemental" ||
    attempt.state !== "paid" ||
    order.paymentStatus !== "paid"
  ) {
    throw new Error("Supplemental operator authorization requires a paid supplemental attempt.")
  }
  const migrationId = relationshipId(order.supplementalForMigration)
  if (!migrationId) throw new Error("Supplemental order is not linked to a migration.")
  let migration = await payload.findByID({
    collection: "domain-migrations",
    id: migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (
    migration.operatorWorkAuthorizationState === "paid_authorized" &&
    sameRelationshipId(migration.operatorWorkAuthorizationOrder, order.id) &&
    sameRelationshipId(migration.operatorWorkAuthorizationPaymentAttempt, attempt.id)
  ) {
    return migration
  }
  if (
    !sameRelationshipId(migration.supplementalOrder, order.id) ||
    !sameRelationshipId(migration.tenant, order.tenant) ||
    !sameRelationshipId(migration.originatingOrder, order.parentOrder) ||
    migration.operatorWorkCause !== "customer_migration" ||
    migration.operatorWorkAuthorizationState !== "awaiting_payment"
  ) {
    throw new Error("Supplemental payment does not match the paused migration authority.")
  }
  if (!lineItemHasAssistedFee(order)) {
    throw new Error("Supplemental order does not freeze the assisted-standard fee.")
  }
  const amount = commercialAmountFromNet(
    orderCatalog(order).migrations.assisted_standard.netAmountMinor,
  )
  if (
    attempt.netAmountMinor !== amount.netAmountMinor ||
    attempt.vatAmountMinor !== amount.vatAmountMinor ||
    attempt.grossAmountMinor !== amount.grossAmountMinor
  ) {
    throw new Error("Supplemental payment amount does not match the frozen service fee.")
  }
  migration = await updateMigration(payload, migration, {
    operatorWorkAuthorizationState: "paid_authorized",
    operatorWorkAuthorizationPaymentAttempt: attempt.id,
    operatorWorkAuthorizedAt: attempt.paidAt ?? now,
    reconciliationRequired: false,
    failureReason: null,
  }, "supplemental_operator_work_payment_authorized", now)
  return migration
}

export async function startMigrationOperatorWork(
  payload: Payload,
  input: {
    migrationId: string | number
    actor: OperatorActor
    now?: string
  },
): Promise<DomainMigration> {
  const actor = requireOperator(input.actor)
  const now = input.now ?? new Date().toISOString()
  let migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (migration.operatorWorkStartedAt) return migration
  if (
    migration.state !== "paused_supplemental_order" ||
    !["paid_authorized", "non_billable_incident_authorized"].includes(
      migration.operatorWorkAuthorizationState,
    )
  ) {
    throw new Error("Operator work cannot start before paid or incident-recovery authorization.")
  }
  if (migration.operatorWorkAuthorizationState === "paid_authorized") {
    const orderId = relationshipId(migration.operatorWorkAuthorizationOrder)
    const attemptId = relationshipId(migration.operatorWorkAuthorizationPaymentAttempt)
    if (!orderId || !attemptId) {
      throw new Error("Paid operator authorization evidence is incomplete.")
    }
    const [order, attempt] = await Promise.all([
      payload.findByID({
        collection: "orders",
        id: orderId,
        depth: 0,
        overrideAccess: true,
      }) as Promise<Order>,
      payload.findByID({
        collection: "payment-attempts",
        id: attemptId,
        depth: 0,
        overrideAccess: true,
      }) as Promise<PaymentAttempt>,
    ])
    if (
      order.paymentStatus !== "paid" ||
      attempt.state !== "paid" ||
      !sameRelationshipId(attempt.order, order.id) ||
      !sameRelationshipId(order.tenant, migration.tenant)
    ) {
      throw new Error("Paid operator authorization is no longer valid.")
    }
  } else if (migration.operatorWorkCause !== "siteinabox_incident_recovery") {
    throw new Error("Only Siteinabox incident recovery may use non-billable authorization.")
  }
  migration = await updateMigration(payload, migration, {
    operatorWorkStartedAt: now,
    operatorWorkStartedBy: actor.id,
    operatorWorkStartedByEmail: actor.email.trim().toLowerCase(),
  }, "operator_work_started", now)
  return migration
}

export async function completeMigrationOperatorWork(
  payload: Payload,
  input: {
    migrationId: string | number
    actor: OperatorActor
    completionNotes: string
    now?: string
  },
): Promise<DomainMigration> {
  const actor = requireOperator(input.actor)
  const now = input.now ?? new Date().toISOString()
  const notes = input.completionNotes.trim()
  if (!notes) throw new Error("Operator work completion requires audit notes.")
  let migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (migration.operatorWorkCompletedAt) return migration
  if (
    migration.state !== "paused_supplemental_order" ||
    !migration.operatorWorkStartedAt
  ) {
    throw new Error("Operator work cannot complete before its audited start.")
  }
  migration = await updateMigration(payload, migration, {
    state: "preparing",
    operatorWorkCompletedAt: now,
    operatorWorkCompletedBy: actor.id,
    operatorWorkCompletedByEmail: actor.email.trim().toLowerCase(),
    operatorWorkCompletionNotes: notes,
    automationResumedAt: now,
    reconciliationRequired: true,
    failureReason: null,
  }, "operator_work_completed_automation_resumed", now)
  const supplementalOrderId = relationshipId(migration.supplementalOrder)
  if (supplementalOrderId) {
    const order = await payload.findByID({
      collection: "orders",
      id: supplementalOrderId,
      depth: 0,
      overrideAccess: true,
    }) as Order
    if (order.state === "fulfillment_pending" && order.paymentStatus === "paid") {
      await payload.update({
        collection: "orders",
        id: order.id,
        data: { state: "fulfilled" },
        depth: 0,
        overrideAccess: true,
        context: { legalOrderLifecycleMutation: true },
      })
    }
  }
  await queueDomainMigrationPreparation(payload, migration.id)
  return migration
}

export async function failMigrationOperatorWork(
  payload: Payload,
  input: {
    migrationId: string | number
    actor: OperatorActor
    failureCode:
      | "provider_access_failed"
      | "zone_conflict"
      | "customer_correction_required"
      | "incident_recovery_failed"
    now?: string
  },
): Promise<DomainMigration> {
  const actor = requireOperator(input.actor)
  const now = input.now ?? new Date().toISOString()
  const failureCodes = new Set([
    "provider_access_failed",
    "zone_conflict",
    "customer_correction_required",
    "incident_recovery_failed",
  ])
  if (!failureCodes.has(input.failureCode)) {
    throw new Error("Operator work requires an approved redacted failure code.")
  }
  const migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (
    migration.state !== "paused_supplemental_order" ||
    !migration.operatorWorkStartedAt ||
    migration.operatorWorkCompletedAt
  ) {
    throw new Error("Operator work failure can be recorded only after start and before completion.")
  }
  return updateMigration(payload, migration, {
    state: "failed",
    encryptedTransferCode: null,
    transferCodeDeletedAt: now,
    reconciliationRequired: false,
    failureReason:
      `${input.failureCode}:recorded_by_super_admin:${actor.id}`,
  }, `operator_work_failed:${input.failureCode}`, now)
}

export async function requestDomainMigrationRollback(
  payload: Payload,
  input: {
    migrationId: string | number
    actor: OperatorActor
    reasonCode:
      | "operator_detected_service_regression"
      | "operator_detected_dns_mismatch"
      | "customer_impact_reported"
    now?: string
  },
): Promise<DomainMigration> {
  const actor = requireOperator(input.actor)
  const now = input.now ?? new Date().toISOString()
  if (![
    "operator_detected_service_regression",
    "operator_detected_dns_mismatch",
    "customer_impact_reported",
  ].includes(input.reasonCode)) {
    throw new Error("Migration rollback requires an approved redacted reason code.")
  }
  const migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (
    !["cutover_in_progress", "verifying"].includes(migration.state) ||
    !migration.rollbackEvidence ||
    migration.rollbackWriteState === "confirmed"
  ) {
    throw new Error("Migration rollback is available only during an active cutover.")
  }
  const requested = await updateMigration(payload, migration, {
    rollbackWriteState: migration.rollbackWriteState === "indeterminate"
      ? "indeterminate"
      : "not_started",
    rollbackRequestedAt: migration.rollbackRequestedAt ?? now,
    reconciliationRequired: true,
    failureReason:
      `${input.reasonCode}:requested_by_super_admin:${actor.id}`,
  }, `operator_requested_rollback:${input.reasonCode}`, now)
  await queueDomainMigrationPreparation(payload, requested.id)
  return requested
}
