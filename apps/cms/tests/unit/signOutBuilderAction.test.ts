import { beforeEach, describe, expect, it, vi } from "vitest"
import { signOutBuilderAction } from "@/lib/actions/requestBuilderMagicLink"

const io = vi.hoisted(() => {
  const order: string[] = []
  return { headers: new Headers(), signOut: vi.fn(), cookieSet: vi.fn(), redirect: vi.fn(), order }
})
vi.mock("next/headers", () => ({ headers: async () => io.headers, cookies: async () => ({ set: io.cookieSet }) }))
vi.mock("next/navigation", () => ({ redirect: io.redirect }))
vi.mock("@/lib/preview/betterAuth", () => ({ previewAuth: { api: { signOut: io.signOut } } }))
vi.mock("@/lib/builder/sendBuilderMagicLink", () => ({ sendBuilderMagicLink: vi.fn() }))
beforeEach(() => {
  io.headers = new Headers({ host: "admin.siteinabox.nl", "x-forwarded-host": "admin.siteinabox.nl", cookie: "siab-preview-auth.session_token=signed" })
  io.order.length = 0
  io.signOut.mockReset().mockImplementation(async () => {
    io.order.push("revoked")
    const headers = new Headers()
    headers.append("Set-Cookie", "siab-preview-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure")
    headers.append("Set-Cookie", "siab-preview-auth.session_data=; Max-Age=0; Path=/; HttpOnly; Secure")
    return { response: { success: true }, headers }
  })
  io.cookieSet.mockReset().mockImplementation((name: string) => { io.order.push(`cookie:${name}`) })
  io.redirect.mockReset().mockImplementation((path: string) => { io.order.push(`redirect:${path}`); throw new Error("NEXT_REDIRECT fixture") })
})
describe("builder sign-out completes at the login page", () => {
  it("redirects only after successful SDK revocation and installing every deletion cookie", async () => {
    await expect(signOutBuilderAction()).rejects.toThrow("NEXT_REDIRECT fixture")
    expect(io.order).toEqual(["revoked", "cookie:siab-preview-auth.session_token", "cookie:siab-preview-auth.session_data", "redirect:/login"])
    expect(io.redirect).toHaveBeenCalledWith("/login")
    expect(io.signOut).toHaveBeenCalledWith(expect.objectContaining({ returnHeaders: true, headers: expect.any(Headers) }))
  })
  it("does not redirect or clear cookies when SDK revocation fails", async () => {
    io.signOut.mockRejectedValueOnce(new Error("Revocation commit receipt unavailable"))
    await expect(signOutBuilderAction()).rejects.toThrow("Revocation commit receipt unavailable")
    expect(io.cookieSet).not.toHaveBeenCalled()
    expect(io.redirect).not.toHaveBeenCalled()
  })
  it("does not report completion for an unsuccessful SDK response", async () => {
    io.signOut.mockResolvedValueOnce({ response: { success: false }, headers: new Headers() })
    await expect(signOutBuilderAction()).rejects.toThrow("Builder sign-out failed")
    expect(io.cookieSet).not.toHaveBeenCalled()
    expect(io.redirect).not.toHaveBeenCalled()
  })
  it("does not invoke auth or redirect an untrusted request authority", async () => {
    io.headers = new Headers({ host: "admin.siteinabox.nl", "x-forwarded-host": "attacker.example" })
    await signOutBuilderAction()
    expect(io.signOut).not.toHaveBeenCalled()
    expect(io.cookieSet).not.toHaveBeenCalled()
    expect(io.redirect).not.toHaveBeenCalled()
  })
})
