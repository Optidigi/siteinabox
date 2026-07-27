import { describe, expect, it, vi } from "vitest"

import {
  authorizeMigrationOperatorWorkFromPayment,
  completeMigrationOperatorWork,
  pauseAcceptedAssistedMigration,
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
  const update = vi.fn(async ({ collection, id, data }: MockUpdateArgs) => {
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
  it("creates an immutable supplemental order and blocks work until its exact payment", async () => {
    const store = createStore()
    const requested = await requestMigrationOperatorWork(store.payload, {
      migrationId: 10,
      requestedClassification: "assisted_standard",
      workCause: "customer_migration",
      workScope: "Import the complete provider export.",
      supplementalAcceptance: {
        actorEmail: "client@example.com",
        acceptedAt: NOW,
        ipAddress: "192.0.2.1",
        userAgent: "test",
      },
      now: NOW,
    })

    expect(requested.supplementalOrder).toMatchObject({
      orderKind: "migration_supplemental",
      parentOrder: 20,
      supplementalForMigration: 10,
      subtotalNetMinor: 4_900,
      vatAmountMinor: 1_029,
      totalGrossMinor: 5_929,
      state: "accepted",
      paymentStatus: "pending",
    })
    expect(requested.migration).toMatchObject({
      state: "paused_supplemental_order",
      operatorWorkAuthorizationState: "awaiting_payment",
    })
    await expect(startMigrationOperatorWork(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      now: NOW,
    })).rejects.toThrow("cannot start")

    Object.assign(requested.supplementalOrder!, {
      state: "fulfillment_pending",
      paymentStatus: "paid",
      paidAt: NOW,
    })
    const attempt = {
      id: 101,
      order: requested.supplementalOrder!.id,
      purpose: "supplemental",
      state: "paid",
      paidAt: NOW,
      netAmountMinor: 4_900,
      vatAmountMinor: 1_029,
      grossAmountMinor: 5_929,
    }
    store.collections["payment-attempts"]!.push(attempt)
    await authorizeMigrationOperatorWorkFromPayment(
      store.payload,
      requested.supplementalOrder as never,
      attempt as never,
      NOW,
    )
    await expect(startMigrationOperatorWork(store.payload, {
      migrationId: 10,
      actor: {
        id: 98,
        email: "customer@example.com",
        role: "owner",
      },
      now: "2026-07-28T10:04:00.000Z",
    })).rejects.toThrow("authenticated super-admin")
    await startMigrationOperatorWork(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      now: "2026-07-28T10:05:00.000Z",
    })
    const completed = await completeMigrationOperatorWork(store.payload, {
      migrationId: 10,
      actor: OPERATOR,
      completionNotes: "Provider export imported and validated.",
      now: "2026-07-28T10:20:00.000Z",
    })

    expect(completed).toMatchObject({
      state: "preparing",
      operatorWorkAuthorizationState: "paid_authorized",
      operatorWorkStartedByEmail: "operator@siteinabox.nl",
      operatorWorkCompletedByEmail: "operator@siteinabox.nl",
      automationResumedAt: "2026-07-28T10:20:00.000Z",
    })
    expect(requested.supplementalOrder).toMatchObject({ state: "fulfilled" })
    expect(store.payload.jobs.queue).toHaveBeenCalledWith({
      task: "prepare-domain-migration",
      input: { migrationId: "10" },
      queue: "default",
      overrideAccess: true,
    })
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

  it("stops complex work before payment and deletes the retained transfer code", async () => {
    const store = createStore()
    const result = await requestMigrationOperatorWork(store.payload, {
      migrationId: 10,
      requestedClassification: "complex",
      workCause: "customer_migration",
      workScope: "Unsupported bespoke DNS topology.",
      now: NOW,
    })

    expect(result.supplementalOrder).toBeNull()
    expect(result.migration).toMatchObject({
      state: "custom_quote_required",
      operatorWorkClassification: "complex",
      operatorWorkAuthorizationState: "custom_quote_required",
      encryptedTransferCode: null,
      transferCodeDeletedAt: NOW,
    })
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
