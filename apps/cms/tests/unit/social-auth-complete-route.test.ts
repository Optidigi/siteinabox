import { beforeEach, describe, expect, it, vi } from "vitest"

import { errLike } from "../_helpers/cast"
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  issuePayloadSessionCookie: vi.fn(),
  isAllowedSocialAuthHost: vi.fn(),
}))

vi.mock("@/lib/betterAuth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

vi.mock("@/lib/socialAuth/payloadSession", () => ({
  issuePayloadSessionCookie: mocks.issuePayloadSessionCookie,
}))

vi.mock("@/lib/socialAuth/hosts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/socialAuth/hosts")>("@/lib/socialAuth/hosts")
  return {
    ...actual,
    isAllowedSocialAuthHost: mocks.isAllowedSocialAuthHost,
  }
})

import { GET } from "@/app/api/siab-auth/complete/route"

const request = (path = "/api/siab-auth/complete") =>
  new Request(`https://admin.siteinabox.nl${path}`, {
    headers: {
      host: "admin.siteinabox.nl",
      "x-siab-mode": "platform",
    },
  })

const internalRequest = (
  path = "/api/siab-auth/complete",
  forwardedHost = "admin.siteinabox.nl",
) =>
  new Request(`https://0.0.0.0:3000${path}`, {
    headers: {
      host: "0.0.0.0:3000",
      "x-forwarded-host": forwardedHost,
      "x-forwarded-proto": "https",
      "x-siab-mode": "platform",
    },
  })

describe("social auth completion route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isAllowedSocialAuthHost.mockResolvedValue(true)
  })

  it("redirects to login when Better Auth has no linked Payload user", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: {} })

    const res = await GET(request())

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://admin.siteinabox.nl/login?error=social-unlinked")
    expect(mocks.issuePayloadSessionCookie).not.toHaveBeenCalled()
  })

  it("mints a Payload cookie and preserves a safe next redirect", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { payloadUserId: "42" } })
    mocks.issuePayloadSessionCookie.mockResolvedValueOnce("payload-token=signed; Path=/; HttpOnly")

    const res = await GET(request("/api/siab-auth/complete?next=/sites"))

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://admin.siteinabox.nl/sites")
    expect(res.headers.get("set-cookie")).toBe("payload-token=signed; Path=/; HttpOnly")
    expect(mocks.issuePayloadSessionCookie).toHaveBeenCalledWith("42", expect.any(Request))
  })

  it("uses forwarded platform admin hosts instead of container-local request URLs", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { payloadUserId: "42" } })
    mocks.issuePayloadSessionCookie.mockResolvedValueOnce("payload-token=signed; Path=/; HttpOnly")

    const res = await GET(internalRequest("/api/siab-auth/complete?next=/sites"))

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://admin.siteinabox.nl/sites")
    const sessionHeaders = mocks.getSession.mock.calls[0]?.[0]?.headers as Headers
    expect(sessionHeaders.get("host")).toBe("admin.siteinabox.nl")
    expect(sessionHeaders.get("x-forwarded-host")).toBe("admin.siteinabox.nl")
    const bridgedRequest = mocks.issuePayloadSessionCookie.mock.calls[0]?.[1] as Request
    expect(bridgedRequest.url).toBe("https://admin.siteinabox.nl/api/siab-auth/complete?next=/sites")
    expect(bridgedRequest.headers.get("host")).toBe("admin.siteinabox.nl")
    expect(bridgedRequest.headers.get("x-forwarded-host")).toBe("admin.siteinabox.nl")
  })

  it("rejects retired tenant admin hosts before reading the Better Auth session", async () => {
    mocks.isAllowedSocialAuthHost.mockResolvedValueOnce(false)

    const res = await GET(internalRequest("/api/siab-auth/complete", "admin.ami-care.nl"))

    expect(res.status).toBe(404)
    expect(await res.text()).toBe("Unknown auth host")
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.issuePayloadSessionCookie).not.toHaveBeenCalled()
  })

  it("uses the platform admin host dynamically too", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: {} })

    const res = await GET(internalRequest("/api/siab-auth/complete", "admin.siteinabox.nl"))

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://admin.siteinabox.nl/login?error=social-unlinked")
  })

  it("rejects unknown admin hosts before reading the Better Auth session", async () => {
    mocks.isAllowedSocialAuthHost.mockResolvedValueOnce(false)

    const res = await GET(internalRequest("/api/siab-auth/complete", "admin.unknown-example.nl"))

    expect(res.status).toBe(404)
    expect(await res.text()).toBe("Unknown auth host")
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.issuePayloadSessionCookie).not.toHaveBeenCalled()
  })

  it("rejects unsafe next redirects through the shared validator", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { payloadUserId: "42" } })
    mocks.issuePayloadSessionCookie.mockResolvedValueOnce("payload-token=signed; Path=/; HttpOnly")

    const res = await GET(request("/api/siab-auth/complete?next=https://evil.example/path"))

    expect(res.headers.get("location")).toBe("https://admin.siteinabox.nl/")
  })

  it("redirects to login when the Payload session bridge fails", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { payloadUserId: "42" } })
    mocks.issuePayloadSessionCookie.mockRejectedValueOnce(new Error("wrong host"))

    const res = await GET(request())

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://admin.siteinabox.nl/login?error=social-session")
  })
})
