import { describe, expect, it, vi } from "vitest"

import {
  authorizeMigrationOperatorWorkFromPayment,
  completeMigrationOperatorWork,
  failMigrationOperatorWork,
  pauseAcceptedAssistedMigration,
  proposeMigrationOperatorWork,
  requestDomainMigrationRollback,
  requestMigrationOperatorWork,
  startMigrationOperatorWork,
} from "@/lib/domains/assistedMigration"
import { asPayload, type MockDoc, type MockFindArgs, type MockUpdateArgs } from "../_helpers/mockPayload"

const NOW = "2026-07-28T10:00:00.000Z"
const OPERATOR = {
  id: 99,
  email: "operator@siteinabox.nl",
  role: "super-admin" as const,
}

const originOrder = (classification: "automatic" | "assisted_standard" = "automatic") => ({
  id: 20,
  orderNumber: "SIAB-ORIGIN-20",
  tenant: 1,
  generationRun: 30,
  state: "fulfillment_pending",
  checkoutProfileKey: "profile-1",
  catalogVersion: "2026-07-26.1",
  quoteEvidence: {
    migration: {
      classification,
      sourceMechanism: "customer_authorized_provider_export_v1",
    },
  },
  netLineItems: classification === "assisted_standard"
    ? [{
        code: "migration-assisted-standard-per-domain",
        quantity: 1,
        netAmountMinor: 4_900,
      }]
    : [],
  contractingPartyProfileVersion: 1,
  termsVersion: "terms-v1",
  privacyVersion: "privacy-v1",
  businessUseDeclarationVersion: "business-v1",
  customerName: "Ada Lovelace",
  customerEmail: "client@example.com",
  companyName: "Acme Studio",
  billingAddress: { country: "NL" },
  packageCode: "siteinabox-annual",
  billingPeriod: "annual",
  renewalTerms: "Renews annually.",
  lineItems: [],
  currency: "EUR",
  subtotalNet: 190,
  vatAmount: 39.9,
  totalGross: 229.9,
  domain: "example.nl",
  domainRegistrant: { email: "client@example.com" },
  legalDocuments: [10, 11],
  paymentStatus: "paid",
  paymentProvider: "mollie",
  createdAt: "2026-07-28T08:00:00.000Z",
})

const migrationRecord = (
  classification: "automatic" | "assisted_standard" = "automatic",
) => ({
  id: 10,
  idempotencyKey: "domain-migration:order:20:v1",
  originatingOrder: 20,
  checkoutProfile: 40,
  tenant: 1,
  domainNameAscii: "example.nl",
  tld: "nl",
  acceptedClassification: classification,
  state: "preparing",
  sourceMechanism: "customer_authorized_provider_export_v1",
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

const matches = (doc: MockDoc, where: MockFindArgs["where"]): boolean => {
  if (!where) return true
  const clauses = Array.isArray(where.and)
    ? where.and
    : Object.entries(where).map(([field, value]) => ({ [field]: value }))
  return clauses.every((clause) => {
    const [field, condition] = Object.entries(clause as MockDoc)[0] ?? []
    if (!field || !condition || typeof condition !== "object") return true
    const expected = (condition as { equals?: unknown }).equals
    return expected === undefined || String(doc[field]) === String(expected)
  })
}

const createStore = (
  classification: "automatic" | "assisted_standard" = "automatic",
) => {
  const collections: Record<string, MockDoc[]> = {
    "domain-migrations": [migrationRecord(classification)],
    orders: [originOrder(classification)],
    "payment-attempts": classification === "assisted_standard"
      ? [{
          id: 50,
          order: 20,
          purpose: "first_payment",
          state: "paid",
          paidAt: "2026-07-28T09:00:00.000Z",
        }]
      : [],
  }
  let nextId = 100
  const find = vi.fn(async ({ collection, where }: MockFindArgs) => {
    const docs = (collections[collection] ?? []).filter((doc) => matches(doc, where))
    return { docs, totalDocs: docs.length }
  })
  const findByID = vi.fn(async ({
    collection,
    id,
  }: {
    collection: string
    id: string | number
  }) => {
    const doc = (collections[collection] ?? []).find(
      (entry) => String(entry.id) === String(id),
    )
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    return doc
  })
  const create = vi.fn(async ({
    collection,
    data,
  }: {
    collection: string
    data: Record<string, unknown>
  }) => {
    const doc = { id: nextId++, ...data }
    ;(collections[collection] ??= []).push(doc)
    return doc
  })
  const update = vi.fn(async ({
    collection,
    id,
    where,
    data,
  }: MockUpdateArgs & { where?: MockFindArgs["where"] }) => {
    if (where) {
      const docs = (collections[collection] ?? []).filter((doc) =>
        matches(doc, where),
      )
      for (const doc of docs) Object.assign(doc, data)
      return { docs, totalDocs: docs.length }
    }
    const doc = (collections[collection] ?? []).find(
      (entry) => String(entry.id) === String(id),
    )
    if (!doc) throw new Error(`Missing ${collection} ${id}`)
    Object.assign(doc, data)
    return doc
  })
  return {
    collections,
    payload: asPayload({
      find,
      findByID,
      create,
      update,
      jobs: { queue: vi.fn() },
    }),
  }
}

describe("assisted migration operator authorization", () => {
  it("rejects new customer-billable proposals and supplemental orders", async () => {
    const store = createStore()
    await expect(proposeMigrationOperatorWork(store.payload, {
      migrationId: 10,
      workScope: "verify_customer_zone_export",
      now: "2026-07-28T09:55:00.000Z",
    })).rejects.toThrow("retired")
    await expect(requestMigrationOperatorWork(store.payload, {
      migrationId: 10,
      requestedClassification: "assisted_standard",
      workCause: "customer_migration",
      workScope: "verify_customer_zone_export",
      supplementalAcceptance: {
        actorEmail: "client@example.com",
        acceptedAt: NOW,
        ipAddress: "192.0.2.1",
        userAgent: "test",
      },
      now: NOW,
    })).rejects.toThrow("retired")
    expect(store.collections.orders).toHaveLength(1)
  })

  it("authorizes incident recovery without billing and never creates an order", async () => {
    const store = createStore()
    const result = await requestMigrationOperatorWork(store.payload, {
      migrationId: 10,
      requestedClassification: "assisted_standard",
      workCause: "siteinabox_incident_recovery",
      workScope: "Restore records lost by Siteinabox automation.",
      now: NOW,
    })

    expect(result.supplementalOrder).toBeNull()
    expect(store.collections.orders).toHaveLength(1)
    expect(result.migration).toMatchObject({
      operatorWorkCause: "siteinabox_incident_recovery",
      operatorWorkAuthorizationState: "non_billable_incident_authorized",
    })
    expect(result.migration).not.toHaveProperty("operatorWorkAuthorizationOrder")
    await expect(startMigrationOperatorWork(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      now: NOW,
    })).resolves.toMatchObject({ operatorWorkStartedAt: NOW })
  })

  it("records operator failure with a bounded redacted code and does not resume automation", async () => {
    const store = createStore()
    await requestMigrationOperatorWork(store.payload, {
      migrationId: 10,
      requestedClassification: "assisted_standard",
      workCause: "siteinabox_incident_recovery",
      workScope: "Restore records lost by Siteinabox automation.",
      now: NOW,
    })
    await startMigrationOperatorWork(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      now: "2026-07-28T10:05:00.000Z",
    })

    const failed = await failMigrationOperatorWork(store.payload, {
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

  it("allows only one concurrent operator completion or failure transition", async () => {
    const store = createStore()
    await requestMigrationOperatorWork(store.payload, {
      migrationId: 10,
      requestedClassification: "assisted_standard",
      workCause: "siteinabox_incident_recovery",
      workScope: "Restore records lost by Siteinabox automation.",
      now: NOW,
    })
    await startMigrationOperatorWork(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      now: "2026-07-28T10:05:00.000Z",
    })

    const findByID = store.payload.findByID as unknown as ReturnType<typeof vi.fn>
    const originalFindByID = findByID.getMockImplementation() as (
      args: { collection: string; id: string | number },
    ) => Promise<MockDoc>
    let concurrentReads = 0
    let releaseReads: (() => void) | undefined
    const readsReady = new Promise<void>((resolve) => {
      releaseReads = resolve
    })
    findByID.mockImplementation(async (args: {
      collection: string
      id: string | number
    }) => {
      if (
        args.collection === "domain-migrations" &&
        concurrentReads < 2
      ) {
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
      completeMigrationOperatorWork(store.payload, {
        migrationId: 10,
        actor: OPERATOR,
        completionNotes: "Verified bounded repair.",
        now: "2026-07-28T10:20:00.000Z",
      }),
      failMigrationOperatorWork(store.payload, {
        migrationId: 10,
        actor: OPERATOR,
        failureCode: "zone_conflict",
        now: "2026-07-28T10:20:00.000Z",
      }),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(results.find((result) => result.status === "rejected"))
      .toMatchObject({
        reason: expect.objectContaining({
          message: expect.stringContaining("changed concurrently"),
        }),
      })
    expect(["preparing", "failed"]).toContain(
      store.collections["domain-migrations"]![0]!.state,
    )
  })

  it("queues rollback from active cutover without making a provider write in the action", async () => {
    const store = createStore()
    const migration = store.collections["domain-migrations"]![0]!
    Object.assign(migration, {
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

  it("rejects complex customer work instead of creating a custom quote", async () => {
    const store = createStore()
    await expect(requestMigrationOperatorWork(store.payload, {
      migrationId: 10,
      requestedClassification: "complex",
      workCause: "customer_migration",
      workScope: "Unsupported bespoke DNS topology.",
      now: NOW,
    })).rejects.toThrow("retired")
    expect(store.collections.orders).toHaveLength(1)
  })

  it("uses the paid originating order for an accepted assisted migration", async () => {
    const store = createStore("assisted_standard")
    const migration = store.collections["domain-migrations"]![0]!
    migration.state = "ready_to_prepare"

    const paused = await pauseAcceptedAssistedMigration(
      store.payload,
      migration as never,
      "Standard assisted migration.",
      NOW,
    )

    expect(paused).toMatchObject({
      state: "paused_supplemental_order",
      operatorWorkAuthorizationState: "paid_authorized",
      operatorWorkAuthorizationOrder: 20,
      operatorWorkAuthorizationPaymentAttempt: 50,
      operatorWorkAuthorizedAt: "2026-07-28T09:00:00.000Z",
    })
  })

  it("rechecks paid evidence immediately before operator work starts", async () => {
    const store = createStore("assisted_standard")
    const migration = store.collections["domain-migrations"]![0]!
    migration.state = "ready_to_prepare"
    await pauseAcceptedAssistedMigration(
      store.payload,
      migration as never,
      "Standard assisted migration.",
      NOW,
    )

    const order = store.collections.orders![0]!
    const attempt = store.collections["payment-attempts"]![0]!
    order.paymentStatus = "refunded"
    attempt.state = "refunded"

    await expect(startMigrationOperatorWork(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      now: "2026-07-28T10:05:00.000Z",
    })).rejects.toThrow("no longer valid")
    expect(migration).not.toHaveProperty("operatorWorkStartedAt")
  })
})
