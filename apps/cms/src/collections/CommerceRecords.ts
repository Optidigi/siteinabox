import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload"
import { domainToASCII } from "node:url"
import {
  billingAgreementStates,
  billingAgreementStateTransitions,
  contractingPartyClassificationSchema,
  domainRenewalCycleStates,
  domainRenewalCycleStateTransitions,
  managedDomainStates,
  managedDomainStateTransitions,
  paymentAttemptStates,
  paymentAttemptStateTransitions,
} from "@siteinabox/contracts/commerce"

import { isSuperAdmin } from "@/access/isSuperAdmin"
import { adminEnumOption, adminText } from "@/lib/payloadAdminI18n"
import { relationshipId, type RelationshipIdRef } from "@/lib/relationshipId"

const selectOptions = (values: readonly string[]) => values.map(adminEnumOption)

const systemOwnedAccess = {
  create: isSuperAdmin,
  read: isSuperAdmin,
  update: () => false,
  delete: () => false,
}

const validateMinorAmount = (value: number | null | undefined): true | string => {
  if (value == null) return true
  if (!Number.isSafeInteger(value)) return "Amount must use integer minor currency units."
  if (value < 0) return "Amount must be non-negative."
  return true
}

const contextEnabled = (
  args: {
    req?: { context?: Record<string, unknown> }
    context?: Record<string, unknown>
  },
  key: string,
): boolean => args.req?.context?.[key] === true || args.context?.[key] === true

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

const immutableFieldIsUnchanged = (
  field: string,
  nextValue: unknown,
  originalDoc: Record<string, unknown> | undefined,
  relationshipFields: ReadonlySet<string>,
): boolean => {
  if (!originalDoc || !(field in originalDoc)) return false
  const originalValue = originalDoc[field]
  if (relationshipFields.has(field)) {
    return relationshipId(nextValue as RelationshipIdRef) ===
      relationshipId(originalValue as RelationshipIdRef)
  }
  return stableStringify(nextValue) === stableStringify(originalValue)
}

const protectLifecycleUpdate = (
  args: Parameters<CollectionBeforeChangeHook>[0],
  input: {
    label: string
    contextKey: string
    allowedFields: ReadonlySet<string>
    relationshipFields: ReadonlySet<string>
    stateTransitions: Readonly<Record<string, readonly string[]>>
  },
) => {
  if (args.operation !== "update") return args.data
  if (!contextEnabled(args, input.contextKey)) {
    throw new Error(
      `${input.label} records are immutable outside the reviewed ${input.label.toLowerCase()} lifecycle.`,
    )
  }
  const currentState = args.originalDoc?.state
  const nextState = args.data?.state
  if (
    typeof currentState === "string" &&
    typeof nextState === "string" &&
    currentState !== nextState &&
    !input.stateTransitions[currentState]?.includes(nextState)
  ) {
    throw new Error(
      `Invalid ${input.label.toLowerCase()} state transition: ${currentState} -> ${nextState}.`,
    )
  }
  const invalidField = Object.keys(args.data ?? {}).find(
    (field) =>
      !input.allowedFields.has(field) &&
      !immutableFieldIsUnchanged(
        field,
        args.data?.[field],
        args.originalDoc as Record<string, unknown> | undefined,
        input.relationshipFields,
      ),
  )
  if (invalidField) {
    throw new Error(`${input.label} field "${invalidField}" is immutable after creation.`)
  }
  return args.data
}

export const rejectCheckoutProfileMutation: CollectionBeforeChangeHook = ({
  data,
  operation,
}) => {
  if (operation === "update") {
    throw new Error("Checkout profile versions are immutable after creation.")
  }
  return data
}

export const validateCheckoutProfile: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  const partyType = data.partyType
  const classification = partyType === "registered_business"
    ? {
        type: partyType,
        kvkNumber: data.kvkNumber,
        domainRegistrantSource: data.domainRegistrantSource,
        ...(data.contractingPartyKind != null
          ? { contractingPartyKind: data.contractingPartyKind }
          : {}),
        ...(data.intendedCompanyName != null
          ? { intendedCompanyName: data.intendedCompanyName }
          : {}),
      }
    : {
        type: partyType,
        kvkNumber: data.kvkNumber ?? null,
        contractingPartyKind: data.contractingPartyKind,
        domainRegistrantSource: data.domainRegistrantSource,
        intendedCompanyName: data.intendedCompanyName,
      }
  const parsed = contractingPartyClassificationSchema.safeParse(classification)
  if (!parsed.success) {
    throw new Error(
      `Invalid checkout contracting-party classification: ${parsed.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
    )
  }
  const hasAuditMetadata = [
    data.revisionReason,
    data.supersedesProfileKey,
    data.actorEmail,
    data.sourceRequestId,
    data.sourceIpAddress,
    data.sourceUserAgent,
  ].some((value) => value != null && String(value).trim().length > 0)
  if (hasAuditMetadata) {
    if (!data.revisionReason || !data.actorEmail || !data.sourceRequestId) {
      throw new Error(
        "Audited checkout profile versions require a revision reason, actor email, and request ID.",
      )
    }
    if (
      typeof data.customerEmail === "string" &&
      String(data.actorEmail).trim().toLowerCase() !== data.customerEmail.trim().toLowerCase()
    ) {
      throw new Error("Checkout profile audit actor must match the authenticated customer.")
    }
    const profileVersion = Number(data.profileVersion)
    if (profileVersion === 1 && data.revisionReason !== "initial_capture") {
      throw new Error("The first checkout profile version must be an initial capture.")
    }
    if (
      profileVersion > 1 &&
      (data.revisionReason !== "customer_correction" || !data.supersedesProfileKey)
    ) {
      throw new Error(
        "A checkout profile correction must identify the superseded profile version.",
      )
    }
  }
  return data
}

const DOMAIN_ASCII_PATTERN =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/

export const normalizeManagedDomain: CollectionBeforeValidateHook = ({ data }) => {
  if (!data?.domainNameAscii) return data
  const normalized = domainToASCII(String(data.domainNameAscii).trim().replace(/\.$/, ""))
    .toLowerCase()
  if (!normalized || normalized.length > 253 || !DOMAIN_ASCII_PATTERN.test(normalized)) {
    throw new Error("Managed domain must be a valid canonical ASCII hostname.")
  }
  const tld = normalized.split(".").at(-1)
  if (data.tld != null && String(data.tld).trim().toLowerCase() !== tld) {
    throw new Error("Managed domain TLD must match the canonical domain name.")
  }
  return { ...data, domainNameAscii: normalized, tld }
}

const paymentAttemptMutableFields = new Set([
  "state",
  "providerPaymentId",
  "providerStatus",
  "reconciliationRequired",
  "lastSyncedAt",
  "authorizedAt",
  "paidAt",
  "failedAt",
  "cancelledAt",
  "expiredAt",
  "refundPendingAt",
  "refundedAmountMinor",
  "refundedAt",
  "failureCode",
  "failureMessage",
  "stateHistory",
])

export const protectPaymentAttempt: CollectionBeforeChangeHook = (args) =>
  protectLifecycleUpdate(args, {
    label: "Payment-attempt",
    contextKey: "paymentAttemptLifecycleMutation",
    allowedFields: paymentAttemptMutableFields,
    relationshipFields: new Set(["order", "tenant"]),
    stateTransitions: paymentAttemptStateTransitions,
  })

const billingAgreementMutableFields = new Set([
  "state",
  "providerCustomerId",
  "providerMandateId",
  "renewalIntent",
  "nextChargeAt",
  "cancelAt",
  "cancelledAt",
  "endedAt",
  "reconciliationRequired",
  "lastSyncedAt",
  "failureReason",
  "stateHistory",
])

export const protectBillingAgreement: CollectionBeforeChangeHook = (args) =>
  protectLifecycleUpdate(args, {
    label: "Billing-agreement",
    contextKey: "billingAgreementLifecycleMutation",
    allowedFields: billingAgreementMutableFields,
    relationshipFields: new Set(["originatingOrder", "checkoutProfile", "tenant"]),
    stateTransitions: billingAgreementStateTransitions,
  })

const managedDomainMutableFields = new Set([
  "state",
  "providerDomainId",
  "renewalIntent",
  "registeredAt",
  "transferredAt",
  "expiresAt",
  "providerSafeRenewalCutoffAt",
  "reconciliationRequired",
  "lastSyncedAt",
  "failureReason",
  "stateHistory",
])

export const protectManagedDomain: CollectionBeforeChangeHook = (args) =>
  protectLifecycleUpdate(args, {
    label: "Managed-domain",
    contextKey: "managedDomainLifecycleMutation",
    allowedFields: managedDomainMutableFields,
    relationshipFields: new Set(["originatingOrder", "registrantProfile", "tenant"]),
    stateTransitions: managedDomainStateTransitions,
  })

const renewalCycleMutableFields = new Set([
  "state",
  "order",
  "paymentAttempt",
  "providerOperationId",
  "providerStatus",
  "paymentSecuredAt",
  "providerCommittedAt",
  "renewedAt",
  "cancelledAt",
  "failedAt",
  "failureReason",
  "reconciliationRequired",
  "lastSyncedAt",
  "stateHistory",
])

export const protectDomainRenewalCycle: CollectionBeforeChangeHook = (args) =>
  protectLifecycleUpdate(args, {
    label: "Domain-renewal-cycle",
    contextKey: "domainRenewalCycleLifecycleMutation",
    allowedFields: renewalCycleMutableFields,
    relationshipFields: new Set([
      "managedDomain",
      "billingAgreement",
      "order",
      "paymentAttempt",
      "tenant",
    ]),
    stateTransitions: domainRenewalCycleStateTransitions,
  })

export const CheckoutProfiles: CollectionConfig = {
  slug: "checkout-profiles",
  lockDocuments: false,
  indexes: [{ fields: ["generationRun", "profileVersion"], unique: true }],
  labels: {
    singular: { en: "Checkout profile", nl: "Checkoutprofiel" },
    plural: { en: "Checkout profiles", nl: "Checkoutprofielen" },
  },
  access: systemOwnedAccess,
  hooks: {
    beforeValidate: [validateCheckoutProfile],
    beforeChange: [rejectCheckoutProfileMutation],
  },
  admin: {
    useAsTitle: "profileKey",
    defaultColumns: ["profileKey", "generationRun", "partyType", "customerEmail", "createdAt"],
    description: adminText(
      "Immutable, versioned contracting-party and billing details captured before order acceptance.",
      "Onveranderlijke, geversioneerde contractpartij- en facturatiegegevens die vóór orderacceptatie zijn vastgelegd.",
    ),
  },
  fields: [
    { name: "profileKey", type: "text", required: true, unique: true, index: true },
    { name: "profileVersion", type: "number", required: true, min: 1, index: true },
    {
      name: "generationRun",
      type: "relationship",
      relationTo: "site-generation-runs",
      required: true,
      index: true,
    },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    { name: "customerName", type: "text", required: true },
    { name: "customerEmail", type: "email", required: true, index: true },
    { name: "customerPhone", type: "text" },
    {
      name: "partyType",
      type: "select",
      required: true,
      options: selectOptions(["registered_business", "business_in_formation"]),
      index: true,
    },
    { name: "contractingPartyName", type: "text", required: true },
    { name: "kvkNumber", type: "text", index: true },
    {
      name: "contractingPartyKind",
      type: "select",
      options: selectOptions(["natural_person"]),
    },
    {
      name: "domainRegistrantSource",
      type: "select",
      required: true,
      defaultValue: "contracting_party",
      options: selectOptions(["contracting_party"]),
    },
    { name: "intendedCompanyName", type: "text" },
    { name: "billingAddress", type: "json", required: true },
    { name: "supersedesProfileKey", type: "text", index: true },
    {
      name: "revisionReason",
      type: "select",
      options: selectOptions(["initial_capture", "customer_correction"]),
      index: true,
    },
    { name: "actorEmail", type: "email", index: true },
    { name: "sourceRequestId", type: "text", index: true },
    { name: "sourceIpAddress", type: "text" },
    { name: "sourceUserAgent", type: "textarea" },
    { name: "createdAt", type: "date", required: true, index: true },
  ],
}

export const PaymentAttempts: CollectionConfig = {
  slug: "payment-attempts",
  lockDocuments: false,
  labels: {
    singular: { en: "Payment attempt", nl: "Betaalpoging" },
    plural: { en: "Payment attempts", nl: "Betaalpogingen" },
  },
  access: systemOwnedAccess,
  hooks: { beforeChange: [protectPaymentAttempt] },
  admin: {
    useAsTitle: "idempotencyKey",
    defaultColumns: ["state", "provider", "order", "grossAmountMinor", "providerPaymentId", "createdAt"],
    description: adminText(
      "Provider-neutral payment attempts with stable idempotency and reconciliation state.",
      "Providerneutrale betaalpogingen met stabiele idempotentie- en reconciliatiestatus.",
    ),
  },
  fields: [
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true },
    { name: "order", type: "relationship", relationTo: "orders", required: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    {
      name: "state",
      type: "select",
      required: true,
      defaultValue: "created",
      options: selectOptions(paymentAttemptStates),
      index: true,
    },
    {
      name: "purpose",
      type: "select",
      required: true,
      options: selectOptions(["first_payment", "recurring", "domain_renewal", "supplemental"]),
      index: true,
    },
    {
      name: "provider",
      type: "select",
      required: true,
      defaultValue: "mollie",
      options: selectOptions(["mollie", "manual"]),
      index: true,
    },
    { name: "providerPaymentId", type: "text", unique: true, index: true },
    { name: "providerStatus", type: "text", index: true },
    { name: "currency", type: "text", required: true, defaultValue: "EUR" },
    {
      name: "netAmountMinor",
      type: "number",
      required: true,
      min: 0,
      validate: validateMinorAmount,
    },
    {
      name: "vatAmountMinor",
      type: "number",
      required: true,
      min: 0,
      validate: validateMinorAmount,
    },
    {
      name: "grossAmountMinor",
      type: "number",
      required: true,
      min: 0,
      validate: validateMinorAmount,
    },
    { name: "reconciliationRequired", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "lastSyncedAt", type: "date", index: true },
    { name: "authorizedAt", type: "date" },
    { name: "paidAt", type: "date", index: true },
    { name: "failedAt", type: "date" },
    { name: "cancelledAt", type: "date" },
    { name: "expiredAt", type: "date" },
    { name: "refundPendingAt", type: "date" },
    {
      name: "refundedAmountMinor",
      type: "number",
      min: 0,
      validate: validateMinorAmount,
    },
    { name: "refundedAt", type: "date" },
    { name: "failureCode", type: "text" },
    { name: "failureMessage", type: "textarea" },
    { name: "stateHistory", type: "json", admin: { readOnly: true } },
    { name: "createdAt", type: "date", required: true, index: true },
  ],
}

export const BillingAgreements: CollectionConfig = {
  slug: "billing-agreements",
  lockDocuments: false,
  labels: {
    singular: { en: "Billing agreement", nl: "Facturatieovereenkomst" },
    plural: { en: "Billing agreements", nl: "Facturatieovereenkomsten" },
  },
  access: systemOwnedAccess,
  hooks: { beforeChange: [protectBillingAgreement] },
  admin: {
    useAsTitle: "idempotencyKey",
    defaultColumns: ["state", "originatingOrder", "billingPeriod", "renewalIntent", "nextChargeAt"],
    description: adminText(
      "Recurring billing intent and Mollie customer/mandate references; no provider subscription authority.",
      "Terugkerende facturatie-intentie en Mollie-klant-/mandaatreferenties; geen providerabonnement als autoriteit.",
    ),
  },
  fields: [
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true },
    {
      name: "originatingOrder",
      type: "relationship",
      relationTo: "orders",
      required: true,
      index: true,
    },
    { name: "checkoutProfile", type: "relationship", relationTo: "checkout-profiles", required: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    {
      name: "state",
      type: "select",
      required: true,
      defaultValue: "pending_first_payment",
      options: selectOptions(billingAgreementStates),
      index: true,
    },
    {
      name: "provider",
      type: "select",
      required: true,
      defaultValue: "mollie",
      options: selectOptions(["mollie"]),
    },
    { name: "providerCustomerId", type: "text", index: true },
    { name: "providerMandateId", type: "text", unique: true, index: true },
    { name: "catalogVersion", type: "text", required: true, index: true },
    { name: "packageCode", type: "text", required: true },
    {
      name: "billingPeriod",
      type: "select",
      required: true,
      options: selectOptions(["monthly", "annual"]),
      index: true,
    },
    { name: "currency", type: "text", required: true, defaultValue: "EUR" },
    {
      name: "recurringNetAmountMinor",
      type: "number",
      required: true,
      min: 0,
      validate: validateMinorAmount,
    },
    { name: "renewalIntent", type: "checkbox", required: true, defaultValue: true, index: true },
    { name: "nextChargeAt", type: "date", index: true },
    { name: "cancelAt", type: "date", index: true },
    { name: "cancelledAt", type: "date" },
    { name: "endedAt", type: "date" },
    { name: "reconciliationRequired", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "lastSyncedAt", type: "date" },
    { name: "failureReason", type: "textarea" },
    { name: "stateHistory", type: "json", admin: { readOnly: true } },
    { name: "createdAt", type: "date", required: true, index: true },
  ],
}

export const ManagedDomains: CollectionConfig = {
  slug: "managed-domains",
  lockDocuments: false,
  labels: {
    singular: { en: "Managed domain", nl: "Beheerd domein" },
    plural: { en: "Managed domains", nl: "Beheerde domeinen" },
  },
  access: systemOwnedAccess,
  hooks: {
    beforeValidate: [normalizeManagedDomain],
    beforeChange: [protectManagedDomain],
  },
  admin: {
    useAsTitle: "domainNameAscii",
    defaultColumns: ["domainNameAscii", "state", "tenant", "provider", "expiresAt", "renewalIntent"],
    description: adminText(
      "Customer-owned domains managed through a provider boundary.",
      "Domeinen in eigendom van klanten die via een providergrens worden beheerd.",
    ),
  },
  fields: [
    { name: "domainNameAscii", type: "text", required: true, unique: true, index: true },
    { name: "tld", type: "text", required: true, index: true },
    {
      name: "provisioningIdempotencyKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "originatingOrder",
      type: "relationship",
      relationTo: "orders",
      required: true,
      index: true,
    },
    {
      name: "registrantProfile",
      type: "relationship",
      relationTo: "checkout-profiles",
      required: true,
      index: true,
    },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    {
      name: "state",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: selectOptions(managedDomainStates),
      index: true,
    },
    {
      name: "initialOperation",
      type: "select",
      required: true,
      options: selectOptions(["registration", "transfer"]),
      index: true,
    },
    {
      name: "registrantOwnership",
      type: "select",
      required: true,
      defaultValue: "customer",
      options: selectOptions(["customer"]),
    },
    {
      name: "provider",
      type: "select",
      required: true,
      defaultValue: "openprovider",
      options: selectOptions(["openprovider", "manual"]),
      index: true,
    },
    { name: "providerDomainId", type: "text", unique: true, index: true },
    { name: "renewalIntent", type: "checkbox", required: true, defaultValue: true, index: true },
    { name: "registeredAt", type: "date" },
    { name: "transferredAt", type: "date" },
    { name: "expiresAt", type: "date", index: true },
    { name: "providerSafeRenewalCutoffAt", type: "date", index: true },
    { name: "reconciliationRequired", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "lastSyncedAt", type: "date" },
    { name: "failureReason", type: "textarea" },
    { name: "stateHistory", type: "json", admin: { readOnly: true } },
    { name: "createdAt", type: "date", required: true, index: true },
  ],
}

export const DomainRenewalCycles: CollectionConfig = {
  slug: "domain-renewal-cycles",
  lockDocuments: false,
  indexes: [{ fields: ["managedDomain", "coverageEndsAt"], unique: true }],
  labels: {
    singular: { en: "Domain renewal cycle", nl: "Domeinverlengingscyclus" },
    plural: { en: "Domain renewal cycles", nl: "Domeinverlengingscycli" },
  },
  access: systemOwnedAccess,
  hooks: { beforeChange: [protectDomainRenewalCycle] },
  admin: {
    useAsTitle: "idempotencyKey",
    defaultColumns: ["managedDomain", "state", "coverageEndsAt", "providerSafeCutoffAt", "renewalIntentSnapshot"],
    description: adminText(
      "Independent renewal cycles that preserve paid/provider-committed work after cancellation.",
      "Onafhankelijke verlengingscycli die betaald of bij de provider vastgelegd werk na opzegging behouden.",
    ),
  },
  fields: [
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true },
    {
      name: "managedDomain",
      type: "relationship",
      relationTo: "managed-domains",
      required: true,
      index: true,
    },
    {
      name: "billingAgreement",
      type: "relationship",
      relationTo: "billing-agreements",
      index: true,
    },
    { name: "order", type: "relationship", relationTo: "orders", index: true },
    {
      name: "paymentAttempt",
      type: "relationship",
      relationTo: "payment-attempts",
      index: true,
    },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    {
      name: "state",
      type: "select",
      required: true,
      defaultValue: "scheduled",
      options: selectOptions(domainRenewalCycleStates),
      index: true,
    },
    { name: "coverageStartsAt", type: "date", required: true, index: true },
    { name: "coverageEndsAt", type: "date", required: true, index: true },
    { name: "providerSafeCutoffAt", type: "date", required: true, index: true },
    { name: "renewalIntentSnapshot", type: "checkbox", required: true, defaultValue: true },
    { name: "currency", type: "text", required: true, defaultValue: "EUR" },
    {
      name: "netAmountMinor",
      type: "number",
      min: 0,
      validate: validateMinorAmount,
    },
    {
      name: "vatAmountMinor",
      type: "number",
      min: 0,
      validate: validateMinorAmount,
    },
    {
      name: "grossAmountMinor",
      type: "number",
      min: 0,
      validate: validateMinorAmount,
    },
    { name: "providerOperationId", type: "text", unique: true, index: true },
    { name: "providerStatus", type: "text" },
    { name: "paymentSecuredAt", type: "date", index: true },
    { name: "providerCommittedAt", type: "date", index: true },
    { name: "renewedAt", type: "date" },
    { name: "cancelledAt", type: "date" },
    { name: "failedAt", type: "date" },
    { name: "failureReason", type: "textarea" },
    { name: "reconciliationRequired", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "lastSyncedAt", type: "date" },
    { name: "stateHistory", type: "json", admin: { readOnly: true } },
    { name: "createdAt", type: "date", required: true, index: true },
  ],
}
