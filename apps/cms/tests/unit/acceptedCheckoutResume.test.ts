import { describe, expect, it, vi } from "vitest"

import {
  loadAcceptedCheckoutResume,
  sameAcceptedCheckoutAuthority,
} from "@/lib/checkout/acceptedCheckoutResume"
import {
  buildCheckoutQuote,
  openCheckoutQuote,
} from "@/lib/checkout/checkoutQuote"
import {
  GTLD_TRANSFER_ELIGIBILITY_DECLARATION_VERSION,
} from "@siteinabox/contracts/tld-capabilities"
import { asPayload } from "../_helpers/mockPayload"

const mocks = vi.hoisted(() => ({
  attachMigrationCheckoutSecret: vi.fn(async () => ({
    id: 10,
    state: "attached",
  })),
  openAttachedMigrationCheckoutSecret: vi.fn(async () => ({
    sourceZoneHash: "a".repeat(64),
  })),
}))

vi.mock("@/lib/domains/migrationCheckoutSecret", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/domains/migrationCheckoutSecret")
  >()
  return {
    ...original,
    attachMigrationCheckoutSecret: mocks.attachMigrationCheckoutSecret,
    openAttachedMigrationCheckoutSecret: mocks.openAttachedMigrationCheckoutSecret,
  }
})

const acceptedOrder = (selectedDomain = "example.nl") => {
  const isGtld = selectedDomain === "example.com"
  const quote = buildCheckoutQuote({
    billingPeriod: "annual",
    providerOperationPriceNetMinor: 1_250,
    migrationClassification: "automatic",
    migrationSourceMechanism: "validated_provider_export_v1",
    migrationSourceZoneHash: "a".repeat(64),
    migrationPublicEvidenceHash: "c".repeat(64),
    migrationInputEnvelope: "v1.encrypted-authority",
    migrationSecretKey: "migration-secret:accepted",
    selectedDomain,
    domainMode: "existing_domain",
    providerQuotedAt: "2026-07-28T09:55:00.000Z",
    profileVersion: 2,
    draftVersion: "draft-before-payment-return",
    now: new Date("2026-07-28T10:00:00.000Z"),
    ...(isGtld
      ? {
          gtldTransferEligibilityDeclarationVersion:
            GTLD_TRANSFER_ELIGIBILITY_DECLARATION_VERSION,
          gtldTransferEligibilityDeclarationText:
            "I confirm the governed gTLD transfer conditions.",
          gtldTransferEligibilityAccepted: true,
        }
      : {}),
  })
  return {
    quote,
    order: {
      id: 90,
      generationRun: 500,
      orderKind: "initial_subscription",
      state: "accepted",
      paymentStatus: "pending",
      customerEmail: "customer@example.com",
      packageCode: quote.packageCode,
      billingPeriod: quote.billingPeriod,
      currency: quote.currency,
      netLineItems: quote.lineItems,
      quoteEvidence: {
        schemaVersion: quote.schemaVersion,
        catalogVersion: quote.catalogVersion,
        providerQuotedAt: quote.providerQuotedAt,
        draftVersion: quote.draftVersion,
        profileVersion: quote.profileVersion,
        selectedDomain: quote.selectedDomain,
        domainMode: quote.domainMode,
        planPriceNetMinor: quote.planPriceNetMinor,
        domainIncludedAllowanceNetMinor:
          quote.domainIncludedAllowanceNetMinor,
        providerOperationPriceNetMinor:
          quote.providerOperationPriceNetMinor,
        domainSurchargeNetMinor: quote.domainSurchargeNetMinor,
        migrationServiceFeeNetMinor: quote.migrationServiceFeeNetMinor,
        migrationPublicEvidenceHash: quote.migrationPublicEvidenceHash,
        subtotalNetMinor: quote.netAmountMinor,
        vatRateBasisPoints: quote.vatRateBasisPoints,
        vatAmountMinor: quote.vatAmountMinor,
        grossPayableNowMinor: quote.grossAmountMinor,
        futureSubscriptionNetMinor: quote.futureSubscriptionNetMinor,
        futureSubscriptionVatMinor: quote.futureSubscriptionVatMinor,
        futureSubscriptionGrossMinor: quote.futureSubscriptionGrossMinor,
        transferRenewalEffect: quote.transferRenewalEffect,
        domainRenewalExplanation: quote.domainRenewalExplanation,
        tldCapability: {
          tld: isGtld ? "com" : "nl",
          capabilityVersion: isGtld
            ? "tld-com-2026-07-28.1"
            : "tld-nl-2026-07-28.1",
          effectiveFrom: "2026-07-28T00:00:00.000Z",
          transferRenewalEffect: quote.transferRenewalEffect,
        },
        migration: {
          classification: quote.migrationClassification,
          sourceMechanism: quote.migrationSourceMechanism,
          sourceZoneHash: quote.migrationSourceZoneHash,
          publicEvidenceHash: quote.migrationPublicEvidenceHash,
          checkoutSecretKey: quote.migrationSecretKey,
          ...(isGtld
            ? {
                transferEligibilityDeclaration: {
                  version:
                    quote.gtldTransferEligibilityDeclarationVersion,
                  text: quote.gtldTransferEligibilityDeclarationText,
                  accepted: quote.gtldTransferEligibilityAccepted,
                },
              }
            : {}),
        },
      },
    },
  }
}

describe("accepted checkout resume", () => {
  it("reissues only the exact nonvolatile accepted authority after a payment return", async () => {
    const { order, quote } = acceptedOrder()
    const find = vi.fn(async () => ({ docs: [order], totalDocs: 1 }))
    const resume = await loadAcceptedCheckoutResume(asPayload({ find }), {
      generationRunId: 500,
      customerEmail: " Customer@Example.com ",
      signingSecret: "resume-secret",
      now: new Date("2026-07-28T10:10:00.000Z"),
    })

    expect(resume).toMatchObject({
      orderId: 90,
      domain: "example.nl",
      billingPeriod: "annual",
      tldCapabilityVersion: "tld-nl-2026-07-28.1",
    })
    const reopened = openCheckoutQuote(
      resume!.quotes.annual.token,
      "resume-secret",
      new Date("2026-07-28T10:11:00.000Z"),
    )
    expect(sameAcceptedCheckoutAuthority(reopened, quote)).toBe(true)
    expect(reopened.quoteIssuedAt).toBe("2026-07-28T10:10:00.000Z")
    expect(reopened.quoteExpiresAt).toBe("2026-07-28T10:25:00.000Z")
    expect(reopened.migrationInputEnvelope).toBeNull()
    expect(mocks.openAttachedMigrationCheckoutSecret).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        secretKey: "migration-secret:accepted",
        orderId: 90,
      }),
    )
    expect(mocks.attachMigrationCheckoutSecret).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        secretKey: "migration-secret:accepted",
        orderId: 90,
      }),
    )
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        and: [
          { generationRun: { equals: 500 } },
          { orderKind: { equals: "initial_subscription" } },
          { customerEmail: { equals: "customer@example.com" } },
        ],
      },
      overrideAccess: true,
    }))
  })

  it("reconstructs durable gTLD acceptance after the migration secret was consumed", async () => {
    const { order } = acceptedOrder("example.com")
    const find = vi.fn(async () => ({ docs: [order], totalDocs: 1 }))
    mocks.openAttachedMigrationCheckoutSecret.mockRejectedValueOnce(
      new Error("Migration checkout secret was already consumed."),
    )

    const resume = await loadAcceptedCheckoutResume(asPayload({ find }), {
      generationRunId: 500,
      customerEmail: "customer@example.com",
      signingSecret: "resume-secret",
      now: new Date("2026-07-28T10:10:00.000Z"),
    })

    expect(resume).toMatchObject({
      domain: "example.com",
      requiresMigrationRecollection: true,
      tldCapabilityVersion: "tld-com-2026-07-28.1",
      quotes: {
        annual: {
          quote: {
            gtldTransferEligibilityDeclarationVersion:
              GTLD_TRANSFER_ELIGIBILITY_DECLARATION_VERSION,
            gtldTransferEligibilityDeclarationText:
              "I confirm the governed gTLD transfer conditions.",
            gtldTransferEligibilityAccepted: true,
          },
        },
      },
    })
  })

  it("fails closed when stored commercial evidence no longer reconciles", async () => {
    const { order } = acceptedOrder()
    order.quoteEvidence.grossPayableNowMinor += 1
    const find = vi.fn(async () => ({ docs: [order], totalDocs: 1 }))

    await expect(loadAcceptedCheckoutResume(asPayload({ find }), {
      generationRunId: 500,
      customerEmail: "customer@example.com",
      signingSecret: "resume-secret",
      now: new Date("2026-07-28T10:10:00.000Z"),
    })).rejects.toThrow("no longer matches")
  })

  it("rejects missing or mismatched frozen transfer-renewal evidence", async () => {
    const missing = acceptedOrder().order
    delete (missing.quoteEvidence as Record<string, unknown>)
      .transferRenewalEffect
    await expect(loadAcceptedCheckoutResume(asPayload({
      find: vi.fn(async () => ({ docs: [missing], totalDocs: 1 })),
    }), {
      generationRunId: 500,
      customerEmail: "customer@example.com",
      signingSecret: "resume-secret",
      now: new Date("2026-07-28T10:10:00.000Z"),
    })).rejects.toThrow("missing transferRenewalEffect")

    const mismatched = acceptedOrder().order
    mismatched.quoteEvidence.tldCapability.transferRenewalEffect =
      "extends_one_year"
    await expect(loadAcceptedCheckoutResume(asPayload({
      find: vi.fn(async () => ({ docs: [mismatched], totalDocs: 1 })),
    }), {
      generationRunId: 500,
      customerEmail: "customer@example.com",
      signingSecret: "resume-secret",
      now: new Date("2026-07-28T10:10:00.000Z"),
    })).rejects.toThrow("frozen TLD capability evidence")
  })

  it("returns the frozen order with a safe recollection gate after secret expiry", async () => {
    const { order } = acceptedOrder()
    const find = vi.fn(async () => ({ docs: [order], totalDocs: 1 }))
    mocks.openAttachedMigrationCheckoutSecret.mockRejectedValueOnce(
      new Error("Migration checkout secret is not active for this order."),
    )

    await expect(loadAcceptedCheckoutResume(asPayload({ find }), {
      generationRunId: 500,
      customerEmail: "customer@example.com",
      signingSecret: "resume-secret",
      now: new Date("2026-08-28T10:10:00.000Z"),
    })).resolves.toMatchObject({
      orderId: 90,
      requiresMigrationRecollection: true,
      quotes: {
        annual: {
          quote: {
            migrationInputEnvelope: null,
            migrationSecretKey: "migration-secret:accepted",
          },
        },
      },
    })
  })
})
