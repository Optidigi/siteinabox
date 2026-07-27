import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PaymentAttempt } from "@/payload-types"

import {
  loadLatestCheckoutProfile,
  saveCheckoutProfileVersion,
} from "@/lib/checkout/checkoutProfile"
import { asDocRecord, createArgs, relationId, updateArgs } from "../_helpers/payloadApi"
import { getTestPayload } from "./_helpers"

let payload: Awaited<ReturnType<typeof getTestPayload>>
const created: Array<{ collection: Parameters<typeof payload.delete>[0]["collection"]; id: number }> = []
const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`

const remember = <T extends { id: string | number }>(
  collection: Parameters<typeof payload.delete>[0]["collection"],
  doc: T,
): T => {
  created.push({ collection, id: relationId(doc) })
  return doc
}

beforeAll(async () => {
  payload = await getTestPayload()
}, 30_000)

afterAll(async () => {
  for (const entry of created.reverse()) {
    await payload.delete({
      collection: entry.collection,
      id: entry.id,
      overrideAccess: true,
    })
  }
})

describe("commerce records on migrated PostgreSQL", () => {
  it("persists independent records while legacy Order projections remain readable", async () => {
    const intake = remember("intake-submissions", await payload.create(createArgs(
      "intake-submissions",
      {
        businessName: "Phase 2 fixture",
        source: "integration-test",
        idempotencyKey: `phase2-intake-${suffix}`,
        raw: { phase: 2 },
      },
      { overrideAccess: true },
    )))
    const run = remember("site-generation-runs", await payload.create(createArgs(
      "site-generation-runs",
      {
        intakeSubmission: intake.id,
        status: "preview_ready",
        idempotencyKey: `phase2-run-${suffix}`,
        normalizedIntake: { businessName: "Phase 2 fixture" },
        normalizedIntakeHash: `normalized-${suffix}`,
        provider: "mock",
        model: "fixture:generic",
        promptVersion: "phase2-test",
        generationInputHash: `input-${suffix}`,
      },
      { overrideAccess: true },
    )))
    const customerEmail = `owner-${suffix}@example.test`
    const profileDraft = {
      partyType: "business_in_formation" as const,
      firstName: "Fixture",
      lastName: "Owner",
      registeredBusinessName: "",
      kvkNumber: "",
      intendedCompanyName: "Fixture Studio",
      street: "Teststraat",
      number: "1",
      suffix: "",
      zipcode: "1234AB",
      city: "Utrecht",
      country: "NL",
      phoneCountryCode: "+31",
      phoneAreaCode: "30",
      phoneSubscriberNumber: "1234567",
    }
    const initialProfile = await saveCheckoutProfileVersion({
      payload,
      generationRunId: run.id,
      actorEmail: customerEmail,
      expectedProfileVersion: 0,
      draft: profileDraft,
      requestId: `profile-request-initial-${suffix}`,
      ipAddress: "192.0.2.10",
      userAgent: "phase3-integration-test",
      now: new Date("2026-07-26T12:00:00.000Z"),
    })
    expect(initialProfile).toMatchObject({
      status: "saved",
      created: true,
      profile: {
        profileVersion: 1,
        revisionReason: "initial_capture",
        actorEmail: customerEmail,
        sourceRequestId: `profile-request-initial-${suffix}`,
      },
    })
    if (initialProfile.status !== "saved") throw new Error("Expected saved initial profile.")
    const persistedInitialProfile = await loadLatestCheckoutProfile(payload, run.id)
    if (!persistedInitialProfile) throw new Error("Expected initial checkout profile.")
    remember("checkout-profiles", persistedInitialProfile)

    const correctedProfile = await saveCheckoutProfileVersion({
      payload,
      generationRunId: run.id,
      actorEmail: customerEmail,
      expectedProfileVersion: 1,
      draft: {
        ...profileDraft,
        city: "Amsterdam",
      },
      requestId: `profile-request-correction-${suffix}`,
      ipAddress: "192.0.2.11",
      userAgent: "phase3-integration-test",
      now: new Date("2026-07-26T12:01:00.000Z"),
    })
    expect(correctedProfile).toMatchObject({
      status: "saved",
      created: true,
      profile: {
        profileVersion: 2,
        revisionReason: "customer_correction",
        supersedesProfileKey: initialProfile.profile.profileKey,
        actorEmail: customerEmail,
        sourceRequestId: `profile-request-correction-${suffix}`,
        city: "Amsterdam",
      },
    })
    const profile = await loadLatestCheckoutProfile(payload, run.id)
    if (!profile) throw new Error("Expected corrected checkout profile.")
    remember("checkout-profiles", profile)
    await expect(payload.create(createArgs(
      "checkout-profiles",
      {
        profileKey: `run:${run.id}:profile:duplicate`,
        profileVersion: 1,
        generationRun: run.id,
        customerName: "Duplicate Fixture Owner",
        customerEmail: `duplicate-${suffix}@example.test`,
        partyType: "business_in_formation",
        contractingPartyName: "Duplicate Fixture Owner",
        kvkNumber: null,
        contractingPartyKind: "natural_person",
        domainRegistrantSource: "contracting_party",
        billingAddress: { country: "NL" },
        createdAt: "2026-07-26T12:00:00.000Z",
      },
      { overrideAccess: true },
    ))).rejects.toThrow()
    const legalDocument = remember("legal-documents", await payload.create(createArgs(
      "legal-documents",
      {
        releaseKey: `phase2-terms-${suffix}`,
        documentType: "platform-terms",
        locale: "nl",
        documentVersion: "phase2-test",
        acceptanceVersion: "phase2-test",
        content: "Phase 2 migration fixture.",
        contentHash: `sha256:${suffix}`,
        sourceCommit: "integration-test",
        publishedAt: "2026-07-26T00:00:00.000Z",
        effectiveAt: "2026-07-26T00:00:00.000Z",
        changeCategory: "editorial",
        changeSummary: "Fixture",
        changeRationale: "Migration verification",
        customerAction: "none",
        consentAction: "none",
      },
      { overrideAccess: true },
    )))
    const order = remember("orders", await payload.create(createArgs(
      "orders",
      {
        orderNumber: `SIAB-PHASE2-${suffix}`,
        generationRun: run.id,
        customerName: "Fixture Owner",
        customerEmail: `owner-${suffix}@example.test`,
        companyName: "Fixture Studio",
        billingAddress: { country: "NL" },
        packageCode: "legacy-compatible",
        billingPeriod: "annual",
        renewalTerms: "Legacy fixture terms.",
        lineItems: [{ code: "legacy", totalGross: 229.9 }],
        currency: "EUR",
        subtotalNet: 190,
        vatAmount: 39.9,
        totalGross: 229.9,
        domain: `phase2-${suffix}.test`,
        domainRegistrant: { owner: "customer" },
        legalDocuments: [legalDocument.id],
        paymentStatus: "pending",
        paymentProvider: "mollie",
        createdAt: "2026-07-26T12:01:00.000Z",
      },
      { overrideAccess: true },
    )))

    const legacyRead = asDocRecord(await payload.findByID({
      collection: "orders",
      id: order.id,
      depth: 0,
      overrideAccess: true,
    }))
    expect(legacyRead).toMatchObject({
      orderNumber: `SIAB-PHASE2-${suffix}`,
      paymentStatus: "pending",
      totalGross: 229.9,
    })
    expect(legacyRead.state).toBeNull()
    expect(legacyRead.checkoutProfileKey).toBeNull()

    const concurrentAttempts = await Promise.allSettled([
      payload.create(createArgs("payment-attempts", {
        idempotencyKey: `payment-${suffix}`,
        order: order.id,
        state: "pending_provider",
        purpose: "first_payment",
        sequenceType: "first",
        provider: "mollie",
        providerPaymentId: `tr-${suffix}`,
        currency: "EUR",
        netAmountMinor: 19_000,
        vatAmountMinor: 3_990,
        grossAmountMinor: 22_990,
        reconciliationRequired: false,
        createdAt: "2026-07-26T12:02:00.000Z",
      }, { overrideAccess: true })),
      payload.create(createArgs("payment-attempts", {
        idempotencyKey: `payment-${suffix}`,
        order: order.id,
        state: "pending_provider",
        purpose: "first_payment",
        sequenceType: "first",
        provider: "mollie",
        providerPaymentId: `tr-duplicate-${suffix}`,
        currency: "EUR",
        netAmountMinor: 19_000,
        vatAmountMinor: 3_990,
        grossAmountMinor: 22_990,
        reconciliationRequired: false,
        createdAt: "2026-07-26T12:02:00.000Z",
      }, { overrideAccess: true })),
    ])
    expect(concurrentAttempts.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(concurrentAttempts.filter((result) => result.status === "rejected")).toHaveLength(1)
    const fulfilledAttempt = concurrentAttempts.find((result) => result.status === "fulfilled")
    if (!fulfilledAttempt || fulfilledAttempt.status !== "fulfilled") {
      throw new Error("Expected one persisted payment attempt.")
    }
    const paymentAttempt = remember(
      "payment-attempts",
      fulfilledAttempt.value as PaymentAttempt,
    )
    await expect(payload.create(createArgs("payment-attempts", {
      idempotencyKey: `payment-provider-duplicate-${suffix}`,
      order: order.id,
      state: "pending_provider",
      purpose: "first_payment",
      sequenceType: "first",
      provider: "mollie",
      providerPaymentId: paymentAttempt.providerPaymentId,
      currency: "EUR",
      netAmountMinor: 19_000,
      vatAmountMinor: 3_990,
      grossAmountMinor: 22_990,
      reconciliationRequired: false,
      createdAt: "2026-07-26T12:02:00.000Z",
    }, { overrideAccess: true }))).rejects.toThrow()

    await expect(payload.update(updateArgs(
      "payment-attempts",
      paymentAttempt.id,
      { state: "paid" },
      { overrideAccess: true },
    ))).rejects.toThrow("payment-attempt lifecycle")
    const paidAttempt = await payload.update(updateArgs(
      "payment-attempts",
      paymentAttempt.id,
      {
        state: "paid",
        providerStatus: "paid",
        paidAt: "2026-07-26T12:03:00.000Z",
      },
      {
        overrideAccess: true,
        context: { paymentAttemptLifecycleMutation: true },
      },
    ))
    expect(paidAttempt).toMatchObject({
      state: "paid",
      providerPaymentId: paymentAttempt.providerPaymentId,
    })

    const agreement = remember("billing-agreements", await payload.create(createArgs(
      "billing-agreements",
      {
        idempotencyKey: `agreement-${suffix}`,
        originatingOrder: order.id,
        checkoutProfile: profile.id,
        state: "mandate_pending",
        provider: "mollie",
        providerCustomerId: `cst-${suffix}`,
        providerMandateId: `mdt-${suffix}`,
        catalogVersion: "2026-07-26.1",
        packageCode: "siteinabox-annual",
        billingPeriod: "annual",
        currency: "EUR",
        recurringNetAmountMinor: 19_000,
        renewalIntent: true,
        reconciliationRequired: false,
        createdAt: "2026-07-26T12:04:00.000Z",
      },
      { overrideAccess: true },
    )))
    const invoice = remember("accounting-documents", await payload.create(createArgs(
      "accounting-documents",
      {
        evidenceKey: `invoice-${suffix}`,
        documentNumber: `INV-${suffix}`,
        documentType: "invoice",
        state: "issued",
        order: order.id,
        paymentAttempt: paymentAttempt.id,
        reason: "payment_collected",
        providerOperationId: paymentAttempt.providerPaymentId,
        providerStatus: "paid",
        currency: "EUR",
        netAmountMinor: 19_000,
        vatAmountMinor: 3_990,
        grossAmountMinor: 22_990,
        lineItems: [{ code: "siteinabox-annual", netAmountMinor: 19_000 }],
        customerSnapshot: { customerEmail },
        issuedAt: "2026-07-26T12:04:00.000Z",
        reconciliationRequired: false,
        createdAt: "2026-07-26T12:04:00.000Z",
      },
      { overrideAccess: true },
    )))
    await expect(payload.update(updateArgs(
      "accounting-documents",
      invoice.id,
      { grossAmountMinor: 1 },
      {
        overrideAccess: true,
        context: { accountingDocumentLifecycleMutation: true },
      },
    ))).rejects.toThrow("immutable")
    await expect(payload.create(createArgs(
      "accounting-documents",
      {
        evidenceKey: `invoice-duplicate-${suffix}`,
        documentNumber: `INV-DUPLICATE-${suffix}`,
        documentType: "invoice",
        state: "issued",
        order: order.id,
        paymentAttempt: paymentAttempt.id,
        reason: "payment_collected",
        providerOperationId: paymentAttempt.providerPaymentId,
        currency: "EUR",
        netAmountMinor: 19_000,
        vatAmountMinor: 3_990,
        grossAmountMinor: 22_990,
        lineItems: [],
        customerSnapshot: { customerEmail },
        issuedAt: "2026-07-26T12:04:00.000Z",
        reconciliationRequired: false,
        createdAt: "2026-07-26T12:04:00.000Z",
      },
      { overrideAccess: true },
    ))).rejects.toThrow()
    const domain = remember("managed-domains", await payload.create(createArgs(
      "managed-domains",
      {
        domainNameAscii: `phase2-${suffix}.nl`,
        tld: "nl",
        provisioningIdempotencyKey: `provision-${suffix}`,
        originatingOrder: order.id,
        registrantProfile: profile.id,
        state: "active",
        initialOperation: "registration",
        registrantOwnership: "customer",
        provider: "openprovider",
        providerDomainId: `domain-${suffix}`,
        renewalIntent: true,
        reconciliationRequired: false,
        createdAt: "2026-07-26T12:05:00.000Z",
      },
      { overrideAccess: true },
    )))
    await expect(payload.create(createArgs(
      "managed-domains",
      {
        domainNameAscii: `PHASE2-${suffix}.NL.`,
        tld: "nl",
        provisioningIdempotencyKey: `provision-alias-${suffix}`,
        originatingOrder: order.id,
        registrantProfile: profile.id,
        state: "pending",
        initialOperation: "registration",
        registrantOwnership: "customer",
        provider: "openprovider",
        providerDomainId: `domain-alias-${suffix}`,
        renewalIntent: true,
        reconciliationRequired: false,
        createdAt: "2026-07-26T12:05:00.000Z",
      },
      { overrideAccess: true },
    ))).rejects.toThrow()
    const cycle = remember("domain-renewal-cycles", await payload.create(createArgs(
      "domain-renewal-cycles",
      {
        idempotencyKey: `renewal-${suffix}`,
        managedDomain: domain.id,
        billingAgreement: agreement.id,
        order: order.id,
        paymentAttempt: paymentAttempt.id,
        state: "payment_committed",
        coverageStartsAt: "2027-07-26T00:00:00.000Z",
        coverageEndsAt: "2028-07-26T00:00:00.000Z",
        providerRenewalDate: "2027-07-26T00:00:00.000Z",
        providerSafeCutoffAt: "2027-07-19T00:00:00.000Z",
        renewalIntentSnapshot: true,
        currency: "EUR",
        providerOperationPriceNetMinor: 1_000,
        includedAllowanceNetMinor: 1_000,
        surchargeNetMinor: 0,
        financialCoverageState: "payment_secured",
        pricingEvidence: {
          provider: "openprovider",
          capturedAt: "2026-07-26T12:06:00.000Z",
          providerOperationPriceNetMinor: 1_000,
          includedAllowanceNetMinor: 1_000,
          surchargeNetMinor: 0,
        },
        netAmountMinor: 1_000,
        vatAmountMinor: 210,
        grossAmountMinor: 1_210,
        reconciliationRequired: false,
        createdAt: "2026-07-26T12:06:00.000Z",
      },
      { overrideAccess: true },
    )))
    await expect(payload.create(createArgs(
      "domain-renewal-cycles",
      {
        idempotencyKey: `renewal-duplicate-${suffix}`,
        managedDomain: domain.id,
        billingAgreement: agreement.id,
        state: "scheduled",
        coverageStartsAt: "2027-07-26T00:00:00.000Z",
        coverageEndsAt: "2028-07-26T00:00:00.000Z",
        providerRenewalDate: "2027-07-26T00:00:00.000Z",
        providerSafeCutoffAt: "2027-07-19T00:00:00.000Z",
        renewalIntentSnapshot: true,
        currency: "EUR",
        providerOperationPriceNetMinor: 1_000,
        includedAllowanceNetMinor: 1_000,
        surchargeNetMinor: 0,
        financialCoverageState: "uncovered",
        pricingEvidence: {
          provider: "openprovider",
          capturedAt: "2026-07-26T12:06:00.000Z",
          providerOperationPriceNetMinor: 1_000,
          includedAllowanceNetMinor: 1_000,
          surchargeNetMinor: 0,
        },
        reconciliationRequired: false,
        createdAt: "2026-07-26T12:06:00.000Z",
      },
      { overrideAccess: true },
    ))).rejects.toThrow()

    expect({ agreement, domain, cycle }).toMatchObject({
      agreement: { state: "mandate_pending", providerMandateId: `mdt-${suffix}` },
      domain: {
        state: "active",
        registrantOwnership: "customer",
        providerDomainId: `domain-${suffix}`,
      },
      cycle: {
        state: "payment_committed",
        renewalIntentSnapshot: true,
      },
    })
  })
})
