import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  payload: {
    auth: vi.fn(),
  },
  signInMagicLink: vi.fn(),
  createOrRefreshPreviewGrant: vi.fn(),
  headers: new Headers({
    host: "admin.siteinabox.nl",
    "x-forwarded-proto": "https",
  }),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/preview/betterAuth", () => ({
  previewAuth: {
    api: {
      signInMagicLink: mocks.signInMagicLink,
    },
  },
}))

vi.mock("@/lib/preview/previewAccess", () => ({
  createOrRefreshPreviewGrant: mocks.createOrRefreshPreviewGrant,
}))

describe("sendPreviewAccessAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin" } })
    mocks.createOrRefreshPreviewGrant.mockResolvedValue({
      id: 900,
      customerEmail: "customer@example.com",
      clientSlug: "preview-studio",
    })
    mocks.signInMagicLink.mockResolvedValue({ ok: true })
  })

  it("creates a grant and sends a preview-host magic link through preview auth", async () => {
    const { sendPreviewAccessAction } = await import("@/lib/actions/previewAccess")

    const formData = new FormData()
    formData.set("email", "Customer@Example.com")
    const result = await sendPreviewAccessAction(500, { ok: false, message: "" }, formData)

    expect(result).toEqual({
      ok: true,
      previewUrl: "https://preview.siteinabox.nl/preview-studio",
      message: "Preview magic link sent.",
    })
    expect(mocks.createOrRefreshPreviewGrant).toHaveBeenCalledWith({
      generationRunId: 500,
      customerEmail: "customer@example.com",
      sendEmail: true,
    })
    expect(mocks.signInMagicLink).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        email: "customer@example.com",
        callbackURL: "https://preview.siteinabox.nl/preview-studio",
        metadata: {
          previewClientSlug: "preview-studio",
          previewSiteReady: true,
        },
      }),
      headers: expect.any(Headers),
    }))
    const callHeaders = mocks.signInMagicLink.mock.calls[0]?.[0]?.headers as Headers
    expect(callHeaders.get("host")).toBe("preview.siteinabox.nl")
    expect(callHeaders.get("x-forwarded-host")).toBe("preview.siteinabox.nl")
  })

  it("blocks non-super-admin operators before creating a grant", async () => {
    mocks.payload.auth.mockResolvedValue({ user: { id: 2, role: "owner" } })
    const { sendPreviewAccessAction } = await import("@/lib/actions/previewAccess")

    const formData = new FormData()
    formData.set("email", "customer@example.com")
    const result = await sendPreviewAccessAction(500, { ok: false, message: "" }, formData)

    expect(result.ok).toBe(false)
    expect(result.message).toContain("Only super-admins")
    expect(mocks.createOrRefreshPreviewGrant).not.toHaveBeenCalled()
    expect(mocks.signInMagicLink).not.toHaveBeenCalled()
  })
})
