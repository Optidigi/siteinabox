import { describe, expect, it, vi } from "vitest"

import { loadCustomerMigrationStatus } from "@/lib/domains/migrationStatus"
import { asPayload, type MockFindArgs } from "../_helpers/mockPayload"

describe("customer migration status projection", () => {
  it("binds the lookup to run and customer and returns only redacted action state", async () => {
    const find = vi.fn(async (input: MockFindArgs) => {
      if (input.collection === "orders") {
        return {
          docs: [{
            id: 90,
            generationRun: 500,
            orderKind: "initial_subscription",
            customerEmail: "customer@example.com",
          }],
          totalDocs: 1,
        }
      }
      if (input.collection === "domain-migrations") {
        return {
          docs: [{
            id: 100,
            originatingOrder: 90,
            domainNameAscii: "ami-care.nl",
            state: "awaiting_provider",
            acceptedClassification: "automatic",
            operatorWorkAuthorizationState: "not_required",
            customerActions: [
              {
                action: "confirm_transfer",
                status: "pending",
                deadlineAt: "2026-07-31T10:00:00.000Z",
                privateNote: "must-not-leak",
              },
              {
                action: "upload_complete_zone",
                status: "completed",
                evidenceHash: "must-not-leak",
              },
            ],
            encryptedTransferCode: "must-not-leak",
            sourceZoneSnapshot: { records: ["must-not-leak"] },
            providerTransferId: "must-not-leak",
            updatedAt: "2026-07-28T10:00:00.000Z",
          }],
          totalDocs: 1,
        }
      }
      throw new Error(`Unexpected collection ${input.collection}`)
    })
    const result = await loadCustomerMigrationStatus(asPayload({ find }), {
      generationRunId: 500,
      customerEmail: " Customer@Example.com ",
    })

    expect(find.mock.calls[0]?.[0]).toMatchObject({
      collection: "orders",
      where: {
        and: [
          { generationRun: { equals: 500 } },
          { orderKind: { equals: "initial_subscription" } },
          { customerEmail: { equals: "customer@example.com" } },
        ],
      },
      overrideAccess: true,
    })
    expect(result).toEqual({
      migrationId: 100,
      domain: "ami-care.nl",
      state: "awaiting_provider",
      classification: "automatic",
      operatorAuthorization: "not_required",
      actions: [
        {
          action: "confirm_transfer",
          status: "pending",
          deadlineAt: "2026-07-31T10:00:00.000Z",
        },
        {
          action: "upload_complete_zone",
          status: "completed",
          deadlineAt: null,
        },
      ],
      supplementalProposal: null,
      updatedAt: "2026-07-28T10:00:00.000Z",
    })
    expect(JSON.stringify(result)).not.toMatch(
      /must-not-leak|encryptedTransferCode|sourceZoneSnapshot|providerTransferId/,
    )
  })

  it("does not return an ambiguous or customer-mismatched order", async () => {
    const find = vi.fn(async () => ({
      docs: [],
      totalDocs: 0,
    }))
    await expect(loadCustomerMigrationStatus(asPayload({ find }), {
      generationRunId: 500,
      customerEmail: "",
    })).resolves.toBeNull()
    expect(find).not.toHaveBeenCalled()
  })

  it("shows the immutable supplemental proposal amount without operator evidence", async () => {
    const find = vi.fn(async (input: MockFindArgs) => {
      if (input.collection === "orders") {
        return {
          docs: [{
            id: 90,
            generationRun: 500,
            orderKind: "initial_subscription",
            customerEmail: "customer@example.com",
            catalogVersion: "2026-07-26.1",
          }],
          totalDocs: 1,
        }
      }
      return {
        docs: [{
          id: 100,
          originatingOrder: 90,
          supplementalOrder: 91,
          domainNameAscii: "ami-care.nl",
          state: "paused_supplemental_order",
          acceptedClassification: "automatic",
          operatorWorkAuthorizationState: "awaiting_payment",
          operatorWorkScope: "verify_customer_zone_export",
          customerActions: [],
          updatedAt: "2026-07-28T10:00:00.000Z",
        }],
        totalDocs: 1,
      }
    })
    const findByID = vi.fn(async () => ({
      id: 91,
      paymentStatus: "open",
    }))

    await expect(loadCustomerMigrationStatus(asPayload({ find, findByID }), {
      generationRunId: 500,
      customerEmail: "customer@example.com",
    })).resolves.toMatchObject({
      migrationId: 100,
      operatorAuthorization: "awaiting_payment",
      supplementalProposal: {
        workScopeCode: "verify_customer_zone_export",
        currency: "EUR",
        netAmountMinor: 4_900,
        vatAmountMinor: 1_029,
        grossAmountMinor: 5_929,
        paymentStatus: "open",
      },
    })
  })
})
