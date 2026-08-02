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
            tenant: 1,
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

  it("does not project a cancelled order as live migration work", async () => {
    const find = vi.fn(async ({ collection }: MockFindArgs) => ({
      docs: collection === "orders" ? [{
        id: 90,
        state: "cancelled",
        generationRun: 500,
        orderKind: "initial_subscription",
        customerEmail: "customer@example.com",
      }] : [],
      totalDocs: 1,
    }))

    await expect(loadCustomerMigrationStatus(asPayload({ find }), {
      generationRunId: 500,
      customerEmail: "customer@example.com",
    })).resolves.toBeNull()
    expect(find).toHaveBeenCalledTimes(1)
  })

  it("exposes the governed registrant-email confirmation deadline", async () => {
    const order = {
      id: 600,
      generationRun: 500,
      tenant: 1,
      orderKind: "initial_subscription",
      customerEmail: "client@example.com",
      quoteEvidence: {
        tldCapability: {
          tld: "com",
          capabilityVersion: "tld-com-2026-07-29.3",
        },
      },
    }
    const migration = {
      id: 700,
      originatingOrder: 600,
      managedDomain: null,
      domainNameAscii: "example.com",
      tld: "com",
      state: "awaiting_provider",
      acceptedClassification: "automatic",
      sourceMechanism: "cloudflare_api_v1",
      operatorWorkAuthorizationState: "not_required",
      customerActions: {
        confirm_transfer: {
          status: "required",
          updatedAt: "2026-07-28T08:00:00.000Z",
          evidence: "registrant_email_confirmation_required",
        },
      },
      transferRequestedAt: "2026-07-28T08:00:00.000Z",
      updatedAt: "2026-07-28T08:00:00.000Z",
    }
    const payload = asPayload({
      find: vi.fn(async ({ collection }: { collection: string }) => ({
        docs: collection === "orders"
          ? [order]
          : collection === "domain-migrations"
            ? [migration]
            : [],
      })),
      findByID: vi.fn(),
    })

    await expect(loadCustomerMigrationStatus(payload, {
      generationRunId: 500,
      customerEmail: "CLIENT@example.com",
    })).resolves.toMatchObject({
      actions: [{
        action: "confirm_transfer",
        status: "required",
        deadlineAt: "2026-08-03T08:00:00.000Z",
      }],
    })
  })
})
