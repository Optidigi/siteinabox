import { describe, it, expect, vi, beforeEach } from "vitest"

// fs.rename / fs.rm are spied on per-test so we can assert call patterns
// without touching the real filesystem.
vi.mock("node:fs", async (orig) => {
  const actual = (await orig()) as any
  return {
    ...actual,
    promises: {
      ...actual.promises,
      rename: vi.fn(async () => undefined),
      rm: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined)
    }
  }
})

const { ensureTenantPostHogEnrollment } = vi.hoisted(() => ({
  ensureTenantPostHogEnrollment: vi.fn(async () => "updated"),
}))
vi.mock("@/lib/analytics/projectEnrollment", () => ({
  ensureTenantPostHogEnrollment,
  tenantAnalyticsAppUrls: (tenant: any) => tenant.domainVerification?.status === "verified"
    ? [`https://${tenant.domain}`, `https://admin.${tenant.domain}`]
    : [],
}))

import { promises as fs } from "node:fs"
import path from "node:path"
import {
  archiveTenantDir,
  createTenantDir,
  enrollTenantAnalytics,
  removeTenantDir,
  restoreTenantDir
} from "@/hooks/tenantLifecycle"

const fakeReq = (): any => ({
  payload: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }
})

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

beforeEach(() => {
  vi.clearAllMocks()
})

describe("removeTenantDir (afterDelete)", () => {
  it("removes both live and archived dirs with force:true", async () => {
    const req = fakeReq()
    await removeTenantDir({ doc: { id: 42 }, id: 42, req, collection: {} as any, context: {} as any })
    expect(fs.rm).toHaveBeenCalledTimes(2)
    expect(fs.rm).toHaveBeenCalledWith(
      path.join(dataDir(), "tenants", "42"),
      { recursive: true, force: true }
    )
    expect(fs.rm).toHaveBeenCalledWith(
      path.join(dataDir(), "archived", "42"),
      { recursive: true, force: true }
    )
    expect(req.payload.logger.info).toHaveBeenCalled()
    expect(req.payload.logger.warn).not.toHaveBeenCalled()
  })

  it("does not throw when fs.rm rejects — logs warn instead", async () => {
    ;(fs.rm as any).mockRejectedValueOnce(new Error("permission denied"))
    const req = fakeReq()
    await expect(
      removeTenantDir({ doc: { id: 7 }, id: 7, req, collection: {} as any, context: {} as any })
    ).resolves.toBeDefined()
    expect(req.payload.logger.warn).toHaveBeenCalled()
  })
})

describe("createTenantDir (afterChange create)", () => {
  it("does not create tenant data dirs when skipProjection context is set", async () => {
    const req = fakeReq()
    await createTenantDir({
      doc: { id: 42 },
      req: { ...req, context: { skipProjection: true } },
      collection: {} as any,
      context: {} as any,
      operation: "create",
    } as any)

    expect(fs.mkdir).not.toHaveBeenCalled()
  })
})

describe("enrollTenantAnalytics (verified tenant lifecycle)", () => {
  it("automatically enrolls a newly verified tenant", async () => {
    const req = fakeReq()
    await enrollTenantAnalytics({
      doc: { id: 42, domain: "client.example", domainVerification: { status: "verified" } },
      previousDoc: { id: 42, domain: "client.example", domainVerification: { status: "not_checked" } },
      req,
      collection: {} as any,
      context: {} as any,
      operation: "update",
    } as any)

    expect(ensureTenantPostHogEnrollment).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }))
    expect(req.payload.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "42", result: "updated" }),
      "[analytics] tenant PostHog enrollment checked",
    )
  })

  it("does not call PostHog for unverified or unchanged domains", async () => {
    const req = fakeReq()
    await enrollTenantAnalytics({
      doc: { id: 42, domain: "client.example", domainVerification: { status: "not_checked" } },
      previousDoc: null,
      req,
    } as any)
    await enrollTenantAnalytics({
      doc: { id: 42, domain: "client.example", domainVerification: { status: "verified" } },
      previousDoc: { id: 42, domain: "client.example", domainVerification: { status: "verified" } },
      req,
    } as any)

    expect(ensureTenantPostHogEnrollment).not.toHaveBeenCalled()
  })
})

describe("restoreTenantDir (status: archived → active)", () => {
  it("renames archived/<id> back to tenants/<id> on un-archive", async () => {
    const req = fakeReq()
    await restoreTenantDir({
      doc: { id: 9, status: "active" },
      previousDoc: { id: 9, status: "archived" },
      req,
      collection: {} as any,
      context: {} as any,
      operation: "update"
    } as any)
    expect(fs.rename).toHaveBeenCalledWith(
      path.join(dataDir(), "archived", "9"),
      path.join(dataDir(), "tenants", "9")
    )
  })

  it("no-op when status was not previously archived (active → active)", async () => {
    const req = fakeReq()
    await restoreTenantDir({
      doc: { id: 9, status: "active" },
      previousDoc: { id: 9, status: "active" },
      req,
      collection: {} as any,
      context: {} as any,
      operation: "update"
    } as any)
    expect(fs.rename).not.toHaveBeenCalled()
  })

  it("no-op on archived → archived (idempotent)", async () => {
    const req = fakeReq()
    await restoreTenantDir({
      doc: { id: 9, status: "archived" },
      previousDoc: { id: 9, status: "archived" },
      req,
      collection: {} as any,
      context: {} as any,
      operation: "update"
    } as any)
    expect(fs.rename).not.toHaveBeenCalled()
  })

  it("warns instead of throwing when archived dir is missing", async () => {
    const enoent: any = new Error("not found")
    enoent.code = "ENOENT"
    ;(fs.rename as any).mockRejectedValueOnce(enoent)
    const req = fakeReq()
    await expect(
      restoreTenantDir({
        doc: { id: 9, status: "active" },
        previousDoc: { id: 9, status: "archived" },
        req,
        collection: {} as any,
        context: {} as any,
        operation: "update"
      } as any)
    ).resolves.toBeDefined()
    expect(req.payload.logger.warn).toHaveBeenCalled()
  })
})

describe("archiveTenantDir (status: any → archived)", () => {
  it("renames tenants/<id> to archived/<id> on archive", async () => {
    const req = fakeReq()
    await archiveTenantDir({
      doc: { id: 5, status: "archived" },
      previousDoc: { id: 5, status: "active" },
      req,
      collection: {} as any,
      context: {} as any,
      operation: "update"
    } as any)
    expect(fs.rename).toHaveBeenCalledWith(
      path.join(dataDir(), "tenants", "5"),
      path.join(dataDir(), "archived", "5")
    )
  })

  it("no-op archived → archived", async () => {
    const req = fakeReq()
    await archiveTenantDir({
      doc: { id: 5, status: "archived" },
      previousDoc: { id: 5, status: "archived" },
      req,
      collection: {} as any,
      context: {} as any,
      operation: "update"
    } as any)
    expect(fs.rename).not.toHaveBeenCalled()
  })
})
