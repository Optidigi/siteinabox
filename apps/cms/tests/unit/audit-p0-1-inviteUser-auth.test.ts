import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Audit finding #1 (P0, T2 primary / T1 secondary) — `inviteUser` server action
// is unauthenticated and uses `overrideAccess: true`, so any caller (and
// plausibly anonymous if the action ID leaks) can create users at arbitrary
// role + tenant. Fix: resolve caller via payload.auth({headers}); reject
// non-(super-admin|owner); for owner, require input.tenantId === ownTenant.
// Drop overrideAccess: true and pass `user: caller` so access rules run.

// Stub the payload config (real one fails fast on missing env vars).
vi.mock("@/payload.config", () => ({ default: {} }))

// Stub Next 15's dynamic headers() API — server action will call it.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "payload-token=fake" })
}))

// Mock the payload runtime. `getPayload` returns a fake instance whose
// auth/create/forgotPassword we control per test.
const fakePayload = {
  auth: vi.fn(),
  create: vi.fn(),
  forgotPassword: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
}
vi.mock("payload", async () => {
  const actual = await vi.importActual<any>("payload")
  return { ...actual, getPayload: vi.fn(async () => fakePayload) }
})

const mocks = vi.hoisted(() => ({
  signInMagicLink: vi.fn(),
}))
vi.mock("@/lib/betterAuth", () => ({
  auth: {
    api: {
      signInMagicLink: mocks.signInMagicLink,
    },
  },
}))

// Import AFTER the mocks above (vi.mock is hoisted, so this is safe).
import { inviteUser } from "@/lib/actions/inviteUser"

beforeEach(() => {
  fakePayload.auth.mockReset()
  fakePayload.create.mockReset()
  fakePayload.forgotPassword.mockReset()
  mocks.signInMagicLink.mockReset()
  fakePayload.create.mockResolvedValue({ id: 42 })
  fakePayload.forgotPassword.mockResolvedValue(undefined)
  mocks.signInMagicLink.mockResolvedValue({ ok: true })
})

describe("audit-p0 #1 — inviteUser server action must authenticate the caller", () => {
  it("rejects anonymous callers (no session)", async () => {
    fakePayload.auth.mockResolvedValue({ user: null })
    await expect(
      inviteUser({ email: "atk@x", name: "atk", role: "owner", tenantId: 1 })
    ).rejects.toThrow()
    expect(fakePayload.create).not.toHaveBeenCalled()
  })

  it("rejects editor callers (must be super-admin or owner to invite)", async () => {
    fakePayload.auth.mockResolvedValue({
      user: { id: 10, role: "editor", tenants: [{ tenant: { id: 1 } }] }
    })
    await expect(
      inviteUser({ email: "atk@x", name: "atk", role: "editor", tenantId: 1 })
    ).rejects.toThrow()
    expect(fakePayload.create).not.toHaveBeenCalled()
  })

  it("rejects viewer callers", async () => {
    fakePayload.auth.mockResolvedValue({
      user: { id: 11, role: "viewer", tenants: [{ tenant: { id: 1 } }] }
    })
    await expect(
      inviteUser({ email: "atk@x", name: "atk", role: "viewer", tenantId: 1 })
    ).rejects.toThrow()
    expect(fakePayload.create).not.toHaveBeenCalled()
  })

  it("rejects owner inviting into a tenant they don't own (cross-tenant takeover vector)", async () => {
    fakePayload.auth.mockResolvedValue({
      user: { id: 20, role: "owner", tenants: [{ tenant: { id: 1 } }] }
    })
    await expect(
      inviteUser({ email: "atk@x", name: "atk", role: "editor", tenantId: 999 })
    ).rejects.toThrow()
    expect(fakePayload.create).not.toHaveBeenCalled()
  })

  it("owner can invite into OWN tenant; payload.create is called with `user` and WITHOUT `overrideAccess: true`", async () => {
    const caller = { id: 20, role: "owner", tenants: [{ tenant: { id: 1 } }] }
    fakePayload.auth.mockResolvedValue({ user: caller })
    await inviteUser({ email: "new@x", name: "new", role: "editor", tenantId: 1 })
    expect(fakePayload.create).toHaveBeenCalledTimes(1)
    const args = fakePayload.create.mock.calls[0]![0]
    // The exact bug: previously this was `overrideAccess: true`, which let
    // unauth callers and editors create super-admins.
    expect(args.overrideAccess).not.toBe(true)
    // The caller MUST be passed through so Payload's collection-level + new
    // field-level access rules (audit #2/#3) apply.
    expect(args.user).toBe(caller)
  })

  it("super-admin can invite into any tenant", async () => {
    fakePayload.auth.mockResolvedValue({
      user: { id: 1, role: "super-admin", tenants: [] }
    })
    await inviteUser({ email: "n@x", name: "n", role: "editor", tenantId: 999 })
    expect(fakePayload.create).toHaveBeenCalledTimes(1)
  })

  it("sends a Better Auth magic link and does not call Payload forgotPassword for normal invite onboarding", async () => {
    fakePayload.auth.mockResolvedValue({
      user: { id: 1, role: "super-admin", tenants: [] }
    })

    await inviteUser({ email: "new@example.com", name: "New User", role: "editor", tenantId: 1 })

    expect(fakePayload.forgotPassword).not.toHaveBeenCalled()
    expect(mocks.signInMagicLink).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        email: "new@example.com",
        name: "New User",
        callbackURL: "/",
        errorCallbackURL: "/login",
      }),
      headers: expect.any(Headers),
    }))
  })

  it("owner with numeric-id tenant relationship (un-populated FK) still gates correctly", async () => {
    // Payload may return tenants[].tenant either as the populated tenant
    // object or as the bare id depending on depth. The auth gate must handle
    // both shapes — same pattern used in canManageUsers.
    const caller = { id: 20, role: "owner", tenants: [{ tenant: 1 }] }
    fakePayload.auth.mockResolvedValue({ user: caller })
    await inviteUser({ email: "n@x", name: "n", role: "editor", tenantId: 1 })
    expect(fakePayload.create).toHaveBeenCalledTimes(1)
  })

  it("OBS-6: invite UI requires re-entering the target email before sending", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/forms/UserInviteForm.tsx"),
      "utf8",
    )
    expect(src).toContain("confirmEmail")
    expect(src).toContain('t("validation.emailMatch")')
    expect(src).toContain('t("inviteDescription")')
  })
})
