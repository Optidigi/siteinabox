import { describe, expect, it } from "vitest"

import type { DomainMigration } from "@/payload-types"
import {
  classifyMigrationEntry,
} from "@/lib/domains/migrationDecisions"

const migration = (
  values: Partial<DomainMigration> = {},
): DomainMigration => ({
  state: "ready_to_prepare",
  sourceZoneSnapshot: { records: [] },
  targetZoneSnapshot: { records: [] },
  rollbackEvidence: { nameservers: [] },
  encryptedTransferCode: "ciphertext",
  providerTransferState: "not_started",
  ...values,
} as DomainMigration)

describe("domain migration entry decisions", () => {
  it.each([
    ["completed", "completed", "completed"],
    ["rolled_back", "completed", "rolled_back"],
    ["custom_quote_required", "manual_review", "failed"],
    ["paused_supplemental_order", "waiting", "waiting"],
  ] as const)(
    "classifies %s without provider or Payload effects",
    (state, outcome, status) => {
      expect(classifyMigrationEntry(migration({ state }))).toMatchObject({
        outcome,
        status,
      })
    },
  )

  it("requires complete frozen evidence before continuing", () => {
    expect(classifyMigrationEntry(migration({
      targetZoneSnapshot: null,
    }))).toEqual({
      outcome: "waiting",
      status: "waiting",
      message: "Frozen migration preparation evidence is incomplete.",
    })
  })

  it("allows confirmed transfer reconciliation after secret clearing", () => {
    expect(classifyMigrationEntry(migration({
      encryptedTransferCode: null,
      providerTransferState: "confirmed",
    }))).toEqual({ outcome: "continue" })
  })
})
