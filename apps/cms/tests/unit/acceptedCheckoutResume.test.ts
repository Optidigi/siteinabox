import { describe, expect, it, vi } from "vitest"

import {
  loadAcceptedCheckoutResume,
  sameAcceptedCheckoutAuthority,
} from "@/lib/checkout/acceptedCheckoutResume"
import {
  buildCheckoutQuote,
  openCheckoutQuote,
} from "@/lib/checkout/checkoutQuote"
import { asPayload } from "../_helpers/mockPayload"

const mocks = vi.hoisted(() => ({
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
    openAttachedMigrationCheckoutSecret: mocks.openAttachedMigrationCheckoutSecret,
  }
})

const acceptedOrder = () => {
  const quote = buildCheckoutQuote({
    billingPeriod: "annual",
    providerOperationPriceNetMinor: 1_250,
    migrationClassification: "automatic",
    migrationSourceZoneHash: "a".repeat(64),
    migrationInputEnvelope: "v1.encrypted-authority",
    migrationSecretKey: "migration-secret:accepted",
    selectedDomain: "example.nl",
    domainMode: "existing_domain",
    providerQuotedAt: "2026-07-28T09:55:00.000Z",
    profileVersion: 2,
    draftVersion: "draft-before-payment-return",
    now: new Date("2026-07-28T10:00:00.000Z"),
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
        subtotalNetMinor: quote.netAmountMinor,
        vatRateBasisPoints: quote.vatRateBasisPoints,
        vatAmountMinor: quote.vatAmountMinor,
        grossPayableNowMinor: quote.grossAmountMinor,
        futureSubscriptionNetMinor: quote.futureSubscriptionNetMinor,
        futureSubscriptionVatMinor: quote.futureSubscriptionVatMinor,
        futureSubscriptionGrossMinor: quote.futureSubscriptionGrossMinor,
        domainRenewalExplanation: quote.domainRenewalExplanation,
        tldCapability: {
          tld: "nl",
          capabilityVersion: "tld-nl-2026-07-28.1",
          effectiveFrom: "2026-07-28T00:00:00.000Z",
        },
        migration: {
          classification: quote.migrationClassification,
          sourceZoneHash: quote.migrationSourceZoneHash,
          checkoutSecretKey: quote.migrationSecretKey,
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
