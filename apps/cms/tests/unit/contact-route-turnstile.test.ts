import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  hasUnvalidatedAuthSignal: vi.fn(),
  sendPlatformContactEmail: vi.fn(),
  verifyTurnstile: vi.fn(),
}))

vi.mock("payload", () => ({ getPayload: mocks.getPayload }))
vi.mock("@/access/authSignals", () => ({
  hasUnvalidatedAuthSignal: mocks.hasUnvalidatedAuthSignal,
}))
vi.mock("@/lib/contact/platformContact", () => ({
  sendPlatformContactEmail: mocks.sendPlatformContactEmail,
}))
vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile,
}))
vi.mock("@/payload.config", () => ({ default: {} }))

import { POST } from "@/app/(payload)/api/contact/route"

const contactRequest = () => {
  const body = new FormData()
  body.set("name", "Ada")
  body.set("email", "ada@example.com")
  body.set("message", "Kunnen we kennismaken?")
  body.set("cf-turnstile-response", "verified-token")
  return new NextRequest("https://siteinabox.nl/api/contact", {
    method: "POST",
    body,
  })
}

describe("platform contact Turnstile boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPayload.mockResolvedValue({
      auth: vi.fn().mockResolvedValue({ user: null }),
    })
    mocks.hasUnvalidatedAuthSignal.mockReturnValue(false)
    mocks.sendPlatformContactEmail.mockResolvedValue({ ok: true })
  })

  it("does not send mail when Turnstile rejects the request", async () => {
    mocks.verifyTurnstile.mockResolvedValue({
      ok: false,
      code: "turnstile_invalid",
      status: 400,
    })

    const response = await POST(contactRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "turnstile_invalid",
    })
    expect(mocks.sendPlatformContactEmail).not.toHaveBeenCalled()
  })

  it("sends mail only after a verified token", async () => {
    mocks.verifyTurnstile.mockResolvedValue({ ok: true })

    const response = await POST(contactRequest())

    expect(mocks.verifyTurnstile).toHaveBeenCalledWith({
      token: "verified-token",
    })
    expect(mocks.sendPlatformContactEmail).toHaveBeenCalledOnce()
    expect(response.status).toBe(202)
  })
})
