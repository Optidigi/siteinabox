import { describe, expect, it, vi } from "vitest"

import { asPayload } from "../_helpers/mockPayload"
import { loadCustomerProvisioningStatus } from "@/lib/domains/provisioningStatus"

describe("customer provisioning status", () => {
  it("projects paid registration and registrant action without provider secrets", async () => {
    const payload = asPayload({
      find: vi.fn(async ({ collection }) => {
        if (collection === "orders") {
          return {
            docs: [{
              id: 600,
              generationRun: 500,
              orderKind: "initial_subscription",
              customerEmail: "customer@example.com",
              paymentStatus: "paid",
              domain: "clientsite.nl",
              updatedAt: "2026-07-29T12:00:00.000Z",
            }],
          }
        }
        if (collection === "managed-domains") {
          return {
            docs: [{
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
            }],
          }
        }
        return { docs: [] }
      }),
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
    const payload = asPayload({
      find: vi.fn(async () => ({ docs: [] })),
    })

    await expect(loadCustomerProvisioningStatus(payload, {
      generationRunId: 500,
      customerEmail: "customer@example.com",
    })).resolves.toBeNull()
  })
})
