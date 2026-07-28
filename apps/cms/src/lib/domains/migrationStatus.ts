import "server-only"

import {
  commercialAmountFromNet,
  getCommercialCatalog,
} from "@siteinabox/contracts/commerce"
import type { Payload } from "payload"
import type { DomainMigration, ManagedDomain, Order } from "@/payload-types"
import { relationshipId } from "@/lib/relationshipId"

export type CustomerMigrationActionStatus = {
  action: string
  status: "required" | "pending" | "completed" | "failed" | "overdue"
  deadlineAt: string | null
}

export type CustomerMigrationStatus = {
  migrationId: string | number
  domain: string
  state: DomainMigration["state"]
  classification: DomainMigration["acceptedClassification"]
  operatorAuthorization:
    | "not_required"
    | "awaiting_customer_acceptance"
    | "awaiting_payment"
    | "paid_authorized"
    | "non_billable_incident_authorized"
    | "custom_quote_required"
  actions: CustomerMigrationActionStatus[]
  supplementalProposal: {
    workScopeCode: string
    currency: "EUR"
    netAmountMinor: number
    vatAmountMinor: number
    grossAmountMinor: number
    paymentStatus: Order["paymentStatus"] | null
  } | null
  updatedAt: string
}

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

const customerActions = (value: unknown): CustomerMigrationActionStatus[] => {
  const source = readRecord(value)
  const entries = Array.isArray(value)
    ? value
    : Object.entries(source ?? {}).map(([action, state]) => ({
        action,
        ...readRecord(state),
      }))
  return entries.flatMap((entry) => {
    const action = readRecord(entry)
    const code = typeof action?.action === "string"
      ? action.action
      : typeof action?.code === "string"
        ? action.code
        : null
    const status = action?.status
    if (
      !code ||
      !["required", "pending", "completed", "failed", "overdue"].includes(
        String(status),
      )
    ) {
      return []
    }
    return [{
      action: code,
      status: status as CustomerMigrationActionStatus["status"],
      deadlineAt: typeof action?.deadlineAt === "string"
        ? action.deadlineAt
        : null,
    }]
  })
}

export async function loadCustomerMigrationStatus(
  payload: Payload,
  input: {
    generationRunId: string | number
    customerEmail: string
  },
): Promise<CustomerMigrationStatus | null> {
  const customerEmail = input.customerEmail.trim().toLowerCase()
  if (!customerEmail) return null
  const orders = await payload.find({
    collection: "orders",
    where: {
      and: [
        { generationRun: { equals: input.generationRunId } },
        { orderKind: { equals: "initial_subscription" } },
        { customerEmail: { equals: customerEmail } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (orders.docs.length !== 1) return null
  const order = orders.docs[0] as Order
  const migrations = await payload.find({
    collection: "domain-migrations",
    where: { originatingOrder: { equals: order.id } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (migrations.docs.length !== 1) return null
  const migration = migrations.docs[0] as DomainMigration
  const managedDomainId = relationshipId(migration.managedDomain)
  const managedDomain = managedDomainId
    ? await payload.findByID({
        collection: "managed-domains",
        id: managedDomainId,
        depth: 0,
        overrideAccess: true,
      }).catch(() => null) as ManagedDomain | null
    : null
  const actions = customerActions(migration.customerActions).map((action) => ({
    ...action,
    deadlineAt: action.deadlineAt ??
      (action.action === "provide_epp_code"
        ? migration.transferCodeExpiresAt ?? null
        : action.action === "verify_registrant"
          ? managedDomain?.registrantVerificationDueAt ?? null
          : null),
  }))
  const supplementalOrderId = relationshipId(migration.supplementalOrder)
  const supplementalOrder = supplementalOrderId
    ? await payload.findByID({
        collection: "orders",
        id: supplementalOrderId,
        depth: 0,
        overrideAccess: true,
      }).catch(() => null) as Order | null
    : null
  const catalog = order.catalogVersion
    ? getCommercialCatalog(order.catalogVersion)
    : null
  const supplementalAmount = catalog
    ? commercialAmountFromNet(catalog.migrations.assisted_standard.netAmountMinor)
    : null
  const supplementalProposal =
    ["awaiting_customer_acceptance", "awaiting_payment"].includes(
      migration.operatorWorkAuthorizationState,
    ) &&
    migration.operatorWorkScope &&
    supplementalAmount
      ? {
          workScopeCode: migration.operatorWorkScope,
          ...supplementalAmount,
          paymentStatus: supplementalOrder?.paymentStatus ?? null,
        }
      : null
  return {
    migrationId: migration.id,
    domain: migration.domainNameAscii,
    state: migration.state,
    classification: migration.acceptedClassification,
    operatorAuthorization: migration.operatorWorkAuthorizationState,
    actions,
    supplementalProposal,
    updatedAt: migration.updatedAt,
  }
}
