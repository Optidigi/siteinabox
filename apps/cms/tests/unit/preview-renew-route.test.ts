import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/siab-auth/preview-renew/route"

const seams = vi.hoisted(() => ({ read: vi.fn(), handler: vi.fn() }))
vi.mock("@/lib/auth/verifiedPreviewSession", () => ({ readVerifiedPreviewSession: seams.read }))
vi.mock("@/lib/preview/betterAuth", () => ({ previewAuth: { handler: seams.handler } }))
const subject = { session: { id: "original-preview-session" }, user: { id: "verified-user", email: "verified@example.test" } }
const request = (host: string, origin?: string, forwardedHost = host) => new Request(`http://${host}/api/siab-auth/preview-renew`, { method: "POST", headers: { host, "x-forwarded-host": forwardedHost, cookie: "siab-preview-auth.session_token=signed-fixture", ...(origin ? { origin } : {}) } })
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development")
  seams.read.mockReset().mockResolvedValue(subject)
  seams.handler.mockReset().mockResolvedValue(new Response("{}", { headers: { "Set-Cookie": "siab-preview-auth.session_token=renewed; HttpOnly" } }))
})
afterEach(() => vi.unstubAllEnvs())
describe("preview renewal uses the actual preview request authority", () => {
  it("accepts same-origin development HTTP including the localhost port", async () => {
    const response = await POST(request("localhost:3403", "http://localhost:3403"))
    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie()).toHaveLength(1)
    const upstream = seams.handler.mock.calls[0]?.[0]
    expect(upstream).toBeInstanceOf(Request)
    expect(upstream.url).toBe("http://localhost:3403/api/preview-auth/get-session?disableCookieCache=true")
    expect(upstream.headers.get("host")).toBe("localhost:3403")
    expect(upstream.headers.get("x-forwarded-host")).toBe("localhost:3403")
    expect(seams.read).toHaveBeenCalledTimes(2)
  })
  it.each([undefined, "http://localhost:3404", "https://localhost:3403", "https://attacker.example"])("rejects missing or cross-origin browser authority %s", async (origin) => {
    expect((await POST(request("localhost:3403", origin))).status).toBe(403)
    expect(seams.handler).not.toHaveBeenCalled()
    expect(seams.read).not.toHaveBeenCalled()
  })
  it.each(["attacker.example", "localhost:3403, attacker.example", "localhost:3404"])("rejects conflicting or malformed forwarded authority %s", async (forwarded) => {
    expect((await POST(request("localhost:3403", "http://localhost:3403", forwarded))).status).toBe(404)
    expect(seams.handler).not.toHaveBeenCalled()
  })
  it("accepts exact production HTTPS platform origin", async () => {
    vi.stubEnv("NODE_ENV", "production")
    expect((await POST(request("admin.siteinabox.nl", "https://admin.siteinabox.nl"))).status).toBe(200)
    expect(seams.handler.mock.calls[0]?.[0].url).toBe("https://admin.siteinabox.nl/api/preview-auth/get-session?disableCookieCache=true")
  })
  it("rejects production HTTP origin and production loopback", async () => {
    vi.stubEnv("NODE_ENV", "production")
    expect((await POST(request("admin.siteinabox.nl", "http://admin.siteinabox.nl"))).status).toBe(403)
    expect((await POST(request("localhost:3403", "http://localhost:3403"))).status).toBe(404)
    expect(seams.handler).not.toHaveBeenCalled()
  })
  it("denies missing signed session and changed post-renew subject without emitting cookies", async () => {
    seams.read.mockResolvedValueOnce(null)
    expect((await POST(request("localhost:3403", "http://localhost:3403"))).status).toBe(401)
    expect(seams.handler).not.toHaveBeenCalled()
    seams.read.mockResolvedValueOnce(subject).mockResolvedValueOnce({ ...subject, session: { id: "different-session" } })
    const response = await POST(request("localhost:3403", "http://localhost:3403"))
    expect(response.status).toBe(401)
    expect(response.headers.getSetCookie()).toHaveLength(0)
  })
})
