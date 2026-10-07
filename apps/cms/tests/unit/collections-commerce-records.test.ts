import type { ManagedDomain } from "@/payload-types"
import { validRenewalCycle } from "../_helpers/commerceBuilders"
import { managedDomainFixture, paymentAttemptFixture, billingAgreementFixture, commerceNotificationFixture, accountingDocumentFixture } from "../_helpers/generatedDocs"
import { hookCollection, hookRequest } from "../_helpers/hookFixtures"
import { userFixture } from "../_helpers/generatedDocs"
import {
  billingAgreementStates,
  domainRenewalCycleStates,
  managedDomainStates,
  orderStates,
  paymentAttemptStates,
} from "@siteinabox/contracts/commerce"
import { describe, expect, it } from "vitest"

import {
  AccountingDocuments,
  BillingAgreements,
  CheckoutProfiles,
  CommerceNotificationDeliveries,
  DomainRenewalCycles,
  ManagedDomains,
  normalizeManagedDomain,
  PaymentAttempts,
  protectAccountingDocument,
  protectBillingAgreement,
  protectCommerceNotification,
  protectDomainRenewalCycle,
  protectManagedDomain,
  protectPaymentAttempt,
  rejectCheckoutProfileMutation,
  validateCheckoutProfile,
  validateDomainRenewalCycle,
  validateManagedDomainCustody,
} from "@/collections/CommerceRecords"
import { Orders, protectFrozenOrder } from "@/collections/LegalRecords"
import { SiteGenerationRuns } from "@/collections/SiteGenerationRuns"

import { accessArgs, fieldAccessArgs } from "../_helpers/accessArgs"
import { hookArgsFor } from "../_helpers/hookFixtures"
import {
  expectNamedField,
  fieldOptions,
  fieldOptionValues,
  fieldValidator,
} from "../_helpers/payloadFields"

const commerceCollections = [
  CheckoutProfiles,
  PaymentAttempts,
  BillingAgreements,
  ManagedDomains,
  DomainRenewalCycles,
  AccountingDocuments,
  CommerceNotificationDeliveries,
]

const isUnique = (fieldName: string, collection = CheckoutProfiles): boolean => {
  const field = expectNamedField(collection.fields, fieldName)
  return "unique" in field && field.unique === true
}

const relationTarget = (
  fieldName: string,
  collection: (typeof commerceCollections)[number],
): string | string[] | undefined => {
  const field = expectNamedField(collection.fields, fieldName)
  return "relationTo" in field ? field.relationTo : undefined
}

describe("Phase 2 commerce record schemas", () => {
  it("registers the lifecycle authorities plus accounting and Phase 7 notification evidence", () => {
    expect(commerceCollections.map((collection) => collection.slug)).toEqual([
      "checkout-profiles",
      "payment-attempts",
      "billing-agreements",
      "managed-domains",
      "domain-renewal-cycles",
      "accounting-documents",
      "commerce-notification-deliveries",
    ])
  })

  it("keeps commerce PII and financial records super-admin readable and forbids direct mutation", () => {
    for (const collection of commerceCollections) {
      expect(collection.access?.read?.(accessArgs({
        req: { user: userFixture({ role: "super-admin" }) },
      })), collection.slug).toBe(true)
      expect(collection.access?.read?.(accessArgs({
        req: { user: userFixture({ role: "owner" }) },
      })), collection.slug).toBe(false)
      expect(collection.access?.update?.(accessArgs({
        req: { user: userFixture({ role: "super-admin" }) },
      })), collection.slug).toBe(false)
      expect(collection.access?.delete?.(accessArgs({
        req: { user: userFixture({ role: "super-admin" }) },
      })), collection.slug).toBe(false)
    }
  })

  it("uses database-unique internal keys and provider references", () => {
    expect(isUnique("profileKey")).toBe(true)
    expect(isUnique("idempotencyKey", PaymentAttempts)).toBe(true)
    expect(isUnique("providerPaymentId", PaymentAttempts)).toBe(true)
    expect(isUnique("idempotencyKey", BillingAgreements)).toBe(true)
    expect(isUnique("providerCustomerId", BillingAgreements)).toBe(true)
    expect(isUnique("providerMandateId", BillingAgreements)).toBe(true)
    expect(isUnique("evidenceKey", AccountingDocuments)).toBe(true)
    expect(isUnique("documentNumber", AccountingDocuments)).toBe(true)
    expect(isUnique("providerOperationId", AccountingDocuments)).toBe(true)
    expect(isUnique("domainNameAscii", ManagedDomains)).toBe(true)
    expect(isUnique("provisioningIdempotencyKey", ManagedDomains)).toBe(true)
    expect(isUnique("providerDomainId", ManagedDomains)).toBe(true)
    expect(isUnique("cloudflareZoneId", ManagedDomains)).toBe(true)
    expect(isUnique("idempotencyKey", DomainRenewalCycles)).toBe(true)
    expect(isUnique("providerOperationId", DomainRenewalCycles)).toBe(true)
    expect(CheckoutProfiles.indexes).toContainEqual({
      fields: ["generationRun", "profileVersion"],
      unique: true,
    })
    expect(DomainRenewalCycles.indexes).toContainEqual({
      fields: ["managedDomain", "providerRenewalDate"],
      unique: true,
    })
    expect(isUnique("checkoutProfileKey", Orders)).toBe(false)
    expect(isUnique("billingCycleKey", Orders)).toBe(true)
    expect(isUnique("renewalCycle", Orders)).toBe(true)
    expect(isUnique("notificationKey", CommerceNotificationDeliveries)).toBe(true)
    expect(PaymentAttempts.indexes).toContainEqual({
      fields: ["order", "purpose", "attemptNumber"],
      unique: true,
    })
  })

  it("persists resumable .nl provider, verification, entitlement, and customer-status evidence", () => {
    for (const field of [
      "providerCustomerHandle",
      "providerRegistrationState",
      "registrationRequestedAt",
      "cloudflareZoneId",
      "cloudflareNameservers",
      "cloudflareDnsRecordIds",
      "cloudflareZoneStatus",
      "registrantVerificationStatus",
      "registrantVerificationCheckedAt",
      "authoritativeDnsStatus",
      "authoritativeDnsCheckedAt",
      "authoritativeDnsEvidence",
      "httpsStatus",
      "httpsCheckedAt",
      "httpsEvidence",
      "entitlementStatus",
      "entitlementActivatedAt",
      "customerStatus",
    ]) {
      expect(expectNamedField(ManagedDomains.fields, field)).toBeDefined()
    }
    expect(fieldOptionValues(fieldOptions(
      expectNamedField(ManagedDomains.fields, "providerRegistrationState"),
    ))).toEqual(["not_started", "prepared", "indeterminate", "confirmed"])
    expect(fieldOptionValues(fieldOptions(
      expectNamedField(ManagedDomains.fields, "customerStatus"),
    ))).toEqual(["provisioning", "verification_required", "active", "manual_review"])
  })

  it("keeps order, payment, billing, domain, and renewal relationships independent", () => {
    expect(relationTarget("order", PaymentAttempts)).toBe("orders")
    expect(relationTarget("originatingOrder", BillingAgreements)).toBe("orders")
    expect(relationTarget("originatingOrder", ManagedDomains)).toBe("orders")
    expect(relationTarget("managedDomain", DomainRenewalCycles)).toBe("managed-domains")
    expect(relationTarget("billingAgreement", DomainRenewalCycles)).toBe("billing-agreements")
    expect(relationTarget("order", DomainRenewalCycles)).toBe("orders")
    expect(relationTarget("paymentAttempt", DomainRenewalCycles)).toBe("payment-attempts")
    expect(relationTarget("billingAgreement", PaymentAttempts)).toBe("billing-agreements")
    expect(relationTarget("billingAgreement", Orders)).toBe("billing-agreements")
    expect(relationTarget("renewalCycle", Orders)).toBe("domain-renewal-cycles")
    expect(relationTarget("order", AccountingDocuments)).toBe("orders")
    expect(relationTarget("paymentAttempt", AccountingDocuments)).toBe("payment-attempts")
    expect(relationTarget("reversesDocument", AccountingDocuments)).toBe("accounting-documents")
  })

  it("persists Phase 7 coverage, grace, autorenew, and reminder evidence", () => {
    for (const field of [
      "currentPeriodStartsAt",
      "currentPeriodEndsAt",
      "graceStartedAt",
      "graceEndsAt",
      "suspendedAt",
      "serviceSuspensionStatus",
      "cancelAt",
      "cancellationEvidence",
      "adminExceptionCode",
    ]) {
      expect(expectNamedField(BillingAgreements.fields, field)).toBeDefined()
    }
    for (const field of [
      "providerRenewalDate",
      "providerRenewalMode",
      "providerAutorenew",
      "providerWriteState",
      "providerOperationPriceNetMinor",
      "includedAllowanceNetMinor",
      "surchargeNetMinor",
      "financialCoverageState",
      "pricingEvidence",
    ]) {
      expect(expectNamedField(DomainRenewalCycles.fields, field)).toBeDefined()
    }
    expect(expectNamedField(PaymentAttempts.fields, "attemptNumber")).toBeDefined()
    expect(CommerceNotificationDeliveries.hooks?.beforeChange).toContain(protectCommerceNotification)
    expect(() => { validateDomainRenewalCycle(hookArgsFor(validateDomainRenewalCycle, {
      operation: "create",
      data: {
        providerRenewalMode: "explicit_renew",
        providerAutorenew: "on",
      },
      req: hookRequest({}),
      collection: hookCollection("domain-renewal-cycles"),
      context: {},
    })) }).toThrow("requires provider autorenew to be off")
  })

  it("uses the Phase 1 state contracts without collapsing lifecycle state", () => {
    expect(fieldOptionValues(fieldOptions(expectNamedField(Orders.fields, "state")))).toEqual(
      orderStates,
    )
    expect(fieldOptionValues(fieldOptions(expectNamedField(PaymentAttempts.fields, "state")))).toEqual(
      paymentAttemptStates,
    )
    expect(fieldOptionValues(fieldOptions(expectNamedField(BillingAgreements.fields, "state")))).toEqual(
      billingAgreementStates,
    )
    expect(fieldOptionValues(fieldOptions(expectNamedField(ManagedDomains.fields, "state")))).toEqual(
      managedDomainStates,
    )
    expect(fieldOptionValues(fieldOptions(expectNamedField(DomainRenewalCycles.fields, "state")))).toEqual(
      domainRenewalCycleStates,
    )
  })

  it("enforces the two contracting-party classifications on immutable profile versions", () => {
    for (const field of [
      "supersedesProfileKey",
      "revisionReason",
      "actorEmail",
      "sourceRequestId",
      "sourceIpAddress",
      "sourceUserAgent",
    ]) {
      expect(expectNamedField(CheckoutProfiles.fields, field)).toBeDefined()
    }
    expect(validateCheckoutProfile(hookArgsFor(validateCheckoutProfile, {
      operation: "create",
      data: {
        partyType: "registered_business",
        kvkNumber: "12345678",
        domainRegistrantSource: "contracting_party",
      },
      req: hookRequest({}),
      collection: hookCollection("checkout-profiles"),
      context: {},
    }))).toMatchObject({ partyType: "registered_business" })

    expect(validateCheckoutProfile(hookArgsFor(validateCheckoutProfile, {
      operation: "create",
      data: {
        partyType: "business_in_formation",
        kvkNumber: null,
        contractingPartyKind: "natural_person",
        domainRegistrantSource: "contracting_party",
      },
      req: hookRequest({}),
      collection: hookCollection("checkout-profiles"),
      context: {},
    }))).toMatchObject({ partyType: "business_in_formation" })

    expect(() => { validateCheckoutProfile(hookArgsFor(validateCheckoutProfile, {
      operation: "create",
      data: {
        partyType: "business_in_formation",
        kvkNumber: "12345678",
        contractingPartyKind: "natural_person",
        domainRegistrantSource: "contracting_party",
      },
      req: hookRequest({}),
      collection: hookCollection("checkout-profiles"),
      context: {},
    })) }).toThrow("contracting-party")
    expect(() => { validateCheckoutProfile(hookArgsFor(validateCheckoutProfile, {
      operation: "create",
      data: {
        partyType: "registered_business",
        kvkNumber: "12345678",
        contractingPartyKind: "natural_person",
        domainRegistrantSource: "contracting_party",
      },
      req: hookRequest({}),
      collection: hookCollection("checkout-profiles"),
      context: {},
    })) }).toThrow("contracting-party")

    expect(() => { rejectCheckoutProfileMutation(hookArgsFor(rejectCheckoutProfileMutation, {
      operation: "update",
      data: { customerEmail: "changed@example.test" },
      req: hookRequest({}),
      collection: hookCollection("checkout-profiles"),
      context: {},
    })) }).toThrow("immutable")
    expect(() => { validateCheckoutProfile(hookArgsFor(validateCheckoutProfile, {
      operation: "create",
      data: {
        profileVersion: 2,
        partyType: "registered_business",
        kvkNumber: "12345678",
        domainRegistrantSource: "contracting_party",
        customerEmail: "owner@example.test",
        revisionReason: "customer_correction",
        actorEmail: "owner@example.test",
        sourceRequestId: "req-2",
      },
      req: hookRequest({}),
      collection: hookCollection("checkout-profiles"),
      context: {},
    })) }).toThrow("superseded profile")
  })

  it("canonicalizes managed-domain identity before database uniqueness is applied", () => {
    expect(normalizeManagedDomain(hookArgsFor(normalizeManagedDomain, {
      operation: "create",
      data: { domainNameAscii: "BÜCHER.Example.NL.", tld: "NL" },
      req: hookRequest({}),
      collection: hookCollection("managed-domains"),
      context: {},
    }))).toMatchObject({
      domainNameAscii: "xn--bcher-kva.example.nl",
      tld: "nl",
    })
    expect(() => { normalizeManagedDomain(hookArgsFor(normalizeManagedDomain, {
      operation: "create",
      data: { domainNameAscii: "example.nl", tld: "com" },
      req: hookRequest({}),
      collection: hookCollection("managed-domains"),
      context: {},
    })) }).toThrow("TLD must match")
  })

  it("keeps offboarding custody audited and transfer secrets hidden", () => {
    expect(expectNamedField(ManagedDomains.fields, "custodyStatus")).toMatchObject({
      type: "select",
      required: true,
      defaultValue: "managed",
      index: true,
    })
    const secret = expectNamedField(
      ManagedDomains.fields,
      "encryptedTransferOutCode",
    )
    expect(secret).toMatchObject({ type: "textarea" })
    expect("access" in secret && secret.access?.read?.(fieldAccessArgs({}))).toBe(false)
    expect(() => { validateManagedDomainCustody(
      hookArgsFor(validateManagedDomainCustody, {
        operation: "update",
        data: {
          domainNameAscii: "example.nl",
          custodyStatus: "transfer_code_ready",
        },
        req: hookRequest({}),
        collection: hookCollection("managed-domains"),
        context: {},
      }),
    ) }).toThrow("immutable customer and continuity evidence")
    const registrantDelivery: Partial<ManagedDomain> = {
      domainNameAscii: "example.be",
      custodyStatus: "transfer_code_ready",
      offboardingRequestedAt: "2026-07-28T10:00:00.000Z",
      offboardingRequestedByEmail: "customer@example.com",
      offboardingRequestId: "request-email-delivery",
      offboardingContinuityEvidence: {
        schemaVersion: 2,
        domain: "example.be",
        capturedAt: "2026-07-28T10:00:00.000Z",
        authoritativeNameservers: [
          "ada.ns.cloudflare.com",
          "bob.ns.cloudflare.com",
        ],
        dnssecStatus: "unsigned",
        parentDsRecords: [],
        zoneSnapshotHash: "a".repeat(64),
        mailRecordSetHash: "b".repeat(64),
        serviceRecordSetHash: "c".repeat(64),
        preservationMode: "retain_existing_dns_and_mail",
      },
      transferOutCodeDeliveryStatus: "registrant_email",
      encryptedTransferOutCode: null,
    }
    expect(validateManagedDomainCustody(
      hookArgsFor(validateManagedDomainCustody, {
        operation: "update",
        data: registrantDelivery,
        req: hookRequest({}),
        collection: hookCollection("managed-domains"),
        context: {},
      }),
    )).toMatchObject(registrantDelivery)
    expect(() => { validateManagedDomainCustody(
      hookArgsFor(validateManagedDomainCustody, {
        operation: "update",
        data: {
          ...registrantDelivery,
          transferOutCodeDeliveryStatus: "provider_returned",
        },
        req: hookRequest({}),
        collection: hookCollection("managed-domains"),
        context: {},
      }),
    ) }).toThrow("requires an encrypted auth code")
    expect(() => { protectManagedDomain(hookArgsFor(protectManagedDomain, {
      operation: "update",
      data: { custodyStatus: "managed" },
      originalDoc: managedDomainFixture({
        state: "active",
        custodyStatus: "transferred_out",
      }),
      req: hookRequest({ context: { managedDomainLifecycleMutation: true } }),
      collection: hookCollection("managed-domains"),
      context: {},
    })) }).toThrow("Invalid managed-domain custody transition")

    expect(() => { validateManagedDomainCustody(
      hookArgsFor(validateManagedDomainCustody, {
        operation: "update",
        data: {
          domainNameAscii: "example.nl",
          custodyStatus: "transferred_out",
          offboardingRequestedAt: "2026-07-28T10:00:00.000Z",
          offboardingRequestedByEmail: "customer@example.com",
          offboardingRequestId: "request-1",
          offboardingContinuityEvidence: {
            schemaVersion: 2,
            domain: "example.nl",
            capturedAt: "2026-07-28T10:00:00.000Z",
            authoritativeNameservers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
            dnssecStatus: "unsigned",
            parentDsRecords: [],
            zoneSnapshotHash: "a".repeat(64),
            mailRecordSetHash: "b".repeat(64),
            serviceRecordSetHash: "c".repeat(64),
            preservationMode: "retain_existing_dns_and_mail",
          },
          transferOutCustomerConfirmedAt: "2026-07-28T10:01:00.000Z",
          encryptedTransferOutCode: null,
        },
        req: hookRequest({}),
        collection: hookCollection("managed-domains"),
        context: {},
      }),
    ) }).toThrow("two time-separated provider observations")

    expect(() => { protectManagedDomain(hookArgsFor(protectManagedDomain, {
      operation: "update",
      data: { transferOutConfirmedAt: "2026-07-28T11:00:00.000Z" },
      originalDoc: managedDomainFixture({
        state: "active",
        custodyStatus: "transferred_out",
        transferOutConfirmedAt: "2026-07-28T10:30:00.000Z",
      }),
      req: hookRequest({ context: { managedDomainLifecycleMutation: true } }),
      collection: hookCollection("managed-domains"),
      context: {},
    })) }).toThrow("terminal transfer field")
  })

  it("requires integer non-negative minor currency amounts", () => {
    for (const [collection, fieldName] of [
      [PaymentAttempts, "grossAmountMinor"],
      [DomainRenewalCycles, "grossAmountMinor"],
    ] as const) {
      const validator = fieldValidator(expectNamedField(collection.fields, fieldName))
      expect(validator?.(2_299, {})).toBe(true)
      expect(validator?.(22.99, {})).toMatch(/integer minor currency units/)
      expect(validator?.(-1, {})).toMatch(/non-negative/)
    }
    const orderMinorValidator = fieldValidator(expectNamedField(Orders.fields, "totalGrossMinor"))
    expect(orderMinorValidator?.(22_990, {})).toBe(true)
    expect(orderMinorValidator?.(229.9, {})).toMatch(/non-negative integer/)
  })

  it("allows only reviewed lifecycle fields through collection-specific system contexts", () => {
    expect(() => { protectPaymentAttempt(hookArgsFor(protectPaymentAttempt, {
      operation: "update",
      data: { state: "paid" },
      req: hookRequest({ context: {} }),
      collection: hookCollection("payment-attempts"),
      context: {},
    })) }).toThrow("payment-attempt lifecycle")
    expect(protectPaymentAttempt(hookArgsFor(protectPaymentAttempt, {
      operation: "update",
      data: { state: "paid", paidAt: "2026-07-26T12:00:00.000Z" },
      originalDoc: paymentAttemptFixture({ state: "pending_provider" }),
      req: hookRequest({ context: { paymentAttemptLifecycleMutation: true } }),
      collection: hookCollection("payment-attempts"),
      context: {},
    }))).toMatchObject({ state: "paid" })
    expect(() => { protectPaymentAttempt(hookArgsFor(protectPaymentAttempt, {
      operation: "update",
      data: { grossAmountMinor: 1 },
      originalDoc: paymentAttemptFixture({ state: "created", grossAmountMinor: 2_299 }),
      req: hookRequest({ context: { paymentAttemptLifecycleMutation: true } }),
      collection: hookCollection("payment-attempts"),
      context: {},
    })) }).toThrow('field "grossAmountMinor" is immutable')

    expect(protectBillingAgreement(hookArgsFor(protectBillingAgreement, {
      operation: "update",
      data: { state: "past_due" },
      originalDoc: billingAgreementFixture({ state: "active" }),
      req: hookRequest({ context: { billingAgreementLifecycleMutation: true } }),
      collection: hookCollection("billing-agreements"),
      context: {},
    }))).toMatchObject({ state: "past_due" })
    expect(protectManagedDomain(hookArgsFor(protectManagedDomain, {
      operation: "update",
      data: { state: "manual_review" },
      originalDoc: managedDomainFixture({ state: "active" }),
      req: hookRequest({ context: { managedDomainLifecycleMutation: true } }),
      collection: hookCollection("managed-domains"),
      context: {},
    }))).toMatchObject({ state: "manual_review" })
    expect(protectDomainRenewalCycle(hookArgsFor(protectDomainRenewalCycle, {
      operation: "update",
      data: { state: "manual_review" },
      originalDoc: validRenewalCycle({ state: "provider_requested" }),
      req: hookRequest({ context: { domainRenewalCycleLifecycleMutation: true } }),
      collection: hookCollection("domain-renewal-cycles"),
      context: {},
    }))).toMatchObject({ state: "manual_review" })

    for (const [currentState, nextState] of [
      ["scheduled", "payment_committed"],
      ["scheduled", "renewed"],
      ["payment_required", "renewed"],
      ["payment_committed", "renewed"],
      ["failed", "renewed"],
      ["payment_required", "manual_review"],
    ] as const) {
      expect(protectDomainRenewalCycle(hookArgsFor(protectDomainRenewalCycle, {
        operation: "update",
        data: { state: nextState },
        originalDoc: validRenewalCycle({ state: currentState }),
        req: hookRequest({ context: { domainRenewalCycleLifecycleMutation: true } }),
        collection: hookCollection("domain-renewal-cycles"),
        context: {},
      }))).toMatchObject({ state: nextState })
    }

    expect(protectCommerceNotification(hookArgsFor(protectCommerceNotification, {
      operation: "update",
      data: { status: "cancelled" },
      originalDoc: commerceNotificationFixture({ status: "processing" }),
      req: hookRequest({ context: { commerceNotificationLifecycleMutation: true } }),
      collection: hookCollection("commerce-notification-deliveries"),
      context: {},
    }))).toMatchObject({ status: "cancelled" })

    expect(protectAccountingDocument(hookArgsFor(protectAccountingDocument, {
      operation: "update",
      data: {
        state: "issued",
        providerOperationId: "re_test",
        issuedAt: "2026-07-26T12:00:00.000Z",
      },
      originalDoc: accountingDocumentFixture({ state: "pending_provider" }),
      req: hookRequest({ context: { accountingDocumentLifecycleMutation: true } }),
      collection: hookCollection("accounting-documents"),
      context: {},
    }))).toMatchObject({ state: "issued", providerOperationId: "re_test" })
    expect(() => { protectAccountingDocument(hookArgsFor(protectAccountingDocument, {
      operation: "update",
      data: { grossAmountMinor: 1 },
      originalDoc: accountingDocumentFixture({ state: "pending_provider", grossAmountMinor: 2_299 }),
      req: hookRequest({ context: { accountingDocumentLifecycleMutation: true } }),
      collection: hookCollection("accounting-documents"),
      context: {},
    })) }).toThrow('field "grossAmountMinor" is immutable')
    expect(() => { protectAccountingDocument(hookArgsFor(protectAccountingDocument, {
      operation: "update",
      data: { providerOperationId: "re_replaced" },
      originalDoc: accountingDocumentFixture({
        state: "issued",
        providerOperationId: "re_original",
        issuedAt: "2026-07-26T12:00:00.000Z",
      }),
      req: hookRequest({ context: { accountingDocumentLifecycleMutation: true } }),
      collection: hookCollection("accounting-documents"),
      context: {},
    })) }).toThrow('field "providerOperationId" is immutable')
    expect(() => { protectDomainRenewalCycle(hookArgsFor(protectDomainRenewalCycle, {
      operation: "update",
      data: { pricingEvidence: { providerOperationPriceNetMinor: 1 } },
      originalDoc: validRenewalCycle({
        state: "payment_required",
        pricingEvidence: { providerOperationPriceNetMinor: 800 },
      }),
      req: hookRequest({ context: { domainRenewalCycleLifecycleMutation: true } }),
      collection: hookCollection("domain-renewal-cycles"),
      context: {},
    })) }).toThrow('field "pricingEvidence" is immutable')
    expect(protectDomainRenewalCycle(hookArgsFor(protectDomainRenewalCycle, {
      operation: "update",
      data: {
        state: "payment_required",
        pricingEvidence: { providerOperationPriceNetMinor: 1_200 },
      },
      originalDoc: validRenewalCycle({
        state: "scheduled",
        pricingEvidence: { providerOperationPriceNetMinor: 800 },
      }),
      req: hookRequest({ context: { domainRenewalCycleLifecycleMutation: true } }),
      collection: hookCollection("domain-renewal-cycles"),
      context: {},
    }))).toMatchObject({
      state: "payment_required",
      pricingEvidence: { providerOperationPriceNetMinor: 1_200 },
    })

    expect(() => { protectPaymentAttempt(hookArgsFor(protectPaymentAttempt, {
      operation: "update",
      data: { state: "created" },
      originalDoc: paymentAttemptFixture({ state: "paid" }),
      req: hookRequest({ context: { paymentAttemptLifecycleMutation: true } }),
      collection: hookCollection("payment-attempts"),
      context: {},
    })) }).toThrow("paid -> created")
  })

  it("extends Orders while retaining legacy order and generation-run read projections", () => {
    for (const field of [
      "state",
      "checkoutProfileKey",
      "catalogVersion",
      "quoteEvidence",
      "netLineItems",
      "vatRateBasisPoints",
      "subtotalNetMinor",
      "vatAmountMinor",
      "totalGrossMinor",
      "contractingPartyProfileVersion",
      "termsVersion",
      "privacyVersion",
      "businessUseDeclarationVersion",
      "acceptedAt",
      "acceptanceIpAddress",
      "acceptanceUserAgent",
    ]) {
      expect(expectNamedField(Orders.fields, field)).toBeDefined()
    }
    for (const legacyField of [
      "lineItems",
      "subtotalNet",
      "vatAmount",
      "totalGross",
      "paymentStatus",
      "providerPaymentId",
    ]) {
      expect(expectNamedField(Orders.fields, legacyField)).toBeDefined()
    }
    expect(expectNamedField(SiteGenerationRuns.fields, "payment")).toBeDefined()
    expect(expectNamedField(SiteGenerationRuns.fields, "domainOrder")).toBeDefined()

    expect(protectFrozenOrder(hookArgsFor(protectFrozenOrder, {
      operation: "update",
      data: { state: "fulfillment_pending" },
      req: hookRequest({ context: { legalOrderLifecycleMutation: true } }),
      collection: hookCollection("orders"),
      context: {},
    }))).toMatchObject({ state: "fulfillment_pending" })
    expect(() => { protectFrozenOrder(hookArgsFor(protectFrozenOrder, {
      operation: "update",
      data: { catalogVersion: "changed" },
      req: hookRequest({ context: { legalOrderLifecycleMutation: true } }),
      collection: hookCollection("orders"),
      context: {},
    })) }).toThrow('field "catalogVersion" is immutable')
  })
})
