import {
  domainMigrationStates,
  domainMigrationStateTransitions,
  migrationClassifications,
  migrationCustomerActions,
  migrationOperatorAuthorizationStates,
} from "@siteinabox/contracts/commerce"
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload"

import { isSuperAdmin } from "@/access/isSuperAdmin"
import { adminEnumOption, adminText } from "@/lib/payloadAdminI18n"

const selectOptions = (values: readonly string[]) => values.map(adminEnumOption)

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(
    (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`,
  ).join(",")}}`
}

const frozenOnceFields = new Set([
  "originatingOrder",
  "checkoutProfile",
  "tenant",
  "domainNameAscii",
  "tld",
  "acceptedClassification",
  "sourceMechanism",
  "sourceZoneHash",
  "sourceZoneSnapshot",
  "targetZoneHash",
  "targetZoneSnapshot",
  "rollbackEvidence",
  "supplementalOrder",
  "operatorWorkClassification",
  "operatorWorkCause",
  "operatorWorkScope",
  "operatorWorkAuthorizationOrder",
  "operatorWorkAuthorizationPaymentAttempt",
  "operatorWorkAuthorizedAt",
  "operatorWorkStartedAt",
  "operatorWorkStartedBy",
  "operatorWorkStartedByEmail",
  "operatorWorkCompletedAt",
  "operatorWorkCompletedBy",
  "operatorWorkCompletedByEmail",
  "operatorWorkCompletionNotes",
  "automationResumedAt",
  "createdAt",
])

const mutableLifecycleFields = new Set([
  "state",
  "managedDomain",
  "customerActions",
  "dnssecPreparation",
  "operatorWorkAuthorizationState",
  "semanticComparison",
  "encryptedTransferCode",
  "transferCodeReceivedAt",
  "transferCodeExpiresAt",
  "transferCodeDeletedAt",
  "providerCustomerHandle",
  "providerTransferState",
  "providerTransferId",
  "providerDomainId",
  "transferRequestedAt",
  "transferConfirmedAt",
  "cloudflareZoneId",
  "cloudflareNameservers",
  "cloudflareZoneState",
  "cloudflareRecordIds",
  "zonePreparedAt",
  "cutoverWriteState",
  "cutoverRequestedAt",
  "cutoverConfirmedAt",
  "verificationDeadlineAt",
  "postCutoverVerification",
  "rollbackWriteState",
  "rollbackRequestedAt",
  "rollbackConfirmedAt",
  "completedAt",
  "rolledBackAt",
  "reconciliationRequired",
  "failureReason",
  "stateHistory",
  "updatedAt",
])

const contextEnabled = (
  args: Parameters<CollectionBeforeChangeHook>[0],
): boolean =>
  args.req?.context?.domainMigrationLifecycleMutation === true ||
  args.context?.domainMigrationLifecycleMutation === true

export const protectDomainMigration: CollectionBeforeChangeHook = (args) => {
  if (args.operation !== "update") return args.data
  if (!contextEnabled(args)) {
    throw new Error(
      "Domain-migration records are immutable outside the reviewed migration lifecycle.",
    )
  }
  const original = args.originalDoc as Record<string, unknown> | undefined
  const currentState = original?.state
  const nextState = args.data?.state
  if (
    typeof currentState === "string" &&
    typeof nextState === "string" &&
    currentState !== nextState &&
    !domainMigrationStateTransitions[
      currentState as keyof typeof domainMigrationStateTransitions
    ]?.includes(nextState as never)
  ) {
    throw new Error(`Invalid domain migration state transition: ${currentState} -> ${nextState}.`)
  }
  const invalidField = Object.keys(args.data ?? {}).find((field) => {
    if (mutableLifecycleFields.has(field)) return false
    if (!frozenOnceFields.has(field)) return true
    const previous = original?.[field]
    if (previous == null) return false
    return stableStringify(previous) !== stableStringify(args.data?.[field])
  })
  if (invalidField) {
    throw new Error(`Domain migration field "${invalidField}" is immutable after acquisition.`)
  }
  return args.data
}

export const validateDomainMigration: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
}) => {
  if (!data) return data
  const current = {
    ...(originalDoc as Record<string, unknown> | undefined),
    ...data,
  }
  if (current.acceptedClassification === "complex") {
    throw new Error("Complex migrations require a custom quote and cannot be accepted orders.")
  }
  if (
    ["completed", "rolled_back"].includes(String(current.state)) &&
    current.encryptedTransferCode
  ) {
    throw new Error("Terminal domain migrations must delete the encrypted transfer code.")
  }
  const authorizationState = current.operatorWorkAuthorizationState
  const cause = current.operatorWorkCause
  if (
    cause === "siteinabox_incident_recovery" &&
    (
      authorizationState === "awaiting_payment" ||
      authorizationState === "paid_authorized" ||
      current.operatorWorkAuthorizationOrder ||
      current.operatorWorkAuthorizationPaymentAttempt
    )
  ) {
    throw new Error("Siteinabox incident recovery cannot use billable operator-work authorization.")
  }
  if (
    current.operatorWorkStartedAt &&
    !["paid_authorized", "non_billable_incident_authorized"].includes(
      String(authorizationState),
    )
  ) {
    throw new Error("Operator work cannot start without paid or incident-recovery authorization.")
  }
  if (
    authorizationState === "paid_authorized" &&
    (
      !current.operatorWorkAuthorizationOrder ||
      !current.operatorWorkAuthorizationPaymentAttempt
    )
  ) {
    throw new Error("Paid operator-work authorization requires frozen order and payment evidence.")
  }
  if (current.operatorWorkCompletedAt && !current.operatorWorkStartedAt) {
    throw new Error("Operator work cannot complete before its audited start.")
  }
  if (
    current.operatorWorkClassification === "complex" &&
    current.operatorWorkStartedAt
  ) {
    throw new Error("Complex migration operator work cannot start in ordinary checkout.")
  }
  return data
}

export const DomainMigrations: CollectionConfig = {
  slug: "domain-migrations",
  lockDocuments: false,
  labels: {
    singular: { en: "Domain migration", nl: "Domeinmigratie" },
    plural: { en: "Domain migrations", nl: "Domeinmigraties" },
  },
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeValidate: [validateDomainMigration],
    beforeChange: [protectDomainMigration],
  },
  admin: {
    useAsTitle: "domainNameAscii",
    defaultColumns: [
      "domainNameAscii",
      "state",
      "tenant",
      "providerTransferState",
      "updatedAt",
    ],
    description: adminText(
      "Frozen source/rollback evidence and the independent existing-domain migration lifecycle.",
      "Bevroren bron-/rollbackbewijs en de onafhankelijke migratielevenscyclus voor bestaande domeinen.",
    ),
  },
  fields: [
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true },
    {
      name: "originatingOrder",
      type: "relationship",
      relationTo: "orders",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "checkoutProfile",
      type: "relationship",
      relationTo: "checkout-profiles",
      required: true,
      index: true,
    },
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, index: true },
    {
      name: "managedDomain",
      type: "relationship",
      relationTo: "managed-domains",
      unique: true,
      index: true,
    },
    { name: "domainNameAscii", type: "text", required: true, unique: true, index: true },
    { name: "tld", type: "text", required: true, index: true },
    {
      name: "acceptedClassification",
      type: "select",
      required: true,
      options: selectOptions(migrationClassifications),
      index: true,
    },
    {
      name: "state",
      type: "select",
      required: true,
      defaultValue: "assessment",
      options: selectOptions(domainMigrationStates),
      index: true,
    },
    {
      name: "sourceMechanism",
      type: "select",
      required: true,
      defaultValue: "customer_authorized_provider_export_v1",
      options: selectOptions(["customer_authorized_provider_export_v1"]),
    },
    { name: "sourceZoneHash", type: "text", unique: true, index: true },
    { name: "sourceZoneSnapshot", type: "json", admin: { readOnly: true } },
    { name: "targetZoneHash", type: "text", unique: true, index: true },
    { name: "targetZoneSnapshot", type: "json", admin: { readOnly: true } },
    { name: "rollbackEvidence", type: "json", admin: { readOnly: true } },
    {
      name: "supplementalOrder",
      type: "relationship",
      relationTo: "orders",
      unique: true,
      index: true,
    },
    {
      name: "operatorWorkClassification",
      type: "select",
      options: selectOptions(["assisted_standard", "complex"]),
      index: true,
    },
    {
      name: "operatorWorkCause",
      type: "select",
      options: selectOptions(["customer_migration", "siteinabox_incident_recovery"]),
      index: true,
    },
    { name: "operatorWorkScope", type: "textarea" },
    {
      name: "operatorWorkAuthorizationState",
      type: "select",
      required: true,
      defaultValue: "not_required",
      options: selectOptions(migrationOperatorAuthorizationStates),
      index: true,
    },
    {
      name: "operatorWorkAuthorizationOrder",
      type: "relationship",
      relationTo: "orders",
      index: true,
    },
    {
      name: "operatorWorkAuthorizationPaymentAttempt",
      type: "relationship",
      relationTo: "payment-attempts",
      unique: true,
      index: true,
    },
    { name: "operatorWorkAuthorizedAt", type: "date", index: true },
    { name: "operatorWorkStartedAt", type: "date", index: true },
    {
      name: "operatorWorkStartedBy",
      type: "relationship",
      relationTo: "users",
      index: true,
    },
    { name: "operatorWorkStartedByEmail", type: "email" },
    { name: "operatorWorkCompletedAt", type: "date", index: true },
    {
      name: "operatorWorkCompletedBy",
      type: "relationship",
      relationTo: "users",
      index: true,
    },
    { name: "operatorWorkCompletedByEmail", type: "email" },
    { name: "operatorWorkCompletionNotes", type: "textarea" },
    { name: "automationResumedAt", type: "date", index: true },
    { name: "semanticComparison", type: "json", admin: { readOnly: true } },
    { name: "dnssecPreparation", type: "json", admin: { readOnly: true } },
    {
      name: "customerActions",
      type: "json",
      admin: {
        readOnly: true,
        description: adminText(
          `Persisted states for: ${migrationCustomerActions.join(", ")}.`,
          `Opgeslagen statussen voor: ${migrationCustomerActions.join(", ")}.`,
        ),
      },
    },
    {
      name: "encryptedTransferCode",
      type: "text",
      access: { read: () => false },
      admin: { hidden: true },
    },
    { name: "transferCodeReceivedAt", type: "date" },
    { name: "transferCodeExpiresAt", type: "date", index: true },
    { name: "transferCodeDeletedAt", type: "date" },
    { name: "providerCustomerHandle", type: "text", index: true },
    {
      name: "providerTransferState",
      type: "select",
      required: true,
      defaultValue: "not_started",
      options: selectOptions(["not_started", "prepared", "indeterminate", "confirmed"]),
      index: true,
    },
    { name: "providerTransferId", type: "text", unique: true, index: true },
    { name: "providerDomainId", type: "text", unique: true, index: true },
    { name: "transferRequestedAt", type: "date", index: true },
    { name: "transferConfirmedAt", type: "date" },
    { name: "cloudflareZoneId", type: "text", unique: true, index: true },
    { name: "cloudflareNameservers", type: "json", admin: { readOnly: true } },
    {
      name: "cloudflareZoneState",
      type: "select",
      required: true,
      defaultValue: "not_started",
      options: selectOptions(["not_started", "prepared", "indeterminate", "confirmed"]),
      index: true,
    },
    { name: "cloudflareRecordIds", type: "json", admin: { readOnly: true } },
    { name: "zonePreparedAt", type: "date" },
    {
      name: "cutoverWriteState",
      type: "select",
      required: true,
      defaultValue: "not_started",
      options: selectOptions(["not_started", "prepared", "indeterminate", "confirmed"]),
      index: true,
    },
    { name: "cutoverRequestedAt", type: "date" },
    { name: "cutoverConfirmedAt", type: "date" },
    { name: "verificationDeadlineAt", type: "date", index: true },
    { name: "postCutoverVerification", type: "json", admin: { readOnly: true } },
    {
      name: "rollbackWriteState",
      type: "select",
      required: true,
      defaultValue: "not_started",
      options: selectOptions(["not_started", "prepared", "indeterminate", "confirmed"]),
      index: true,
    },
    { name: "rollbackRequestedAt", type: "date" },
    { name: "rollbackConfirmedAt", type: "date" },
    { name: "completedAt", type: "date", index: true },
    { name: "rolledBackAt", type: "date", index: true },
    {
      name: "reconciliationRequired",
      type: "checkbox",
      required: true,
      defaultValue: false,
      index: true,
    },
    { name: "failureReason", type: "textarea" },
    { name: "stateHistory", type: "json", admin: { readOnly: true } },
    { name: "createdAt", type: "date", required: true, index: true },
    { name: "updatedAt", type: "date", required: true, index: true },
  ],
}
