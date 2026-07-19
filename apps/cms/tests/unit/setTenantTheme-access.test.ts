import { describe, it, expect, vi, beforeEach } from "vitest"
import { cast } from "../_helpers/cast"

// OBS-64 — setTenantTheme is the authorization boundary for tenant theme writes.
// Tenants.access.update remains isSuperAdmin (collection-level access is a
// hard gate in Payload v3 — field-level update access does not exist), so the
// role + tenant-membership check happens here and the inner payload.update
// runs with overrideAccess: true.
//
// Role matrix:
//   super-admin → any tenant      → allow
//   owner       → own tenant      → allow
//   editor      → own tenant      → allow
//   owner|editor → cross-tenant   → deny  (cross-tenant guard)
//   viewer      → own tenant      → deny  (viewer is read-only by invariant)
//   unauthenticated               → deny

vi.mock("@/payload.config", () => ({ default: {} }))

const fakeAuth = vi.fn()
const fakeUpdate = vi.fn()
vi.mock("payload", async () => {
  const actual = await vi.importActual<typeof import("payload")>("payload")
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ auth: fakeAuth, update: fakeUpdate })),
  }
})

// next/headers stub — the action passes whatever headers() returns straight
// to payload.auth, which we've mocked, so the content doesn't matter.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}))

import { setTenantTheme } from "@/lib/actions/setTenantTheme"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"

beforeEach(() => {
  fakeAuth.mockReset()
  fakeUpdate.mockReset()
  fakeUpdate.mockResolvedValue({ id: 1 })
})

const userOf = (role: string, tenants: Array<{ tenant: number | string | { id: number | string } }> = []) =>
  fakeAuth.mockResolvedValueOnce({ user: { id: 1, role, tenants } })

const minimalTheme = DEFAULT_THEME_TOKEN_SPEC

describe("setTenantTheme — OBS-64 authorization boundary", () => {
  it("super-admin can update any tenant's theme", async () => {
    userOf("super-admin", [])
    await setTenantTheme(42, minimalTheme)
    expect(fakeUpdate).toHaveBeenCalledTimes(1)
    const args = fakeUpdate.mock.calls[0]![0]
    expect(args.collection).toBe("tenants")
    expect(args.id).toBe(42)
    expect(args.overrideAccess).toBe(true)
    expect(args.data.theme).toEqual(minimalTheme)
  })

  it("owner can update their own tenant's theme", async () => {
    userOf("owner", [{ tenant: 42 }])
    await setTenantTheme(42, minimalTheme)
    expect(fakeUpdate).toHaveBeenCalledTimes(1)
  })

  it("editor can update their own tenant's theme", async () => {
    userOf("editor", [{ tenant: 42 }])
    await setTenantTheme(42, minimalTheme)
    expect(fakeUpdate).toHaveBeenCalledTimes(1)
  })

  it("owner cannot update another tenant's theme (cross-tenant guard)", async () => {
    userOf("owner", [{ tenant: 99 }])
    await expect(setTenantTheme(42, minimalTheme)).rejects.toThrow(/not authorized/i)
    expect(fakeUpdate).not.toHaveBeenCalled()
  })

  it("editor cannot update another tenant's theme (cross-tenant guard)", async () => {
    userOf("editor", [{ tenant: 99 }])
    await expect(setTenantTheme(42, minimalTheme)).rejects.toThrow(/not authorized/i)
    expect(fakeUpdate).not.toHaveBeenCalled()
  })

  it("viewer cannot update theme even on their own tenant (viewer is read-only)", async () => {
    userOf("viewer", [{ tenant: 42 }])
    await expect(setTenantTheme(42, minimalTheme)).rejects.toThrow(/not authorized/i)
    expect(fakeUpdate).not.toHaveBeenCalled()
  })

  it("unauthenticated callers are rejected before the role check", async () => {
    fakeAuth.mockResolvedValueOnce({ user: null })
    await expect(setTenantTheme(42, minimalTheme)).rejects.toThrow(/authentication required/i)
    expect(fakeUpdate).not.toHaveBeenCalled()
  })

  it("invalid theme is rejected before auth runs", async () => {
    await expect(setTenantTheme(42, cast<typeof DEFAULT_THEME_TOKEN_SPEC>({ ...DEFAULT_THEME_TOKEN_SPEC, colors: { schemeId: "not-a-scheme" } }))).rejects.toThrow(/Invalid theme data/i)
    expect(fakeAuth).not.toHaveBeenCalled()
    expect(fakeUpdate).not.toHaveBeenCalled()
  })

  it("tenant id-shape robustness: populated-object form { tenant: { id: 42 } } is normalised", async () => {
    // Payload's data-loader can populate the relationship to an object form on
    // the JWT user. The check must String()-compare both shapes.
    userOf("editor", [{ tenant: { id: 42 } }])
    await setTenantTheme(42, minimalTheme)
    expect(fakeUpdate).toHaveBeenCalledTimes(1)
  })

  it("string vs number tenant id: setTenantTheme('42', ...) with user.tenants:[{tenant:42}] still authorizes", async () => {
    userOf("editor", [{ tenant: 42 }])
    await setTenantTheme("42", minimalTheme)
    expect(fakeUpdate).toHaveBeenCalledTimes(1)
    expect(fakeUpdate.mock.calls[0]![0].id).toBe("42")
  })

  it("invariant: the inner payload.update uses overrideAccess: true (the auth boundary lives in this action)", async () => {
    // If a future refactor switched back to overrideAccess: false + user, the
    // collection-level isSuperAdmin gate would re-deny tenant members and
    // OBS-64 would silently regress. This test pins the pattern.
    userOf("editor", [{ tenant: 42 }])
    await setTenantTheme(42, minimalTheme)
    expect(fakeUpdate.mock.calls[0]![0].overrideAccess).toBe(true)
    expect(fakeUpdate.mock.calls[0]![0].user).toBeUndefined()
  })
})
