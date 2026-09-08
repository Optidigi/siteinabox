import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: new Headers({
    host: "admin.siteinabox.nl",
    "x-forwarded-host": "admin.siteinabox.nl",
    "x-forwarded-proto": "https",
  }),
  findUsers: vi.fn(),
  cmsSignInMagicLink: vi.fn(),
  builderAction: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    find: mocks.findUsers,
  })),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/betterAuth", () => ({
  auth: {
    api: {
      signInMagicLink: mocks.cmsSignInMagicLink,
    },
  },
}))

vi.mock("@/lib/actions/requestBuilderMagicLink", () => ({
  BUILDER_MAGIC_LINK_GENERIC_SUCCESS:
    "Als dit e-mailadres bij ons bekend is of net is geregistreerd, sturen we een inloglink.",
  requestBuilderMagicLinkAction: mocks.builderAction,
}))

describe("requestUnifiedMagicLinkAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.builderAction.mockResolvedValue({
      ok: true,
      message: "Als dit e-mailadres bij ons bekend is of net is geregistreerd, sturen we een inloglink.",
    })
    mocks.cmsSignInMagicLink.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("sends a tenant CMS magic link to admin.<domain> without falling through to builder", async () => {
    mocks.findUsers.mockResolvedValue({
      totalDocs: 1,
      docs: [{
        id: 9,
        email: "owner@ami-care.nl",
        role: "owner",
        tenants: [{ tenant: { id: 3, domain: "ami-care.nl", status: "active" } }],
      }],
    })
    const { requestUnifiedMagicLinkAction } = await import("@/lib/actions/requestUnifiedMagicLink")
    const form = new FormData()
    form.set("email", "owner@ami-care.nl")
    form.set("intent", "login")

    const result = await requestUnifiedMagicLinkAction({ ok: false, message: "" }, form)

    expect(result.ok).toBe(true)
    expect(mocks.cmsSignInMagicLink).toHaveBeenCalledTimes(1)
    const callHeaders = mocks.cmsSignInMagicLink.mock.calls[0]![0].headers as Headers
    expect(callHeaders.get("host")).toBe("admin.ami-care.nl")
    expect(mocks.builderAction).not.toHaveBeenCalled()
  })

  it("falls through to builder registration when the address is not a CMS user", async () => {
    mocks.findUsers.mockResolvedValue({ totalDocs: 0, docs: [] })
    const { requestUnifiedMagicLinkAction } = await import("@/lib/actions/requestUnifiedMagicLink")
    const form = new FormData()
    form.set("email", "new@example.com")
    form.set("intent", "login")

    await requestUnifiedMagicLinkAction({ ok: false, message: "" }, form)

    expect(mocks.cmsSignInMagicLink).not.toHaveBeenCalled()
    expect(mocks.builderAction).toHaveBeenCalled()
  })
})
