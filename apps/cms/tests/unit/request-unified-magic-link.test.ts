import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: new Headers({
    host: "admin.siteinabox.nl",
    "x-forwarded-host": "admin.siteinabox.nl",
    "x-forwarded-proto": "https",
  }),
  findUsers: vi.fn(),
  findTenant: vi.fn(),
  findAccounts: vi.fn(),
  findOrders: vi.fn(),
  cmsSignInMagicLink: vi.fn(),
  builderAction: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    findByID: mocks.findTenant,
    find: ({ collection }: { collection: string }) => {
      if (collection === "users") return mocks.findUsers()
      if (collection === "customer-accounts") return mocks.findAccounts()
      if (collection === "orders") return mocks.findOrders()
      throw new Error("Unexpected authentication fixture collection: " + collection)
    },
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

vi.mock("@/lib/builder/sendBuilderMagicLink", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/builder/sendBuilderMagicLink")>()
  return {
    ...actual,
    sendBuilderMagicLink: mocks.builderAction,
  }
})

describe("requestUnifiedMagicLinkAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_SUPER_ADMIN_DOMAIN", "siteinabox.nl")
    mocks.findTenant.mockResolvedValue({ id: 1, status: "active", enabledServices: ["website"] })
    mocks.findAccounts.mockResolvedValue({ totalDocs: 0, docs: [] })
    mocks.findOrders.mockResolvedValue({ totalDocs: 0, docs: [] })
    mocks.builderAction.mockResolvedValue({
      ok: true,
      message: "Als dit e-mailadres bij ons bekend is of net is geregistreerd, sturen we een inloglink.",
    })
    mocks.cmsSignInMagicLink.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("sends a tenant CMS magic link to the platform admin host without falling through to builder", async () => {
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
    expect(callHeaders.get("host")).toBe("admin.siteinabox.nl")
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

  it("keeps a free bound workspace on the builder login path", async () => {
    mocks.findUsers.mockResolvedValue({ totalDocs: 1, docs: [{ id: 9, email: "free@example.com", role: "owner", tenants: [{ tenant: 3 }] }] })
    mocks.findAccounts.mockResolvedValue({ totalDocs: 1, docs: [{ id: 10, tenant: 3 }] })
    const { requestUnifiedMagicLinkAction } = await import("@/lib/actions/requestUnifiedMagicLink")
    const form = new FormData()
    form.set("email", "free@example.com")
    form.set("intent", "login")
    await requestUnifiedMagicLinkAction({ ok: false, message: "" }, form)
    expect(mocks.cmsSignInMagicLink).not.toHaveBeenCalled()
    expect(mocks.builderAction).toHaveBeenCalledTimes(1)
  })
  it("lets an email-only team member sign in without website payment", async () => {
    mocks.findTenant.mockResolvedValue({ id: 1, status: "active", enabledServices: ["email"] })
    mocks.findUsers.mockResolvedValue({ totalDocs: 1, docs: [{ id: 7, email: "email-member@fixture.test", role: "editor", tenants: [{ tenant: { id: 1, status: "active" } }] }] })
    const { requestUnifiedMagicLinkAction } = await import("@/lib/actions/requestUnifiedMagicLink")
    const form = new FormData(); form.set("email", "email-member@fixture.test")
    await requestUnifiedMagicLinkAction({ ok: false, message: "" }, form)
    expect(mocks.cmsSignInMagicLink).toHaveBeenCalledTimes(1)
    expect(mocks.builderAction).not.toHaveBeenCalled()
  })

})
