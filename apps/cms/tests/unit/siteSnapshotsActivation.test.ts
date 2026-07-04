import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  activatePublishedSnapshot,
  canActivatePublishedSnapshot,
  prunePublishedSnapshotsForTenant,
} from "@/lib/publish/siteSnapshots"

const approvedPaidRun = {
  id: 500,
  clientApproval: { status: "approved" },
  payment: { status: "completed" },
} as any

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
} as any

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
} as any

const createActivationPayload = (input?: { tenant?: any; run?: any }) => {
  const tenant = { ...(input?.tenant ?? pendingTenant) }
  const run = input?.run ?? approvedPaidRun
  const snapshot = {
    id: 10,
    tenant: tenant.id,
    domain: tenant.domain,
    sourceGenerationRun: run.id,
    status: "drafted",
  }
  const updates: any[] = []
  const payload = {
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection === "published-site-snapshots" && String(id) === String(snapshot.id)) return snapshot
      if (collection === "tenants" && String(id) === String(tenant.id)) return tenant
      if (collection === "site-generation-runs" && String(id) === String(run.id)) return run
      throw new Error(`Missing ${collection} ${id}`)
    }),
    find: vi.fn(async () => ({ docs: [] })),
    update: vi.fn(async ({ collection, data }: any) => {
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
  return { payload: payload as any, tenant, snapshot, updates }
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
    expect(canActivatePublishedSnapshot(approvedPaidRun, {
      tenant: {
        ...verifiedTenant,
        emailSending: {
          provider: "cloudflare",
          mode: "subdomain",
          status: "pending",
          sendingDomain: "mail.clientsite.nl",
          senderEmail: "noreply@mail.clientsite.nl",
        },
      },
    })).toEqual({
      ok: false,
      reason: "Generated-site activation requires verified tenant email sending.",
    })
  })

  it("does not let manual generated-site activation bypass tenant email verification", () => {
    expect(canActivatePublishedSnapshot(approvedPaidRun, {
      manualActivation: true,
      tenant: {
        ...verifiedTenant,
        emailSending: {
          provider: "cloudflare",
          mode: "subdomain",
          status: "failed",
          sendingDomain: "mail.clientsite.nl",
          senderEmail: "noreply@mail.clientsite.nl",
        },
      },
    })).toEqual({
      ok: false,
      reason: "Generated-site activation requires verified tenant email sending.",
    })
  })

  it("allows generated-site activation after domain, sender, approval, and payment are all satisfied", () => {
    expect(canActivatePublishedSnapshot(approvedPaidRun, {
      tenant: verifiedTenant,
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
    expect(tenant.emailSending.lastError).toContain("Bearer [redacted]")
    expect(tenant.emailSending.lastError).toContain("api_token=[redacted]")
    expect(tenant.emailSending.lastError).not.toContain("cf-secret")
    expect(snapshot.status).toBe("drafted")
  })

  it("keeps current-state manual activation without a generation run on the existing path", () => {
    expect(canActivatePublishedSnapshot(null, {
      manualActivation: true,
      tenant: {
        status: "active",
        domainVerification: { status: "verified" },
        emailSending: { status: "not_configured" },
      } as any,
    })).toEqual({ ok: true })
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
      delete: vi.fn(async ({ id }: any) => ({ id })),
    }

    await expect(prunePublishedSnapshotsForTenant(payload as any, 1)).resolves.toEqual({
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
    expect(payload.delete.mock.calls.map(([call]) => call.id)).toEqual([2, 1])
    expect(payload.delete.mock.calls.map(([call]) => call.id)).not.toContain(3)
  })
})
