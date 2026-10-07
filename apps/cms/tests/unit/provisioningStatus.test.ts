import { describe, expect, it, vi } from "vitest"

import { createTestPayload } from "../_helpers/testPayload"
import { orderFixture, managedDomainFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { loadCustomerProvisioningStatus } from "@/lib/domains/provisioningStatus"

describe("customer provisioning status", () => {
  it("projects paid registration and registrant action without provider secrets", async () => {
    const payload = createTestPayload()
    vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => {
        if (collection === "orders") {
          return paginatedFixture([orderFixture({
              id: 600,
              generationRun: 500,
              orderKind: "initial_subscription",
              customerEmail: "customer@example.com",
              paymentStatus: "paid",
              domain: "clientsite.nl",
              updatedAt: "2026-07-29T12:00:00.000Z",
            })])
        }
        if (collection === "managed-domains") {
          return paginatedFixture([managedDomainFixture({
              id: 700,
              originatingOrder: 600,
              domainNameAscii: "clientsite.nl",
              providerDomainId: "provider-secret-id",
              providerRegistrationState: "confirmed",
              registrantVerificationStatus: "pending",
              registrantVerificationDueAt: "2026-08-12T12:00:00.000Z",
              authoritativeDnsStatus: "pending",
              httpsStatus: "pending",
              entitlementStatus: "pending",
              customerStatus: "verification_required",
              failureReason: "internal-provider-detail",
              updatedAt: "2026-07-29T12:05:00.000Z",
            })])
        }
        return paginatedFixture([])
      })

    const status = await loadCustomerProvisioningStatus(payload, {
      generationRunId: 500,
      customerEmail: "Customer@Example.com",
    })

    expect(status).toMatchObject({
      domain: "clientsite.nl",
      registrantVerificationDueAt: "2026-08-12T12:00:00.000Z",
      stages: [
        { code: "payment", status: "complete" },
        { code: "registration", status: "complete" },
        { code: "registrant_verification", status: "action_required" },
        { code: "dns", status: "pending" },
        { code: "https", status: "pending" },
        { code: "activation", status: "pending" },
      ],
    })
    expect(JSON.stringify(status)).not.toMatch(
      /provider-secret-id|internal-provider-detail/,
    )
  })

  it("returns no status without exactly one customer-bound initial order", async () => {
    const payload = createTestPayload()
    vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([]))

    await expect(loadCustomerProvisioningStatus(payload, {
      generationRunId: 500,
      customerEmail: "customer@example.com",
    })).resolves.toBeNull()
  })

  it("does not project a cancelled order as live fulfilment", async () => {
    const payload = createTestPayload()
    const find = vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => paginatedFixture(collection === "orders" ? [orderFixture({
        id: 600,
        state: "cancelled",
        generationRun: 500,
        orderKind: "initial_subscription",
        customerEmail: "customer@example.com",
      })] : []))

    await expect(loadCustomerProvisioningStatus(payload, {
      generationRunId: 500,
      customerEmail: "customer@example.com",
    })).resolves.toBeNull()
    expect(find).toHaveBeenCalledTimes(1)
  })
})
