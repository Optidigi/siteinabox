import { payloadDeleteFixture } from "../_helpers/payloadDeleteFixture"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  cloudflareOAuthCookieName,
  completeCloudflareSourceAuthorization,
  createCloudflareSourceAuthorization,
  expireCloudflareSourceAuthorizations,
  attachCloudflareSourceAuthorization,
  loadCloudflareSourceAuthorization,
  resolveCloudflareOAuthCredential,
  revokeCloudflareOAuthCredential,
} from "@/lib/domains/cloudflareSourceOAuth"
import type { MigrationSourceAuthorization } from "@/payload-types"
import { createTestPayload } from "../_helpers/testPayload"
import { migrationSourceAuthorizationFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { asDocRecord } from "../_helpers/payloadApi"
import { payloadUpdateFixture, type PayloadUpdateOptions } from "../_helpers/payloadUpdateFixture"

const ENCRYPTION_KEY = Buffer.alloc(32, 17).toString("base64")
const ENV = { NODE_ENV: "test",
  DOMAIN_MIGRATION_ENCRYPTION_KEY: ENCRYPTION_KEY,
  COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_OAUTH_ENABLED: "1",
  CLOUDFLARE_SOURCE_OAUTH_CLIENT_ID: "oauth-client-id",
  CLOUDFLARE_SOURCE_OAUTH_CLIENT_SECRET: "oauth-client-secret",
  CLOUDFLARE_SOURCE_OAUTH_REDIRECT_URI:
    "https://admin.siteinabox.nl/api/domain-migration-source/cloudflare/callback",
} satisfies NodeJS.ProcessEnv
const NOW = new Date("2026-07-30T08:00:00.000Z")


const zone = {
  schemaVersion: 1 as const,
  format: "siab-complete-zone-v1" as const,
  domain: "example.nl",
  acquiredAt: NOW.toISOString(),
  authority: {
    mechanism: "cloudflare_api" as const,
    provider: "cloudflare",
    complete: true as const,
  },
  authoritativeNameservers: [
    "ada.ns.cloudflare.com",
    "bob.ns.cloudflare.com",
  ],
  dnssec: {
    status: "unsigned" as const,
    parentDsRecords: [],
  },
  records: [{
    type: "MX" as const,
    name: "example.nl",
    ttl: 3_600,
    priority: 10,
    target: "mail.example.net",
    proxied: false,
  }],
}

const createStore = () => {
  const records: MigrationSourceAuthorization[] = []
  let nextId = 1
  const payload = createTestPayload()
  const create = vi.spyOn(payload, "create").mockImplementation(async args => {
    if (args.collection !== "migration-source-authorizations") throw new Error(`Unexpected collection ${args.collection}`)
    const record = Object.assign(migrationSourceAuthorizationFixture({ id: nextId++ }), args.data)
    records.push(record)
    return record
  })
  vi.spyOn(payload, "find").mockImplementation(async ({ where }) => {
    const serialized = JSON.stringify(where)
    const expiry = asDocRecord(where?.and?.find(entry => entry.expiresAt)?.expiresAt ?? {}).less_than_equal
    const docs = serialized.includes("expiresAt")
      ? records.filter(record => ["pending", "authorized", "attached", "refreshing", "revocation_pending"].includes(record.state) && String(record.expiresAt) <= String(expiry))
      : records.filter(record => (serialized.includes("stateDigest") && serialized.includes(record.stateDigest)) || (serialized.includes("authorizationKey") && serialized.includes(record.authorizationKey)))
    return paginatedFixture(docs)
  })
  const update = vi.fn(async (args: PayloadUpdateOptions) => {
    if (args.collection !== "migration-source-authorizations") throw new Error(`Unexpected collection ${args.collection}`)
    const serialized = JSON.stringify(args.where)
    const record = args.where ? records.find(candidate => serialized.includes(String(candidate.id)) && serialized.includes(candidate.state) && serialized.includes(candidate.updatedAt)) : records.find(candidate => String(candidate.id) === String(args.id))
    if (!record) {
      if (args.where) return { docs: [], errors: [], totalDocs: 0 }
      throw new Error(`Missing authorization ${args.id}`)
    }
    Object.assign(record, args.data)
    return args.where ? { docs: [record], errors: [], totalDocs: 1 } : record
  })
  vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(update))
  vi.spyOn(payload, "delete").mockImplementation(payloadDeleteFixture(async args => {
    if (args.where) throw new Error("Unexpected bulk authorization delete")
    const id = args.id
    const index = records.findIndex(record => String(record.id) === String(id))
    const record = index >= 0 ? records.splice(index, 1)[0] : undefined
    if (!record) throw new Error(`Missing authorization ${id}`)
    return record
  }))
  return { payload, records, update, create }
}

const tokenFetch = vi.fn(async () => new Response(JSON.stringify({
  access_token: "access-token-" + "a".repeat(40),
  refresh_token: "refresh-token-" + "b".repeat(40),
  expires_in: 3_600,
  token_type: "Bearer",
  scope: "zone.read dns.read offline_access",
}), {
  status: 200,
  headers: { "content-type": "application/json" },
}))

const start = async (store: ReturnType<typeof createStore>) =>
  createCloudflareSourceAuthorization(store.payload, {
    generationRunId: 50,
    tenantId: 10,
    clientSlug: "example",
    customerEmail: "customer@example.com",
    domain: "example.nl",
    env: ENV,
    now: NOW,
  })

const authorize = async (store: ReturnType<typeof createStore>) => {
  const started = await start(store)
  const state = new URL(started.authorizationUrl).searchParams.get("state")!
  const completed = await completeCloudflareSourceAuthorization(
    store.payload,
    {
      state,
      code: "one-time-code",
      browserBinding: started.browserBinding,
      context: {
        generationRunId: 50,
        tenantId: 10,
        clientSlug: "example",
        customerEmail: "customer@example.com",
      },
      env: ENV,
      now: NOW,
    },
    {
      fetchImpl: tokenFetch as typeof fetch,
      inspectPublicEvidence: vi.fn(async () => ({
        checkedAt: NOW.toISOString(),
        authoritativeNameservers: zone.authoritativeNameservers,
        dnssecDsPresent: false,
        dnssecDsRecords: [],
        dnssecDsTtl: null,
        probableDnsProvider: "cloudflare",
        registrar: "Example Registrar",
        supplementalOnly: true as const,
      })),
      acquireSource: vi.fn(async () => ({
        mechanism: "cloudflare_api_v1" as const,
        zone,
        refreshCredential: {
          kind: "cloudflare_api_token" as const,
          token: "temporary-access-token",
          zoneId: "a".repeat(32),
        },
      })),
    },
  )
  const loaded = await loadCloudflareSourceAuthorization(store.payload, {
    authorizationKey: completed.authorizationKey,
    generationRunId: 50,
    tenantId: 10,
    clientSlug: "example",
    customerEmail: "customer@example.com",
    domain: "example.nl",
    env: ENV,
    now: new Date("2026-07-30T08:01:00.000Z"),
  })
  await attachCloudflareSourceAuthorization(
    store.payload,
    loaded.record,
    new Date("2026-07-30T08:02:00.000Z"),
  )
  return loaded.source.refreshCredential as Extract<
    typeof loaded.source.refreshCredential,
    { kind: "cloudflare_oauth" }
  >
}

describe("Cloudflare delegated source OAuth", () => {
  beforeEach(() => {
    tokenFetch.mockClear()
  })

  it("creates a least-privilege PKCE authorization without exposing secrets", async () => {
    const store = createStore()
    const result = await start(store)
    const url = new URL(result.authorizationUrl)

    expect(url.origin + url.pathname).toBe(
      "https://dash.cloudflare.com/oauth2/auth",
    )
    expect(url.searchParams.get("scope")).toBe(
      "zone.read dns.read offline_access",
    )
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(result.authorizationUrl).not.toContain("oauth-client-secret")
    expect(result.authorizationUrl).not.toContain("customer@example.com")
    expect(result.authorizationUrl).not.toContain("example.nl")
    expect(store.records[0]).toMatchObject({
      state: "pending",
      customerEmailDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      domainNameAscii: "example.nl",
    })
    expect(JSON.stringify(store.records[0])).not.toContain(
      url.searchParams.get("state"),
    )
    expect(JSON.stringify(store.records[0])).not.toContain(result.browserBinding)
  })

  it("binds callback, complete source, handle consumption, and refresh rotation", async () => {
    const store = createStore()
    const started = await start(store)
    const state = new URL(started.authorizationUrl).searchParams.get("state")!
    const acquired = vi.fn(async () => ({
      mechanism: "cloudflare_api_v1" as const,
      zone,
      refreshCredential: {
        kind: "cloudflare_api_token" as const,
        token: "temporary-access-token",
        zoneId: "a".repeat(32),
      },
    }))
    const completed = await completeCloudflareSourceAuthorization(
      store.payload,
      {
        state,
        code: "one-time-code",
        browserBinding: started.browserBinding,
        context: {
          generationRunId: 50,
          tenantId: 10,
          clientSlug: "example",
          customerEmail: "customer@example.com",
        },
        env: ENV,
        now: NOW,
      },
      {
        fetchImpl: tokenFetch as typeof fetch,
        inspectPublicEvidence: vi.fn(async () => ({
          checkedAt: NOW.toISOString(),
          authoritativeNameservers: zone.authoritativeNameservers,
          dnssecDsPresent: false,
          dnssecDsRecords: [],
          dnssecDsTtl: null,
          probableDnsProvider: "cloudflare",
          registrar: "Example Registrar",
          supplementalOnly: true as const,
        })),
        acquireSource: acquired,
      },
    )

    expect(completed).toMatchObject({
      clientSlug: "example",
      domain: "example.nl",
    })
    expect(tokenFetch).toHaveBeenCalledWith(
      "https://dash.cloudflare.com/oauth2/token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    )
    expect(acquired).toHaveBeenCalledWith(expect.objectContaining({
      token: "access-token-" + "a".repeat(40),
    }))
    expect(JSON.stringify(store.records[0])).not.toContain("access-token-")
    expect(JSON.stringify(store.records[0])).not.toContain("refresh-token-")

    const authorized = await loadCloudflareSourceAuthorization(store.payload, {
      authorizationKey: completed.authorizationKey,
      generationRunId: 50,
      tenantId: 10,
      clientSlug: "example",
      customerEmail: "customer@example.com",
      domain: "example.nl",
      env: ENV,
      now: new Date("2026-07-30T08:01:00.000Z"),
    })
    expect(authorized.source.refreshCredential).toMatchObject({
      kind: "cloudflare_oauth",
      authorizationKey: completed.authorizationKey,
      zoneId: "a".repeat(32),
    })
    await expect(loadCloudflareSourceAuthorization(store.payload, {
      authorizationKey: completed.authorizationKey,
      generationRunId: 51,
      tenantId: 10,
      clientSlug: "example",
      customerEmail: "customer@example.com",
      domain: "example.nl",
      env: ENV,
      now: NOW,
    })).rejects.toThrow("unavailable")

    await attachCloudflareSourceAuthorization(
      store.payload,
      authorized.record,
      new Date("2026-07-30T08:02:00.000Z"),
    )
    expect(store.records[0]).toMatchObject({
      state: "attached",
      encryptedAuthority: expect.stringMatching(/^v1\./),
    })
    await expect(attachCloudflareSourceAuthorization(
      store.payload,
      authorized.record,
      new Date("2026-07-30T08:03:00.000Z"),
    )).resolves.toBeUndefined()

    tokenFetch.mockClear()
    const refreshed = await resolveCloudflareOAuthCredential(
      store.payload,
      authorized.source.refreshCredential as Extract<
        typeof authorized.source.refreshCredential,
        { kind: "cloudflare_oauth" }
      >,
      {
      env: ENV,
      now: new Date("2026-07-30T09:00:00.000Z"),
      fetchImpl: tokenFetch as typeof fetch,
    })
    expect(refreshed).toMatchObject({
      accessToken: "access-token-" + "a".repeat(40),
      refreshToken: "refresh-token-" + "b".repeat(40),
    })
  })

  it("allows only one concurrent refresh owner", async () => {
    const store = createStore()
    const reference = await authorize(store)
    tokenFetch.mockClear()

    const results = await Promise.allSettled([
      resolveCloudflareOAuthCredential(store.payload, reference, {
        env: ENV,
        now: new Date("2026-07-30T09:00:00.000Z"),
        fetchImpl: tokenFetch as typeof fetch,
      }),
      resolveCloudflareOAuthCredential(store.payload, reference, {
        env: ENV,
        now: new Date("2026-07-30T09:00:00.000Z"),
        fetchImpl: tokenFetch as typeof fetch,
      }),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(tokenFetch).toHaveBeenCalledTimes(1)
    expect(store.records[0]).toMatchObject({
      state: "attached",
      encryptedAuthority: expect.stringMatching(/^v1\./),
    })
  })

  it("allows only one worker to reclaim a stale refresh lease", async () => {
    const store = createStore()
    const reference = await authorize(store)
    await expect(resolveCloudflareOAuthCredential(
      store.payload,
      reference,
      {
        env: ENV,
        now: new Date("2026-07-30T09:00:00.000Z"),
        fetchImpl: vi.fn(async () => {
          throw new Error("worker stopped after claiming")
        }) as typeof fetch,
      },
    )).rejects.toMatchObject({
      name: "MigrationSourceRefreshRetryableError",
    })
    expect(store.records[0]?.state).toBe("refreshing")

    const update = store.update
    const originalUpdate = update.getMockImplementation()
    if (!originalUpdate) throw new Error("Expected store update implementation")
    let staleLeaseClaims = 0
    update.mockImplementation(async (args: PayloadUpdateOptions) => {
      if (
        asDocRecord(args.data).updatedAt === "2026-07-30T09:02:00.000Z" &&
        Object.keys(args.data).length === 1
      ) {
        staleLeaseClaims += 1
        if (staleLeaseClaims > 1) return { docs: [], errors: [], totalDocs: 0 }
      }
      return originalUpdate(args)
    })
    const provider = vi.fn(async () => new Response(JSON.stringify({
      access_token: "reclaimed-access-" + "a".repeat(40),
      refresh_token: "reclaimed-refresh-" + "b".repeat(40),
      expires_in: 3_600,
      token_type: "Bearer",
      scope: "zone.read dns.read offline_access",
    }), { status: 200 }))

    const results = await Promise.allSettled([
      resolveCloudflareOAuthCredential(store.payload, reference, {
        env: ENV,
        now: new Date("2026-07-30T09:02:00.000Z"),
        fetchImpl: provider as typeof fetch,
      }),
      resolveCloudflareOAuthCredential(store.payload, reference, {
        env: ENV,
        now: new Date("2026-07-30T09:02:00.000Z"),
        fetchImpl: provider as typeof fetch,
      }),
    ])

    expect(results.filter((result) => result.status === "fulfilled"))
      .toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected"))
      .toHaveLength(1)
    expect(provider).toHaveBeenCalledTimes(1)
    expect(store.records[0]).toMatchObject({
      state: "attached",
      encryptedAuthority: expect.stringMatching(/^v1\./),
    })
  })

  it("quarantines a rotated refresh grant with reduced scopes", async () => {
    const store = createStore()
    const reference = await authorize(store)
    const insufficient = vi.fn(async () => new Response(JSON.stringify({
      access_token: "reduced-access-" + "a".repeat(40),
      refresh_token: "reduced-refresh-" + "b".repeat(40),
      expires_in: 3_600,
      token_type: "Bearer",
      scope: "zone.read offline_access",
    }), { status: 200 }))

    await expect(resolveCloudflareOAuthCredential(
      store.payload,
      reference,
      {
        env: ENV,
        now: new Date("2026-07-30T09:00:00.000Z"),
        fetchImpl: insufficient as typeof fetch,
      },
    )).rejects.toMatchObject({
      name: "MigrationSourceAuthorizationError",
    })
    expect(store.records[0]).toMatchObject({
      state: "revocation_pending",
      encryptedAuthority: expect.stringMatching(/^v1\./),
      expiresAt: "2026-07-30T09:00:00.000Z",
    })
  })

  it("retains reduced-scope authority when quarantine loses its CAS", async () => {
    const store = createStore()
    const reference = await authorize(store)
    const update = store.update
    const originalUpdate = update.getMockImplementation()
    if (!originalUpdate) throw new Error("Expected store update implementation")
    let loseQuarantine = true
    update.mockImplementation(async (args: PayloadUpdateOptions) => {
      if (
        loseQuarantine &&
        asDocRecord(args.data).state === "revocation_pending"
      ) {
        loseQuarantine = false
        return { docs: [], errors: [], totalDocs: 0 }
      }
      return originalUpdate(args)
    })
    const insufficient = vi.fn(async () => new Response(JSON.stringify({
      access_token: "reduced-access-" + "a".repeat(40),
      refresh_token: "reduced-refresh-" + "b".repeat(40),
      expires_in: 3_600,
      token_type: "Bearer",
      scope: "zone.read offline_access",
    }), { status: 200 }))

    await expect(resolveCloudflareOAuthCredential(
      store.payload,
      reference,
      {
        env: ENV,
        now: new Date("2026-07-30T09:00:00.000Z"),
        fetchImpl: insufficient as typeof fetch,
      },
    )).rejects.toThrow("changed concurrently")
    expect(store.records).toHaveLength(2)
    expect(store.records[1]).toMatchObject({
      state: "revocation_pending",
      encryptedAuthority: expect.stringMatching(/^v1\./),
      expiresAt: "2026-07-30T09:00:00.000Z",
    })
    expect(JSON.stringify(store.records)).not.toContain("reduced-refresh-")
  })

  it("revokes a rotated grant when neither authoritative nor detached persistence succeeds", async () => {
    const store = createStore()
    const reference = await authorize(store)
    const update = store.update
    const originalUpdate = update.getMockImplementation()
    if (!originalUpdate) throw new Error("Expected store update implementation")
    let persistenceFailures = 3
    update.mockImplementation(async (args: PayloadUpdateOptions) => {
      if (
        persistenceFailures > 0 &&
        asDocRecord(args.data).state === "attached" &&
        typeof asDocRecord(args.data).encryptedAuthority === "string"
      ) {
        persistenceFailures -= 1
        return { docs: [], errors: [], totalDocs: 0 }
      }
      return originalUpdate(args)
    })
    const create = store.create
    create.mockRejectedValueOnce(new Error("detached persistence unavailable"))
    const provider = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "rotated-access-" + "a".repeat(40),
        refresh_token: "rotated-refresh-" + "b".repeat(40),
        expires_in: 3_600,
        token_type: "Bearer",
        scope: "zone.read dns.read offline_access",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    await expect(resolveCloudflareOAuthCredential(
      store.payload,
      reference,
      {
        env: ENV,
        now: new Date("2026-07-30T09:00:00.000Z"),
        fetchImpl: provider as typeof fetch,
      },
    )).rejects.toMatchObject({
      name: "MigrationSourceAuthorizationError",
    })
    expect(provider).toHaveBeenCalledTimes(2)
    expect(provider.mock.calls[1]?.[0]).toBe(
      "https://dash.cloudflare.com/oauth2/revoke",
    )
    expect(String(provider.mock.calls[1]?.[1]?.body)).toContain(
      "token=rotated-refresh-",
    )
    expect(store.records).toHaveLength(1)
  })

  it("rejects callback replay, browser mismatch, and insufficient scopes", async () => {
    const store = createStore()
    const started = await start(store)
    const state = new URL(started.authorizationUrl).searchParams.get("state")!
    const input = {
      state,
      code: "one-time-code",
      browserBinding: started.browserBinding,
      context: {
        generationRunId: 50,
        tenantId: 10,
        clientSlug: "example",
        customerEmail: "customer@example.com",
      },
      env: ENV,
      now: NOW,
    }
    await expect(completeCloudflareSourceAuthorization(
      store.payload,
      { ...input, browserBinding: "wrong-browser" },
      { fetchImpl: tokenFetch as typeof fetch },
    )).rejects.toThrow("invalid or expired")
    expect(tokenFetch).not.toHaveBeenCalled()

    const insufficient = vi.fn(async () => new Response(JSON.stringify({
      access_token: "access-token-" + "a".repeat(40),
      refresh_token: "refresh-token-" + "b".repeat(40),
      expires_in: 3_600,
      token_type: "Bearer",
      scope: "zone.read offline_access",
    }), { status: 200 }))
    await expect(completeCloudflareSourceAuthorization(
      store.payload,
      input,
      { fetchImpl: insufficient as typeof fetch },
    )).rejects.toThrow("incomplete authority")
    expect(store.records[0]).toMatchObject({
      state: "revocation_pending",
      encryptedAuthority: expect.stringMatching(/^v1\./),
    })
  })

  it("durably retains an issued grant when source capture fails", async () => {
    const store = createStore()
    const started = await start(store)
    const state = new URL(started.authorizationUrl).searchParams.get("state")!

    await expect(completeCloudflareSourceAuthorization(
      store.payload,
      {
        state,
        code: "one-time-code",
        browserBinding: started.browserBinding,
        context: {
          generationRunId: 50,
          tenantId: 10,
          clientSlug: "example",
          customerEmail: "customer@example.com",
        },
        env: ENV,
        now: NOW,
      },
      {
        fetchImpl: tokenFetch as typeof fetch,
        inspectPublicEvidence: vi.fn(async () => ({
          checkedAt: NOW.toISOString(),
          authoritativeNameservers: zone.authoritativeNameservers,
          dnssecDsPresent: false,
          dnssecDsRecords: [],
          dnssecDsTtl: null,
          probableDnsProvider: "cloudflare",
          registrar: "Example Registrar",
          supplementalOnly: true as const,
        })),
        acquireSource: vi.fn(async () => {
          throw new Error("source capture failed")
        }),
      },
    )).rejects.toThrow("source capture failed")
    expect(store.records[0]).toMatchObject({
      state: "revocation_pending",
      encryptedAuthority: expect.stringMatching(/^v1\./),
    })
    expect(JSON.stringify(store.records[0])).not.toContain("refresh-token-")

    const revokeFetch = vi.fn(async () => new Response(null, { status: 200 }))
    await expect(expireCloudflareSourceAuthorizations(store.payload, {
      env: ENV,
      now: new Date("2026-07-30T08:11:00.000Z"),
      fetchImpl: revokeFetch as typeof fetch,
    })).resolves.toMatchObject({ revoked: 1, failed: 0 })
    expect(store.records[0]).toMatchObject({
      state: "revoked",
      encryptedAuthority: null,
    })
  })

  it("retries an unknown first database outcome before source capture", async () => {
    const store = createStore()
    const update = vi.mocked(store.payload.update)
    update.mockImplementationOnce(async () => {
      throw new Error("database outcome unknown")
    })
    const started = await start(store)
    const state = new URL(started.authorizationUrl).searchParams.get("state")!

    await expect(completeCloudflareSourceAuthorization(
      store.payload,
      {
        state,
        code: "one-time-code",
        browserBinding: started.browserBinding,
        context: {
          generationRunId: 50,
          tenantId: 10,
          clientSlug: "example",
          customerEmail: "customer@example.com",
        },
        env: ENV,
        now: NOW,
      },
      {
        fetchImpl: tokenFetch as typeof fetch,
        inspectPublicEvidence: vi.fn(async () => ({
          checkedAt: NOW.toISOString(),
          authoritativeNameservers: zone.authoritativeNameservers,
          dnssecDsPresent: false,
          dnssecDsRecords: [],
          dnssecDsTtl: null,
          probableDnsProvider: "cloudflare",
          registrar: "Example Registrar",
          supplementalOnly: true as const,
        })),
        acquireSource: vi.fn(async () => ({
          mechanism: "cloudflare_api_v1" as const,
          zone,
          refreshCredential: {
            kind: "cloudflare_api_token" as const,
            token: "temporary-access-token",
            zoneId: "a".repeat(32),
          },
        })),
      },
    )).resolves.toMatchObject({ domain: "example.nl" })
    expect(store.records[0]).toMatchObject({
      state: "authorized",
      encryptedAuthority: expect.stringMatching(/^v1\./),
    })
  })

  it("retries a zero-row first claim before source capture", async () => {
    const store = createStore()
    const update = store.update
    update.mockResolvedValueOnce({
      docs: [],
      totalDocs: 0,
      errors: [],
    })
    const started = await start(store)
    const state = new URL(started.authorizationUrl).searchParams.get("state")!

    await expect(completeCloudflareSourceAuthorization(
      store.payload,
      {
        state,
        code: "one-time-code",
        browserBinding: started.browserBinding,
        context: {
          generationRunId: 50,
          tenantId: 10,
          clientSlug: "example",
          customerEmail: "customer@example.com",
        },
        env: ENV,
        now: NOW,
      },
      {
        fetchImpl: tokenFetch as typeof fetch,
        inspectPublicEvidence: vi.fn(async () => ({
          checkedAt: NOW.toISOString(),
          authoritativeNameservers: zone.authoritativeNameservers,
          dnssecDsPresent: false,
          dnssecDsRecords: [],
          dnssecDsTtl: null,
          probableDnsProvider: "cloudflare",
          registrar: "Example Registrar",
          supplementalOnly: true as const,
        })),
        acquireSource: vi.fn(async () => ({
          mechanism: "cloudflare_api_v1" as const,
          zone,
          refreshCredential: {
            kind: "cloudflare_api_token" as const,
            token: "temporary-access-token",
            zoneId: "a".repeat(32),
          },
        })),
      },
    )).resolves.toMatchObject({ domain: "example.nl" })
    expect(store.records[0]).toMatchObject({ state: "authorized" })
  })

  it("revokes refresh authority without placing it in the request URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }))
    const credential = {
      accessToken: "access-token-" + "a".repeat(40),
      refreshToken: "refresh-token-" + "b".repeat(40),
      accessTokenExpiresAt: "2026-07-30T09:00:00.000Z",
      scopes: ["zone.read", "dns.read", "offline_access"],
      zoneId: "a".repeat(32),
    }

    await revokeCloudflareOAuthCredential(credential, {
      env: ENV,
      fetchImpl: fetchImpl as typeof fetch,
    })

    const [url, request] = fetchImpl.mock.calls[0]!
    expect(url).toBe("https://dash.cloudflare.com/oauth2/revoke")
    expect(String(url)).not.toContain(credential.refreshToken)
    expect(String(request?.body)).toContain("token=refresh-token-")
    expect(String(request?.body)).toContain("token_type_hint=refresh_token")
  })

  it("reclaims a revocation CAS race before reporting durable cleanup", async () => {
    const store = createStore()
    const reference = await authorize(store)
    const record = store.records[0]!
    const update = store.update
    update.mockImplementationOnce(async () => {
      record.updatedAt = "2026-07-30T08:59:59.000Z"
      return {
        docs: [],
        totalDocs: 0,
        errors: [],
      }
    })
    const revokeFetch = vi.fn(async () => new Response(null, { status: 200 }))

    const { revokeCloudflareSourceAuthorization } = await import(
      "@/lib/domains/cloudflareSourceOAuth"
    )
    await expect(revokeCloudflareSourceAuthorization(
      store.payload,
      reference,
      {
        env: ENV,
        now: new Date("2026-07-30T09:00:00.000Z"),
        fetchImpl: revokeFetch as typeof fetch,
      },
    )).resolves.toBe(true)
    expect(revokeFetch).toHaveBeenCalledTimes(1)
    expect(record).toMatchObject({
      state: "revoked",
      encryptedAuthority: null,
    })
  })

  it("expires abandoned PKCE state and revokes abandoned delegated authority", async () => {
    const pendingStore = createStore()
    await start(pendingStore)
    const pendingResult = await expireCloudflareSourceAuthorizations(
      pendingStore.payload,
      {
        env: ENV,
        now: new Date("2026-07-30T08:11:00.000Z"),
      },
    )
    expect(pendingResult).toEqual({
      examined: 1,
      expired: 1,
      revoked: 0,
      deleted: 0,
      failed: 0,
    })
    expect(pendingStore.records[0]).toMatchObject({
      state: "expired",
      encryptedAuthority: null,
    })

    const authorizedStore = createStore()
    const started = await start(authorizedStore)
    const state = new URL(started.authorizationUrl).searchParams.get("state")!
    await completeCloudflareSourceAuthorization(
      authorizedStore.payload,
      {
        state,
        code: "one-time-code",
        browserBinding: started.browserBinding,
        context: {
          generationRunId: 50,
          tenantId: 10,
          clientSlug: "example",
          customerEmail: "customer@example.com",
        },
        env: ENV,
        now: NOW,
      },
      {
        fetchImpl: tokenFetch as typeof fetch,
        inspectPublicEvidence: vi.fn(async () => ({
          checkedAt: NOW.toISOString(),
          authoritativeNameservers: zone.authoritativeNameservers,
          dnssecDsPresent: false,
          dnssecDsRecords: [],
          dnssecDsTtl: null,
          probableDnsProvider: "cloudflare",
          registrar: "Example Registrar",
          supplementalOnly: true as const,
        })),
        acquireSource: vi.fn(async () => ({
          mechanism: "cloudflare_api_v1" as const,
          zone,
          refreshCredential: {
            kind: "cloudflare_api_token" as const,
            token: "temporary-access-token",
            zoneId: "a".repeat(32),
          },
        })),
      },
    )
    tokenFetch.mockClear()
    const authorizedResult = await expireCloudflareSourceAuthorizations(
      authorizedStore.payload,
      {
        env: ENV,
        now: new Date("2026-07-31T08:01:00.000Z"),
        fetchImpl: tokenFetch as typeof fetch,
      },
    )
    expect(authorizedResult).toEqual({
      examined: 1,
      expired: 0,
      revoked: 1,
      deleted: 0,
      failed: 0,
    })
    expect(tokenFetch).toHaveBeenCalledWith(
      "https://dash.cloudflare.com/oauth2/revoke",
      expect.anything(),
    )
    expect(authorizedStore.records[0]).toMatchObject({
      state: "revoked",
      encryptedAuthority: null,
    })
  })

  it("keeps failed revocation due and clears it on the next reconciliation", async () => {
    const store = createStore()
    await authorize(store)
    const failedRevoke = vi.fn(async () =>
      new Response(null, { status: 503 }))

    await expect(expireCloudflareSourceAuthorizations(store.payload, {
      env: ENV,
      now: new Date("2026-09-04T08:00:00.000Z"),
      fetchImpl: failedRevoke as typeof fetch,
    })).resolves.toMatchObject({ failed: 1, revoked: 0 })
    expect(store.records[0]).toMatchObject({
      state: "revocation_pending",
      encryptedAuthority: expect.stringMatching(/^v1\./),
      expiresAt: "2026-09-04T08:00:00.000Z",
    })

    const successfulRevoke = vi.fn(async () =>
      new Response(null, { status: 200 }))
    await expect(expireCloudflareSourceAuthorizations(store.payload, {
      env: ENV,
      now: new Date("2026-09-04T08:01:00.000Z"),
      fetchImpl: successfulRevoke as typeof fetch,
    })).resolves.toMatchObject({ failed: 0, revoked: 1 })
    expect(store.records[0]).toMatchObject({
      state: "revoked",
      encryptedAuthority: null,
    })
  })

  it("derives a bounded correlation-cookie name without credential data", () => {
    expect(cloudflareOAuthCookieName("a".repeat(43))).toBe(
      `siab_cf_source_${"a".repeat(12)}`,
    )
  })
})
