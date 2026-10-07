import { describe, expect, it, vi } from "vitest"

import {
  authorizeDomainMigrationIncidentRecovery,
  completeDomainMigrationIncidentRecovery,
  failDomainMigrationIncidentRecovery,
  requestDomainMigrationRollback,
  startDomainMigrationIncidentRecovery,
} from "@/lib/domains/migrationOperatorRecovery"
import type { DomainMigration } from "@/payload-types"
import { createTestPayload } from "../_helpers/testPayload"
import { domainMigrationFixture } from "../_helpers/generatedDocs"
import { matchesWhere } from "../_helpers/mockPayload"
import { payloadUpdateFixture } from "../_helpers/payloadUpdateFixture"

const NOW = "2026-07-28T10:00:00.000Z"
const OPERATOR = {
  id: 99,
  email: "operator@siteinabox.nl",
  role: "super-admin" as const,
}

const migrationRecord = (): DomainMigration => domainMigrationFixture({
  id: 10,
  idempotencyKey: "domain-migration:order:20:v1",
  originatingOrder: 20,
  checkoutProfile: 40,
  tenant: 1,
  domainNameAscii: "example.nl",
  tld: "nl",
  acceptedClassification: "automatic",
  state: "preparing",
  sourceMechanism: "cloudflare_api_v1",
  encryptedTransferCode: "ciphertext",
  providerTransferState: "not_started",
  cloudflareZoneState: "not_started",
  cutoverWriteState: "not_started",
  rollbackWriteState: "not_started",
  operatorWorkAuthorizationState: "not_required",
  reconciliationRequired: false,
  stateHistory: [],
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-28T08:00:00.000Z",
})

const createStore = () => {
  const collections = { "domain-migrations": [migrationRecord()] }
  const payload = createTestPayload()
  const findByID = vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
    if (collection !== "domain-migrations") throw new Error(`Unexpected collection ${collection}`)
    const doc = collections[collection].find(entry => String(entry.id) === String(id))
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    return doc
  })
  vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(async args => {
    if (args.collection !== "domain-migrations") throw new Error(`Unexpected collection ${args.collection}`)
    if (args.where) {
      const docs = collections[args.collection].filter(doc => matchesWhere({ ...doc }, args.where))
      for (const doc of docs) Object.assign(doc, args.data)
      return { docs, errors: [], totalDocs: docs.length }
    }
    const doc = collections[args.collection].find(entry => String(entry.id) === String(args.id))
    if (!doc) throw new Error(`Missing ${args.collection} ${args.id}`)
    Object.assign(doc, args.data)
    return doc
  }))
  vi.spyOn(payload.jobs, "queue").mockResolvedValue({ id: 1, input: {}, totalTried: 0, createdAt: NOW, updatedAt: NOW })
  return { collections, findByID, payload }
}

const authorizeAndStart = async (store: ReturnType<typeof createStore>) => {
  await authorizeDomainMigrationIncidentRecovery(store.payload, {
    migrationId: 10,
    workScope: "Restore records lost by Siteinabox automation.",
    now: NOW,
  })
  return startDomainMigrationIncidentRecovery(store.payload, {
    migrationId: 10,
    actor: OPERATOR,
    now: "2026-07-28T10:05:00.000Z",
  })
}

describe("domain migration operator recovery", () => {
  it("authorizes only non-billable incident recovery without creating commerce state", async () => {
    const store = createStore()
    const migration = await authorizeDomainMigrationIncidentRecovery(
      store.payload,
      {
        migrationId: 10,
        workScope: "Restore records lost by Siteinabox automation.",
        now: NOW,
      },
    )

    expect(Object.keys(store.collections)).toEqual(["domain-migrations"])
    expect(migration).toMatchObject({
      state: "paused_supplemental_order",
      operatorWorkCause: "siteinabox_incident_recovery",
      operatorWorkAuthorizationState: "non_billable_incident_authorized",
    })
    expect(migration).not.toHaveProperty("operatorWorkAuthorizationOrder")
    await expect(startDomainMigrationIncidentRecovery(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      now: NOW,
    })).resolves.toMatchObject({ operatorWorkStartedAt: NOW })
  })

  it("rejects an unbounded incident scope", async () => {
    const store = createStore()
    await expect(authorizeDomainMigrationIncidentRecovery(store.payload, {
      migrationId: 10,
      workScope: "  ",
      now: NOW,
    })).rejects.toThrow("bounded scope")
  })

  it("records a bounded failure without resuming automation", async () => {
    const store = createStore()
    await authorizeAndStart(store)

    const failed = await failDomainMigrationIncidentRecovery(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      failureCode: "zone_conflict",
      now: "2026-07-28T10:10:00.000Z",
    })

    expect(failed).toMatchObject({
      state: "failed",
      reconciliationRequired: false,
      failureReason: "zone_conflict:recorded_by_super_admin:99",
    })
    expect(store.payload.jobs.queue).not.toHaveBeenCalled()
  })

  it("allows only one concurrent completion or failure transition", async () => {
    const store = createStore()
    await authorizeAndStart(store)

    const findByID = store.findByID
    const originalFindByID = findByID.getMockImplementation()
    if (!originalFindByID) throw new Error("Expected store findByID implementation")
    let concurrentReads = 0
    let releaseReads: (() => void) | undefined
    const readsReady = new Promise<void>((resolve) => {
      releaseReads = resolve
    })
    findByID.mockImplementation(async (args) => {
      if (args.collection === "domain-migrations" && concurrentReads < 2) {
        concurrentReads += 1
        const snapshot = structuredClone(
          store.collections["domain-migrations"]![0]!,
        )
        if (concurrentReads === 2) releaseReads?.()
        await readsReady
        return snapshot
      }
      return originalFindByID(args)
    })

    const results = await Promise.allSettled([
      completeDomainMigrationIncidentRecovery(store.payload, {
        migrationId: 10,
        actor: OPERATOR,
        completionNotes: "Verified bounded repair.",
        now: "2026-07-28T10:20:00.000Z",
      }),
      failDomainMigrationIncidentRecovery(store.payload, {
        migrationId: 10,
        actor: OPERATOR,
        failureCode: "zone_conflict",
        now: "2026-07-28T10:20:00.000Z",
      }),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: expect.objectContaining({
        message: expect.stringContaining("changed concurrently"),
      }),
    })
  })

  it("queues rollback from active cutover without making a provider write", async () => {
    const store = createStore()
    Object.assign(store.collections["domain-migrations"]![0]!, {
      state: "verifying",
      rollbackEvidence: {
        authoritativeNameservers: ["ns1.old.example", "ns2.old.example"],
      },
    })

    const requested = await requestDomainMigrationRollback(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      reasonCode: "operator_detected_dns_mismatch",
      now: NOW,
    })

    expect(requested).toMatchObject({
      state: "verifying",
      rollbackWriteState: "not_started",
      rollbackRequestedAt: NOW,
      reconciliationRequired: true,
      failureReason:
        "operator_detected_dns_mismatch:requested_by_super_admin:99",
    })
    expect(store.payload.jobs.queue).toHaveBeenCalledWith({
      task: "prepare-domain-migration",
      input: { migrationId: "10" },
      queue: "default",
      overrideAccess: true,
    })
  })
})
