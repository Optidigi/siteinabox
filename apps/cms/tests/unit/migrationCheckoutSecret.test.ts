import { accessArgs } from "../_helpers/accessArgs"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MigrationCheckoutSecrets } from "@/collections/MigrationCheckoutSecrets"
import {
  attachMigrationCheckoutSecret,
  consumeMigrationCheckoutSecret,
  migrationCheckoutSecretKey,
  openAttachedMigrationCheckoutSecret,
  persistMigrationCheckoutSecret,
  replaceExpiredAttachedMigrationCheckoutSecret,
} from "@/lib/domains/migrationCheckoutSecret"
import { expireStaleMigrationCheckoutSecrets } from "@/lib/domains/migrationCheckoutSecretLifecycle"
import {
  openAutomaticSourceRefreshAuthority,
  sealAutomaticSourceRefreshAuthority,
  sealCheckoutMigrationInput,
} from "@/lib/domains/migrationSecrets"
import { domainMigrationSourceAuthorityHash } from "@/lib/domains/migrationEvidence"
import { normalizeCompleteZone } from "@siteinabox/contracts/domain-migration"
import type { MigrationCheckoutSecret } from "@/payload-types"
import { matchesWhere } from "../_helpers/mockPayload"
import { createTestPayload } from "../_helpers/testPayload"
import { migrationCheckoutSecretFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { payloadUpdateFixture } from "../_helpers/payloadUpdateFixture"

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
const zone = {
  schemaVersion: 1 as const,
  format: "siab-complete-zone-v1" as const,
  domain: "example.nl",
  acquiredAt: "2026-07-28T10:00:00.000Z",
  authority: {
    mechanism: "cloudflare_api" as const,
    provider: "cloudflare",
    complete: true as const,
  },
  authoritativeNameservers: ["ns1.example.test", "ns2.example.test"],
  dnssec: { status: "unsigned" as const, parentDsRecords: [] },
  records: [{ type: "MX" as const, name: "@", ttl: 300, priority: 10, target: "mail.example.nl" }],
}

const buildStore = () => {
  let record: MigrationCheckoutSecret | null = null
  const payload = createTestPayload()
  const find = vi.spyOn(payload, "find").mockImplementation(async () => paginatedFixture(record ? [record] : []))
  const create = vi.spyOn(payload, "create").mockImplementation(async args => {
    if (args.collection !== "migration-checkout-secrets") throw new Error(`Unexpected collection ${args.collection}`)
    const created = migrationCheckoutSecretFixture()
    Object.assign(created, args.data)
    record = created
    return created
  })
  const update = vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(async args => {
    if (args.collection !== "migration-checkout-secrets") throw new Error(`Unexpected collection ${args.collection}`)
    if (args.where && (!record || !matchesWhere({ ...record }, args.where))) return { docs: [], errors: [], totalDocs: 0 }
    if (!record) throw new Error("Missing secret")
    Object.assign(record, args.data)
    return args.where ? { docs: [record], errors: [], totalDocs: 1 } : record
  }))
  return { payload, find, create, update, read: () => record, replace: (next: MigrationCheckoutSecret) => { record = next } }
}
const cloudflareRefreshCredential = (token = "customer-cloudflare-token-value") => ({
  kind: "cloudflare_api_token" as const,
  token,
  zoneId: "a".repeat(32),
})

describe("migration checkout secret lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("DOMAIN_MIGRATION_ENCRYPTION_KEY", ENCRYPTION_KEY)
  })

  it("keeps ciphertext outside immutable order evidence and clears it after consumption", async () => {
    const store = buildStore()
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(zone),
    )
    const encryptedInput = sealCheckoutMigrationInput({
      schemaVersion: 2,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "cloudflare_api_v1",
      sourceZoneHash,
      sourceZone: zone,
      sourceRefreshCredential: cloudflareRefreshCredential(),
      transferCode: "secret-epp",
      transferAuthorizationAccepted: true,
    })
    const secretKey = migrationCheckoutSecretKey(500, "example.nl", sourceZoneHash)

    await persistMigrationCheckoutSecret(store.payload, {
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      encryptedInput,
      now: new Date("2026-07-28T10:00:00.000Z"),
    })
    await attachMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 90,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      now: new Date("2026-07-28T10:01:00.000Z"),
    })
    await expect(openAttachedMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 90,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      now: new Date("2026-07-28T10:02:00.000Z"),
    })).resolves.toMatchObject({ transferCode: "secret-epp", sourceZoneHash })

    await consumeMigrationCheckoutSecret(store.payload, { secretKey, orderId: 90 })
    expect(store.read()).toMatchObject({
      secretKey,
      order: 90,
      state: "consumed",
      encryptedInput: null,
    })
    expect(JSON.stringify({
      migration: { checkoutSecretKey: secretKey, sourceZoneHash },
    })).not.toContain("secret-epp")
  })

  it("limits automatic source credentials to the 24-hour source-evidence window", async () => {
    const store = buildStore()
    const automaticZone = zone
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(automaticZone),
    )
    const encryptedInput = sealCheckoutMigrationInput({
      schemaVersion: 2,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "cloudflare_api_v1",
      sourceZoneHash,
      sourceZone: automaticZone,
      sourceRefreshCredential: cloudflareRefreshCredential(),
      transferCode: "secret-epp",
      transferAuthorizationAccepted: true,
    })
    await persistMigrationCheckoutSecret(store.payload, {
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      encryptedInput,
      now: new Date("2026-07-29T10:00:00.000Z"),
    })

    expect(store.read()).toMatchObject({
      expiresAt: "2026-07-30T10:00:00.000Z",
    })
  })

  it("rejects cross-order access and expires ciphertext fail-closed", async () => {
    const store = buildStore()
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(zone),
    )
    const encryptedInput = sealCheckoutMigrationInput({
      schemaVersion: 2,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "cloudflare_api_v1",
      sourceZoneHash,
      sourceZone: zone,
      sourceRefreshCredential: cloudflareRefreshCredential(),
      transferCode: "secret-epp",
      transferAuthorizationAccepted: true,
    })
    const secretKey = migrationCheckoutSecretKey(500, "example.nl", sourceZoneHash)
    await persistMigrationCheckoutSecret(store.payload, {
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      encryptedInput,
      now: new Date("2026-07-01T00:00:00.000Z"),
    })
    await attachMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 90,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
    })
    await expect(openAttachedMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 91,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
    })).rejects.toThrow("not active")

    await expect(expireStaleMigrationCheckoutSecrets(
      store.payload,
      new Date("2026-08-01T00:00:00.000Z"),
    )).resolves.toBe(1)
    expect(store.read()).toMatchObject({ state: "expired", encryptedInput: null })

    await replaceExpiredAttachedMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 90,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      encryptedInput,
      now: new Date("2026-08-01T00:05:00.000Z"),
    })
    await expect(openAttachedMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 90,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      now: new Date("2026-08-01T00:06:00.000Z"),
    })).resolves.toMatchObject({
      transferCode: "secret-epp",
      sourceZoneHash,
    })
    await expect(replaceExpiredAttachedMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 91,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      encryptedInput,
    })).rejects.toThrow("accepted order")
  })

  it("denies every direct collection operation", () => {
    expect(MigrationCheckoutSecrets.access?.create?.(accessArgs({}))).toBe(false)
    expect(MigrationCheckoutSecrets.access?.read?.(accessArgs({}))).toBe(false)
    expect(MigrationCheckoutSecrets.access?.update?.(accessArgs({}))).toBe(false)
    expect(MigrationCheckoutSecrets.access?.delete?.(accessArgs({}))).toBe(false)
  })

  it("does not let a stale expiry claim overwrite a concurrently consumed secret", async () => {
    const store = buildStore()
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(zone),
    )
    const encryptedInput = sealCheckoutMigrationInput({
      schemaVersion: 2,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "cloudflare_api_v1",
      sourceZoneHash,
      sourceZone: zone,
      sourceRefreshCredential: cloudflareRefreshCredential(),
      transferCode: "secret-epp",
      transferAuthorizationAccepted: true,
    })
    const secretKey = migrationCheckoutSecretKey(500, "example.nl", sourceZoneHash)
    await persistMigrationCheckoutSecret(store.payload, {
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      encryptedInput,
      now: new Date("2026-07-01T00:00:00.000Z"),
    })
    await attachMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 90,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
      now: new Date("2026-07-01T00:01:00.000Z"),
    })
    const current = store.read()
    if (!current) throw new Error("Expected an attached secret.")
    const staleSnapshot = structuredClone(current)
    store.find.mockResolvedValueOnce(paginatedFixture([staleSnapshot]))
    store.replace({
      ...current,
      state: "consumed",
      encryptedInput: null,
      consumedAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    })

    await expect(expireStaleMigrationCheckoutSecrets(
      store.payload,
      new Date("2026-08-01T00:00:01.000Z"),
    )).resolves.toBe(0)
    expect(store.read()).toMatchObject({
      state: "consumed",
      encryptedInput: null,
    })
  })

  it("coalesces a create race for equivalent randomly encrypted input", async () => {
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(zone),
    )
    const input = {
      schemaVersion: 2 as const,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic" as const,
      sourceMechanism: "cloudflare_api_v1" as const,
      sourceZoneHash,
      sourceZone: zone,
      sourceRefreshCredential: cloudflareRefreshCredential(),
      transferCode: "same-secret-epp",
      transferAuthorizationAccepted: true as const,
    }
    const envelopeA = sealCheckoutMigrationInput(input)
    const envelopeB = sealCheckoutMigrationInput(input)
    expect(envelopeA).not.toBe(envelopeB)

    let record: MigrationCheckoutSecret | null = null
    const payload = createTestPayload()
    let findCalls = 0
    const find = vi.spyOn(payload, "find").mockImplementation(async () => {
      findCalls += 1
      if (findCalls <= 2) return paginatedFixture([])
      return paginatedFixture(record ? [record] : [])
    })
    const create = vi.spyOn(payload, "create").mockImplementation(async ({ collection, data }) => {
      if (collection !== "migration-checkout-secrets") throw new Error(`Unexpected collection ${collection}`)
      if (record) throw new Error("duplicate key value violates unique constraint")
      const created = migrationCheckoutSecretFixture()
      Object.assign(created, data)
      record = created
      return created
    })
    const persist = (encryptedInput: string) =>
      persistMigrationCheckoutSecret(payload, {
        generationRunId: 500,
        domain: "example.nl",
        sourceZoneHash,
        encryptedInput,
        now: new Date("2026-07-28T10:00:00.000Z"),
      })

    const [first, second] = await Promise.all([
      persist(envelopeA),
      persist(envelopeB),
    ])
    expect(first.secretKey).toBe(second.secretKey)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it("does not coalesce concurrent automatic inputs with different refresh credentials", async () => {
    const automaticZone = zone
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(automaticZone),
    )
    const envelope = (token: string) => sealCheckoutMigrationInput({
      schemaVersion: 2,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "cloudflare_api_v1",
      sourceZoneHash,
      sourceZone: automaticZone,
      sourceRefreshCredential: cloudflareRefreshCredential(token),
      transferCode: "same-secret-epp",
      transferAuthorizationAccepted: true,
    })
    let record: MigrationCheckoutSecret | null = null
    const payload = createTestPayload()
    let findCalls = 0
    const find = vi.spyOn(payload, "find").mockImplementation(async () => {
      findCalls += 1
      if (findCalls <= 2) return paginatedFixture([])
      return paginatedFixture(record ? [record] : [])
    })
    const create = vi.spyOn(payload, "create").mockImplementation(async ({ collection, data }) => {
      if (collection !== "migration-checkout-secrets") throw new Error(`Unexpected collection ${collection}`)
      if (record) throw new Error("duplicate key value violates unique constraint")
      const created = migrationCheckoutSecretFixture()
      Object.assign(created, data)
      record = created
      return created
    })
    const persist = (encryptedInput: string) =>
      persistMigrationCheckoutSecret(payload, {
        generationRunId: 500,
        domain: "example.nl",
        sourceZoneHash,
        encryptedInput,
        now: new Date("2026-07-28T10:00:00.000Z"),
      })

    const results = await Promise.allSettled([
      persist(envelope("first-customer-cloudflare-token")),
      persist(envelope("second-customer-cloudflare-token")),
    ])
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
  })
})

describe("durable automatic source refresh authority", () => {
  it.each([
    {
      sourceMechanism: "cloudflare_api_v1" as const,
      credential: {
        kind: "cloudflare_api_token" as const,
        token: "scoped-cloudflare-token-value",
        zoneId: "a".repeat(32),
      },
    },
    {
      sourceMechanism: "authorized_axfr_v1" as const,
      credential: {
        kind: "authorized_axfr" as const,
        nameserver: "ns1.example.test",
        tsigName: "siab-key",
        tsigSecret: "dGVzdC1zZWNyZXQtdmFsdWU=",
      },
    },
  ])("round-trips a bounded $sourceMechanism credential", (variant) => {
    const authority = {
      schemaVersion: 1 as const,
      domain: "example.nl",
      sourceMechanism: variant.sourceMechanism,
      acceptedSourceAuthorityHash: "a".repeat(64),
      acceptedSourceContentHash: "b".repeat(64),
      credential: variant.credential,
    }
    const envelope = sealAutomaticSourceRefreshAuthority(
      authority,
      "domain-migration:order:90:v1",
    )

    expect(envelope).not.toContain(JSON.stringify(variant.credential))
    expect(openAutomaticSourceRefreshAuthority(
      envelope,
      "domain-migration:order:90:v1",
      "example.nl",
    )).toEqual(authority)
    expect(() => openAutomaticSourceRefreshAuthority(
      envelope,
      "domain-migration:order:91:v1",
      "example.nl",
    )).toThrow()
  })

})
