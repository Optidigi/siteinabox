import type { CollectionBeforeChangeHook, CollectionConfig } from "payload"
import { adminEnumOption, adminText } from "@/lib/payloadAdminI18n"
import {
  legalChangeCategories,
  legalConsentActions,
  legalCustomerActions,
  legalDocumentTypes,
} from "@siteinabox/contracts/legal"
import { isSuperAdmin } from "@/access/isSuperAdmin"

const selectOptions = (values: readonly string[]) => values.map(adminEnumOption)
const appendOnlyAccess = {
  create: isSuperAdmin,
  read: isSuperAdmin,
  update: () => false,
  delete: () => false,
}

export const rejectRecordMutation: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation === "update") throw new Error("This legal evidence record is immutable after creation.")
  return data
}

const appendOnlyHooks = { beforeChange: [rejectRecordMutation] }

export const LegalDocuments: CollectionConfig = {
  slug: "legal-documents",
  labels: { singular: { en: "Legal document", nl: "Juridisch document" }, plural: { en: "Legal documents", nl: "Juridische documenten" } },
  access: appendOnlyAccess,
  hooks: appendOnlyHooks,
  admin: {
    useAsTitle: "releaseKey",
    defaultColumns: ["releaseKey", "documentType", "locale", "documentVersion", "effectiveAt"],
    description: adminText("Immutable copies of reviewed legal releases synchronized from Git.", "Onveranderlijke kopieën van beoordeelde juridische releases die vanuit Git zijn gesynchroniseerd."),
  },
  fields: [
    { name: "releaseKey", type: "text", required: true, unique: true, index: true },
    { name: "documentType", type: "select", required: true, options: selectOptions(legalDocumentTypes), index: true },
    { name: "locale", type: "text", required: true, index: true },
    { name: "documentVersion", type: "text", required: true, index: true },
    { name: "acceptanceVersion", type: "text", index: true,
      admin: { description: adminText("Required for contractual documents; privacy publications normally have no acceptance version.", "Verplicht voor contractuele documenten; privacypublicaties hebben normaal geen acceptatieversie.") } },
    { name: "replaces", type: "text" },
    { name: "content", type: "textarea", required: true },
    { name: "contentHash", type: "text", required: true, index: true },
    { name: "sourceCommit", type: "text", required: true },
    { name: "publishedAt", type: "date", required: true, index: true },
    { name: "effectiveAt", type: "date", required: true, index: true },
    { name: "changeCategory", type: "select", required: true, options: selectOptions(legalChangeCategories), index: true },
    { name: "changeSummary", type: "textarea", required: true },
    { name: "changeRationale", type: "textarea", required: true },
    { name: "customerAction", type: "select", required: true, options: selectOptions(legalCustomerActions), index: true },
    { name: "consentAction", type: "select", required: true, defaultValue: "none", options: selectOptions(legalConsentActions) },
    { name: "audience", type: "text" },
    { name: "noticeDays", type: "number", min: 0 },
  ],
}

export const LegalPublicationEvents: CollectionConfig = {
  slug: "legal-publication-events",
  labels: { singular: { en: "Legal publication event", nl: "Juridische publicatiegebeurtenis" }, plural: { en: "Legal publication events", nl: "Juridische publicatiegebeurtenissen" } },
  access: appendOnlyAccess,
  hooks: appendOnlyHooks,
  admin: { useAsTitle: "eventKey", defaultColumns: ["eventKey", "document", "eventType", "occurredAt"] },
  fields: [
    { name: "eventKey", type: "text", required: true, unique: true, index: true },
    { name: "document", type: "relationship", relationTo: "legal-documents", required: true, index: true },
    { name: "eventType", type: "select", required: true, options: selectOptions(["registered", "scheduled", "activated", "superseded", "failed"]), index: true },
    { name: "occurredAt", type: "date", required: true, index: true },
    { name: "supersededDocument", type: "relationship", relationTo: "legal-documents" },
    { name: "message", type: "textarea" },
    { name: "metadata", type: "json" },
  ],
}

export const AgreementAcceptances: CollectionConfig = {
  slug: "agreement-acceptances",
  labels: { singular: { en: "Agreement acceptance", nl: "Overeenkomstacceptatie" }, plural: { en: "Agreement acceptances", nl: "Overeenkomstacceptaties" } },
  access: appendOnlyAccess,
  hooks: appendOnlyHooks,
  admin: { useAsTitle: "evidenceKey", defaultColumns: ["evidenceKey", "tenant", "document", "acceptedAt", "actorEmail"] },
  fields: [
    { name: "evidenceKey", type: "text", required: true, unique: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    { name: "order", type: "relationship", relationTo: "orders", index: true },
    { name: "document", type: "relationship", relationTo: "legal-documents", required: true, index: true },
    { name: "documentVersion", type: "text", required: true },
    { name: "acceptanceVersion", type: "text", required: true, index: true },
    { name: "contentHash", type: "text", required: true },
    { name: "statementVersion", type: "text", required: true },
    { name: "statementText", type: "textarea", required: true },
    { name: "actorUser", type: "relationship", relationTo: "users", index: true },
    { name: "actorEmail", type: "email", required: true, index: true },
    { name: "acceptedAt", type: "date", required: true, index: true },
    { name: "requestId", type: "text", required: true, index: true },
    { name: "ipAddress", type: "text", admin: { description: adminText("Optional proportionate audit signal; apply the retention register.", "Optioneel proportioneel auditsignaal; pas het bewaartermijnenregister toe.") } },
    { name: "userAgent", type: "textarea" },
  ],
}

export const SiteReviewRevisions: CollectionConfig = {
  slug: "site-review-revisions",
  labels: { singular: { en: "Site review revision", nl: "Sitebeoordelingsversie" }, plural: { en: "Site review revisions", nl: "Sitebeoordelingsversies" } },
  access: appendOnlyAccess,
  hooks: appendOnlyHooks,
  admin: { useAsTitle: "revisionKey", defaultColumns: ["revisionKey", "tenant", "generationRun", "domain", "createdAt"] },
  fields: [
    { name: "revisionKey", type: "text", required: true, unique: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, index: true },
    { name: "generationRun", type: "relationship", relationTo: "site-generation-runs", required: true, index: true },
    { name: "domain", type: "text", required: true, index: true },
    { name: "snapshotHash", type: "text", required: true, index: true },
    { name: "snapshot", type: "json", required: true },
    { name: "createdAt", type: "date", required: true, index: true },
  ],
}

export const SiteApprovals: CollectionConfig = {
  slug: "site-approvals",
  labels: { singular: { en: "Site approval", nl: "Sitegoedkeuring" }, plural: { en: "Site approvals", nl: "Sitegoedkeuringen" } },
  access: appendOnlyAccess,
  hooks: appendOnlyHooks,
  admin: { useAsTitle: "evidenceKey", defaultColumns: ["evidenceKey", "tenant", "reviewRevision", "approvedAt", "actorEmail"] },
  fields: [
    { name: "evidenceKey", type: "text", required: true, unique: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, index: true },
    { name: "reviewRevision", type: "relationship", relationTo: "site-review-revisions", required: true, index: true },
    { name: "domain", type: "text", required: true },
    { name: "snapshotHash", type: "text", required: true, index: true },
    { name: "statementVersion", type: "text", required: true },
    { name: "statementText", type: "textarea", required: true },
    { name: "actorUser", type: "relationship", relationTo: "users" },
    { name: "actorEmail", type: "email", required: true, index: true },
    { name: "approvedAt", type: "date", required: true, index: true },
    { name: "requestId", type: "text", required: true },
  ],
}

const allowedOrderLifecycleFields = new Set(["paymentStatus", "providerPaymentId", "paidAt", "cancelledAt"])
export const protectFrozenOrder: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation !== "update") return data
  if (req.context?.legalOrderLifecycleMutation !== true) {
    throw new Error("Orders are frozen after creation. Use the payment lifecycle service.")
  }
  const invalid = Object.keys(data ?? {}).find((field) => !allowedOrderLifecycleFields.has(field))
  if (invalid) throw new Error(`Order field "${invalid}" is immutable after creation.`)
  return data
}

export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: { en: "Order", nl: "Bestelling" }, plural: { en: "Orders", nl: "Bestellingen" } },
  access: { create: isSuperAdmin, read: isSuperAdmin, update: () => false, delete: () => false },
  hooks: { beforeChange: [protectFrozenOrder] },
  admin: { useAsTitle: "orderNumber", defaultColumns: ["orderNumber", "tenant", "customerEmail", "totalGross", "paymentStatus", "createdAt"] },
  fields: [
    { name: "orderNumber", type: "text", required: true, unique: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    { name: "generationRun", type: "relationship", relationTo: "site-generation-runs", index: true },
    { name: "customerName", type: "text", required: true },
    { name: "customerEmail", type: "email", required: true, index: true },
    { name: "companyName", type: "text", required: true },
    { name: "billingAddress", type: "json", required: true },
    { name: "packageCode", type: "text", required: true },
    { name: "billingPeriod", type: "select", required: true, options: selectOptions(["one_time", "monthly", "quarterly", "annual"]) },
    { name: "renewalTerms", type: "textarea", required: true },
    { name: "lineItems", type: "json", required: true },
    { name: "currency", type: "text", required: true, defaultValue: "EUR" },
    { name: "subtotalNet", type: "number", required: true, min: 0 },
    { name: "vatAmount", type: "number", required: true, min: 0 },
    { name: "totalGross", type: "number", required: true, min: 0 },
    { name: "domain", type: "text", required: true, index: true },
    { name: "domainRegistrant", type: "json", required: true },
    { name: "legalDocuments", type: "relationship", relationTo: "legal-documents", hasMany: true, required: true },
    { name: "paymentStatus", type: "select", required: true, defaultValue: "pending", options: selectOptions(["pending", "open", "paid", "failed", "cancelled", "expired"]), index: true },
    { name: "paymentProvider", type: "select", required: true, defaultValue: "mollie", options: selectOptions(["mollie", "manual"]) },
    { name: "providerPaymentId", type: "text", index: true },
    { name: "createdAt", type: "date", required: true, index: true },
    { name: "paidAt", type: "date" },
    { name: "cancelledAt", type: "date" },
  ],
}

export const CommunicationPreferences: CollectionConfig = {
  slug: "communication-preferences",
  labels: { singular: { en: "Communication preference", nl: "Communicatievoorkeur" }, plural: { en: "Communication preferences", nl: "Communicatievoorkeuren" } },
  access: { create: isSuperAdmin, read: isSuperAdmin, update: isSuperAdmin, delete: () => false },
  admin: { useAsTitle: "subjectKey", defaultColumns: ["subjectKey", "email", "marketing", "productNotifications", "suppressed", "updatedAt"] },
  fields: [
    { name: "subjectKey", type: "text", required: true, unique: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    { name: "user", type: "relationship", relationTo: "users", index: true },
    { name: "email", type: "email", required: true, index: true },
    { name: "marketing", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "marketingConsentVersion", type: "text" },
    { name: "marketingConsentAt", type: "date", index: true },
    { name: "marketingConsentSource", type: "text" },
    { name: "productNotifications", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "directory", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "suppressed", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "suppressionReason", type: "select", options: selectOptions(["user_unsubscribe", "admin_suppression", "provider_bounce", "provider_complaint"]), index: true },
    { name: "statementVersion", type: "text", required: true },
    { name: "locale", type: "select", required: true, defaultValue: "nl", options: selectOptions(["nl", "en"]), index: true },
    { name: "updatedAt", type: "date", required: true, index: true },
  ],
}

export const CommunicationPreferenceEvents: CollectionConfig = {
  slug: "communication-preference-events",
  labels: { singular: { en: "Communication preference event", nl: "Communicatievoorkeurgebeurtenis" }, plural: { en: "Communication preference events", nl: "Communicatievoorkeurgebeurtenissen" } },
  access: appendOnlyAccess,
  hooks: appendOnlyHooks,
  admin: { useAsTitle: "eventKey", defaultColumns: ["eventKey", "preference", "preferenceType", "action", "occurredAt"] },
  fields: [
    { name: "eventKey", type: "text", required: true, unique: true, index: true },
    { name: "preference", type: "relationship", relationTo: "communication-preferences", required: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    { name: "user", type: "relationship", relationTo: "users", index: true },
    { name: "preferenceType", type: "select", required: true, options: selectOptions(["marketing", "product_notification", "tenant_notification", "locale", "directory", "suppression"]), index: true },
    { name: "action", type: "select", required: true, options: selectOptions(["opt_in", "opt_out", "subscribe", "unsubscribe", "update", "suppress", "unsuppress"]), index: true },
    { name: "channel", type: "select", required: true, defaultValue: "email", options: selectOptions(["email"]), index: true },
    { name: "category", type: "text", index: true },
    { name: "statementVersion", type: "text", required: true },
    { name: "statementText", type: "textarea", required: true },
    { name: "source", type: "text", required: true },
    { name: "occurredAt", type: "date", required: true, index: true },
    { name: "assertedAt", type: "date" },
    { name: "requestId", type: "text" },
    { name: "ipAddress", type: "text" },
    { name: "userAgent", type: "text" },
    { name: "metadata", type: "json" },
  ],
}

export const TenantNotificationSubscriptions: CollectionConfig = {
  slug: "tenant-notification-subscriptions",
  labels: { singular: { en: "Tenant notification subscription", nl: "Tenantmeldingsabonnement" }, plural: { en: "Tenant notification subscriptions", nl: "Tenantmeldingsabonnementen" } },
  access: { create: isSuperAdmin, read: isSuperAdmin, update: isSuperAdmin, delete: () => false },
  admin: { useAsTitle: "subscriptionKey", defaultColumns: ["tenant", "user", "email", "formSubmissions", "updatedAt"] },
  fields: [
    { name: "subscriptionKey", type: "text", required: true, unique: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, index: true },
    { name: "user", type: "relationship", relationTo: "users", required: true, index: true },
    { name: "email", type: "email", required: true, index: true },
    { name: "formSubmissions", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "publishingAndSiteStatus", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "domainAndDns", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "billingAndPayments", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "teamAndAccess", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "operationalDigest", type: "checkbox", required: true, defaultValue: false, index: true },
    { name: "updatedAt", type: "date", required: true, index: true },
  ],
}

export const LegalRequirements: CollectionConfig = {
  slug: "legal-requirements",
  labels: { singular: { en: "Legal requirement", nl: "Juridische vereiste" }, plural: { en: "Legal requirements", nl: "Juridische vereisten" } },
  access: { create: isSuperAdmin, read: isSuperAdmin, update: () => false, delete: () => false },
  admin: { useAsTitle: "requirementKey", defaultColumns: ["requirementKey", "tenant", "document", "action", "status", "enforceAt"] },
  fields: [
    { name: "requirementKey", type: "text", required: true, unique: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", index: true },
    { name: "subjectEmail", type: "email", required: true, index: true },
    { name: "document", type: "relationship", relationTo: "legal-documents", required: true, index: true },
    { name: "action", type: "select", required: true, options: selectOptions(legalCustomerActions), index: true },
    { name: "status", type: "select", required: true, defaultValue: "pending", options: selectOptions(["pending", "notified", "satisfied", "waived", "objected", "failed"]), index: true },
    { name: "enforceAt", type: "date", index: true },
    { name: "objectionDeadlineAt", type: "date", index: true },
    { name: "notifiedAt", type: "date" },
    { name: "noticeDeliveredAt", type: "date", index: true },
    { name: "objectedAt", type: "date", index: true },
    { name: "qualifyingUseAt", type: "date", index: true },
    { name: "deemedAcceptedAt", type: "date", index: true },
    { name: "satisfiedAt", type: "date" },
    { name: "resolutionBasis", type: "select", options: selectOptions(["explicit_acceptance", "transaction_acceptance", "qualifying_continued_use", "notice_window_elapsed", "objection", "waiver"]), index: true },
    { name: "resolutionEvidence", type: "json" },
    { name: "acceptance", type: "relationship", relationTo: "agreement-acceptances" },
    { name: "lastError", type: "textarea" },
  ],
}
