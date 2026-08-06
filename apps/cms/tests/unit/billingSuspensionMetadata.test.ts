/** Regression: Payload beforeValidate backfills billing fields on theme-only updates. */
import { describe, expect, it } from "vitest"
import { protectBillingSuspensionMetadata } from "@/collections/Tenants"
import { hookArgsFor } from "../_helpers/hookFixtures"

const suspendedTenant = {
  status: "suspended",
  billingSuspensionAgreement: 900,
  billingSuspendedAt: "2026-08-15T10:00:00.000Z",
  theme: { version: 2, appearance: { mode: "light" } },
}

const callHook = (
  data: Record<string, unknown>,
  input: {
    operation?: "create" | "update"
    system?: boolean
    originalDoc?: Record<string, unknown>
  } = {},
) => protectBillingSuspensionMetadata(hookArgsFor(
  protectBillingSuspensionMetadata,
  {
    data,
    operation: input.operation ?? "update",
    originalDoc: input.originalDoc ?? suspendedTenant,
    req: {
      context: input.system
        ? { billingTenantLifecycleMutation: true }
        : {},
    },
  },
))

describe("billing suspension metadata ownership", () => {
  it("allows theme-only updates when Payload carries unchanged billing metadata", () => {
    expect(callHook({
      theme: { version: 3, appearance: { mode: "dark" } },
      billingSuspensionAgreement: suspendedTenant.billingSuspensionAgreement,
      billingSuspendedAt: suspendedTenant.billingSuspendedAt,
    })).toMatchObject({
      theme: { version: 3, appearance: { mode: "dark" } },
      billingSuspensionAgreement: 900,
      billingSuspendedAt: "2026-08-15T10:00:00.000Z",
    })
  })

  it("allows theme-only updates when Payload backfills null billing metadata", () => {
    expect(callHook({
      theme: { version: 3, appearance: { mode: "dark" } },
      billingSuspensionAgreement: null,
      billingSuspendedAt: null,
    }, {
      originalDoc: {
        status: "provisioning",
        billingSuspensionAgreement: null,
        billingSuspendedAt: null,
        theme: { version: 3, appearance: { mode: "light" } },
      },
    })).toMatchObject({
      theme: { version: 3, appearance: { mode: "dark" } },
    })
  })

  it("allows theme-only updates that omit billing keys entirely", () => {
    expect(callHook({
      theme: { version: 3, appearance: { mode: "dark" } },
    })).toMatchObject({
      theme: { version: 3, appearance: { mode: "dark" } },
    })
  })

  it("rejects unauthorized writes to billingSuspensionAgreement", () => {
    expect(() => callHook({
      billingSuspensionAgreement: 999,
      billingSuspendedAt: suspendedTenant.billingSuspendedAt,
    })).toThrow("Billing suspension metadata is system-owned.")
    expect(() => callHook({
      billingSuspensionAgreement: null,
      billingSuspendedAt: null,
    })).toThrow("Billing suspension metadata is system-owned.")
  })

  it("rejects unauthorized writes to billingSuspendedAt", () => {
    expect(() => callHook({
      billingSuspensionAgreement: suspendedTenant.billingSuspensionAgreement,
      billingSuspendedAt: "2026-09-01T00:00:00.000Z",
    })).toThrow("Billing suspension metadata is system-owned.")
  })

  it("allows reviewed billing lifecycle mutations with context", () => {
    expect(callHook({
      billingSuspensionAgreement: 999,
      billingSuspendedAt: "2026-09-01T00:00:00.000Z",
    }, { system: true })).toMatchObject({
      billingSuspensionAgreement: 999,
      billingSuspendedAt: "2026-09-01T00:00:00.000Z",
    })
    expect(callHook({
      billingSuspensionAgreement: null,
      billingSuspendedAt: null,
    }, { system: true })).toMatchObject({
      billingSuspensionAgreement: null,
      billingSuspendedAt: null,
    })
  })
})
