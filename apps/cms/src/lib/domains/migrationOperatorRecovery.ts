import "server-only"

import type { Payload } from "payload"
import type { DomainMigration, User } from "@/payload-types"

import { queueDomainMigrationPreparation } from "@/lib/jobs/prepareDomainMigrationTask"

type OperatorActor = Pick<User, "id" | "email" | "role">

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
    throw new Error("Migration recovery requires an authenticated super-admin.")
  }
  return actor
}

export async function authorizeDomainMigrationIncidentRecovery(
  payload: Payload,
  input: {
    migrationId: string | number
    workScope: string
    now?: string
  },
): Promise<DomainMigration> {
  const now = input.now ?? new Date().toISOString()
  const workScope = input.workScope.trim()
  if (!workScope) throw new Error("Incident recovery requires a bounded scope.")
  const migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (![
    "ready_to_prepare",
    "preparing",
    "awaiting_provider",
    "ready_for_cutover",
    "paused_supplemental_order",
  ].includes(migration.state)) {
    throw new Error(
      "Incident recovery can start only after customer inputs and before cutover.",
    )
  }
  return updateMigration(payload, migration, {
    state: "paused_supplemental_order",
    operatorWorkClassification: "assisted_standard",
    operatorWorkCause: "siteinabox_incident_recovery",
    operatorWorkScope: workScope,
    operatorWorkAuthorizationState: "non_billable_incident_authorized",
    operatorWorkAuthorizedAt: now,
    reconciliationRequired: false,
    failureReason: null,
  }, "siteinabox_incident_recovery_non_billable", now)
}

export async function startDomainMigrationIncidentRecovery(
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
    migration.operatorWorkAuthorizationState !==
      "non_billable_incident_authorized" ||
    migration.operatorWorkCause !== "siteinabox_incident_recovery"
  ) {
    throw new Error("Incident recovery cannot start before authorization.")
  }
  migration = await updateMigration(payload, migration, {
    operatorWorkStartedAt: now,
    operatorWorkStartedBy: actor.id,
    operatorWorkStartedByEmail: actor.email.trim().toLowerCase(),
  }, "operator_work_started", now)
  return migration
}

export async function completeDomainMigrationIncidentRecovery(
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
  if (!notes) throw new Error("Incident recovery completion requires audit notes.")
  let migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (migration.operatorWorkCompletedAt) return migration
  if (
    migration.state !== "paused_supplemental_order" ||
    migration.operatorWorkCause !== "siteinabox_incident_recovery" ||
    !migration.operatorWorkStartedAt
  ) {
    throw new Error("Incident recovery cannot complete before its audited start.")
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
  await queueDomainMigrationPreparation(payload, migration.id)
  return migration
}

export async function failDomainMigrationIncidentRecovery(
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
    throw new Error("Incident recovery requires an approved redacted failure code.")
  }
  const migration = await payload.findByID({
    collection: "domain-migrations",
    id: input.migrationId,
    depth: 0,
    overrideAccess: true,
  }) as DomainMigration
  if (
    migration.state !== "paused_supplemental_order" ||
    migration.operatorWorkCause !== "siteinabox_incident_recovery" ||
    !migration.operatorWorkStartedAt ||
    migration.operatorWorkCompletedAt
  ) {
    throw new Error(
      "Incident recovery failure can be recorded only after start and before completion.",
    )
  }
  return updateMigration(payload, migration, {
    state: "failed",
    encryptedTransferCode: null,
    transferCodeDeletedAt: now,
    encryptedSourceRefreshAuthority: null,
    sourceRefreshAuthorityDeletedAt: now,
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
