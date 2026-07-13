import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  auth: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    find: mocks.find,
    auth: mocks.auth,
    forgotPassword: mocks.forgotPassword,
    resetPassword: mocks.resetPassword,
    logger: { error: mocks.loggerError },
  })),
}))

import { POST as forgotPassword } from "@/app/(payload)/api/users/forgot-password/route"
import { POST as resetPassword } from "@/app/(payload)/api/users/reset-password/route"
import { proxy } from "@/proxy"
import {
  buildSuperAdminResetUrl,
  SUPER_ADMIN_RESET_TOKEN_TTL_MS,
} from "@/lib/auth/passwordRecovery"
import { resetPasswordTemplate } from "@/lib/email/templates/resetPassword"

const jsonRequest = (path: string, body: unknown) => new Request(`https://admin.siteinabox.nl${path}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

describe("super-admin password recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: null })
    vi.stubEnv("NEXT_PUBLIC_SUPER_ADMIN_DOMAIN", "siteinabox.nl")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    "/forgot-password",
    "/reset-password/token",
    "/api/users/forgot-password",
    "/api/users/reset-password",
  ])("returns 404 for password recovery on tenant hosts: %s", async (path) => {
    const response = await proxy(new NextRequest(`https://admin.client.nl${path}`, {
      method: path.includes("/api/") ? "POST" : "GET",
      headers: { host: "admin.client.nl" },
    }))
    expect(response.status).toBe(404)
  })

  it("allows the recovery surfaces through on the configured super-admin host", async () => {
    const response = await proxy(new NextRequest("https://admin.siteinabox.nl/forgot-password", {
      headers: { host: "admin.siteinabox.nl" },
    }))
    expect(response.status).not.toBe(404)
  })

  it("does not create reset tokens for tenant users or unknown addresses", async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    const response = await forgotPassword(jsonRequest("/api/users/forgot-password", { email: "tenant@example.nl" }))
    expect(response.status).toBe(200)
    expect(mocks.forgotPassword).not.toHaveBeenCalled()
  })

  it("does not let authenticated tenant users bypass the anonymous limiter to trigger resets", async () => {
    mocks.auth.mockResolvedValue({ user: { id: 2, role: "owner" } })
    const response = await forgotPassword(jsonRequest("/api/users/forgot-password", { email: "admin@example.nl" }))

    expect(response.status).toBe(404)
    expect(mocks.find).not.toHaveBeenCalled()
    expect(mocks.forgotPassword).not.toHaveBeenCalled()
  })

  it("rejects invalid auth signals that would otherwise bypass the anonymous limiter", async () => {
    const request = new Request("https://admin.siteinabox.nl/api/users/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "bogus" },
      body: JSON.stringify({ email: "admin@example.nl" }),
    })
    const response = await forgotPassword(request)

    expect(response.status).toBe(403)
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it("uses Payload's reset machinery with an explicit one-hour lifetime for super-admins", async () => {
    mocks.find.mockResolvedValue({ docs: [{ id: 1, role: "super-admin" }] })
    mocks.forgotPassword.mockResolvedValue("token")
    const response = await forgotPassword(jsonRequest("/api/users/forgot-password", { email: " Admin@Example.nl " }))
    expect(response.status).toBe(200)
    expect(mocks.forgotPassword).toHaveBeenCalledWith(expect.objectContaining({
      collection: "users",
      data: { email: "admin@example.nl" },
      expiration: SUPER_ADMIN_RESET_TOKEN_TTL_MS,
    }))
  })

  it("reports provider failure instead of showing a false success", async () => {
    mocks.find.mockResolvedValue({ docs: [{ id: 1, role: "super-admin" }] })
    mocks.forgotPassword.mockRejectedValue(new Error("provider unavailable"))
    const response = await forgotPassword(jsonRequest("/api/users/forgot-password", { email: "admin@example.nl" }))
    expect(response.status).toBe(500)
    expect(mocks.loggerError).toHaveBeenCalled()
  })

  it("rejects reset tokens that do not belong to a live super-admin reset", async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    const response = await resetPassword(jsonRequest("/api/users/reset-password", {
      password: "new-password",
      token: "tenant-or-invalid-token",
    }))
    expect(response.status).toBe(400)
    expect(mocks.resetPassword).not.toHaveBeenCalled()
  })

  it("delegates valid super-admin reset tokens to Payload", async () => {
    mocks.find.mockResolvedValue({ docs: [{ id: 1, role: "super-admin" }] })
    mocks.resetPassword.mockResolvedValue({ token: "session-token", user: { id: 1 } })
    const response = await resetPassword(jsonRequest("/api/users/reset-password", {
      password: "new-password",
      token: "valid-token",
    }))
    expect(response.status).toBe(200)
    expect(mocks.resetPassword).toHaveBeenCalledWith(expect.objectContaining({
      collection: "users",
      data: { password: "new-password", token: "valid-token" },
    }))
  })

  it("pins reset links to the configured super-admin origin and provides HTML and text copy", () => {
    const url = buildSuperAdminResetUrl("abc/123", {
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPER_ADMIN_DOMAIN: "example.nl",
    } as NodeJS.ProcessEnv)
    expect(url).toBe("https://admin.example.nl/reset-password/abc%2F123")
    const message = resetPasswordTemplate({ resetUrl: url })
    expect(message.html).toContain(url)
    expect(message.text).toContain(url)
    expect(message.html).toContain("één uur")
  })
})
