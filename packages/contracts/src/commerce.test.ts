import { describe, expect, it } from "vitest"

import {
  COMMERCIAL_CATALOG,
  COMMERCIAL_CATALOG_VERSION,
  ACCEPTED_ORDER_EVIDENCE_POLICY,
  MIGRATION_CUSTOMER_ACTION_FEES_NET_MINOR,
  REFUND_DECISION_MATRIX,
  businessUseDeclarationAcceptanceSchema,
  calculateDomainSurchargeNetMinor,
  classifyMigration,
  commerceLifecycleSnapshotSchema,
  commerceStateMachines,
  commercialAmountFromNet,
  commercialAmountSchema,
  commercialContractSelectionSchema,
  contractingPartyClassificationSchema,
  decideMigrationScope,
  decideRenewalCancellation,
  domainRenewalCycleStateTransitions,
  getCommercialCatalog,
  managedDomainStates,
  migrationChargeNetMinor,
  migrationCustomerActions,
  paymentAttemptStateTransitions,
  refundDecisionFor,
  refundScenarios,
} from "./commerce"

describe("versioned commercial catalog", () => {
  it("freezes the locked business-only catalog values in euro minor units", () => {
    expect(COMMERCIAL_CATALOG).toMatchObject({
      schemaVersion: 1,
      catalogVersion: COMMERCIAL_CATALOG_VERSION,
      audience: "business_professional_only",
      currency: "EUR",
      vat: { jurisdiction: "NL", rateBasisPoints: 2_100 },
      subscriptions: {
        monthly: { billingPeriod: "monthly", netAmountMinor: 1_900 },
        annual: { billingPeriod: "annual", netAmountMinor: 19_000 },
      },
      domain: {
        registrant: "customer",
        includedAllowanceNetMinor: 1_000,
        includedOperations: ["registration", "transfer", "renewal"],
        siteinaboxContactRoles: ["administrative", "technical", "billing"],
      },
      migrations: {
        automatic: { netAmountMinor: 0, checkout: "ordinary" },
        assisted_standard: { netAmountMinor: 4_900, checkout: "ordinary", unit: "per_domain" },
        complex: { netAmountMinor: null, checkout: "custom_quote_only" },
      },
    })
    expect(getCommercialCatalog()).toBe(COMMERCIAL_CATALOG)
    expect(() => getCommercialCatalog("2099-01-01.1")).toThrow("Unknown commercial catalog")
  })

  it.each([
    [1_900, { netAmountMinor: 1_900, vatAmountMinor: 399, grossAmountMinor: 2_299 }],
    [19_000, { netAmountMinor: 19_000, vatAmountMinor: 3_990, grossAmountMinor: 22_990 }],
    [4_900, { netAmountMinor: 4_900, vatAmountMinor: 1_029, grossAmountMinor: 5_929 }],
  ])("calculates Dutch VAT for %i net minor units", (netAmountMinor, expected) => {
    expect(commercialAmountFromNet(netAmountMinor)).toEqual({
      currency: "EUR",
      ...expected,
    })
  })

  it("uses the provider-operation allowance as a surcharge floor", () => {
    expect(calculateDomainSurchargeNetMinor(0)).toBe(0)
    expect(calculateDomainSurchargeNetMinor(1_000)).toBe(0)
    expect(calculateDomainSurchargeNetMinor(1_250)).toBe(250)
    expect(() => calculateDomainSurchargeNetMinor(-1)).toThrow("non-negative safe integer")
    expect(() => commercialAmountFromNet(1.5)).toThrow("non-negative safe integer")
  })

  it("requires internally consistent net, VAT, and gross evidence", () => {
    expect(commercialAmountSchema.parse(commercialAmountFromNet(1_900))).toMatchObject({
      netAmountMinor: 1_900,
      vatAmountMinor: 399,
      grossAmountMinor: 2_299,
    })
    expect(commercialAmountSchema.safeParse({
      currency: "EUR",
      netAmountMinor: 1_900,
      vatAmountMinor: 400,
      grossAmountMinor: 2_300,
    }).success).toBe(false)
    expect(ACCEPTED_ORDER_EVIDENCE_POLICY).toMatchObject({
      mutation: "append_only",
      frozenFields: expect.arrayContaining([
        "catalogVersion",
        "quoteEvidence",
        "netLineItems",
        "vatAmount",
        "grossAmount",
        "contractingPartyProfileVersion",
        "termsVersion",
        "privacyVersion",
        "businessUseDeclarationVersion",
        "acceptedAt",
        "ipAddress",
        "userAgent",
      ]),
    })
  })
})

describe("contracting parties and business-use declaration", () => {
  it("accepts only a registered business with a KVK number or a natural person in formation without one", () => {
    expect(contractingPartyClassificationSchema.parse({
      type: "registered_business",
      kvkNumber: "12345678",
      domainRegistrantSource: "contracting_party",
    })).toMatchObject({ type: "registered_business" })

    expect(contractingPartyClassificationSchema.parse({
      type: "business_in_formation",
      kvkNumber: null,
      contractingPartyKind: "natural_person",
      domainRegistrantSource: "contracting_party",
      intendedCompanyName: "Studio in oprichting",
    })).toMatchObject({
      type: "business_in_formation",
      kvkNumber: null,
      contractingPartyKind: "natural_person",
    })

    expect(contractingPartyClassificationSchema.safeParse({
      type: "registered_business",
      kvkNumber: null,
      domainRegistrantSource: "contracting_party",
    }).success).toBe(false)
    expect(contractingPartyClassificationSchema.safeParse({
      type: "business_in_formation",
      kvkNumber: "12345678",
      contractingPartyKind: "natural_person",
      domainRegistrantSource: "contracting_party",
    }).success).toBe(false)
    expect(contractingPartyClassificationSchema.safeParse({
      type: "private_consumer",
    }).success).toBe(false)
  })

  it("requires affirmative acceptance of a governed declaration version", () => {
    expect(businessUseDeclarationAcceptanceSchema.parse({
      declarationVersion: "business-use-declaration-2026-07-26.1",
      accepted: true,
    })).toEqual({
      declarationVersion: "business-use-declaration-2026-07-26.1",
      accepted: true,
    })
    expect(businessUseDeclarationAcceptanceSchema.safeParse({
      declarationVersion: "business-use-declaration-2026-07-26.1",
      accepted: false,
    }).success).toBe(false)
  })

  it("binds the party classification and declaration acceptance to the catalog version", () => {
    expect(commercialContractSelectionSchema.parse({
      catalogVersion: COMMERCIAL_CATALOG_VERSION,
      contractingParty: {
        type: "business_in_formation",
        kvkNumber: null,
        contractingPartyKind: "natural_person",
        domainRegistrantSource: "contracting_party",
      },
      businessUseDeclaration: {
        declarationVersion: "business-use-declaration-2026-07-26.1",
        accepted: true,
      },
    })).toMatchObject({
      catalogVersion: COMMERCIAL_CATALOG_VERSION,
      contractingParty: { type: "business_in_formation" },
    })
  })
})

describe("migration classification and billing", () => {
  it("classifies operator technical work as assisted and unsupported work as complex", () => {
    expect(classifyMigration({
      supported: true,
      expectedSiteinaboxOperatorTechnicalAction: false,
    })).toBe("automatic")
    expect(classifyMigration({
      supported: true,
      expectedSiteinaboxOperatorTechnicalAction: true,
    })).toBe("assisted_standard")
    expect(classifyMigration({
      supported: false,
      expectedSiteinaboxOperatorTechnicalAction: false,
    })).toBe("complex")
  })

  it("does not charge customer actions or Siteinabox incident recovery", () => {
    expect(migrationCustomerActions).toEqual([
      "provide_epp_code",
      "authorize_provider",
      "upload_complete_zone",
      "confirm_transfer",
      "verify_registrant",
    ])
    expect(Object.values(MIGRATION_CUSTOMER_ACTION_FEES_NET_MINOR)).toEqual([0, 0, 0, 0, 0])
    expect(migrationChargeNetMinor("automatic")).toBe(0)
    expect(migrationChargeNetMinor("assisted_standard")).toBe(4_900)
    expect(migrationChargeNetMinor("complex")).toBeNull()
    expect(migrationChargeNetMinor("assisted_standard", "siteinabox_incident_recovery")).toBe(0)
  })

  it("pauses an accepted automatic migration before unexpected billable operator work", () => {
    expect(decideMigrationScope({
      acceptedClassification: "automatic",
      unexpectedOperatorTechnicalAction: true,
      workCause: "customer_migration",
    })).toBe("pause_for_supplemental_order")
    expect(decideMigrationScope({
      acceptedClassification: "automatic",
      unexpectedOperatorTechnicalAction: true,
      workCause: "siteinabox_incident_recovery",
    })).toBe("proceed_non_billable_incident_recovery")
    expect(decideMigrationScope({
      acceptedClassification: "complex",
      unexpectedOperatorTechnicalAction: false,
      workCause: "customer_migration",
    })).toBe("stop_for_custom_quote")
  })
})

describe("independent commerce state machines", () => {
  it("keeps order, payment, billing, domain, renewal, and migration state separate", () => {
    expect(Object.keys(commerceStateMachines)).toEqual([
      "order",
      "paymentAttempt",
      "billingAgreement",
      "managedDomain",
      "domainRenewalCycle",
      "domainMigration",
    ])
    expect(commerceLifecycleSnapshotSchema.parse({
      order: "accepted",
      paymentAttempt: "failed",
      billingAgreement: "cancelled",
      managedDomain: "active",
      domainRenewalCycle: "renewed",
      domainMigration: "completed",
    })).toMatchObject({
      order: "accepted",
      paymentAttempt: "failed",
      managedDomain: "active",
    })
  })

  it("has no managed-domain transition that deletes or appropriates a customer domain", () => {
    expect(managedDomainStates).not.toContain("deleted")
    expect(managedDomainStates).not.toContain("siteinabox_owned")
    expect(COMMERCIAL_CATALOG.domain.registrant).toBe("customer")
  })

  it("keeps captured payment evidence while refunds follow their own states", () => {
    expect(paymentAttemptStateTransitions.paid).not.toContain("failed")
    expect(paymentAttemptStateTransitions.refund_pending).toContain("refund_failed")
    expect(paymentAttemptStateTransitions.refund_pending).toContain("chargeback")
    expect(paymentAttemptStateTransitions.refund_pending).not.toContain("failed")
  })

  it("does not allow a committed renewal cycle to be cancelled", () => {
    expect(domainRenewalCycleStateTransitions.payment_committed).toEqual(["provider_requested"])
    expect(domainRenewalCycleStateTransitions.provider_requested).not.toContain("cancelled")
    expect(decideRenewalCancellation({
      cycleState: "payment_required",
      billingAgreementCancelled: true,
      paymentSecured: true,
      providerSafeCutoffReached: false,
    })).toBe("complete_committed_cycle")
    expect(decideRenewalCancellation({
      cycleState: "payment_required",
      billingAgreementCancelled: false,
      paymentSecured: false,
      providerSafeCutoffReached: true,
    })).toBe("cancel_uncovered_cycle")
  })
})

describe("refund decision matrix", () => {
  it("is exhaustive and never mutates accepted order evidence", () => {
    expect(Object.keys(REFUND_DECISION_MATRIX)).toEqual(refundScenarios)
    expect(Object.values(REFUND_DECISION_MATRIX).every(
      (decision) => decision.acceptedOrderMutation === "forbidden",
    )).toBe(true)
  })

  it("preserves customer domains after payment failure, cancellation, or post-commit failure", () => {
    expect(refundDecisionFor("failed_payment_customer_domain_exists")).toMatchObject({
      refundScope: "none",
      domainDisposition: "customer_retains",
    })
    expect(refundDecisionFor("customer_cancellation_after_provider_commit")).toMatchObject({
      domainDisposition: "customer_retains",
      committedProviderOperation: "complete",
    })
    expect(refundDecisionFor("siteinabox_failure_after_provider_commit")).toMatchObject({
      domainDisposition: "customer_retains",
      committedProviderOperation: "complete",
    })
  })

  it("refunds deterministic overpayments and non-billable recovery without rewriting the order", () => {
    expect(refundDecisionFor("duplicate_payment")).toMatchObject({
      refundScope: "duplicate_captured_payment",
      automatic: true,
      nextAction: "issue_refund",
    })
    expect(refundDecisionFor("unfulfillable_before_provider_commit")).toMatchObject({
      refundScope: "full_captured_payment",
      automatic: true,
      nextAction: "issue_refund",
    })
    expect(refundDecisionFor("incident_recovery_migration_fee_charged")).toMatchObject({
      refundScope: "migration_service_fee",
      automatic: true,
      nextAction: "issue_refund",
    })
    expect(refundDecisionFor("automatic_migration_scope_increase")).toMatchObject({
      refundScope: "none",
      nextAction: "pause_for_supplemental_order",
    })
    expect(refundDecisionFor("complex_migration")).toMatchObject({
      refundScope: "none",
      nextAction: "stop_before_payment",
    })
  })
})
