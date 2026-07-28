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
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    record = { ...record, ...data }
    return record
  })
  return {
    payload: asPayload({ find, create, update }),
    find,
    create,
    update,
    read: () => record,
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
})
