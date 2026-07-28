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
import { sealCheckoutMigrationInput } from "@/lib/domains/migrationSecrets"
import { domainMigrationSourceAuthorityHash } from "@/lib/domains/migrationEvidence"
import { normalizeCompleteZone } from "@siteinabox/contracts/domain-migration"
import { asPayload } from "../_helpers/mockPayload"

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
const zone = {
  schemaVersion: 1 as const,
  format: "siab-complete-zone-v1" as const,
  domain: "example.nl",
  acquiredAt: "2026-07-28T10:00:00.000Z",
  authority: {
    mechanism: "customer_authorized_provider_export" as const,
    provider: "fixture",
    complete: true as const,
  },
  authoritativeNameservers: ["ns1.example.test", "ns2.example.test"],
  dnssec: { status: "unsigned" as const, parentDsRecords: [] },
  records: [{ type: "MX" as const, name: "@", ttl: 300, priority: 10, target: "mail.example.nl" }],
}

const buildStore = () => {
  let record: Record<string, unknown> | null = null
  const find = vi.fn(async () => ({
    docs: record ? [record] : [],
    totalDocs: record ? 1 : 0,
  }))
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    record = { id: 1, ...data }
    return record
  })
  const conditionMatches = (
    current: Record<string, unknown>,
    condition: Record<string, unknown>,
  ): boolean =>
    Object.entries(condition).every(([field, value]) => {
      if (field === "and" && Array.isArray(value)) {
        return value.every((clause) =>
          conditionMatches(current, clause as Record<string, unknown>),
        )
      }
      if (!value || typeof value !== "object") return true
      const operators = value as {
        equals?: unknown
        less_than_equal?: unknown
        in?: unknown[]
      }
      if (
        operators.equals !== undefined &&
        String(current[field]) !== String(operators.equals)
      ) return false
      if (
        operators.less_than_equal !== undefined &&
        String(current[field]) > String(operators.less_than_equal)
      ) return false
      if (
        operators.in &&
        !operators.in.some((entry) => String(entry) === String(current[field]))
      ) return false
      return true
    })
  const update = vi.fn(async ({
    data,
    where,
  }: {
    data: Record<string, unknown>
    where?: Record<string, unknown>
  }) => {
    if (where) {
      if (!record || !conditionMatches(record, where)) {
        return { docs: [], totalDocs: 0 }
      }
      record = { ...record, ...data }
      return { docs: [record], totalDocs: 1 }
    }
    record = { ...record, ...data }
    return record
  })
  return {
    payload: asPayload({ find, create, update }),
    find,
    create,
    update,
    read: () => record,
    replace: (next: Record<string, unknown>) => {
      record = next
    },
  }
}

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
      schemaVersion: 1,
      generationRunId: "500",
      domain: "example.nl",
      classification: "assisted_standard",
      sourceMechanism: "customer_authorized_provider_export_v1",
      sourceZoneHash,
      sourceZone: zone,
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
    })
    await expect(openAttachedMigrationCheckoutSecret(store.payload, {
      secretKey,
      orderId: 90,
      generationRunId: 500,
      domain: "example.nl",
      sourceZoneHash,
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

  it("rejects cross-order access and expires ciphertext fail-closed", async () => {
    const store = buildStore()
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(zone),
    )
    const encryptedInput = sealCheckoutMigrationInput({
      schemaVersion: 1,
      generationRunId: "500",
      domain: "example.nl",
      classification: "assisted_standard",
      sourceMechanism: "customer_authorized_provider_export_v1",
      sourceZoneHash,
      sourceZone: zone,
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
    expect(MigrationCheckoutSecrets.access?.create?.({} as never)).toBe(false)
    expect(MigrationCheckoutSecrets.access?.read?.({} as never)).toBe(false)
    expect(MigrationCheckoutSecrets.access?.update?.({} as never)).toBe(false)
    expect(MigrationCheckoutSecrets.access?.delete?.({} as never)).toBe(false)
  })

  it("does not let a stale expiry claim overwrite a concurrently consumed secret", async () => {
    const store = buildStore()
    const sourceZoneHash = domainMigrationSourceAuthorityHash(
      normalizeCompleteZone(zone),
    )
    const encryptedInput = sealCheckoutMigrationInput({
      schemaVersion: 1,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic",
      sourceMechanism: "customer_authorized_provider_export_v1",
      sourceZoneHash,
      sourceZone: zone,
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
    store.find.mockResolvedValueOnce({
      docs: [staleSnapshot],
      totalDocs: 1,
    })
    store.replace({
      ...store.read(),
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
      schemaVersion: 1 as const,
      generationRunId: "500",
      domain: "example.nl",
      classification: "automatic" as const,
      sourceMechanism: "customer_authorized_provider_export_v1" as const,
      sourceZoneHash,
      sourceZone: zone,
      transferCode: "same-secret-epp",
      transferAuthorizationAccepted: true as const,
    }
    const envelopeA = sealCheckoutMigrationInput(input)
    const envelopeB = sealCheckoutMigrationInput(input)
    expect(envelopeA).not.toBe(envelopeB)

    let record: Record<string, unknown> | null = null
    let findCalls = 0
    const find = vi.fn(async () => {
      findCalls += 1
      if (findCalls <= 2) return { docs: [], totalDocs: 0 }
      return { docs: record ? [record] : [], totalDocs: record ? 1 : 0 }
    })
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (record) throw new Error("duplicate key value violates unique constraint")
      record = { id: 1, ...data }
      return record
    })
    const payload = asPayload({ find, create })
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
})
