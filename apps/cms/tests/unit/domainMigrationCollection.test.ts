import { domainMigrationFixture } from "../_helpers/generatedDocs"
import { hookRequest, hookCollection } from "../_helpers/hookFixtures"
import { fieldAccessArgs } from "../_helpers/accessArgs"
import type { DomainMigration } from "@/payload-types"
import { describe, expect, it } from "vitest"

import {
  DomainMigrations,
  protectDomainMigration,
  validateDomainMigration,
} from "@/collections/DomainMigrations"

type BeforeChangeArgs = Parameters<typeof protectDomainMigration>[0]
type BeforeValidateArgs = Parameters<typeof validateDomainMigration>[0]

const updateArgs = (input: {
  data: Partial<DomainMigration>
  originalDoc?: Partial<DomainMigration>
  context?: BeforeChangeArgs["context"]
}): BeforeChangeArgs => ({
  operation: "update", data: input.data,
  originalDoc: domainMigrationFixture(input.originalDoc ?? { state: "awaiting_customer", sourceZoneHash: "frozen-hash" }),
  context: input.context ?? {}, req: hookRequest({ context: input.context ?? {} }),
  collection: hookCollection("domain-migrations"),
})

const validateArgs = (input: { data: Partial<DomainMigration> }): BeforeValidateArgs => ({
  ...input, operation: "create", context: {}, req: hookRequest(), collection: hookCollection("domain-migrations"),
})

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

    expect(protectDomainMigration(updateArgs({
      originalDoc: { state: "ready_for_cutover" },
      data: { state: "custom_quote_required" },
      context: { domainMigrationLifecycleMutation: true },
    }))).toMatchObject({ state: "custom_quote_required" })
  })

  it("freezes acquired source and rollback evidence", () => {
    expect(() => protectDomainMigration(updateArgs({
      data: { sourceZoneHash: "different-hash" },
      context: { domainMigrationLifecycleMutation: true },
    }))).toThrow('field "sourceZoneHash" is immutable')
  })

  it("supports assisted standard, rejects accepted complex, and deletes terminal secrets", () => {
    expect(validateDomainMigration(validateArgs({
      data: { acceptedClassification: "assisted_standard" },
    }))).toMatchObject({
      acceptedClassification: "assisted_standard",
    })
    expect(() => validateDomainMigration(validateArgs({
      data: { acceptedClassification: "complex" },
    }))).toThrow("custom quote")
    expect(() => validateDomainMigration(validateArgs({
      data: { state: "completed", encryptedTransferCode: "ciphertext" },
    }))).toThrow("delete encrypted credentials")
    for (const state of [
      "completed",
      "rolled_back",
      "failed",
      "custom_quote_required",
    ] as const) {
      expect(() => validateDomainMigration(validateArgs({
        data: {
          state,
          encryptedSourceRefreshAuthority: "ciphertext",
        },
      }))).toThrow(
        "delete encrypted credentials",
      )
    }
  })

  it("enforces paid/non-billable authorization and immutable operator audit fields", () => {
    expect(() => validateDomainMigration(validateArgs({
      data: {
        operatorWorkAuthorizationState: "awaiting_payment",
        operatorWorkStartedAt: "2026-07-28T10:00:00.000Z",
      },
    }))).toThrow("cannot start")
    expect(() => validateDomainMigration(validateArgs({
      data: {
        operatorWorkCause: "siteinabox_incident_recovery",
        operatorWorkAuthorizationState: "paid_authorized",
        operatorWorkAuthorizationOrder: 1,
        operatorWorkAuthorizationPaymentAttempt: 2,
      },
    }))).toThrow("cannot use billable")
    expect(() => protectDomainMigration(updateArgs({
      originalDoc: {
        state: "paused_supplemental_order",
        operatorWorkStartedAt: "2026-07-28T10:00:00.000Z",
      },
      data: { operatorWorkStartedAt: "2026-07-28T10:01:00.000Z" },
      context: { domainMigrationLifecycleMutation: true },
    }))).toThrow('field "operatorWorkStartedAt" is immutable')
  })

  it("never exposes the encrypted transfer-code field through normal reads", () => {
    const field = DomainMigrations.fields.find(
      (candidate) => "name" in candidate && candidate.name === "encryptedTransferCode",
    )
    if (!field || !("access" in field) || !field.access?.read) {
      throw new Error("Encrypted transfer code field access is missing.")
    }
    expect(field.access.read(fieldAccessArgs({}))).toBe(false)
    const sourceField = DomainMigrations.fields.find(
      (candidate) =>
        "name" in candidate &&
        candidate.name === "encryptedSourceRefreshAuthority",
    )
    if (!sourceField || !("access" in sourceField) || !sourceField.access?.read) {
      throw new Error("Encrypted source refresh field access is missing.")
    }
    expect(sourceField.access.read(fieldAccessArgs({}))).toBe(false)
  })
})
