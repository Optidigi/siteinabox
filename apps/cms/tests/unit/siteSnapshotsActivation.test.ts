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
import { asPayload, type MockDoc, type MockFindArgs, type MockFindByIdArgs, type MockUpdateArgs } from "../_helpers/mockPayload"
const approvedPaidRun = {
  id: 500,
  clientApproval: { status: "approved" },
  payment: { status: "completed" },
}

const verifiedTenant = {
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
}

const pendingTenant = {
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

const adoptedPreCommerceRouting = {
  state: "adopted" as const,
  adoptedDomain: "ami-care.nl",
  evidenceVersion: "pre-commerce-routing-v1",
  adoptedAt: "2026-07-30T09:59:23.000Z",
  revokedAt: null,
}

const createActivationPayload = (input?: { tenant?: MockDoc; run?: MockDoc }) => {
  const tenant: MockDoc = { ...(input?.tenant ?? pendingTenant) }
  const run: MockDoc = { ...(input?.run ?? approvedPaidRun) }
  const snapshot: MockDoc = {
    id: 10,
    tenant: tenant.id,
    domain: tenant.domain,
    sourceGenerationRun: run.id,
    status: "drafted",
  }
  const updates: MockDoc[] = []
  const payload = {
    findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
      if (collection === "published-site-snapshots" && String(id) === String(snapshot.id)) return snapshot
      if (collection === "tenants" && String(id) === String(tenant.id)) return tenant
      if (collection === "site-generation-runs" && String(id) === String(run.id)) return run
      throw new Error(`Missing ${collection} ${id}`)
    }),
    find: vi.fn(async () => ({ docs: [] })),
    update: vi.fn(async ({ collection, data }: MockUpdateArgs) => {
      updates.push({ collection, data })
      if (collection === "tenants") {
        Object.assign(tenant, data)
        return tenant
      }
      if (collection === "published-site-snapshots") {
        Object.assign(snapshot, data)
        return snapshot
      }
      return { ...data }
    }),
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { payload: asPayload(payload), tenant, snapshot, updates }
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
    const { payload, tenant, snapshot } = createActivationPayload()
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
    const { payload, tenant, snapshot } = createActivationPayload({
      tenant: verifiedTenant,
    })

    await expect(activatePublishedSnapshot(payload, {
      snapshotId: 10,
      deferLiveHandoff: true,
      req: { transactionID: "publication-transaction" } as PayloadRequest,
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
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "published-site-snapshots",
      req: expect.objectContaining({
        transactionID: "publication-transaction",
      }),
    }))
    expect(payload.find).not.toHaveBeenCalledWith(expect.objectContaining({
      collection: "orders",
    }))
  })

  it("activates while optional tenant-branded email remains pending", async () => {
    const { payload, tenant, snapshot } = createActivationPayload()
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
    const { payload, tenant, snapshot } = createActivationPayload()
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

    const result = beforeValidate(hookArgsFor(beforeValidate, {
      operation: "update",
      data: {
        status: "superseded",
        snapshot: legacySnapshot,
      },
      originalDoc: {
        status: "active",
        snapshot: legacySnapshot,
      },
      context: { publishSnapshotLifecycleMutation: true },
      req: {},
      collection: {},
    }))

    expect(result).toEqual({
      status: "superseded",
      snapshot: legacySnapshot,
    })
  })

  it("normalizes legacy snapshot themes before validating new snapshots", () => {
    const beforeValidate = PublishedSiteSnapshots.hooks?.beforeValidate?.[0]
    if (!beforeValidate) throw new Error("Missing published snapshot validation hook")

    const result = beforeValidate(hookArgsFor(beforeValidate, {
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
      req: {},
      collection: {},
      context: {},
    }))

    expect(result.snapshot.theme).toEqual({
      version: 3,
      appearance: { mode: "light" },
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

    expect(() => beforeValidate(hookArgsFor(beforeValidate, {
      operation: "update",
      data: {
        status: "superseded",
        snapshot: {
          ...legacySnapshot,
          tenantSlug: "changed",
        },
      },
      originalDoc: {
        status: "active",
        snapshot: legacySnapshot,
      },
      context: { publishSnapshotLifecycleMutation: true },
      req: {},
      collection: {},
    }))).toThrow("Published site snapshot failed contract validation")
  })

  it("prunes published snapshots to the latest ten while preserving the active snapshot", async () => {
    const docs = Array.from({ length: 12 }, (_, index) => {
      const id = 12 - index
      return {
        id,
        version: id,
        tenant: 1,
        status: id === 3 ? "active" : "superseded",
      }
    })
    const payload = {
      find: vi.fn(async () => ({ docs })),
      delete: vi.fn(async (args: MockFindByIdArgs) => ({ id: args.id })),
    }

    await expect(prunePublishedSnapshotsForTenant(asPayload(payload), 1)).resolves.toEqual({
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
    expect(payload.delete.mock.calls.map(([call]: [MockFindByIdArgs]) => call.id)).toEqual([2, 1])
    expect(payload.delete.mock.calls.map(([call]: [MockFindByIdArgs]) => call.id)).not.toContain(3)
  })
})

describe("published snapshot theme serving", () => {
  it("preserves a canonical V3 theme when resolving an active snapshot", async () => {
    const tenant = {
      id: 1,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 10,
      siteManifest: null,
    }
    const managedDomain = {
      id: 20,
      tenant: tenant.id,
      domainNameAscii: tenant.domain,
      state: "active",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    }
    const payload = {
      find: vi.fn(async ({ collection }: MockFindArgs) => ({
        docs: collection === "tenants"
          ? [tenant]
          : collection === "managed-domains"
            ? [managedDomain]
            : [],
      })),
      findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) return tenant
        if (collection === "published-site-snapshots" && String(id) === "10") {
          return { id: 10, status: "active", snapshot: amicarePublishedSiteSnapshot }
        }
        throw new Error(`Missing ${collection} ${id}`)
      }),
    }

    const result = await resolvePublishedSnapshotByHost(asPayload(payload), tenant.domain)

    expect(result?.snapshot.theme).toEqual(amicarePublishedSiteSnapshot.theme)
  })

  it("does not infer www or accept an alias owned by another tenant", async () => {
    const victim = {
      id: 2,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: "victim.nl",
      status: "active",
      activeSnapshot: 22,
      siteManifest: null,
    }
    const snapshot = {
      ...amicarePublishedSiteSnapshot,
      domain: victim.domain,
    }
    const find = vi.fn(async ({ collection, where }: MockFindArgs) => ({
      docs: collection === "tenants" &&
        JSON.stringify(where).includes('"victim.nl"')
        ? [victim]
        : collection === "managed-domains"
          ? [{
              id: 23,
              tenant: victim.id,
              domainNameAscii: victim.domain,
              state: "active",
              authoritativeDnsStatus: "verified",
              httpsStatus: "verified",
              edgeRoutingStatus: "active",
              entitlementStatus: "active",
              customerStatus: "active",
            }]
          : collection === "site-settings"
            ? [{
                id: 99,
                tenant: 1,
                aliases: [{ host: "www.victim.nl" }],
              }]
            : [],
    }))
    const payload = {
      find,
      findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
        if (collection === "tenants" && String(id) === "1") {
          return {
            id: 1,
            slug: "attacker",
            domain: "attacker.nl",
            status: "active",
            activeSnapshot: 11,
            siteManifest: null,
          }
        }
        if (collection === "published-site-snapshots" && String(id) === "22") {
          return { id: 22, status: "active", snapshot }
        }
        throw new Error(`Missing ${collection} ${id}`)
      }),
    }

    const result = await resolvePublishedSnapshotByHost(
      asPayload(payload),
      "www.victim.nl",
    )

    expect(result).toBeNull()
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "site-settings",
    }))
  })

  it("resolves an explicitly modeled www alias for the same tenant", async () => {
    const tenant = {
      id: 3,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: "explicit.nl",
      status: "active",
      activeSnapshot: 33,
      siteManifest: null,
    }
    const snapshot = {
      ...amicarePublishedSiteSnapshot,
      domain: tenant.domain,
      settings: {
        ...amicarePublishedSiteSnapshot.settings,
        aliases: [{ host: "www.explicit.nl" }],
      },
    }
    const settings = {
      id: 100,
      tenant: tenant.id,
      aliases: [{ host: "www.explicit.nl" }],
    }
    const managedDomain = {
      id: 34,
      tenant: tenant.id,
      domainNameAscii: tenant.domain,
      state: "active",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    }
    const payload = {
      find: vi.fn(async ({ collection, where }: MockFindArgs) => ({
        docs: collection === "tenants"
          ? []
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains" && where
              ? [managedDomain]
              : [],
      })),
      findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) {
          return tenant
        }
        if (
          collection === "published-site-snapshots" &&
          String(id) === String(tenant.activeSnapshot)
        ) {
          return { id: tenant.activeSnapshot, status: "active", snapshot }
        }
        throw new Error(`Missing ${collection} ${id}`)
      }),
    }

    const result = await resolvePublishedSnapshotByHost(
      asPayload(payload),
      "www.explicit.nl",
    )

    expect(result?.tenant.id).toBe(tenant.id)
    expect(result?.routing.activeHosts).toEqual([
      "explicit.nl",
      "www.explicit.nl",
    ])
  })

  it("keeps an audited verified pre-commerce tenant active until managed-domain adoption", async () => {
    const tenant = {
      id: 4,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 44,
      siteManifest: null,
      domainVerification: { status: "verified" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    }
    const settings = {
      id: 101,
      tenant: tenant.id,
      aliases: [{ host: `www.${tenant.domain}` }],
    }
    const payload = {
      find: vi.fn(async ({ collection, where }: MockFindArgs) => ({
        docs: collection === "tenants"
          ? JSON.stringify(where).includes(`www.${tenant.domain}`)
            ? []
            : [tenant]
          : collection === "site-settings"
            ? [settings]
            : [],
      })),
      findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
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
          return {
            id: tenant.activeSnapshot,
            tenant: tenant.id,
            domain: tenant.domain,
            status: "active",
            snapshot: amicarePublishedSiteSnapshot,
          }
        }
        throw new Error(`Missing ${collection} ${id}`)
      }),
    }

    await expect(
      resolvePublishedSnapshotByHost(asPayload(payload), tenant.domain),
    ).resolves.toMatchObject({
      tenant: { id: tenant.id },
      routing: {
        activeHosts: [tenant.domain, `www.${tenant.domain}`],
      },
    })
    await expect(
      resolvePublishedSnapshotByHost(
        asPayload(payload),
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
    const tenant = {
      id: 404,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 405,
      siteManifest: null,
      domainVerification: { status: "verified" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    }
    const settings = {
      id: 406,
      tenant: tenant.id,
      aliases: [
        { host: `www.${tenant.domain}` },
        { host: `www.${tenant.domain}.` },
      ],
    }
    const payload = {
      find: vi.fn(async ({ collection, where }: MockFindArgs) => ({
        docs: collection === "tenants"
          ? JSON.stringify(where).includes(`www.${tenant.domain}`)
            ? []
            : [tenant]
          : collection === "site-settings"
            ? [settings]
            : [],
      })),
      findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
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
          return {
            id: tenant.activeSnapshot,
            tenant: tenant.id,
            domain: tenant.domain,
            status: "active",
            snapshot: amicarePublishedSiteSnapshot,
          }
        }
        throw new Error(`Missing ${collection} ${id}`)
      }),
    }

    await expect(
      resolvePublishedSnapshotByHost(asPayload(payload), tenant.domain),
    ).resolves.toMatchObject({
      routing: { activeHosts: [tenant.domain] },
    })
    await expect(
      resolvePublishedSnapshotByHost(
        asPayload(payload),
        `www.${tenant.domain}`,
      ),
    ).resolves.toBeNull()
  })

  it("blocks an unverified pre-commerce tenant without managed-domain evidence", async () => {
    const tenant = {
      id: 5,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 55,
      siteManifest: null,
      domainVerification: { status: "pending" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    }
    const payload = {
      find: vi.fn(async ({ collection }: MockFindArgs) => ({
        docs: collection === "tenants" ? [tenant] : [],
      })),
    }

    await expect(
      resolvePublishedSnapshotByHost(asPayload(payload), tenant.domain),
    ).resolves.toBeNull()
  })

  it("does not treat a newly verified tenant as a pre-commerce routing bypass", async () => {
    const tenant = {
      id: 6,
      slug: "new-tenant",
      domain: "new-tenant.nl",
      status: "active",
      activeSnapshot: 66,
      siteManifest: null,
      domainVerification: { status: "verified" },
    }
    const payload = {
      find: vi.fn(async ({ collection }: MockFindArgs) => ({
        docs: collection === "tenants" ? [tenant] : [],
      })),
    }

    await expect(
      resolvePublishedSnapshotByHost(asPayload(payload), tenant.domain),
    ).resolves.toBeNull()
  })

  it("requires separate active lifecycle evidence for a non-www alias", async () => {
    const tenant = {
      id: 7,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 77,
      siteManifest: null,
      domainVerification: { status: "verified" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    }
    const alias = "shop.ami-care.nl"
    const settings = {
      id: 102,
      tenant: tenant.id,
      aliases: [{ host: alias }],
    }
    const canonicalDomain = {
      id: 78,
      tenant: tenant.id,
      domainNameAscii: tenant.domain,
      state: "active",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    }
    const payload = {
      find: vi.fn(async ({ collection, where }: MockFindArgs) => ({
        docs: collection === "tenants"
          ? []
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains" &&
                JSON.stringify(where).includes(`"${tenant.domain}"`)
              ? [canonicalDomain]
            : [],
      })),
      findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) {
          return tenant
        }
        throw new Error(`Missing ${collection} ${id}`)
      }),
    }

    await expect(
      resolvePublishedSnapshotByHost(asPayload(payload), alias),
    ).resolves.toBeNull()
  })

  it("accepts a non-www alias only with its own active managed-domain lifecycle", async () => {
    const tenant = {
      id: 8,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 88,
      siteManifest: null,
    }
    const alias = "shop.ami-care.nl"
    const snapshot = {
      ...amicarePublishedSiteSnapshot,
      settings: {
        ...amicarePublishedSiteSnapshot.settings,
        aliases: [{ host: alias }],
      },
    }
    const settings = {
      id: 103,
      tenant: tenant.id,
      aliases: [{ host: alias }],
    }
    const aliasDomain = {
      id: 89,
      tenant: tenant.id,
      domainNameAscii: alias,
      state: "active",
      authoritativeDnsStatus: "verified",
      httpsStatus: "verified",
      edgeRoutingStatus: "active",
      entitlementStatus: "active",
      customerStatus: "active",
    }
    const canonicalDomain = {
      ...aliasDomain,
      id: 90,
      domainNameAscii: tenant.domain,
    }
    const payload = {
      find: vi.fn(async ({ collection, where }: MockFindArgs) => ({
        docs: collection === "tenants"
          ? []
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains"
              ? JSON.stringify(where).includes(`"${tenant.domain}"`)
                ? [canonicalDomain]
                : JSON.stringify(where).includes(`"${alias}"`)
                  ? [aliasDomain]
                  : []
              : [],
      })),
      findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) {
          return tenant
        }
        if (
          collection === "published-site-snapshots" &&
          String(id) === String(tenant.activeSnapshot)
        ) {
          return { id: tenant.activeSnapshot, status: "active", snapshot }
        }
        throw new Error(`Missing ${collection} ${id}`)
      }),
    }

    await expect(
      resolvePublishedSnapshotByHost(asPayload(payload), alias),
    ).resolves.toMatchObject({ tenant: { id: tenant.id } })
  })

  it("does not let an active alias override an inactive canonical domain", async () => {
    const tenant = {
      id: 10,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 110,
      siteManifest: null,
      domainVerification: { status: "verified" },
    }
    const alias = "shop.ami-care.nl"
    const settings = {
      id: 105,
      tenant: tenant.id,
      aliases: [{ host: alias }],
    }
    const payload = {
      find: vi.fn(async ({ collection, where }: MockFindArgs) => ({
        docs: collection === "tenants"
          ? []
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains" &&
                !JSON.stringify(where).includes('"state"')
              ? [{
                  id: 111,
                  tenant: tenant.id,
                  domainNameAscii: tenant.domain,
                  state: "suspended",
                }]
              : [],
      })),
      findByID: vi.fn(async ({ collection, id }: MockFindByIdArgs) => {
        if (collection === "tenants" && String(id) === String(tenant.id)) {
          return tenant
        }
        throw new Error(`Missing ${collection} ${id}`)
      }),
    }

    await expect(
      resolvePublishedSnapshotByHost(asPayload(payload), alias),
    ).resolves.toBeNull()
  })

  it("lets any canonical managed-domain row suppress pre-commerce adoption", async () => {
    const tenant = {
      id: 9,
      slug: amicarePublishedSiteSnapshot.tenantSlug,
      domain: amicarePublishedSiteSnapshot.domain,
      status: "active",
      activeSnapshot: 99,
      siteManifest: null,
      domainVerification: { status: "verified" },
      preCommerceRoutingAdoption: adoptedPreCommerceRouting,
    }
    const settings = { id: 104, tenant: tenant.id, aliases: [] }
    const payload = {
      find: vi.fn(async ({ collection, where }: MockFindArgs) => ({
        docs: collection === "tenants"
          ? [tenant]
          : collection === "site-settings"
            ? [settings]
            : collection === "managed-domains" &&
                !JSON.stringify(where).includes('"state"')
              ? [{ id: 100, tenant: 999, domainNameAscii: tenant.domain }]
              : [],
      })),
    }

    await expect(
      resolvePublishedSnapshotByHost(asPayload(payload), tenant.domain),
    ).resolves.toBeNull()
  })
})
