import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  signInMagicLink: vi.fn(),
  headers: new Headers({
    host: "preview.siteinabox.nl",
    "x-forwarded-proto": "https",
  }),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("@/lib/preview/betterAuth", () => ({
  previewAuth: {
    api: {
      signInMagicLink: mocks.signInMagicLink,
    },
  },
}))

describe("requestPreviewMagicLinkAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("sends a preview magic-link request without exposing grant existence", async () => {
    mocks.signInMagicLink.mockResolvedValue({ ok: true })
    const { requestPreviewMagicLinkAction } = await import("@/lib/actions/requestPreviewMagicLink")
    const form = new FormData()
    form.set("email", "Customer@Example.com")

    const result = await requestPreviewMagicLinkAction("reserved-domain", "/reserved-domain", { ok: false, message: "" }, form)

    expect(result).toEqual({
      ok: true,
      message: "If this email has preview access, you will receive a magic link.",
    })
    expect(mocks.signInMagicLink).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        email: "customer@example.com",
        callbackURL: "/reserved-domain",
        metadata: { previewClientSlug: "reserved-domain" },
      }),
    }))
  })

  it("returns the same public response when no matching grant exists", async () => {
    mocks.signInMagicLink.mockRejectedValue(new Error("No active preview access grant matches this email."))
    const { requestPreviewMagicLinkAction } = await import("@/lib/actions/requestPreviewMagicLink")
    const form = new FormData()
    form.set("email", "wrong@example.com")

    const result = await requestPreviewMagicLinkAction("reserved-domain", "/reserved-domain", { ok: false, message: "" }, form)

    expect(result).toEqual({
      ok: true,
      message: "If this email has preview access, you will receive a magic link.",
    })
  })
})
