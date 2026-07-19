import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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

  it("requires verified tenant email sending for generated-site activation", () => {
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
    })).toEqual({
      ok: false,
      reason: "Generated-site activation requires verified tenant email sending.",
    })
  })

  it("does not let manual generated-site activation bypass tenant email verification", () => {
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
    })).toEqual({
      ok: false,
      reason: "Generated-site activation requires verified tenant email sending.",
    })
  })

  it("allows generated-site activation after domain, sender, approval, and payment are all satisfied", () => {
    expect(canActivatePublishedSnapshot(asGenerationRun(approvedPaidRun), {
      tenant: asTenant(verifiedTenant),
    })).toEqual({ ok: true })
  })

  it("refreshes pending tenant email sending during activation and activates when Cloudflare reports verified", async () => {
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

    expect(fetch).toHaveBeenCalledWith(
      "https://cloudflare.test/client/v4/zones/zone-123/email/sending/subdomains/subdomain-123",
      expect.objectContaining({ method: "GET" }),
    )
    expect(tenant.emailSending).toMatchObject({
      status: "verified",
      sendingDomain: "mail.clientsite.nl",
      senderEmail: "noreply@mail.clientsite.nl",
      cloudflareZoneId: "zone-123",
      cloudflareSubdomainId: "subdomain-123",
      lastError: null,
    })
    expect(snapshot.status).toBe("active")
  })

  it("refreshes pending tenant email sending during activation and blocks when Cloudflare still reports pending", async () => {
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

    await expect(activatePublishedSnapshot(payload, { snapshotId: 10 })).rejects.toThrow(
      "Generated-site activation requires verified tenant email sending.",
    )

    expect(tenant.emailSending).toMatchObject({
      status: "pending",
      sendingDomain: "mail.clientsite.nl",
      cloudflareSubdomainId: "subdomain-123",
      lastError: null,
    })
    expect(snapshot.status).toBe("drafted")
  })

  it("records sanitized Cloudflare refresh errors and blocks activation with the existing gate reason", async () => {
    const { payload, tenant, snapshot } = createActivationPayload()
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      success: false,
      errors: [{ code: 1000, message: "Provider rejected Bearer cf-secret api_token=cf-secret" }],
      result: null,
    }, { status: 200 })))

    await expect(activatePublishedSnapshot(payload, { snapshotId: 10 })).rejects.toThrow(
      "Generated-site activation requires verified tenant email sending.",
    )

    expect(tenant.emailSending).toMatchObject({
      status: "failed",
      cloudflareZoneId: "zone-123",
      cloudflareSubdomainId: "subdomain-123",
    })
    expect(asMockDoc(tenant.emailSending).lastError).toContain("Bearer [redacted]")
    expect(asMockDoc(tenant.emailSending).lastError).toContain("api_token=[redacted]")
    expect(asMockDoc(tenant.emailSending).lastError).not.toContain("cf-secret")
    expect(snapshot.status).toBe("drafted")
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
    const payload = {
      find: vi.fn(async ({ collection }: MockFindArgs) => ({
        docs: collection === "tenants" ? [tenant] : [],
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
})
