import { describe, expect, it } from "vitest"

import {
  migrationRegistrantVerification,
  registrationRegistrantVerification,
  storedRegistrantVerification,
} from "@/lib/domains/registrantVerification"

describe("registrant verification projection", () => {
  it.each([
    [undefined, "pending"],
    ["not required", "not_required"],
    ["valid", "verified"],
    ["completed", "verified"],
    ["suspended", "suspended"],
    ["expired", "overdue"],
    ["rejected", "failed"],
    ["provider-specific", "pending"],
  ] as const)(
    "preserves registration status %s as %s",
    (providerStatus, expected) => {
      expect(registrationRegistrantVerification({
        verificationEmailStatus: providerStatus,
      }, "nl").status).toBe(expected)
    },
  )

  it("preserves the migration-specific approved status mapping", () => {
    expect(migrationRegistrantVerification({
      verificationEmailStatus: "approved",
    })).toBe("verified")
    expect(migrationRegistrantVerification({
      verificationEmailStatus: "valid",
    })).toBe("pending")
  })

  it("projects recovery and customer-action ownership without effects", () => {
    expect(storedRegistrantVerification("verified", "suspended")).toEqual({
      status: "recovered",
      recovered: true,
      customerActionRequired: false,
    })
    expect(storedRegistrantVerification("overdue", "verified")).toEqual({
      status: "overdue",
      recovered: false,
      customerActionRequired: true,
    })
  })
})
