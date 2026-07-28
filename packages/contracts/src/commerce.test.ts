import { describe, expect, it } from "vitest"

import {
  BILLING_DUNNING_OFFSETS_DAYS,
  BILLING_GRACE_DAYS,
  BILLING_UPCOMING_CHARGE_REMINDER_DAYS,
  COMMERCIAL_CATALOG,
  COMMERCIAL_CATALOG_VERSION,
  ACCEPTED_ORDER_EVIDENCE_POLICY,
  ASSISTED_STANDARD_MIGRATION_LINE_ITEM_CODE,
  DOMAIN_RENEWAL_REMINDER_OFFSETS_DAYS,
  MIGRATION_CUSTOMER_ACTION_FEES_NET_MINOR,
  NL_OPENPROVIDER_SAFE_CUTOFF_LEAD_DAYS,
  REFUND_DECISION_MATRIX,
  addBillingPeriod,
  assistedMigrationSupplementalEvidenceSchema,
  assertExclusiveProviderRenewalExecution,
  billingDunningStage,
  billingGraceEndsAt,
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
  migrationOperatorAuthorizationRequirement,
  domainOffboardingContinuityEvidenceSchema,
  evaluateCommerceReleaseGate,
  managedDomainCustodyStateTransitions,
  paymentAttemptStateTransitions,
  providerSafeCutoffAt,
  refundDecisionFor,
  refundScenarios,
  renewalFinancialCoverage,
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
      "remove_dnssec_ds",
    ])
    expect(Object.values(MIGRATION_CUSTOMER_ACTION_FEES_NET_MINOR)).toEqual([0, 0, 0, 0, 0, 0])
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

  it("requires the correct immutable authorization source for operator work", () => {
    expect(migrationOperatorAuthorizationRequirement({
      acceptedClassification: "assisted_standard",
      requestedClassification: "assisted_standard",
      workCause: "customer_migration",
    })).toBe("originating_order_payment")
    expect(migrationOperatorAuthorizationRequirement({
      acceptedClassification: "automatic",
      requestedClassification: "assisted_standard",
      workCause: "customer_migration",
    })).toBe("supplemental_order_payment")
    expect(migrationOperatorAuthorizationRequirement({
      acceptedClassification: "automatic",
      requestedClassification: "assisted_standard",
      workCause: "siteinabox_incident_recovery",
    })).toBe("non_billable_incident_authorization")
    expect(migrationOperatorAuthorizationRequirement({
      acceptedClassification: "automatic",
      requestedClassification: "complex",
      workCause: "siteinabox_incident_recovery",
    })).toBe("non_billable_incident_authorization")
    expect(migrationOperatorAuthorizationRequirement({
      acceptedClassification: "automatic",
      requestedClassification: "complex",
      workCause: "customer_migration",
    })).toBe("custom_quote")
  })

  it("freezes exactly one assisted-standard fee per domain in supplemental evidence", () => {
    const evidence = {
      schemaVersion: 1,
      kind: "migration_assisted_standard_supplemental",
      migrationId: 10,
      originatingOrderId: 20,
      catalogVersion: COMMERCIAL_CATALOG_VERSION,
      classification: "assisted_standard",
      workCause: "customer_migration",
      workScope: "Import the provider zone export.",
      domain: "example.nl",
      unit: "per_domain",
      quantity: 1,
      lineItemCode: ASSISTED_STANDARD_MIGRATION_LINE_ITEM_CODE,
      amount: commercialAmountFromNet(4_900),
      acceptedAt: "2026-07-28T10:00:00.000Z",
    } as const
    expect(assistedMigrationSupplementalEvidenceSchema.parse(evidence).amount).toEqual({
      currency: "EUR",
      netAmountMinor: 4_900,
      vatAmountMinor: 1_029,
      grossAmountMinor: 5_929,
    })
    expect(assistedMigrationSupplementalEvidenceSchema.safeParse({
      ...evidence,
      amount: commercialAmountFromNet(5_000),
    }).success).toBe(false)
    expect(assistedMigrationSupplementalEvidenceSchema.safeParse({
      ...evidence,
      workCause: "siteinabox_incident_recovery",
    }).success).toBe(false)
  })
})

describe("offboarding custody and staged commerce release", () => {
  it("keeps transfer-out custody separate from domain service state", () => {
    expect(managedDomainCustodyStateTransitions.managed).toEqual([
      "offboarding_requested",
    ])
    expect(managedDomainCustodyStateTransitions.transfer_pending).toContain(
      "transferred_out",
    )
    expect(managedDomainCustodyStateTransitions.transferred_out).toEqual([])
    expect(domainOffboardingContinuityEvidenceSchema.parse({
      schemaVersion: 2,
      domain: "example.nl",
      capturedAt: "2026-07-28T10:00:00.000Z",
      authoritativeNameservers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      dnssecStatus: "signed",
      parentDsRecords: ["12345 13 2 ABCD"],
      zoneSnapshotHash: "a".repeat(64),
      mailRecordSetHash: "b".repeat(64),
      serviceRecordSetHash: "c".repeat(64),
      preservationMode: "retain_existing_dns_and_mail",
    })).toMatchObject({
      domain: "example.nl",
      preservationMode: "retain_existing_dns_and_mail",
    })
    expect(domainOffboardingContinuityEvidenceSchema.safeParse({
      schemaVersion: 1,
      domain: "example.nl",
      capturedAt: "2026-07-28T10:00:00.000Z",
      authoritativeNameservers: ["ada.ns.cloudflare.com", "bob.ns.cloudflare.com"],
      dnssecStatus: "unknown",
      zoneSnapshotHash: "a".repeat(64),
      mailRecordSetHash: "b".repeat(64),
      serviceRecordSetHash: "c".repeat(64),
      preservationMode: "retain_existing_dns_and_mail",
    }).success).toBe(true)
  })

  it("fails closed through disabled and shadow release stages", () => {
    expect(evaluateCommerceReleaseGate({
      stage: "disabled",
      evidenceVersion: null,
      providerWritesAcknowledged: false,
      nodeEnvironment: "production",
      mollieApiKeyMode: "live",
      openproviderApiBaseUrl: "https://api.openprovider.eu/v1beta",
      cloudflareApiBaseUrl: "https://api.cloudflare.com/client/v4",
    })).toMatchObject({
      providerReadsAllowed: false,
      providerWritesAllowed: false,
    })
    expect(evaluateCommerceReleaseGate({
      stage: "shadow",
      evidenceVersion: null,
      providerWritesAcknowledged: false,
      nodeEnvironment: "production",
      mollieApiKeyMode: "live",
      openproviderApiBaseUrl: "https://api.openprovider.eu/v1beta",
      cloudflareApiBaseUrl: "https://api.cloudflare.com/client/v4",
    })).toMatchObject({
      providerReadsAllowed: true,
      providerWritesAllowed: false,
    })
  })

  it("allows sandbox and production writes only with matching evidence and endpoints", () => {
    expect(evaluateCommerceReleaseGate({
      stage: "sandbox",
      evidenceVersion: "phase11-2026-07-27.1",
      providerWritesAcknowledged: true,
      nodeEnvironment: "development",
      mollieApiKeyMode: "test",
      openproviderApiBaseUrl: "https://openprovider.sandbox.test/v1beta",
      cloudflareApiBaseUrl: "https://cloudflare.mock.test/client/v4",
    }).providerWritesAllowed).toBe(true)
    expect(evaluateCommerceReleaseGate({
      stage: "production",
      evidenceVersion: "phase11-2026-07-27.1",
      providerWritesAcknowledged: true,
      nodeEnvironment: "production",
      mollieApiKeyMode: "live",
      openproviderApiBaseUrl: "https://api.openprovider.eu/v1beta",
      cloudflareApiBaseUrl: "https://api.cloudflare.com/client/v4",
      productionSecretsConfigured: true,
      originIsolationVerified: true,
    }).providerWritesAllowed).toBe(true)
    expect(evaluateCommerceReleaseGate({
      stage: "production",
      evidenceVersion: "stale",
      providerWritesAcknowledged: true,
      nodeEnvironment: "production",
      mollieApiKeyMode: "live",
      openproviderApiBaseUrl: "https://api.openprovider.eu/v1beta",
      cloudflareApiBaseUrl: "https://api.cloudflare.com/client/v4",
      productionSecretsConfigured: true,
      originIsolationVerified: true,
    })).toMatchObject({
      providerWritesAllowed: false,
      blockers: ["release_evidence_version_mismatch"],
    })
    expect(evaluateCommerceReleaseGate({
      stage: "production",
      evidenceVersion: "phase11-2026-07-27.1",
      providerWritesAcknowledged: true,
      nodeEnvironment: "production",
      mollieApiKeyMode: "live",
      openproviderApiBaseUrl: "https://api.openprovider.eu@attacker.example/v1beta",
      cloudflareApiBaseUrl: "http://api.cloudflare.com/client/v4",
      productionSecretsConfigured: true,
      originIsolationVerified: true,
    }).providerWritesAllowed).toBe(false)
    expect(evaluateCommerceReleaseGate({
      stage: "sandbox",
      evidenceVersion: "phase11-2026-07-27.1",
      providerWritesAcknowledged: true,
      nodeEnvironment: "development",
      mollieApiKeyMode: "test",
      openproviderApiBaseUrl: "https://attacker.example/v1beta",
      cloudflareApiBaseUrl: "https://cloudflare.mock.test/client/v4",
    })).toMatchObject({
      providerWritesAllowed: false,
      blockers: ["sandbox_requires_reserved_openprovider_host"],
    })
    expect(evaluateCommerceReleaseGate({
      stage: "production",
      evidenceVersion: "phase11-2026-07-27.1",
      providerWritesAcknowledged: true,
      nodeEnvironment: "production",
      mollieApiKeyMode: "live",
      openproviderApiBaseUrl: "https://api.openprovider.eu/v1beta",
      cloudflareApiBaseUrl: "https://api.cloudflare.com/client/v4",
      productionSecretsConfigured: false,
      originIsolationVerified: false,
    })).toMatchObject({
      providerWritesAllowed: false,
      blockers: [
        "production_provider_or_encryption_prerequisite_missing",
        "production_origin_isolation_not_verified",
      ],
    })
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
    expect(domainRenewalCycleStateTransitions.payment_committed).toEqual([
      "provider_requested",
      "renewed",
      "manual_review",
    ])
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

describe("Phase 7 billing and renewal contracts", () => {
  it("defines every governed customer reminder offset and the 14-day grace boundary", () => {
    expect(BILLING_UPCOMING_CHARGE_REMINDER_DAYS).toEqual([7])
    expect(BILLING_DUNNING_OFFSETS_DAYS).toEqual([0, 3, 7, 13])
    expect(DOMAIN_RENEWAL_REMINDER_OFFSETS_DAYS).toEqual([90, 60, 30, 14, 7, 1])
    expect(BILLING_GRACE_DAYS).toBe(14)
    expect(billingGraceEndsAt("2026-08-01T10:00:00.000Z")).toBe("2026-08-15T10:00:00.000Z")
    expect(billingDunningStage("2026-08-01T10:00:00.000Z", "2026-08-01T09:59:59.999Z")).toBe("not_due")
    expect(billingDunningStage("2026-08-01T10:00:00.000Z", "2026-08-01T10:00:00.000Z")).toBe("due")
    expect(billingDunningStage("2026-08-01T10:00:00.000Z", "2026-08-04T10:00:00.000Z")).toBe("retry_3d")
    expect(billingDunningStage("2026-08-01T10:00:00.000Z", "2026-08-08T10:00:00.000Z")).toBe("retry_7d")
    expect(billingDunningStage("2026-08-01T10:00:00.000Z", "2026-08-14T10:00:00.000Z")).toBe("retry_13d")
    expect(billingDunningStage("2026-08-01T10:00:00.000Z", "2026-08-15T10:00:00.000Z")).toBe("suspend")
  })

  it("anchors monthly and annual coverage without end-of-month drift", () => {
    expect(addBillingPeriod("2026-01-31T12:00:00.000Z", "monthly")).toBe("2026-02-28T12:00:00.000Z")
    expect(addBillingPeriod("2028-02-29T12:00:00.000Z", "annual")).toBe("2029-02-28T12:00:00.000Z")
  })

  it("keys the .nl provider-safe cutoff from Openprovider renewal_date", () => {
    expect(NL_OPENPROVIDER_SAFE_CUTOFF_LEAD_DAYS).toBe(2)
    expect(providerSafeCutoffAt(
      "2027-07-26T00:00:00.000Z",
      NL_OPENPROVIDER_SAFE_CUTOFF_LEAD_DAYS,
    )).toBe("2027-07-24T00:00:00.000Z")
  })

  it("freezes renewal allowance and surcharge coverage in minor units", () => {
    expect(renewalFinancialCoverage(900)).toEqual({
      providerOperationPriceNetMinor: 900,
      includedAllowanceNetMinor: 1_000,
      surchargeNetMinor: 0,
      initialState: "included_allowance",
    })
    expect(renewalFinancialCoverage(1_250)).toEqual({
      providerOperationPriceNetMinor: 1_250,
      includedAllowanceNetMinor: 1_000,
      surchargeNetMinor: 250,
      initialState: "uncovered",
    })
  })

  it("forbids explicit renewal and provider autorenew in the same cycle", () => {
    expect(() => assertExclusiveProviderRenewalExecution({
      mode: "provider_autorenew",
      providerAutorenewEnabled: true,
      explicitRenewalRequested: false,
    })).not.toThrow()
    expect(() => assertExclusiveProviderRenewalExecution({
      mode: "provider_autorenew",
      providerAutorenewEnabled: true,
      explicitRenewalRequested: true,
    })).toThrow("cannot use provider autorenew and explicit renewal together")
    expect(() => assertExclusiveProviderRenewalExecution({
      mode: "explicit_renew",
      providerAutorenewEnabled: true,
      explicitRenewalRequested: false,
    })).toThrow("requires provider autorenew to be off")
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
