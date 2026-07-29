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
  domainOffboardingContinuityEvidenceSchema,
  managedDomainCustodyStates,
  managedDomainCustodyStateTransitions,
  managedDomainStates,
  managedDomainStateTransitions,
  paymentAttemptStates,
  paymentAttemptStateTransitions,
  providerRenewalModes,
  refundScenarios,
  renewalFinancialCoverageStates,
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
  "checkoutUrl",
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
  "providerRefundIds",
  "chargebackAmountMinor",
  "chargebackAt",
  "providerChargebackIds",
  "failureCode",
  "failureMessage",
  "stateHistory",
])

export const protectPaymentAttempt: CollectionBeforeChangeHook = (args) =>
  protectLifecycleUpdate(args, {
    label: "Payment-attempt",
    contextKey: "paymentAttemptLifecycleMutation",
    allowedFields: paymentAttemptMutableFields,
    relationshipFields: new Set(["order", "tenant", "billingAgreement"]),
    stateTransitions: paymentAttemptStateTransitions,
  })

const billingAgreementMutableFields = new Set([
  "state",
  "providerCustomerId",
  "providerMandateId",
  "renewalIntent",
  "nextChargeAt",
  "currentPeriodStartsAt",
  "currentPeriodEndsAt",
  "graceStartedAt",
  "graceEndsAt",
  "lastPaymentAttemptAt",
  "suspendedAt",
  "restoredAt",
  "serviceSuspensionStatus",
  "cancelAt",
  "cancelledAt",
  "endedAt",
  "cancellationEvidence",
  "adminExceptionCode",
  "adminExceptionAt",
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
  "custodyStatus",
  "providerCustomerHandle",
  "providerDomainId",
  "providerRegistrationState",
  "registrationRequestedAt",
  "cloudflareZoneId",
  "cloudflareNameservers",
  "cloudflareDnsRecordIds",
  "cloudflareZoneStatus",
  "edgeRoutingStatus",
  "edgeRoutingCheckedAt",
  "edgeRoutingEvidence",
  "adminHttpsStatus",
  "adminHttpsCheckedAt",
  "adminHttpsEvidence",
  "registrantVerificationStatus",
  "registrantVerificationCheckedAt",
  "registrantVerificationDueAt",
  "registrantVerificationRecoveredAt",
  "registrantVerificationDescription",
  "authoritativeDnsStatus",
  "authoritativeDnsCheckedAt",
  "authoritativeDnsEvidence",
  "httpsStatus",
  "httpsCheckedAt",
  "httpsEvidence",
  "entitlementStatus",
  "entitlementActivatedAt",
  "customerStatus",
  "renewalIntent",
  "registeredAt",
  "transferredAt",
  "expiresAt",
  "providerRenewalDate",
  "registryExpiryDate",
  "earliestExplicitRenewalAt",
  "registrarSafeCutoffAt",
  "paymentChargeAt",
  "providerSafeRenewalCutoffAt",
  "providerAutorenew",
  "providerAutorenewCheckedAt",
  "providerRenewalPriceNetMinor",
  "providerRenewalPriceCurrency",
  "providerRenewalPriceQuotedAt",
  "reconciliationRequired",
  "lastSyncedAt",
  "failureReason",
  "stateHistory",
  "encryptedTransferOutCode",
  "transferOutCodeDeliveryStatus",
  "transferOutCodeFetchedAt",
  "transferOutCodeLastRevealedAt",
  "transferOutCodeDeletedAt",
  "transferOutStartedAt",
  "transferOutProviderMissingCount",
  "transferOutFirstMissingAt",
  "transferOutLastCheckedAt",
  "transferOutConfirmedAt",
])

const managedDomainFrozenOffboardingFields = new Set([
  "offboardingRequestedAt",
  "offboardingRequestedByEmail",
  "offboardingRequestId",
  "offboardingReason",
  "offboardingContinuityEvidence",
  "transferOutCustomerConfirmedAt",
])

const managedDomainTerminalTransferFields = new Set([
  "transferOutCodeDeletedAt",
  "transferOutProviderMissingCount",
  "transferOutFirstMissingAt",
  "transferOutLastCheckedAt",
  "transferOutConfirmedAt",
])

export const protectManagedDomain: CollectionBeforeChangeHook = (args) => {
  if (args.operation === "update") {
    const original = args.originalDoc as Record<string, unknown> | undefined
    const currentCustody = original?.custodyStatus ?? "managed"
    const nextCustody = args.data?.custodyStatus
    if (
      typeof currentCustody === "string" &&
      typeof nextCustody === "string" &&
      currentCustody !== nextCustody &&
      !managedDomainCustodyStateTransitions[
        currentCustody as keyof typeof managedDomainCustodyStateTransitions
      ]?.includes(nextCustody as never)
    ) {
      throw new Error(
        `Invalid managed-domain custody transition: ${currentCustody} -> ${nextCustody}.`,
      )
    }
    const changedFrozenField = Object.keys(args.data ?? {}).find((field) => {
      if (!managedDomainFrozenOffboardingFields.has(field)) return false
      const previous = original?.[field]
      return previous != null &&
        stableStringify(previous) !== stableStringify(args.data?.[field])
    })
    if (changedFrozenField) {
      throw new Error(
        `Managed-domain offboarding field "${changedFrozenField}" is immutable after capture.`,
      )
    }
    if (currentCustody === "transferred_out") {
      const changedTerminalField = Object.keys(args.data ?? {}).find((field) =>
        managedDomainTerminalTransferFields.has(field) &&
        stableStringify(original?.[field]) !== stableStringify(args.data?.[field])
      )
      if (changedTerminalField) {
        throw new Error(
          `Managed-domain terminal transfer field "${changedTerminalField}" is immutable.`,
        )
      }
    }
  }
  return protectLifecycleUpdate(args, {
    label: "Managed-domain",
    contextKey: "managedDomainLifecycleMutation",
    allowedFields: new Set([
      ...managedDomainMutableFields,
      ...managedDomainFrozenOffboardingFields,
    ]),
    relationshipFields: new Set(["originatingOrder", "registrantProfile", "tenant"]),
    stateTransitions: managedDomainStateTransitions,
  })
}

export const validateManagedDomainCustody: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
}) => {
  if (!data) return data
  const current = {
    ...(originalDoc as Record<string, unknown> | undefined),
    ...data,
  }
  const custodyStatus = String(current.custodyStatus ?? "managed")
  if (
    custodyStatus !== "managed" &&
    (
      !current.offboardingRequestedAt ||
      !current.offboardingRequestedByEmail ||
      !current.offboardingRequestId ||
      !current.offboardingContinuityEvidence
    )
  ) {
    throw new Error("Domain offboarding requires immutable customer and continuity evidence.")
  }
  if (current.offboardingContinuityEvidence) {
    const evidence = domainOffboardingContinuityEvidenceSchema.parse(
      current.offboardingContinuityEvidence,
    )
    if (evidence.domain !== current.domainNameAscii) {
      throw new Error("Domain offboarding continuity evidence belongs to another domain.")
    }
  }
  if (
    ["transfer_code_ready", "transfer_pending"].includes(custodyStatus) &&
    !current.encryptedTransferOutCode
  ) {
    throw new Error("Transfer-out readiness requires an encrypted provider auth code.")
  }
  if (
    custodyStatus === "transferred_out" &&
    (
      (
        typeof current.offboardingContinuityEvidence === "object" &&
        current.offboardingContinuityEvidence != null &&
        !Array.isArray(current.offboardingContinuityEvidence) &&
        (current.offboardingContinuityEvidence as Record<string, unknown>)
          .schemaVersion !== 2
      ) ||
      current.encryptedTransferOutCode ||
      !current.transferOutCustomerConfirmedAt ||
      !current.transferOutCodeDeletedAt ||
      !current.transferOutConfirmedAt ||
      typeof current.transferOutProviderMissingCount !== "number" ||
      current.transferOutProviderMissingCount < 2 ||
      !current.transferOutFirstMissingAt ||
      !current.transferOutLastCheckedAt ||
      !Number.isFinite(new Date(String(current.transferOutFirstMissingAt)).getTime()) ||
      !Number.isFinite(new Date(String(current.transferOutLastCheckedAt)).getTime()) ||
      new Date(String(current.transferOutLastCheckedAt)).getTime() -
        new Date(String(current.transferOutFirstMissingAt)).getTime() <
        15 * 60_000
    )
  ) {
    throw new Error(
      "Confirmed transfer-out requires customer confirmation, two time-separated provider observations and deletion of the encrypted auth code.",
    )
  }
  return data
}

const renewalCycleMutableFields = new Set([
  "state",
  "order",
  "paymentAttempt",
  "providerOperationId",
  "providerStatus",
  "providerAutorenew",
  "providerWriteState",
  "providerWriteRequestedAt",
  "providerBalanceAvailableMinor",
  "providerBalanceReservedMinor",
  "providerBalanceCurrency",
  "providerBalanceCheckedAt",
  "providerOperationPriceNetMinor",
  "includedAllowanceNetMinor",
  "surchargeNetMinor",
  "financialCoverageState",
  "pricingEvidence",
  "netAmountMinor",
  "vatAmountMinor",
  "grossAmountMinor",
  "paymentSecuredAt",
  "providerCommittedAt",
  "renewedAt",
  "cancelledAt",
  "failedAt",
  "failureReason",
  "adminExceptionCode",
  "adminExceptionAt",
  "reconciliationRequired",
  "lastSyncedAt",
  "stateHistory",
])

export const validateDomainRenewalCycle: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  if (
    data.providerRenewalMode === "explicit_renew" &&
    data.providerAutorenew !== "off"
  ) {
    throw new Error("An explicit renewal cycle requires provider autorenew to be off.")
  }
  return data
}

const accountingDocumentMutableFields = new Set([
  "state",
  "providerOperationId",
  "providerStatus",
  "issuedAt",
  "failedAt",
  "failureMessage",
  "reconciliationRequired",
  "lastSyncedAt",
  "stateHistory",
])

const accountingDocumentStateTransitions = {
  pending_provider: ["issued", "failed"],
  issued: [],
  failed: ["pending_provider", "issued"],
} as const

export const protectAccountingDocument: CollectionBeforeChangeHook = (args) => {
  if (args.operation === "update" && args.originalDoc?.state === "issued") {
    const changedIssuedIdentity = ["providerOperationId", "issuedAt"].find(
      (field) =>
        field in (args.data ?? {}) &&
        !immutableFieldIsUnchanged(
          field,
          args.data?.[field],
          args.originalDoc as Record<string, unknown>,
          new Set(),
        ),
    )
    if (changedIssuedIdentity) {
      throw new Error(
        `Issued accounting-document field "${changedIssuedIdentity}" is immutable.`,
      )
    }
  }
  return protectLifecycleUpdate(args, {
    label: "Accounting-document",
    contextKey: "accountingDocumentLifecycleMutation",
    allowedFields: accountingDocumentMutableFields,
    relationshipFields: new Set([
      "order",
      "paymentAttempt",
      "reversesDocument",
      "tenant",
    ]),
    stateTransitions: accountingDocumentStateTransitions,
  })
}

const renewalIndicativePricingFields = new Set([
  "providerOperationPriceNetMinor",
  "includedAllowanceNetMinor",
  "surchargeNetMinor",
  "pricingEvidence",
  "netAmountMinor",
  "vatAmountMinor",
  "grossAmountMinor",
])

export const protectDomainRenewalCycle: CollectionBeforeChangeHook = (args) => {
  if (args.operation === "update") {
    const changedPricingField = Object.keys(args.data ?? {}).find(
      (field) => renewalIndicativePricingFields.has(field) &&
        !immutableFieldIsUnchanged(
          field,
          args.data?.[field],
          args.originalDoc as Record<string, unknown>,
          new Set(),
        ),
    )
    if (
      changedPricingField &&
      (
        args.originalDoc?.state !== "scheduled" ||
        args.originalDoc?.order != null ||
        args.originalDoc?.paymentAttempt != null ||
        args.originalDoc?.paymentSecuredAt != null
      )
    ) {
      throw new Error(
        `Domain-renewal-cycle field "${changedPricingField}" is immutable after actionable financial evidence exists.`,
      )
    }
  }
  return protectLifecycleUpdate(args, {
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
}

const commerceNotificationMutableFields = new Set([
  "status",
  "attemptCount",
  "lastAttemptAt",
  "nextAttemptAt",
  "leaseUntil",
  "sentAt",
  "failedAt",
  "lastError",
])

export const protectCommerceNotification: CollectionBeforeChangeHook = (args) =>
  protectLifecycleUpdate(args, {
    label: "Commerce-notification",
    contextKey: "commerceNotificationLifecycleMutation",
    allowedFields: commerceNotificationMutableFields,
    relationshipFields: new Set([
      "billingAgreement",
      "renewalCycle",
      "tenant",
    ]),
    stateTransitions: {
      queued: ["processing", "cancelled"],
      processing: ["sent", "failed", "cancelled"],
      failed: ["processing", "cancelled"],
      sent: [],
      cancelled: [],
    },
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
    {
      name: "firstName",
      type: "text",
      admin: {
        description: adminText(
          "Authoritative natural-person given name. Empty only on legacy profiles.",
          "Gezaghebbende voornaam van de natuurlijke persoon. Alleen leeg bij oude profielen.",
        ),
      },
    },
    {
      name: "lastName",
      type: "text",
      admin: {
        description: adminText(
          "Authoritative natural-person family name. Empty only on legacy profiles.",
          "Gezaghebbende achternaam van de natuurlijke persoon. Alleen leeg bij oude profielen.",
        ),
      },
    },
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
  indexes: [{ fields: ["order", "purpose", "attemptNumber"], unique: true }],
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
    {
      name: "billingAgreement",
      type: "relationship",
      relationTo: "billing-agreements",
      index: true,
    },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    {
      name: "attemptNumber",
      type: "number",
      required: true,
      defaultValue: 1,
      min: 1,
      index: true,
    },
    {
      name: "state",
      type: "select",
      required: true,
      defaultValue: "created",
      options: selectOptions(paymentAttemptStates),
      index: true,
    },
    {
      name: "sequenceType",
      type: "select",
      options: selectOptions(["first", "recurring", "oneoff"]),
      index: true,
      admin: {
        description: adminText(
          "Required for Phase 4 attempts; empty only on records created before the typed Mollie lifecycle.",
          "Verplicht voor fase-4-pogingen; alleen leeg bij records van vóór de getypeerde Mollie-levenscyclus.",
        ),
      },
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
    { name: "checkoutUrl", type: "text" },
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
    { name: "providerRefundIds", type: "json", admin: { readOnly: true } },
    {
      name: "chargebackAmountMinor",
      type: "number",
      min: 0,
      validate: validateMinorAmount,
    },
    { name: "chargebackAt", type: "date" },
    { name: "providerChargebackIds", type: "json", admin: { readOnly: true } },
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
    { name: "providerCustomerId", type: "text", unique: true, index: true },
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
    { name: "currentPeriodStartsAt", type: "date", index: true },
    { name: "currentPeriodEndsAt", type: "date", index: true },
    { name: "graceStartedAt", type: "date", index: true },
    { name: "graceEndsAt", type: "date", index: true },
    { name: "lastPaymentAttemptAt", type: "date" },
    { name: "suspendedAt", type: "date", index: true },
    { name: "restoredAt", type: "date" },
    {
      name: "serviceSuspensionStatus",
      type: "select",
      required: true,
      defaultValue: "none",
      options: selectOptions(["none", "billing_suspended", "restoration_blocked"]),
      index: true,
    },
    { name: "cancelAt", type: "date", index: true },
    { name: "cancelledAt", type: "date" },
    { name: "endedAt", type: "date" },
    { name: "cancellationEvidence", type: "json", admin: { readOnly: true } },
    { name: "adminExceptionCode", type: "text", index: true },
    { name: "adminExceptionAt", type: "date" },
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
    beforeValidate: [normalizeManagedDomain, validateManagedDomainCustody],
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
      name: "custodyStatus",
      type: "select",
      required: true,
      defaultValue: "managed",
      options: selectOptions(managedDomainCustodyStates),
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
    { name: "providerCustomerHandle", type: "text", index: true },
    {
      name: "providerRegistrationState",
      type: "select",
      required: true,
      defaultValue: "not_started",
      options: selectOptions(["not_started", "prepared", "indeterminate", "confirmed"]),
      index: true,
    },
    { name: "registrationRequestedAt", type: "date", index: true },
    { name: "cloudflareZoneId", type: "text", unique: true, index: true },
    { name: "cloudflareNameservers", type: "json", admin: { readOnly: true } },
    { name: "cloudflareDnsRecordIds", type: "json", admin: { readOnly: true } },
    { name: "cloudflareZoneStatus", type: "text", index: true },
    {
      name: "edgeRoutingStatus",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: selectOptions(["pending", "configured", "active", "failed"]),
      index: true,
    },
    { name: "edgeRoutingCheckedAt", type: "date", index: true },
    { name: "edgeRoutingEvidence", type: "json", admin: { readOnly: true } },
    {
      name: "adminHttpsStatus",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: selectOptions(["pending", "verified", "failed"]),
      index: true,
    },
    { name: "adminHttpsCheckedAt", type: "date", index: true },
    { name: "adminHttpsEvidence", type: "json", admin: { readOnly: true } },
    {
      name: "registrantVerificationStatus",
      type: "select",
      required: true,
      defaultValue: "not_checked",
      options: selectOptions([
        "not_checked",
        "not_required",
        "pending",
        "verified",
        "overdue",
        "suspended",
        "recovered",
        "failed",
      ]),
      index: true,
    },
    { name: "registrantVerificationCheckedAt", type: "date" },
    { name: "registrantVerificationDueAt", type: "date", index: true },
    { name: "registrantVerificationRecoveredAt", type: "date" },
    { name: "registrantVerificationDescription", type: "textarea" },
    {
      name: "authoritativeDnsStatus",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: selectOptions(["pending", "verified", "failed"]),
      index: true,
    },
    { name: "authoritativeDnsCheckedAt", type: "date" },
    { name: "authoritativeDnsEvidence", type: "json", admin: { readOnly: true } },
    {
      name: "httpsStatus",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: selectOptions(["pending", "verified", "failed"]),
      index: true,
    },
    { name: "httpsCheckedAt", type: "date" },
    { name: "httpsEvidence", type: "json", admin: { readOnly: true } },
    {
      name: "entitlementStatus",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: selectOptions(["pending", "active", "blocked"]),
      index: true,
    },
    { name: "entitlementActivatedAt", type: "date" },
    {
      name: "customerStatus",
      type: "select",
      required: true,
      defaultValue: "provisioning",
      options: selectOptions(["provisioning", "verification_required", "active", "manual_review"]),
      index: true,
    },
    { name: "renewalIntent", type: "checkbox", required: true, defaultValue: true, index: true },
    { name: "registeredAt", type: "date" },
    { name: "transferredAt", type: "date" },
    { name: "expiresAt", type: "date", index: true },
    { name: "providerRenewalDate", type: "date", index: true },
    { name: "registryExpiryDate", type: "date", index: true },
    { name: "earliestExplicitRenewalAt", type: "date", index: true },
    { name: "registrarSafeCutoffAt", type: "date", index: true },
    { name: "paymentChargeAt", type: "date", index: true },
    { name: "providerSafeRenewalCutoffAt", type: "date", index: true },
    {
      name: "providerAutorenew",
      type: "select",
      required: true,
      defaultValue: "unknown",
      options: selectOptions(["on", "off", "default", "unknown"]),
      index: true,
    },
    { name: "providerAutorenewCheckedAt", type: "date" },
    {
      name: "providerRenewalPriceNetMinor",
      type: "number",
      min: 0,
      validate: validateMinorAmount,
    },
    { name: "providerRenewalPriceCurrency", type: "text" },
    { name: "providerRenewalPriceQuotedAt", type: "date" },
    { name: "offboardingRequestedAt", type: "date", index: true },
    { name: "offboardingRequestedByEmail", type: "email", index: true },
    { name: "offboardingRequestId", type: "text", unique: true, index: true },
    { name: "offboardingReason", type: "textarea" },
    {
      name: "offboardingContinuityEvidence",
      type: "json",
      admin: { readOnly: true },
    },
    {
      name: "encryptedTransferOutCode",
      type: "textarea",
      access: { read: () => false },
      admin: { hidden: true },
    },
    {
      name: "transferOutCodeDeliveryStatus",
      type: "select",
      required: true,
      defaultValue: "not_requested",
      options: selectOptions([
        "not_requested",
        "provider_returned",
        "registrant_email",
      ]),
      index: true,
    },
    { name: "transferOutCodeFetchedAt", type: "date" },
    { name: "transferOutCodeLastRevealedAt", type: "date" },
    { name: "transferOutCodeDeletedAt", type: "date" },
    { name: "transferOutStartedAt", type: "date", index: true },
    {
      name: "transferOutProviderMissingCount",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
    },
    { name: "transferOutFirstMissingAt", type: "date" },
    { name: "transferOutLastCheckedAt", type: "date" },
    { name: "transferOutCustomerConfirmedAt", type: "date", index: true },
    { name: "transferOutConfirmedAt", type: "date", index: true },
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
  indexes: [{ fields: ["managedDomain", "providerRenewalDate"], unique: true }],
  labels: {
    singular: { en: "Domain renewal cycle", nl: "Domeinverlengingscyclus" },
    plural: { en: "Domain renewal cycles", nl: "Domeinverlengingscycli" },
  },
  access: systemOwnedAccess,
  hooks: {
    beforeValidate: [validateDomainRenewalCycle],
    beforeChange: [protectDomainRenewalCycle],
  },
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
    { name: "providerRenewalDate", type: "date", required: true, index: true },
    { name: "registryExpiryDate", type: "date", index: true },
    { name: "earliestExplicitRenewalAt", type: "date", index: true },
    { name: "registrarSafeCutoffAt", type: "date", index: true },
    { name: "paymentChargeAt", type: "date", index: true },
    { name: "providerSafeCutoffAt", type: "date", required: true, index: true },
    { name: "renewalIntentSnapshot", type: "checkbox", required: true, defaultValue: true },
    {
      name: "providerRenewalMode",
      type: "select",
      required: true,
      defaultValue: "provider_autorenew",
      options: selectOptions(providerRenewalModes),
      index: true,
    },
    {
      name: "providerAutorenew",
      type: "select",
      required: true,
      defaultValue: "unknown",
      options: selectOptions(["on", "off", "default", "unknown"]),
      index: true,
    },
    {
      name: "providerWriteState",
      type: "select",
      required: true,
      defaultValue: "not_required",
      options: selectOptions(["not_required", "prepared", "indeterminate", "confirmed", "failed"]),
      index: true,
    },
    { name: "providerWriteRequestedAt", type: "date" },
    {
      name: "providerBalanceAvailableMinor",
      type: "number",
      min: 0,
      validate: validateMinorAmount,
    },
    {
      name: "providerBalanceReservedMinor",
      type: "number",
      min: 0,
      validate: validateMinorAmount,
    },
    { name: "providerBalanceCurrency", type: "text" },
    { name: "providerBalanceCheckedAt", type: "date" },
    { name: "currency", type: "text", required: true, defaultValue: "EUR" },
    {
      name: "providerOperationPriceNetMinor",
      type: "number",
      required: true,
      min: 0,
      validate: validateMinorAmount,
    },
    {
      name: "includedAllowanceNetMinor",
      type: "number",
      required: true,
      min: 0,
      validate: validateMinorAmount,
    },
    {
      name: "surchargeNetMinor",
      type: "number",
      required: true,
      min: 0,
      validate: validateMinorAmount,
    },
    {
      name: "financialCoverageState",
      type: "select",
      required: true,
      defaultValue: "uncovered",
      options: selectOptions(renewalFinancialCoverageStates),
      index: true,
    },
    { name: "pricingEvidence", type: "json", required: true, admin: { readOnly: true } },
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
    { name: "adminExceptionCode", type: "text", index: true },
    { name: "adminExceptionAt", type: "date" },
    { name: "reconciliationRequired", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "lastSyncedAt", type: "date" },
    { name: "stateHistory", type: "json", admin: { readOnly: true } },
    { name: "createdAt", type: "date", required: true, index: true },
  ],
}

export const CommerceNotificationDeliveries: CollectionConfig = {
  slug: "commerce-notification-deliveries",
  lockDocuments: false,
  labels: {
    singular: { en: "Commerce notification", nl: "Commercekennisgeving" },
    plural: { en: "Commerce notifications", nl: "Commercekennisgevingen" },
  },
  access: systemOwnedAccess,
  hooks: { beforeChange: [protectCommerceNotification] },
  admin: {
    useAsTitle: "notificationKey",
    defaultColumns: ["kind", "status", "recipient", "tenant", "eventAt", "sentAt"],
    description: adminText(
      "Idempotent billing and domain-renewal delivery evidence. Message bodies are not stored.",
      "Idempotent bewijs van facturatie- en domeinverlengingsmeldingen. Berichtinhoud wordt niet opgeslagen.",
    ),
  },
  fields: [
    { name: "notificationKey", type: "text", required: true, unique: true, index: true },
    { name: "billingAgreement", type: "relationship", relationTo: "billing-agreements", index: true },
    { name: "renewalCycle", type: "relationship", relationTo: "domain-renewal-cycles", index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, index: true },
    { name: "recipient", type: "email", required: true, index: true },
    {
      name: "kind",
      type: "select",
      required: true,
      options: selectOptions([
        "payment_received",
        "domain_verification_required",
        "site_live_handoff",
        "upcoming_charge_7d",
        "payment_failed_0d",
        "payment_overdue_3d",
        "payment_overdue_7d",
        "payment_overdue_13d",
        "service_suspended_14d",
        "service_restored",
        "cancellation_scheduled",
        "cancellation_effective",
        "domain_renewal_90d",
        "domain_renewal_60d",
        "domain_renewal_30d",
        "domain_renewal_14d",
        "domain_renewal_7d",
        "domain_renewal_admin_7d",
        "domain_renewal_1d",
        "domain_renewed",
      ]),
      index: true,
    },
    { name: "templateVersion", type: "text", required: true },
    { name: "eventAt", type: "date", required: true, index: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "queued",
      options: selectOptions(["queued", "processing", "sent", "failed", "cancelled"]),
      index: true,
    },
    { name: "attemptCount", type: "number", required: true, defaultValue: 0, min: 0 },
    { name: "lastAttemptAt", type: "date" },
    { name: "nextAttemptAt", type: "date", index: true },
    { name: "leaseUntil", type: "date", index: true },
    { name: "sentAt", type: "date", index: true },
    { name: "failedAt", type: "date" },
    { name: "lastError", type: "textarea" },
  ],
}

export const AccountingDocuments: CollectionConfig = {
  slug: "accounting-documents",
  lockDocuments: false,
  labels: {
    singular: { en: "Accounting document", nl: "Boekhouddocument" },
    plural: { en: "Accounting documents", nl: "Boekhouddocumenten" },
  },
  access: systemOwnedAccess,
  hooks: { beforeChange: [protectAccountingDocument] },
  admin: {
    useAsTitle: "documentNumber",
    defaultColumns: [
      "documentType",
      "documentNumber",
      "state",
      "order",
      "grossAmountMinor",
      "issuedAt",
    ],
    description: adminText(
      "Frozen invoice and credit-note evidence derived from accepted orders and reconciled provider operations.",
      "Bevroren factuur- en creditnota-evidence afgeleid van geaccepteerde bestellingen en gereconcilieerde providerbewerkingen.",
    ),
  },
  fields: [
    { name: "evidenceKey", type: "text", required: true, unique: true, index: true },
    { name: "documentNumber", type: "text", required: true, unique: true, index: true },
    {
      name: "documentType",
      type: "select",
      required: true,
      options: selectOptions(["invoice", "credit_note"]),
      index: true,
    },
    {
      name: "state",
      type: "select",
      required: true,
      options: selectOptions(["pending_provider", "issued", "failed"]),
      index: true,
    },
    { name: "order", type: "relationship", relationTo: "orders", required: true, index: true },
    {
      name: "paymentAttempt",
      type: "relationship",
      relationTo: "payment-attempts",
      required: true,
      index: true,
    },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    {
      name: "reversesDocument",
      type: "relationship",
      relationTo: "accounting-documents",
      index: true,
    },
    {
      name: "reason",
      type: "select",
      required: true,
      options: selectOptions(["payment_collected", "refund", "chargeback"]),
      index: true,
    },
    {
      name: "refundScenario",
      type: "select",
      options: selectOptions(refundScenarios),
      index: true,
    },
    { name: "providerOperationId", type: "text", unique: true, index: true },
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
    { name: "lineItems", type: "json", required: true },
    { name: "customerSnapshot", type: "json", required: true },
    { name: "issuedAt", type: "date", index: true },
    { name: "failedAt", type: "date" },
    { name: "failureMessage", type: "textarea" },
    {
      name: "reconciliationRequired",
      type: "checkbox",
      required: true,
      defaultValue: false,
      index: true,
    },
    { name: "lastSyncedAt", type: "date", index: true },
    { name: "stateHistory", type: "json", admin: { readOnly: true } },
    { name: "createdAt", type: "date", required: true, index: true },
  ],
}
