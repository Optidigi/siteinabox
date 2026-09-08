import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  isLocalPreviewSessionBypass: vi.fn(),
  createLocalPreviewSessionCookie: vi.fn(),
}))

vi.mock("@/lib/requestAuthority", () => ({
  isLocalPreviewSessionBypass: mocks.isLocalPreviewSessionBypass,
}))

vi.mock("@/lib/builder/localPreviewSession", () => ({
  createLocalPreviewSessionCookie: mocks.createLocalPreviewSessionCookie,
}))

import { GET } from "@/app/(payload)/api/builder/dev-session/route"

describe("local preview session bypass route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 404 outside development loopback", async () => {
    mocks.isLocalPreviewSessionBypass.mockReturnValue(false)
    const response = await GET(new NextRequest("https://admin.siteinabox.nl/api/builder/dev-session"))
    expect(response.status).toBe(404)
    expect(mocks.createLocalPreviewSessionCookie).not.toHaveBeenCalled()
  })

  it("sets a signed preview cookie and redirects to /builder on loopback", async () => {
    mocks.isLocalPreviewSessionBypass.mockReturnValue(true)
    mocks.createLocalPreviewSessionCookie.mockResolvedValue({
      name: "siab-preview-auth.session_token",
      value: "token.signature",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: 60,
    })
    const response = await GET(new NextRequest("http://localhost:3000/api/builder/dev-session"))
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe("/builder")
    const setCookie = response.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("siab-preview-auth.session_token=token.signature")
  })
})
