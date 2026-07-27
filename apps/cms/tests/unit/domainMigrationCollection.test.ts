import { describe, expect, it } from "vitest"

import {
  DomainMigrations,
  protectDomainMigration,
  validateDomainMigration,
} from "@/collections/DomainMigrations"

type BeforeChangeArgs = Parameters<typeof protectDomainMigration>[0]
type BeforeValidateArgs = Parameters<typeof validateDomainMigration>[0]

const updateArgs = (input: {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  context?: Record<string, unknown>
}): BeforeChangeArgs => ({
  operation: "update",
  data: input.data,
  originalDoc: input.originalDoc ?? {
    state: "awaiting_customer",
    sourceZoneHash: "frozen-hash",
  },
  context: input.context,
  req: { context: input.context },
} as unknown as BeforeChangeArgs)

describe("domain migration collection constraints", () => {
  it("allows lifecycle writes only through the reviewed context and state graph", () => {
    expect(() => protectDomainMigration(updateArgs({
      data: { state: "ready_to_prepare" },
    }))).toThrow("reviewed migration lifecycle")

    expect(() => protectDomainMigration(updateArgs({
      data: { state: "completed" },
      context: { domainMigrationLifecycleMutation: true },
    }))).toThrow("Invalid domain migration state transition")

    expect(protectDomainMigration(updateArgs({
      data: { state: "ready_to_prepare" },
      context: { domainMigrationLifecycleMutation: true },
    }))).toMatchObject({ state: "ready_to_prepare" })
  })

  it("freezes acquired source and rollback evidence", () => {
    expect(() => protectDomainMigration(updateArgs({
      data: { sourceZoneHash: "different-hash" },
      context: { domainMigrationLifecycleMutation: true },
    }))).toThrow('field "sourceZoneHash" is immutable')
  })

  it("requires automatic classification and transfer-code deletion at terminal states", () => {
    expect(() => validateDomainMigration({
      data: { acceptedClassification: "assisted_standard" },
    } as unknown as BeforeValidateArgs)).toThrow("automatic classification")
    expect(() => validateDomainMigration({
      data: { state: "completed", encryptedTransferCode: "ciphertext" },
    } as unknown as BeforeValidateArgs)).toThrow("delete the encrypted transfer code")
  })

  it("never exposes the encrypted transfer-code field through normal reads", () => {
    const field = DomainMigrations.fields.find(
      (candidate) => "name" in candidate && candidate.name === "encryptedTransferCode",
    )
    if (!field || !("access" in field) || !field.access?.read) {
      throw new Error("Encrypted transfer code field access is missing.")
    }
    expect(field.access.read({} as never)).toBe(false)
  })
})
