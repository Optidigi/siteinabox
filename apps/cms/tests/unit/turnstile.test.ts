import { describe, expect, it, vi } from "vitest"

import { verifyTurnstile } from "@/lib/security/turnstile"

const SECRET = "test-secret"
const TOKEN = "test-token"

describe("Turnstile verification", () => {
  it("accepts a successful response for the expected action and hostname", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      hostname: "www.siteinabox.nl",
      action: "platform-contact",
    }), { status: 200 }))

    await expect(verifyTurnstile({
      token: TOKEN,
      secret: SECRET,
      remoteIp: "203.0.113.10",
      fetchImpl,
      idempotencyKey: "request-id",
    })).resolves.toEqual({ ok: true })

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [, request] = fetchImpl.mock.calls[0] ?? []
    expect(request?.method).toBe("POST")
    expect(request?.body).toBeInstanceOf(URLSearchParams)
    const body = request?.body as URLSearchParams
    expect(body.get("secret")).toBe(SECRET)
    expect(body.get("response")).toBe(TOKEN)
    expect(body.get("remoteip")).toBe("203.0.113.10")
    expect(body.get("idempotency_key")).toBe("request-id")
  })

  it.each([
    {
      success: false,
      "error-codes": ["invalid-input-response"],
      hostname: "siteinabox.nl",
      action: "platform-contact",
    },
    { success: true, hostname: "attacker.example", action: "platform-contact" },
    { success: true, hostname: "siteinabox.nl", action: "another-action" },
  ])("rejects invalid provider results", async (providerResult) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(providerResult), { status: 200 }),
    )
    await expect(verifyTurnstile({
      token: TOKEN,
      secret: SECRET,
      fetchImpl,
    })).resolves.toEqual({
      ok: false,
      code: "turnstile_invalid",
      status: 400,
    })
  })

  it.each([
    ["invalid-input-secret"],
    ["internal-error"],
    ["unknown-provider-error"],
    [undefined],
  ])("treats provider or configuration errors as unavailable", async (errorCodes) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      "error-codes": errorCodes,
    }), { status: 200 }))
    await expect(verifyTurnstile({
      token: TOKEN,
      secret: SECRET,
      fetchImpl,
    })).resolves.toEqual({
      ok: false,
      code: "turnstile_unavailable",
      status: 503,
    })
  })

  it.each([undefined, "", "x".repeat(2049)])("rejects missing or oversized tokens", async (token) => {
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(verifyTurnstile({
      token,
      secret: SECRET,
      fetchImpl,
    })).resolves.toEqual({
      ok: false,
      code: "turnstile_invalid",
      status: 400,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("fails closed when the secret is absent", async () => {
    await expect(verifyTurnstile({
      token: TOKEN,
      secret: "",
    })).resolves.toEqual({
      ok: false,
      code: "turnstile_unavailable",
      status: 503,
    })
  })

  it.each([
    vi.fn<typeof fetch>().mockRejectedValue(new Error("network")),
    vi.fn<typeof fetch>().mockResolvedValue(new Response("upstream failure", { status: 502 })),
    vi.fn<typeof fetch>().mockResolvedValue(new Response("not json", { status: 200 })),
  ])("fails closed when Siteverify is unavailable", async (fetchImpl) => {
    await expect(verifyTurnstile({
      token: TOKEN,
      secret: SECRET,
      fetchImpl,
    })).resolves.toEqual({
      ok: false,
      code: "turnstile_unavailable",
      status: 503,
    })
  })
})
