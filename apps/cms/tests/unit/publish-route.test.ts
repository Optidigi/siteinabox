import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  payload: {
    auth: vi.fn(),
    findByID: vi.fn(),
  },
  publishSiteSnapshot: vi.fn(),
  activatePublishedSnapshot: vi.fn(),
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/publish/siteSnapshots", () => ({
  publishSiteSnapshot: mocks.publishSiteSnapshot,
  activatePublishedSnapshot: mocks.activatePublishedSnapshot,
}))

import { POST } from "@/app/(payload)/api/publish/route"

const req = (body: unknown) =>
  new NextRequest("https://admin.siteinabox.nl/api/publish", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })

describe("publish route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.payload.findByID.mockResolvedValue({ id: 7, slug: "ami-care", domain: "ami-care.nl" })
    mocks.publishSiteSnapshot.mockResolvedValue({
      activated: false,
      snapshot: { id: 10, status: "drafted", version: 1, domain: "example.test" },
    })
    mocks.activatePublishedSnapshot.mockResolvedValue({ id: 9 })
  })

  it("rejects unauthenticated callers", async () => {
    mocks.payload.auth.mockResolvedValue({ user: null })

    const res = await POST(req({ tenantId: 1 }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: "Forbidden" })
    expect(mocks.publishSiteSnapshot).not.toHaveBeenCalled()
  })

  it("rejects callers when auth lookup fails", async () => {
    mocks.payload.auth.mockRejectedValue(new Error("bad session"))

    const res = await POST(req({ tenantId: 1 }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: "Forbidden" })
    expect(mocks.publishSiteSnapshot).not.toHaveBeenCalled()
    expect(mocks.activatePublishedSnapshot).not.toHaveBeenCalled()
  })

  it("rejects non-super-admin callers", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 2, role: "owner" } })

    const res = await POST(req({ tenantId: 1 }))

    expect(res.status).toBe(403)
    expect(mocks.publishSiteSnapshot).not.toHaveBeenCalled()
  })

  it("allows tenant editors to publish current CMS pages for their own tenant", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 2, role: "editor", tenants: [{ tenant: 7 }] },
    })
    mocks.publishSiteSnapshot.mockResolvedValue({
      activated: true,
      snapshot: { id: 12, status: "active", version: 3, domain: "example.test" },
    })

    const res = await POST(req({
      tenantId: 7,
      includeAllPublishedPages: true,
      activate: true,
      manualActivation: true,
      reason: "auto-publish current CMS state",
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, activated: true, snapshotId: 12, status: "active" })
    expect(mocks.publishSiteSnapshot).toHaveBeenCalledWith(mocks.payload, expect.objectContaining({
      tenantId: 7,
      generationRunId: null,
      includeAllPublishedPages: true,
      activate: true,
      manualActivation: true,
      publishedBy: 2,
    }))
    expect(mocks.payload.findByID).toHaveBeenCalledWith({
      collection: "tenants",
      id: 7,
      depth: 0,
      overrideAccess: true,
    })
  })

  it("rejects tenant users publishing non-official tenants directly", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 2, role: "editor", tenants: [{ tenant: 7 }] },
    })
    mocks.payload.findByID.mockResolvedValue({ id: 7, slug: "customer-preview", domain: "customer.example" })

    const res = await POST(req({
      tenantId: 7,
      includeAllPublishedPages: true,
      activate: true,
      manualActivation: true,
    }))

    expect(res.status).toBe(403)
    expect(mocks.publishSiteSnapshot).not.toHaveBeenCalled()
  })

  it("rejects tenant users publishing another tenant or non-current-state snapshots", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 2, role: "editor", tenants: [{ tenant: 7 }] },
    })

    expect((await POST(req({
      tenantId: 8,
      includeAllPublishedPages: true,
      activate: true,
    }))).status).toBe(403)
    expect((await POST(req({
      tenantId: 7,
      generationRunId: 50,
      activate: true,
    }))).status).toBe(403)
    expect((await POST(req({
      tenantId: 7,
      generationRunId: 50,
      includeAllPublishedPages: true,
      activate: true,
    }))).status).toBe(403)
    expect(mocks.publishSiteSnapshot).not.toHaveBeenCalled()
  })

  it("rejects invalid JSON and malformed bodies", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin" } })

    expect((await POST(req("{"))).status).toBe(400)
    expect((await POST(req(["not", "object"]))).status).toBe(400)
    expect((await POST(req({ activate: true }))).status).toBe(400)
  })

  it("publishes a snapshot without activation", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin" } })

    const res = await POST(req({ tenantId: 7, generationRunId: 50, reason: "operator publish" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, activated: false, snapshotId: 10, status: "drafted" })
    expect(mocks.publishSiteSnapshot).toHaveBeenCalledWith(mocks.payload, {
      tenantId: 7,
      generationRunId: 50,
      includeAllPublishedPages: false,
      activate: false,
      manualActivation: false,
      publishedBy: 1,
      activationReason: "operator publish",
    })
  })

  it("publishes and activates a snapshot", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin" } })
    mocks.publishSiteSnapshot.mockResolvedValue({
      activated: true,
      snapshot: { id: 11, status: "active", version: 2, domain: "example.test" },
    })

    const res = await POST(req({
      tenantId: 7,
      generationRunId: 50,
      activate: true,
      manualActivation: true,
      reason: "manual activation",
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, activated: true, snapshotId: 11, status: "active" })
    expect(mocks.publishSiteSnapshot).toHaveBeenCalledWith(mocks.payload, expect.objectContaining({
      activate: true,
      manualActivation: true,
      includeAllPublishedPages: false,
      activationReason: "manual activation",
    }))
  })

  it("publishes current CMS pages for direct live editor publishes", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin" } })
    mocks.publishSiteSnapshot.mockResolvedValue({
      activated: true,
      snapshot: { id: 12, status: "active", version: 3, domain: "example.test" },
    })

    const res = await POST(req({
      tenantId: 7,
      includeAllPublishedPages: true,
      activate: true,
      manualActivation: true,
      reason: "publish current CMS state",
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, activated: true, snapshotId: 12, status: "active" })
    expect(mocks.publishSiteSnapshot).toHaveBeenCalledWith(mocks.payload, expect.objectContaining({
      generationRunId: null,
      includeAllPublishedPages: true,
      activate: true,
      manualActivation: true,
      activationReason: "publish current CMS state",
    }))
  })

  it("rolls back by activating an existing snapshot in rollback mode", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin" } })

    const res = await POST(req({
      action: "rollback",
      snapshotId: 8,
      manualActivation: true,
      reason: "restore previous snapshot",
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, activated: true, snapshotId: 9 })
    expect(mocks.activatePublishedSnapshot).toHaveBeenCalledWith(mocks.payload, {
      snapshotId: 8,
      manualActivation: true,
      activatedBy: 1,
      activationReason: "restore previous snapshot",
      rollback: true,
    })
  })

  it("returns 422 when activation policy blocks the operation", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin" } })
    mocks.publishSiteSnapshot.mockRejectedValue(new Error("Activation requires verified domain ownership."))

    const res = await POST(req({ tenantId: 7, generationRunId: 50, activate: true }))

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ ok: false, message: "Activation requires verified domain ownership." })
  })
})
