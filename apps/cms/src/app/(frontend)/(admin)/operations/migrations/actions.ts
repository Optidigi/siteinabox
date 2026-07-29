"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { User } from "@/payload-types"
import {
  completeMigrationOperatorWork,
  failMigrationOperatorWork,
  requestDomainMigrationRollback,
  requestMigrationOperatorWork,
  startMigrationOperatorWork,
} from "@/lib/domains/assistedMigration"

const migrationId = (formData: FormData): string => {
  const value = String(formData.get("migrationId") ?? "").trim()
  if (!/^\d+$/.test(value)) throw new Error("A valid migration id is required.")
  return value
}

const authenticatedOperator = async () => {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: await headers() })
  const user = auth.user as User | null
  if (
    !user ||
    user.role !== "super-admin" ||
    !user.email?.trim()
  ) {
    throw new Error("Migration operator action requires a super-admin.")
  }
  return { payload, user }
}

const completedPath = (id: string, result: string) =>
  `/operations/migrations/${id}?result=${result}`

const incidentScopes = {
  restore_siab_website_records: "restore_siab_website_records",
  repair_siab_zone_configuration: "repair_siab_zone_configuration",
  recover_siab_cutover_orchestration: "recover_siab_cutover_orchestration",
} as const

const completionCodes = {
  source_verified_and_ready: "source_verified_and_ready",
  operator_step_completed: "operator_step_completed",
  incident_recovery_completed: "incident_recovery_completed",
} as const

export async function classifySiteinaboxIncidentAction(formData: FormData) {
  const id = migrationId(formData)
  const scopeCode = String(formData.get("workScopeCode") ?? "")
  const scope = incidentScopes[scopeCode as keyof typeof incidentScopes]
  if (!scope) {
    redirect(completedPath(id, "invalid-scope"))
  }
  try {
    const { payload } = await authenticatedOperator()
    await requestMigrationOperatorWork(payload, {
      migrationId: id,
      requestedClassification: "assisted_standard",
      workCause: "siteinabox_incident_recovery",
      workScope: scope,
    })
  } catch {
    redirect(completedPath(id, "incident-failed"))
  }
  revalidatePath(`/operations/migrations/${id}`)
  redirect(completedPath(id, "incident-authorized"))
}

export async function startMigrationOperatorWorkAction(formData: FormData) {
  const id = migrationId(formData)
  try {
    const { payload, user } = await authenticatedOperator()
    await startMigrationOperatorWork(payload, {
      migrationId: id,
      actor: user,
    })
  } catch {
    redirect(completedPath(id, "start-failed"))
  }
  revalidatePath(`/operations/migrations/${id}`)
  redirect(completedPath(id, "started"))
}

export async function completeMigrationOperatorWorkAction(formData: FormData) {
  const id = migrationId(formData)
  const completionCode = String(formData.get("completionCode") ?? "")
  const notes = completionCodes[completionCode as keyof typeof completionCodes]
  if (!notes) {
    redirect(completedPath(id, "invalid-notes"))
  }
  try {
    const { payload, user } = await authenticatedOperator()
    await completeMigrationOperatorWork(payload, {
      migrationId: id,
      actor: user,
      completionNotes: notes,
    })
  } catch {
    redirect(completedPath(id, "completion-failed"))
  }
  revalidatePath(`/operations/migrations/${id}`)
  redirect(completedPath(id, "completed"))
}

export async function failMigrationOperatorWorkAction(formData: FormData) {
  const id = migrationId(formData)
  const failureCode = String(formData.get("failureCode") ?? "")
  if (![
    "provider_access_failed",
    "zone_conflict",
    "customer_correction_required",
    "incident_recovery_failed",
  ].includes(failureCode)) {
    redirect(completedPath(id, "invalid-failure-code"))
  }
  try {
    const { payload, user } = await authenticatedOperator()
    await failMigrationOperatorWork(payload, {
      migrationId: id,
      actor: user,
      failureCode: failureCode as
        | "provider_access_failed"
        | "zone_conflict"
        | "customer_correction_required"
        | "incident_recovery_failed",
    })
  } catch {
    redirect(completedPath(id, "failure-record-failed"))
  }
  revalidatePath(`/operations/migrations/${id}`)
  redirect(completedPath(id, "failure-recorded"))
}

export async function requestDomainMigrationRollbackAction(formData: FormData) {
  const id = migrationId(formData)
  const reasonCode = String(formData.get("reasonCode") ?? "")
  if (![
    "operator_detected_service_regression",
    "operator_detected_dns_mismatch",
    "customer_impact_reported",
  ].includes(reasonCode)) {
    redirect(completedPath(id, "invalid-rollback-reason"))
  }
  try {
    const { payload, user } = await authenticatedOperator()
    await requestDomainMigrationRollback(payload, {
      migrationId: id,
      actor: user,
      reasonCode: reasonCode as
        | "operator_detected_service_regression"
        | "operator_detected_dns_mismatch"
        | "customer_impact_reported",
    })
  } catch {
    redirect(completedPath(id, "rollback-failed"))
  }
  revalidatePath(`/operations/migrations/${id}`)
  redirect(completedPath(id, "rollback-requested"))
}
