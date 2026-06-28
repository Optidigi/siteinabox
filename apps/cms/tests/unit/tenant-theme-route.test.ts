import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  payload: {
    auth: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

import { POST } from "@/app/(payload)/api/tenant-theme/route"

const req = (body: unknown) =>
  new NextRequest("https://admin.siteinabox.nl/api/tenant-theme", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })

describe("tenant theme route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.payload.update.mockResolvedValue({ id: 7 })
  })

  it("rejects unauthenticated callers", async () => {
    mocks.payload.auth.mockResolvedValue({ user: null })

    const res = await POST(req({ tenantId: 7, theme: { palette: { accent: "#a04e32" } } }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: "Forbidden" })
    expect(mocks.payload.update).not.toHaveBeenCalled()
  })

  it("allows owners and editors to update their own tenant even when it is not the first membership", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 2, role: "editor", tenants: [{ tenant: 99 }, { tenant: { id: 7 } }] },
    })

    const theme = {
      palette: { accent: "#a04e32", bg: "#fbf7f0" },
      fonts: { heading: "Nunito", text: "Nunito" },
      radius: "1rem",
    }
    const res = await POST(req({ tenantId: "7", theme }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, theme })
    expect(mocks.payload.update).toHaveBeenCalledWith({
      collection: "tenants",
      id: "7",
      data: { theme },
      overrideAccess: true,
    })
  })

  it("allows super-admin callers to update any tenant theme", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin", tenants: [] } })

    const res = await POST(req({ tenantId: 7, theme: {} }))

    expect(res.status).toBe(200)
    expect(mocks.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "tenants",
      id: "7",
      data: { theme: {} },
      overrideAccess: true,
    }))
  })

  it("rejects viewers and cross-tenant editors", async () => {
    mocks.payload.auth.mockResolvedValue({
      user: { id: 2, role: "viewer", tenants: [{ tenant: 7 }] },
    })
    expect((await POST(req({ tenantId: 7, theme: {} }))).status).toBe(403)

    mocks.payload.auth.mockResolvedValue({
      user: { id: 3, role: "editor", tenants: [{ tenant: 8 }] },
    })
    expect((await POST(req({ tenantId: 7, theme: {} }))).status).toBe(403)

    expect(mocks.payload.update).not.toHaveBeenCalled()
  })

  it("rejects malformed bodies and invalid theme tokens before writing", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin" } })

    expect((await POST(req("{"))).status).toBe(400)
    expect((await POST(req(["not", "object"]))).status).toBe(400)
    expect((await POST(req({ theme: {} }))).status).toBe(400)
    const invalid = await POST(req({ tenantId: 7, theme: { palette: { accent: "not-a-color" } } }))
    expect(invalid.status).toBe(400)
    expect((await invalid.json()).message).toContain("Invalid theme data")
    expect(mocks.payload.update).not.toHaveBeenCalled()
  })
})
