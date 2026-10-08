import { createSiteSettingsData } from "@/lib/queries/siteSettingsDefaults"
import type { DomainMigration, Media, Page, PreviewAccessGrant, SiteGenerationRun, Tenant, User } from "@/payload-types"

const timestamp = "2026-08-01T00:00:00.000Z"

export const tenantFixture = (patch: Partial<Tenant> = {}): Tenant => ({
  id: 1, name: "Fixture tenant", slug: "fixture", domain: "fixture.example", status: "provisioning",
  createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const userFixture = (patch: Partial<User> = {}): User => ({
  id: 1, role: "super-admin", email: "fixture@example.com", collection: "users",
  createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const pageFixture = (patch: Partial<Page> = {}): Page => ({
  id: 1, title: "Fixture page", slug: "index", status: "draft",
  createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const generationRunFixture = (patch: Partial<SiteGenerationRun> = {}): SiteGenerationRun => ({
  id: 1, intakeSubmission: 1, status: "preview_ready", idempotencyKey: "fixture-run",
  normalizedIntake: null, normalizedIntakeHash: "fixture", provider: "fixture", model: "fixture",
  promptVersion: "v1", generationInputHash: "fixture", createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const previewGrantFixture = (patch: Partial<PreviewAccessGrant> = {}): PreviewAccessGrant => ({
  id: 1, customerEmail: "fixture@example.com", tenant: 1, generationRun: 1, clientSlug: "fixture",
  expiryPolicy: "fixed",
  expiresAt: "2026-09-01T00:00:00.000Z", createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const paginatedFixture = <T>(docs: T[], patch: Partial<import("payload").PaginatedDocs<T>> = {}): import("payload").PaginatedDocs<T> => ({
  docs, totalDocs: docs.length, totalPages: 1, page: 1, limit: 50, pagingCounter: 1,
  hasNextPage: false, hasPrevPage: false, nextPage: null, prevPage: null, ...patch,
})

export const mediaFixture = (patch: Partial<Media> = {}): Media => ({
  id: 1, createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const domainMigrationFixture = (patch: Partial<DomainMigration> = {}): DomainMigration => ({
  id: 1, idempotencyKey: "fixture-migration", originatingOrder: 1, checkoutProfile: 1, tenant: 1,
  domainNameAscii: "fixture.example", tld: "example", acceptedClassification: "automatic",
  state: "awaiting_customer", sourceMechanism: "validated_provider_export_v1",
  operatorWorkAuthorizationState: "not_required", dnssecPhase: "source_unsigned",
  dnssecWriteState: "not_started", providerTransferState: "not_started", cloudflareZoneState: "not_started",
  cutoverWriteState: "not_started", rollbackWriteState: "not_started", reconciliationRequired: false,
  createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const paymentAttemptFixture = (patch: Partial<import("@/payload-types").PaymentAttempt> = {}): import("@/payload-types").PaymentAttempt => ({
  id: 1, idempotencyKey: "fixture-attempt", order: 1, attemptNumber: 1, state: "created", purpose: "recurring", provider: "mollie", currency: "EUR", netAmountMinor: 1900, vatAmountMinor: 399, grossAmountMinor: 2299, reconciliationRequired: false, createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const orderFixture = (patch: Partial<import("@/payload-types").Order> = {}): import("@/payload-types").Order => ({
  id: 1, orderNumber: "fixture-order", customerName: "Fixture customer", customerEmail: "fixture@example.com", companyName: "Fixture company", billingAddress: { country: "NL" }, packageCode: "siteinabox-monthly", billingPeriod: "monthly", renewalTerms: "Monthly", lineItems: [], currency: "EUR", subtotalNet: 19, vatAmount: 3.99, totalGross: 22.99, domain: "fixture.example", domainRegistrant: {}, legalDocuments: [], paymentStatus: "pending", paymentProvider: "mollie", createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const billingAgreementFixture = (patch: Partial<import("@/payload-types").BillingAgreement> = {}): import("@/payload-types").BillingAgreement => ({
  id: 1, idempotencyKey: "fixture-agreement", originatingOrder: 1, checkoutProfile: 1, state: "active", provider: "mollie", catalogVersion: "fixture", packageCode: "siteinabox-monthly", billingPeriod: "monthly", currency: "EUR", recurringNetAmountMinor: 1900, renewalIntent: true, serviceSuspensionStatus: "none", reconciliationRequired: false, createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const managedDomainFixture = (patch: Partial<import("@/payload-types").ManagedDomain> = {}): import("@/payload-types").ManagedDomain => ({
  id: 1, domainNameAscii: "fixture.example", tld: "example", provisioningIdempotencyKey: "fixture-domain", originatingOrder: 1, registrantProfile: 1, state: "pending", custodyStatus: "managed", initialOperation: "registration", registrantOwnership: "customer", provider: "openprovider", providerRegistrationState: "not_started", edgeRoutingStatus: "pending", adminHttpsStatus: "pending", registrantVerificationStatus: "not_checked", authoritativeDnsStatus: "pending", httpsStatus: "pending", entitlementStatus: "pending", customerStatus: "provisioning", renewalIntent: true, providerAutorenew: "unknown", transferOutCodeDeliveryStatus: "not_requested", transferOutProviderMissingCount: 0, reconciliationRequired: false, createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const checkoutProgressFixture = (patch: Partial<import("@/payload-types").CheckoutProgressDraft> = {}): import("@/payload-types").CheckoutProgressDraft => ({
  id: 1, previewAccessGrant: 1, tenant: 1, generationRun: 1, domainMode: "new_registration", decision: "domain", billingPeriod: "monthly", expiresAt: "2026-09-01T00:00:00.000Z", createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const communicationPreferenceFixture = (patch: Partial<import("@/payload-types").CommunicationPreference> = {}): import("@/payload-types").CommunicationPreference => ({
  id: 1, subjectKey: "fixture-preference", email: "fixture@example.com", marketing: false, productNotifications: false, directory: false, suppressed: false, statementVersion: "v1", locale: "nl", createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const communicationPreferenceEventFixture = (patch: Partial<import("@/payload-types").CommunicationPreferenceEvent> = {}): import("@/payload-types").CommunicationPreferenceEvent => ({
  id: 1, eventKey: "fixture-event", preference: 1, preferenceType: "marketing", action: "opt_out", channel: "email", statementVersion: "v1", statementText: "Fixture decision", source: "public-intake", occurredAt: timestamp, createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const legalRequirementFixture = (patch: Partial<import("@/payload-types").LegalRequirement> = {}): import("@/payload-types").LegalRequirement => ({
  id: 1, requirementKey: "fixture-requirement", subjectEmail: "fixture@example.com", document: 1, action: "mandatory_reaccept", status: "pending", createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const legalNotificationDeliveryFixture = (patch: Partial<import("@/payload-types").LegalNotificationDelivery> = {}): import("@/payload-types").LegalNotificationDelivery => ({
  id: 1, notificationKey: "fixture-notification", requirement: 1, tenant: 1, recipient: "fixture@example.com", kind: "initial", templateVersion: "v1", status: "queued", attemptCount: 0, nextAttemptAt: timestamp, createdAt: timestamp, updatedAt: timestamp, ...patch,
})

export const siteSettingsFixture = (patch: Partial<import("@/payload-types").SiteSetting> = {}): import("@/payload-types").SiteSetting => ({ ...createSiteSettingsData(1, "Fixture", "https://fixture.example"), id: 1, createdAt: timestamp, updatedAt: timestamp, ...patch })

export const publishedSnapshotFixture = (patch: Partial<import("@/payload-types").PublishedSiteSnapshot> = {}): import("@/payload-types").PublishedSiteSnapshot => ({ id: 1, tenant: 1, snapshotKey: "fixture-snapshot", version: 1, status: "drafted", domain: "fixture.example", snapshotHash: "fixture", snapshot: {}, publishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp, ...patch })

export const operationalAlertFixture = (patch: Partial<import("@/payload-types").OperationalAlert> = {}): import("@/payload-types").OperationalAlert => ({ id: 1, severity: "error", status: "open", source: "domains", dedupeKey: "fixture-alert", message: "Fixture alert", occurrenceCount: 1, firstSeenAt: timestamp, lastSeenAt: timestamp, createdAt: timestamp, updatedAt: timestamp, ...patch })

export const migrationCheckoutSecretFixture = (patch: Partial<import("@/payload-types").MigrationCheckoutSecret> = {}): import("@/payload-types").MigrationCheckoutSecret => ({ id: 1, secretKey: "fixture-secret", domainNameAscii: "fixture.example", sourceZoneHash: "fixture", state: "pending_order", expiresAt: "2026-09-01T00:00:00.000Z", createdAt: timestamp, updatedAt: timestamp, ...patch })

export const migrationSourceAuthorizationFixture = (patch: Partial<import("@/payload-types").MigrationSourceAuthorization> = {}): import("@/payload-types").MigrationSourceAuthorization => ({ id: 1, authorizationKey: "fixture-authorization", stateDigest: "fixture-state", browserBindingDigest: "fixture-browser", clientSlug: "fixture", customerEmailDigest: "fixture-email", domainNameAscii: "fixture.example", state: "pending", expiresAt: "2026-09-01T00:00:00.000Z", createdAt: timestamp, updatedAt: timestamp, ...patch })

export const legalDocumentFixture = (patch: Partial<import("@/payload-types").LegalDocument> = {}): import("@/payload-types").LegalDocument => ({ id: 1, releaseKey: "fixture-release", documentType: "platform-terms", locale: "nl", documentVersion: "v1", content: "Fixture terms", contentHash: "fixture", sourceCommit: "fixture", publishedAt: timestamp, effectiveAt: timestamp, changeCategory: "contract_material", changeSummary: "Fixture changes", changeRationale: "Fixture rationale", customerAction: "mandatory_reaccept", consentAction: "none", createdAt: timestamp, updatedAt: timestamp, ...patch })

export const agreementAcceptanceFixture = (patch: Partial<import("@/payload-types").AgreementAcceptance> = {}): import("@/payload-types").AgreementAcceptance => ({ id: 1, evidenceKey: "fixture-acceptance", document: 1, documentVersion: "v1", acceptanceVersion: "v1", contentHash: "fixture", statementVersion: "v1", statementText: "Fixture acceptance", actorEmail: "fixture@example.com", acceptedAt: timestamp, requestId: "fixture-request", createdAt: timestamp, updatedAt: timestamp, ...patch })

export const legalPublicationEventFixture = (patch: Partial<import("@/payload-types").LegalPublicationEvent> = {}): import("@/payload-types").LegalPublicationEvent => ({ id: 1, eventKey: "fixture-publication", document: 1, eventType: "registered", occurredAt: timestamp, createdAt: timestamp, updatedAt: timestamp, ...patch })

export const checkoutProfileFixture = (patch: Partial<import("@/payload-types").CheckoutProfile> = {}): import("@/payload-types").CheckoutProfile => ({ id: 1, profileKey: "fixture-profile", profileVersion: 1, generationRun: 1, customerName: "Fixture customer", customerEmail: "fixture@example.com", partyType: "registered_business", contractingPartyName: "Fixture company", domainRegistrantSource: "contracting_party", billingAddress: { country: "NL" }, createdAt: timestamp, updatedAt: timestamp, ...patch })

export const intakeSubmissionFixture = (patch: Partial<import("@/payload-types").IntakeSubmission> = {}): import("@/payload-types").IntakeSubmission => ({ id: 1, businessName: "Fixture business", source: "public-intake", status: "submitted", idempotencyKey: "fixture-intake", raw: null, createdAt: timestamp, updatedAt: timestamp, ...patch })

export const commerceNotificationFixture = (patch: Partial<import("@/payload-types").CommerceNotificationDelivery> = {}): import("@/payload-types").CommerceNotificationDelivery => ({ id: 1, notificationKey: "fixture-commerce-notification", tenant: 1, recipient: "fixture@example.com", kind: "payment_received", templateVersion: "v1", eventAt: timestamp, status: "queued", attemptCount: 0, createdAt: timestamp, updatedAt: timestamp, ...patch })

export const siteReviewRevisionFixture = (patch: Partial<import("@/payload-types").SiteReviewRevision> = {}): import("@/payload-types").SiteReviewRevision => ({ id: 1, revisionKey: "fixture-review", tenant: 1, generationRun: 1, domain: "fixture.example", snapshotHash: "fixture", snapshot: {}, createdAt: timestamp, updatedAt: timestamp, ...patch })

export const siteApprovalFixture = (patch: Partial<import("@/payload-types").SiteApproval> = {}): import("@/payload-types").SiteApproval => ({ id: 1, evidenceKey: "fixture-approval", tenant: 1, reviewRevision: 1, domain: "fixture.example", snapshotHash: "fixture", statementVersion: "v1", statementText: "Fixture approval", actorEmail: "fixture@example.com", approvedAt: timestamp, requestId: "fixture-request", createdAt: timestamp, updatedAt: timestamp, ...patch })

export const accountingDocumentFixture = (patch: Partial<import("@/payload-types").AccountingDocument> = {}): import("@/payload-types").AccountingDocument => ({ id: 1, evidenceKey: "fixture-accounting", documentNumber: "fixture-invoice", documentType: "invoice", state: "pending_provider", order: 1, paymentAttempt: 1, reason: "payment_collected", currency: "EUR", netAmountMinor: 1900, vatAmountMinor: 399, grossAmountMinor: 2299, lineItems: [], customerSnapshot: {}, reconciliationRequired: false, createdAt: timestamp, updatedAt: timestamp, ...patch })
