import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  payload: {
    auth: vi.fn(),
    findByID: vi.fn(),
  },
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

import { POST } from "@/app/(payload)/api/preview-tokens/route"

const req = (body: unknown) =>
  new NextRequest("https://admin.siteinabox.nl/api/preview-tokens", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })

describe("preview token route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PREVIEW_HMAC_SECRET = "test-secret-32-bytes-deadbeefcafe1234567890"
  })

  it("rejects a persisted page that does not belong to the requested tenant", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 1, role: "owner", tenants: [{ tenant: 7 }] },
    })
    mocks.payload.findByID
      .mockResolvedValueOnce({ id: 7, status: "provisioning" })
      .mockResolvedValueOnce({ id: 42, tenant: 8 })

    const res = await POST(req({ tenantId: 7, pageId: 42 }))

    expect(res.status).toBe(403)
    expect(mocks.payload.findByID).toHaveBeenCalledWith({
      collection: "pages",
      id: 42,
      depth: 0,
      overrideAccess: true,
    })
  })

  it("signs a persisted page only after tenant ownership is verified", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 1, role: "owner", tenants: [{ tenant: 7 }] },
    })
    mocks.payload.findByID
      .mockResolvedValueOnce({ id: 7, status: "provisioning" })
      .mockResolvedValueOnce({ id: 42, tenant: { id: "7" } })

    const res = await POST(req({ tenantId: 7, pageId: 42 }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.token).toEqual(expect.any(String))
    expect(body.exp).toEqual(expect.any(Number))
  })

  it("preserves draft preview sentinels after tenant authorization", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 1, role: "owner", tenants: [{ tenant: 7 }] },
    })
    mocks.payload.findByID.mockResolvedValueOnce({ id: 7, status: "provisioning" })

    const res = await POST(req({ tenantId: 7, pageId: "draft-abc" }))

    expect(res.status).toBe(200)
    expect(mocks.payload.findByID).toHaveBeenCalledTimes(1)
  })

  it.each(["suspended", "archived"])("rejects %s tenants before signing a preview token", async (status) => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 1, role: "owner", tenants: [{ tenant: 7 }] },
    })
    mocks.payload.findByID.mockResolvedValueOnce({ id: 7, status })

    const res = await POST(req({ tenantId: 7, pageId: 42 }))

    expect(res.status).toBe(404)
    expect(mocks.payload.findByID).toHaveBeenCalledTimes(1)
  })
})
