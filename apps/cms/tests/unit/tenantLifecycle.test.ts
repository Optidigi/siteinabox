import { createInitializedTestPayload, createTestRequest } from "../_helpers/testPayload"
import { tenantFixture } from "../_helpers/generatedDocs"
import { hookCollection, hookRequest } from "../_helpers/hookFixtures"
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { MockDoc } from "../_helpers/mockPayload"
import { argsFor } from "../_helpers/argsFor"
import { promises as fs } from "node:fs"
import path from "node:path"
import {
  archiveTenantDir,
  createTenantDir,
  enrollTenantAnalytics,
  removeTenantDir,
  restoreTenantDir,
} from "@/hooks/tenantLifecycle"

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return {
    ...actual,
    promises: {
      ...actual.promises,
      rename: vi.fn(async () => undefined),
      rm: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    },
  }
})

const { ensureTenantPostHogEnrollment } = vi.hoisted(() => ({
  ensureTenantPostHogEnrollment: vi.fn(async () => "updated"),
}))
vi.mock("@/lib/analytics/projectEnrollment", () => ({
  ensureTenantPostHogEnrollment,
  tenantAnalyticsAppUrls: (tenant: MockDoc) => {
    const verification = tenant.domainVerification as { status?: string } | undefined
    const domain = String(tenant.domain ?? "")
    return verification?.status === "verified"
      ? [`https://${domain}`, `https://admin.siteinabox.nl`]
      : []
  },
}))

const fakeReq = async () => {
  const payload = await createInitializedTestPayload()
  vi.spyOn(payload.logger, "info")
  vi.spyOn(payload.logger, "warn")
  vi.spyOn(payload.logger, "error")
  return createTestRequest(payload)
}

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

beforeEach(() => {
  vi.clearAllMocks()
})

describe("removeTenantDir (afterDelete)", () => {
  it("removes both live and archived dirs with force:true", async () => {
    const req = await fakeReq()
    await removeTenantDir(argsFor(removeTenantDir, {
      doc: tenantFixture({ id: 42 }),
      id: 42,
      req,
      collection: hookCollection("tenants"),
      context: {},
    }))
    expect(fs.rm).toHaveBeenCalledTimes(2)
    expect(fs.rm).toHaveBeenCalledWith(
      path.join(dataDir(), "tenants", "42"),
      { recursive: true, force: true },
    )
    expect(fs.rm).toHaveBeenCalledWith(
      path.join(dataDir(), "archived", "42"),
      { recursive: true, force: true },
    )
    expect(req.payload.logger.info).toHaveBeenCalled()
    expect(req.payload.logger.warn).not.toHaveBeenCalled()
  })

  it("does not throw when fs.rm rejects — logs warn instead", async () => {
    vi.mocked(fs.rm).mockRejectedValueOnce(new Error("permission denied"))
    const req = await fakeReq()
    await expect(
      removeTenantDir(argsFor(removeTenantDir, {
        doc: tenantFixture({ id: 7 }),
        id: 7,
        req,
        collection: hookCollection("tenants"),
        context: {},
      })),
    ).resolves.toBeDefined()
    expect(req.payload.logger.warn).toHaveBeenCalled()
  })
})

describe("createTenantDir (afterChange create)", () => {
  it("does not create tenant data dirs when skipProjection context is set", async () => {
    const req = await fakeReq()
    await createTenantDir(argsFor(createTenantDir, {
      data: {},
      previousDoc: tenantFixture(),
      doc: tenantFixture({ id: 42 }),
      req: hookRequest({ ...req, context: { skipProjection: true } }),
      collection: hookCollection("tenants"),
      context: { skipProjection: true },
      operation: "create",
    }))

    expect(fs.mkdir).not.toHaveBeenCalled()
  })
})

describe("enrollTenantAnalytics (verified tenant lifecycle)", () => {
  it("automatically enrolls a newly verified tenant", async () => {
    const req = await fakeReq()
    await enrollTenantAnalytics(argsFor(enrollTenantAnalytics, {
      data: {},
      doc: tenantFixture({ id: 42, domain: "client.example", domainVerification: { status: "verified" } }),
      previousDoc: tenantFixture({ id: 42, domain: "client.example", domainVerification: { status: "not_checked" } }),
      req,
      collection: hookCollection("tenants"),
      context: {},
      operation: "update",
    }))

    expect(ensureTenantPostHogEnrollment).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }))
    expect(req.payload.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "42", result: "updated" }),
      "[analytics] tenant PostHog enrollment checked",
    )
  })

  it("does not call PostHog for unverified or unchanged domains", async () => {
    const req = await fakeReq()
    await enrollTenantAnalytics(argsFor(enrollTenantAnalytics, {
      collection: hookCollection("tenants"),
      context: {},
      data: {},
      operation: "update",
      doc: tenantFixture({ id: 42, domain: "client.example", domainVerification: { status: "not_checked" } }),
      previousDoc: tenantFixture({ id: 42, domain: "client.example", domainVerification: { status: "not_checked" } }),
      req,
    }))
    await enrollTenantAnalytics(argsFor(enrollTenantAnalytics, {
      collection: hookCollection("tenants"),
      context: {},
      data: {},
      operation: "update",
      doc: tenantFixture({ id: 42, domain: "client.example", domainVerification: { status: "verified" } }),
      previousDoc: tenantFixture({ id: 42, domain: "client.example", domainVerification: { status: "verified" } }),
      req,
    }))

    expect(ensureTenantPostHogEnrollment).not.toHaveBeenCalled()
  })
})

describe("restoreTenantDir (status: archived → active)", () => {
  it("renames archived/<id> back to tenants/<id> on un-archive", async () => {
    const req = await fakeReq()
    await restoreTenantDir(argsFor(restoreTenantDir, {
      data: {},
      doc: tenantFixture({ id: 9, status: "active" }),
      previousDoc: tenantFixture({ id: 9, status: "archived" }),
      req,
      collection: hookCollection("tenants"),
      context: {},
      operation: "update",
    }))
    expect(fs.rename).toHaveBeenCalledWith(
      path.join(dataDir(), "archived", "9"),
      path.join(dataDir(), "tenants", "9"),
    )
  })

  it("no-op when status was not previously archived (active → active)", async () => {
    const req = await fakeReq()
    await restoreTenantDir(argsFor(restoreTenantDir, {
      data: {},
      doc: tenantFixture({ id: 9, status: "active" }),
      previousDoc: tenantFixture({ id: 9, status: "active" }),
      req,
      collection: hookCollection("tenants"),
      context: {},
      operation: "update",
    }))
    expect(fs.rename).not.toHaveBeenCalled()
  })

  it("no-op on archived → archived (idempotent)", async () => {
    const req = await fakeReq()
    await restoreTenantDir(argsFor(restoreTenantDir, {
      data: {},
      doc: tenantFixture({ id: 9, status: "archived" }),
      previousDoc: tenantFixture({ id: 9, status: "archived" }),
      req,
      collection: hookCollection("tenants"),
      context: {},
      operation: "update",
    }))
    expect(fs.rename).not.toHaveBeenCalled()
  })

  it("warns instead of throwing when archived dir is missing", async () => {
    const enoent = Object.assign(new Error("not found"), { code: "ENOENT" })
    vi.mocked(fs.rename).mockRejectedValueOnce(enoent)
    const req = await fakeReq()
    await expect(
      restoreTenantDir(argsFor(restoreTenantDir, {
        data: {},
        doc: tenantFixture({ id: 9, status: "active" }),
        previousDoc: tenantFixture({ id: 9, status: "archived" }),
        req,
        collection: hookCollection("tenants"),
        context: {},
        operation: "update",
      })),
    ).resolves.toBeDefined()
    expect(req.payload.logger.warn).toHaveBeenCalled()
  })
})

describe("archiveTenantDir (status: unknown → archived)", () => {
  it("renames tenants/<id> to archived/<id> on archive", async () => {
    const req = await fakeReq()
    await archiveTenantDir(argsFor(archiveTenantDir, {
      data: {},
      doc: tenantFixture({ id: 5, status: "archived" }),
      previousDoc: tenantFixture({ id: 5, status: "active" }),
      req,
      collection: hookCollection("tenants"),
      context: {},
      operation: "update",
    }))
    expect(fs.rename).toHaveBeenCalledWith(
      path.join(dataDir(), "tenants", "5"),
      path.join(dataDir(), "archived", "5"),
    )
  })

  it("no-op archived → archived", async () => {
    const req = await fakeReq()
    await archiveTenantDir(argsFor(archiveTenantDir, {
      data: {},
      doc: tenantFixture({ id: 5, status: "archived" }),
      previousDoc: tenantFixture({ id: 5, status: "archived" }),
      req,
      collection: hookCollection("tenants"),
      context: {},
      operation: "update",
    }))
    expect(fs.rename).not.toHaveBeenCalled()
  })
})
