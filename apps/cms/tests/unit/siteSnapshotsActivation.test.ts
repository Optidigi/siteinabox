import { hookCollection, hookRequest } from "../_helpers/hookFixtures"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PayloadRequest } from "payload"
import {
  activatePublishedSnapshot,
  canActivatePublishedSnapshot,
  prunePublishedSnapshotsForTenant,
  resolvePublishedSnapshotByHost,
} from "@/lib/publish/siteSnapshots"
import { PublishedSiteSnapshots } from "@/collections/PublishedSiteSnapshots"
import { amicarePublishedSiteSnapshot } from "@siteinabox/contracts/fixtures/tenants"

import { asGenerationRun, asMockDoc, asTenant, cast } from "../_helpers/cast"
import { hookArgsFor } from "../_helpers/hookFixtures"
import type { Config, Tenant, SiteGenerationRun } from "@/payload-types"
import type { CollectionSlug } from "payload"
import type { MockDoc } from "../_helpers/mockPayload"
import { createInitializedTestPayload, createTestRequest } from "../_helpers/testPayload"
import { payloadDeleteFixture } from "../_helpers/payloadDeleteFixture"
import { asDocRecord } from "../_helpers/payloadApi"
import { generationRunFixture, tenantFixture, managedDomainFixture, publishedSnapshotFixture, siteSettingsFixture, paginatedFixture } from "../_helpers/generatedDocs"
const approvedPaidRun = generationRunFixture({
  id: 500,
  clientApproval: { status: "approved" },
  payment: { status: "completed" },
})

const verifiedTenant = tenantFixture({
  id: 1,
  domain: "clientsite.nl",
  status: "provisioning",
  domainVerification: { status: "verified" },
  emailSending: {
    provider: "cloudflare",
    mode: "subdomain",
    status: "verified",
    sendingDomain: "mail.clientsite.nl",
    senderEmail: "noreply@mail.clientsite.nl",
  },
})

const pendingTenant: Tenant = {
  ...verifiedTenant,
  emailSending: {
    provider: "cloudflare",
    mode: "subdomain",
    status: "pending",
    sendingDomain: "mail.clientsite.nl",
    senderEmail: "noreply@mail.clientsite.nl",
    cloudflareZoneId: "zone-123",
    cloudflareSubdomainId: "subdomain-123",
  },
}

const snapshotId = (value: Tenant["activeSnapshot"]): number => {
  if (typeof value === "number") return value
  if (value && typeof value === "object") return value.id
  throw new Error("Missing active snapshot fixture")
}

const adoptedPreCommerceRouting = {
  state: "adopted" as const,
  adoptedDomain: "ami-care.nl",
  evidenceVersion: "pre-commerce-routing-v1",
  adoptedAt: "2026-07-30T09:59:23.000Z",
  revokedAt: null,
}

const createActivationPayload = async (input?: { tenant?: Partial<Tenant>; run?: Partial<SiteGenerationRun> }) => {
  const tenant = tenantFixture({ ...(input?.tenant ?? pendingTenant) })
  const run = generationRunFixture({ ...(input?.run ?? approvedPaidRun) })
  const snapshot = publishedSnapshotFixture({
    id: 10,
    tenant: tenant.id,
    domain: tenant.domain,
    sourceGenerationRun: run.id,
    status: "drafted",
  })
  const updates: MockDoc[] = []
  const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
      if (collection === "published-site-snapshots" && String(id) === String(snapshot.id)) return snapshot
      if (collection === "tenants" && String(id) === String(tenant.id)) return tenant
      if (collection === "site-generation-runs" && String(id) === String(run.id)) return run
      throw new Error(`Missing ${collection} ${id}`)
    })
  vi.spyOn(payload, "find").mockImplementation(async () => (paginatedFixture<Config["collections"][CollectionSlug]>([])))
  vi.spyOn(payload, "update").mockImplementation(async ({ collection, data }) => {
      updates.push({ collection, data })
      if (collection === "tenants") {
        Object.assign(tenant, data)
        return tenant
      }
      if (collection === "published-site-snapshots") {
        Object.assign(snapshot, data)
        return snapshot
      }
      throw new Error("Unexpected update collection " + collection)
    })
  vi.spyOn(payload.logger, "warn")
  vi.spyOn(payload.logger, "error")
  vi.spyOn(payload.logger, "info")
  return { payload: payload, tenant, snapshot, updates }
}

describe("published snapshot activation gate", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDFLARE_API_BASE_URL", "https://cloudflare.test/client/v4")
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-secret")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-123")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("treats pending tenant-branded email as optional for generated-site activation", () => {
    expect(canActivatePublishedSnapshot(asGenerationRun(approvedPaidRun), {
      tenant: asTenant({
        ...verifiedTenant,
        emailSending: {
          provider: "cloudflare",
          mode: "subdomain",
          status: "pending",
          sendingDomain: "mail.clientsite.nl",
          senderEmail: "noreply@mail.clientsite.nl",
        },
      }),
    })).toEqual({ ok: true })
  })

  it("treats failed tenant-branded email as optional for manual activation", () => {
    expect(canActivatePublishedSnapshot(asGenerationRun(approvedPaidRun), {
      manualActivation: true,
      tenant: asTenant({
        ...verifiedTenant,
        emailSending: {
          provider: "cloudflare",
          mode: "subdomain",
          status: "failed",
          sendingDomain: "mail.clientsite.nl",
          senderEmail: "noreply@mail.clientsite.nl",
        },
      }),
    })).toEqual({ ok: true })
  })

  it("allows generated-site activation after domain, sender, approval, and payment are all satisfied", () => {
    expect(canActivatePublishedSnapshot(asGenerationRun(approvedPaidRun), {
      tenant: asTenant(verifiedTenant),
    })).toEqual({ ok: true })
  })

  it("activates without synchronously refreshing optional tenant-branded email", async () => {
    const { payload, tenant, snapshot } = await createActivationPayload()
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      success: true,
      result: {
        enabled: true,
        name: "mail.clientsite.nl",
        tag: "subdomain-123",
        dkim_selector: "cf-bounce",
        return_path_domain: "cf-bounce.mail.clientsite.nl",
      },
    })))

    await expect(activatePublishedSnapshot(payload, { snapshotId: 10 })).resolves.toMatchObject({
      id: 10,
      status: "active",
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(tenant.emailSending).toMatchObject({
      status: "pending",
      sendingDomain: "mail.clientsite.nl",
      senderEmail: "noreply@mail.clientsite.nl",
      cloudflareZoneId: "zone-123",
      cloudflareSubdomainId: "subdomain-123",
    })
    expect(snapshot.status).toBe("active")
  })

  it("can defer live handoff until an owning transaction commits", async () => {
    const { payload, tenant, snapshot } = await createActivationPayload({
      tenant: verifiedTenant,
    })

    await expect(activatePublishedSnapshot(payload, {
      snapshotId: 10,
      deferLiveHandoff: true,
      req: await createTestRequest(payload, { transactionID: "publication-transaction" }),
    })).resolves.toMatchObject({
      id: 10,
      status: "active",
    })

    expect(tenant).toMatchObject({
      status: "active",
      activeSnapshot: 10,
    })
    expect(snapshot.status).toBe("active")
    expect(payload.find).toHaveBeenCalledTimes(2)
    const transactionRequestMatcher: unknown = expect.objectContaining({ transactionID: "publication-transaction" })
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "published-site-snapshots",
      req: transactionRequestMatcher,
    }))
    expect(payload.find).not.toHaveBeenCalledWith(expect.objectContaining({
      collection: "orders",
    }))
  })

  it("activates while optional tenant-branded email remains pending", async () => {
    const { payload, tenant, snapshot } = await createActivationPayload()
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      success: true,
      result: {
        enabled: false,
        name: "mail.clientsite.nl",
        tag: "subdomain-123",
        dkim_selector: "cf-bounce",
        return_path_domain: "cf-bounce.mail.clientsite.nl",
      },
    })))

    await expect(activatePublishedSnapshot(payload, { snapshotId: 10 }))
      .resolves.toMatchObject({ id: 10, status: "active" })

    expect(tenant.emailSending).toMatchObject({
      status: "pending",
      sendingDomain: "mail.clientsite.nl",
      cloudflareSubdomainId: "subdomain-123",
    })
    expect(snapshot.status).toBe("active")
  })

  it("does not contact optional email provider during snapshot activation", async () => {
    const { payload, tenant, snapshot } = await createActivationPayload()
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      success: false,
      errors: [{ code: 1000, message: "Provider rejected Bearer cf-secret api_token=cf-secret" }],
      result: null,
    }, { status: 200 })))

    await expect(activatePublishedSnapshot(payload, { snapshotId: 10 }))
      .resolves.toMatchObject({ id: 10, status: "active" })

    expect(fetch).not.toHaveBeenCalled()
    expect(asMockDoc(tenant.emailSending).status).toBe("pending")
    expect(snapshot.status).toBe("active")
  })

  it("keeps current-state manual activation without a generation run on the existing path", () => {
    expect(canActivatePublishedSnapshot(null, {
      manualActivation: true,
      tenant: {
        status: "active",
        domainVerification: { status: "verified" },
        emailSending: { status: "not_configured" },
      },
    })).toEqual({ ok: true })
  })

  it("allows content republish for an already-active tenant without re-checking domain verification", () => {
    expect(canActivatePublishedSnapshot(null, {
      manualActivation: true,
      tenant: {
        status: "active",
        domainVerification: { status: "not_checked" },
        emailSending: { status: "not_configured" },
      },
    })).toEqual({ ok: true })
  })

  it("still requires verified domain ownership for first go-live of a non-active tenant", () => {
    expect(canActivatePublishedSnapshot(null, {
      manualActivation: true,
      tenant: {
        status: "provisioning",
        domainVerification: { status: "not_checked" },
        emailSending: { status: "not_configured" },
      },
    })).toEqual({
      ok: false,
      reason: "Activation requires verified domain ownership.",
    })
  })

  it("lets internal lifecycle updates supersede unchanged legacy snapshots", () => {
    const legacySnapshot = {
      schemaVersion: 1,
      tenantId: "1",
      tenantSlug: "ami-care",
      theme: {
        mode: "light",
        radius: "1.5rem",
        density: "comfortable",
        borderStyle: "solid",
        stylePreset: "warm-care",
      },
    }
    const beforeValidate = PublishedSiteSnapshots.hooks?.beforeValidate?.[0]
    if (!beforeValidate) throw new Error("Missing published snapshot validation hook")

    const result: unknown = beforeValidate(hookArgsFor(beforeValidate, {
      operation: "update",
      data: {
        status: "superseded",
        snapshot: legacySnapshot,
      },
      originalDoc: publishedSnapshotFixture({
        status: "active",
        snapshot: legacySnapshot,
      }),
      context: { publishSnapshotLifecycleMutation: true },
      req: hookRequest({}),
      collection: hookCollection("published-site-snapshots"),
    }))

    expect(result).toEqual({
      status: "superseded",
      snapshot: legacySnapshot,
    })
  })

  it("normalizes legacy snapshot themes before validating new snapshots", () => {
    const beforeValidate = PublishedSiteSnapshots.hooks?.beforeValidate?.[0]
    if (!beforeValidate) throw new Error("Missing published snapshot validation hook")

    const result: unknown = beforeValidate(hookArgsFor(beforeValidate, {
      operation: "create",
      data: {
        snapshot: {
          ...amicarePublishedSiteSnapshot,
          theme: {
            mode: "light",
            radius: "1.5rem",
            density: "comfortable",
            borderStyle: "solid",
            stylePreset: "warm-care",
          },
        },
      },
      req: hookRequest({}),
      collection: hookCollection("published-site-snapshots"),
      context: {},
    }))

    if (!result || typeof result !== "object" || !("snapshot" in result)) throw new Error("Missing returned snapshot")
    const returnedSnapshot = result.snapshot
    if (!returnedSnapshot || typeof returnedSnapshot !== "object" || !("theme" in returnedSnapshot)) throw new Error("Missing returned snapshot theme")
    expect(returnedSnapshot.theme).toEqual({
      version: 3,
      appearance: { mode: "light", backgroundMode: "animation" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "clear-modern" },
      shape: { schemeId: "rounded" },
    })
  })

  it("still rejects changed invalid snapshots during lifecycle updates", () => {
    const legacySnapshot = {
      schemaVersion: 1,
      tenantId: "1",
      tenantSlug: "ami-care",
      theme: {
        mode: "light",
        radius: "1.5rem",
        density: "comfortable",
        borderStyle: "solid",
        stylePreset: "warm-care",
      },
    }
    const beforeValidate = PublishedSiteSnapshots.hooks?.beforeValidate?.[0]
    if (!beforeValidate) throw new Error("Missing published snapshot validation hook")

    expect(() => { beforeValidate(hookArgsFor(beforeValidate, {
      operation: "update",
      data: {
        status: "superseded",
        snapshot: {
          ...legacySnapshot,
          tenantSlug: "changed",
        },
      },
      originalDoc: publishedSnapshotFixture({
        status: "active",
        snapshot: legacySnapshot,
      }),
      context: { publishSnapshotLifecycleMutation: true },
      req: hookRequest({}),
      collection: hookCollection("published-site-snapshots"),
    })) }).toThrow("Published site snapshot failed contract validation")
  })

  it("prunes published snapshots to the latest ten while preserving the active snapshot", async () => {
    const docs = Array.from({ length: 12 }, (_, index) => {
      const id = 12 - index
      return publishedSnapshotFixture({
        id,
        version: id,
        tenant: 1,
        status: id === 3 ? "active" : "superseded",
      })
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async () => (paginatedFixture<Config["collections"][CollectionSlug]>(docs)))
  vi.spyOn(payload, "delete").mockImplementation(payloadDeleteFixture(async (args) => {
    const doc = docs.find(entry => String(entry.id) === String(args.id))
    if (!doc) throw new Error("Missing deleted snapshot")
    return doc
  }))

    await expect(prunePublishedSnapshotsForTenant(payload, 1)).resolves.toEqual({
      deleted: 2,
      kept: 10,
    })

    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "published-site-snapshots",
      where: { tenant: { equals: 1 } },
      sort: "-version",
      limit: 1000,
      overrideAccess: true,
    }))
    expect(vi.mocked(payload.delete).mock.calls.map(([call]) => asDocRecord(call).id)).toEqual([2, 1])
    expect(vi.mocked(payload.delete).mock.calls.map(([call]) => asDocRecord(call).id)).not.toContain(3)
  })
})

describe("published snapshot theme serving", () => {
  it("preserves a canonical V3 theme when resolving an active snapshot", async () => {
    const tenant = tenantFixture({
      id: 1,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 10,
      siteManifest: null,
    })
    const managedDomain = managedDomainFixture({
      id: 20,
      tenant: tenant.id,
      domainNameAscii: tenant.domain,
      state: "active",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants"
          ? [tenant]
          : collection === "managed-domains"
            ? [managedDomain]
            : [])))
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) return tenant
        if (collection === "published-site-snapshots" && String(id) === "10") {
          return publishedSnapshotFixture({ id: 10, status: "active", snapshot: amicarePublishedSiteSnapshot })
        }
        throw new Error(`Missing ${collection} ${id}`)
      })

    const result = await resolvePublishedSnapshotByHost(payload, tenant.domain)

    expect(result?.snapshot.theme).toEqual(amicarePublishedSiteSnapshot.theme)
  })

  it("does not infer www or accept an alias owned by another tenant", async () => {
    const victim = tenantFixture({
      id: 2,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: "victim.nl",
      status: "active",
      activeSnapshot: 22,
      siteManifest: null,
    })
    const snapshot = {
      ...amicarePublishedSiteSnapshot,
      domain: victim.domain,
    }
    const find = vi.fn(async ({ collection, where }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants" &&
        JSON.stringify(where).includes('"victim.nl"')
        ? [victim]
        : collection === "managed-domains"
          ? [managedDomainFixture({
              id: 23,
              tenant: victim.id,
              domainNameAscii: victim.domain,
              state: "active",
              authoritativeDnsStatus: "verified",
              httpsStatus: "verified",
              edgeRoutingStatus: "active",
              entitlementStatus: "active",
              customerStatus: "active",
            })]
          : collection === "site-settings"
            ? [siteSettingsFixture({
                id: 99,
                tenant: 1,
                aliases: [{ host: "www.victim.nl" }],
              })]
            : [])))
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(find)
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
        if (collection === "tenants" && String(id) === "1") {
          return tenantFixture({
            id: 1,
            slug: "attacker",
            domain: "attacker.nl",
            status: "active",
            activeSnapshot: 11,
            siteManifest: null,
          })
        }
        if (collection === "published-site-snapshots" && String(id) === "22") {
          return publishedSnapshotFixture({ id: 22, status: "active", snapshot })
        }
        throw new Error(`Missing ${collection} ${id}`)
      })

    const result = await resolvePublishedSnapshotByHost(
      payload,
      "www.victim.nl",
    )

    expect(result).toBeNull()
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "site-settings",
    }))
  })

  it("resolves an explicitly modeled www alias for the same tenant", async () => {
    const tenant = tenantFixture({
      id: 3,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: "explicit.nl",
      status: "active",
      activeSnapshot: 33,
      siteManifest: null,
    })
    const snapshot = {
      ...amicarePublishedSiteSnapshot,
      domain: tenant.domain,
      settings: {
        ...amicarePublishedSiteSnapshot.settings,
        aliases: [{ host: "www.explicit.nl" }],
      },
    }
    const settings = siteSettingsFixture({
      id: 100,
      tenant: tenant.id,
      aliases: [{ host: "www.explicit.nl" }],
    })
    const managedDomain = managedDomainFixture({
      id: 34,
      tenant: tenant.id,
      domainNameAscii: tenant.domain,
      state: "active",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants"
          ? []
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains" && where
              ? [managedDomain]
              : [])))
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) {
          return tenant
        }
        if (
          collection === "published-site-snapshots" &&
          String(id) === String(tenant.activeSnapshot)
        ) {
          return publishedSnapshotFixture({ id: snapshotId(tenant.activeSnapshot), status: "active", snapshot })
        }
        throw new Error(`Missing ${collection} ${id}`)
      })

    const result = await resolvePublishedSnapshotByHost(
      payload,
      "www.explicit.nl",
    )

    expect(result?.tenant.id).toBe(tenant.id)
    expect(result?.routing.activeHosts).toEqual([
      "explicit.nl",
      "www.explicit.nl",
    ])
  })

  it("keeps an audited verified pre-commerce tenant active until managed-domain adoption", async () => {
    const tenant = tenantFixture({
      id: 4,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 44,
      siteManifest: null,
      domainVerification: { status: "verified" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    })
    const settings = siteSettingsFixture({
      id: 101,
      tenant: tenant.id,
      aliases: [{ host: `www.${tenant.domain}` }],
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants"
          ? JSON.stringify(where).includes(`www.${tenant.domain}`)
            ? []
            : [tenant]
          : collection === "site-settings"
            ? [settings]
            : [])))
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
        if (
          collection === "tenants" &&
          String(id) === String(tenant.id)
        ) {
          return tenant
        }
        if (
          collection === "published-site-snapshots" &&
          String(id) === String(tenant.activeSnapshot)
        ) {
          return publishedSnapshotFixture({
            id: snapshotId(tenant.activeSnapshot),
            tenant: tenant.id,
            domain: tenant.domain,
            status: "active",
            snapshot: amicarePublishedSiteSnapshot,
          })
        }
        throw new Error(`Missing ${collection} ${id}`)
      })

    await expect(
      resolvePublishedSnapshotByHost(payload, tenant.domain),
    ).resolves.toMatchObject({
      tenant: { id: tenant.id },
      routing: {
        activeHosts: [tenant.domain, `www.${tenant.domain}`],
      },
    })
    await expect(
      resolvePublishedSnapshotByHost(
        payload,
        `www.${tenant.domain}`,
      ),
    ).resolves.toMatchObject({
      tenant: { id: tenant.id },
      routing: {
        requestedHost: `www.${tenant.domain}`,
        activeHosts: [tenant.domain, `www.${tenant.domain}`],
      },
    })
  })

  it("does not serve or advertise an ambiguous adopted www alias", async () => {
    const tenant = tenantFixture({
      id: 404,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 405,
      siteManifest: null,
      domainVerification: { status: "verified" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    })
    const settings = siteSettingsFixture({
      id: 406,
      tenant: tenant.id,
      aliases: [
        { host: `www.${tenant.domain}` },
        { host: `www.${tenant.domain}.` },
      ],
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants"
          ? JSON.stringify(where).includes(`www.${tenant.domain}`)
            ? []
            : [tenant]
          : collection === "site-settings"
            ? [settings]
            : [])))
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
        if (
          collection === "tenants" &&
          String(id) === String(tenant.id)
        ) {
          return tenant
        }
        if (
          collection === "published-site-snapshots" &&
          String(id) === String(tenant.activeSnapshot)
        ) {
          return publishedSnapshotFixture({
            id: snapshotId(tenant.activeSnapshot),
            tenant: tenant.id,
            domain: tenant.domain,
            status: "active",
            snapshot: amicarePublishedSiteSnapshot,
          })
        }
        throw new Error(`Missing ${collection} ${id}`)
      })

    await expect(
      resolvePublishedSnapshotByHost(payload, tenant.domain),
    ).resolves.toMatchObject({
      routing: { activeHosts: [tenant.domain] },
    })
    await expect(
      resolvePublishedSnapshotByHost(
        payload,
        `www.${tenant.domain}`,
      ),
    ).resolves.toBeNull()
  })

  it("blocks an unverified pre-commerce tenant without managed-domain evidence", async () => {
    const tenant = tenantFixture({
      id: 5,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 55,
      siteManifest: null,
      domainVerification: { status: "not_checked" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants" ? [tenant] : [])))

    await expect(
      resolvePublishedSnapshotByHost(payload, tenant.domain),
    ).resolves.toBeNull()
  })

  it("does not treat a newly verified tenant as a pre-commerce routing bypass", async () => {
    const tenant = tenantFixture({
      id: 6,
      slug: "new-tenant",
      domain: "new-tenant.nl",
      status: "active",
      activeSnapshot: 66,
      siteManifest: null,
      domainVerification: { status: "verified" },
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants" ? [tenant] : [])))

    await expect(
      resolvePublishedSnapshotByHost(payload, tenant.domain),
    ).resolves.toBeNull()
  })

  it("requires separate active lifecycle evidence for a non-www alias", async () => {
    const tenant = tenantFixture({
      id: 7,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 77,
      siteManifest: null,
      domainVerification: { status: "verified" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    })
    const alias = "shop.ami-care.nl"
    const settings = siteSettingsFixture({
      id: 102,
      tenant: tenant.id,
      aliases: [{ host: alias }],
    })
    const canonicalDomain = managedDomainFixture({
      id: 78,
      tenant: tenant.id,
      domainNameAscii: tenant.domain,
      state: "active",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants"
          ? []
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains" &&
                JSON.stringify(where).includes(`"${tenant.domain}"`)
              ? [canonicalDomain]
            : [])))
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) {
          return tenant
        }
        throw new Error(`Missing ${collection} ${id}`)
      })

    await expect(
      resolvePublishedSnapshotByHost(payload, alias),
    ).resolves.toBeNull()
  })

  it("accepts a non-www alias only with its own active managed-domain lifecycle", async () => {
    const tenant = tenantFixture({
      id: 8,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 88,
      siteManifest: null,
    })
    const alias = "shop.ami-care.nl"
    const snapshot = {
      ...amicarePublishedSiteSnapshot,
      settings: {
        ...amicarePublishedSiteSnapshot.settings,
        aliases: [{ host: alias }],
      },
    }
    const settings = siteSettingsFixture({
      id: 103,
      tenant: tenant.id,
      aliases: [{ host: alias }],
    })
    const aliasDomain = managedDomainFixture({
      id: 89,
      tenant: tenant.id,
      domainNameAscii: alias,
      state: "active",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    })
    const canonicalDomain = managedDomainFixture({
      ...aliasDomain,
      id: 90,
      domainNameAscii: tenant.domain,
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants"
          ? []
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains"
              ? JSON.stringify(where).includes(`"${tenant.domain}"`)
                ? [canonicalDomain]
                : JSON.stringify(where).includes(`"${alias}"`)
                  ? [aliasDomain]
                  : []
              : [])))
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) {
          return tenant
        }
        if (
          collection === "published-site-snapshots" &&
          String(id) === String(tenant.activeSnapshot)
        ) {
          return publishedSnapshotFixture({ id: snapshotId(tenant.activeSnapshot), status: "active", snapshot })
        }
        throw new Error(`Missing ${collection} ${id}`)
      })

    await expect(
      resolvePublishedSnapshotByHost(payload, alias),
    ).resolves.toMatchObject({ tenant: { id: tenant.id } })
  })

  it("does not let an active alias override an inactive canonical domain", async () => {
    const tenant = tenantFixture({
      id: 10,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 110,
      siteManifest: null,
      domainVerification: { status: "verified" },
    })
    const alias = "shop.ami-care.nl"
    const settings = siteSettingsFixture({
      id: 105,
      tenant: tenant.id,
      aliases: [{ host: alias }],
    })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants"
          ? []
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains" &&
                !JSON.stringify(where).includes('"state"')
              ? [managedDomainFixture({
                  id: 111,
                  tenant: tenant.id,
                  domainNameAscii: tenant.domain,
                  state: "provider_hold",
                })]
              : [])))
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) {
          return tenant
        }
        throw new Error(`Missing ${collection} ${id}`)
      })

    await expect(
      resolvePublishedSnapshotByHost(payload, alias),
    ).resolves.toBeNull()
  })

  it("lets any canonical managed-domain row suppress pre-commerce adoption", async () => {
    const tenant = tenantFixture({
      id: 9,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 99,
      siteManifest: null,
      domainVerification: { status: "verified" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    })
    const settings = siteSettingsFixture({ id: 104, tenant: tenant.id, aliases: [] })
    const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => (paginatedFixture<Config["collections"][CollectionSlug]>(collection === "tenants"
          ? [tenant]
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains" &&
                !JSON.stringify(where).includes('"state"')
              ? [managedDomainFixture({ id: 100, tenant: 999, domainNameAscii: tenant.domain })]
              : [])))

    await expect(
      resolvePublishedSnapshotByHost(payload, tenant.domain),
    ).resolves.toBeNull()
  })
})
