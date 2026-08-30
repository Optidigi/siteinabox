import { describe, it, expect, vi, beforeEach } from "vitest"

// OBS-20 — updateNav persists a tenant's navbar + footer navigation.
// Authorization is delegated to Payload (SiteSettings.access.update =
// canUpdateSettings + the multi-tenant plugin's update scoping) by calling
// payload.update with `overrideAccess: false, user`. The action's own job is
// to (a) require an authenticated caller, (b) zod-shape-check the lists, and
// (c) resolve the tenant's settings row.

vi.mock("@/payload.config", () => ({ default: {} }))

const fakeAuth = vi.fn()
const fakeFind = vi.fn()
const fakeUpdate = vi.fn()
vi.mock("payload", async () => {
  const actual = await vi.importActual<typeof import("payload")>("payload")
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ auth: fakeAuth, find: fakeFind, update: fakeUpdate })),
  }
})
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))

import { updateNav } from "@/lib/actions/updateNav"

beforeEach(() => {
  fakeAuth.mockReset()
  fakeFind.mockReset()
  fakeUpdate.mockReset()
  fakeUpdate.mockResolvedValue({ id: 10 })
})

const validNav = {
  primary: [
    { type: "page", page: 1, label: null },
    { type: "section", page: 1, anchor: "werkwijze", label: "Werkwijze" },
    { type: "custom", url: "https://x.com", label: "Ext", external: true },
  ],
  footer: [{ type: "custom", url: "/privacy", label: "Privacy", external: false }],
}

describe("updateNav", () => {
  it("persists both nav lists for an authorised caller", async () => {
    fakeAuth.mockResolvedValueOnce({ user: { id: 1, role: "owner" } })
    fakeFind.mockResolvedValueOnce({ docs: [{ id: 10 }], totalDocs: 1 })

    await updateNav(7, validNav)

    expect(fakeUpdate).toHaveBeenCalledTimes(1)
    const args = fakeUpdate.mock.calls[0]![0]
    expect(args.collection).toBe("site-settings")
    expect(args.id).toBe(10)
    expect(args.overrideAccess).toBe(false)
    expect(args.user).toEqual({ id: 1, role: "owner" })
    expect(args.data.navigation.primary).toHaveLength(3)
    expect(args.data.navigation.footer).toHaveLength(1)
  })

  it("resolves the settings row scoped to the caller (find runs with user, overrideAccess false)", async () => {
    fakeAuth.mockResolvedValueOnce({ user: { id: 1, role: "owner" } })
    fakeFind.mockResolvedValueOnce({ docs: [{ id: 10 }], totalDocs: 1 })

    await updateNav(7, validNav)

    const findArgs = fakeFind.mock.calls[0]![0]
    expect(findArgs.collection).toBe("site-settings")
    expect(findArgs.overrideAccess).toBe(false)
    expect(findArgs.user).toEqual({ id: 1, role: "owner" })
    expect(JSON.stringify(findArgs.where)).toContain("7")
  })

  it("rejects an unauthenticated caller before any DB work", async () => {
    fakeAuth.mockResolvedValueOnce({ user: null })
    await expect(updateNav(7, validNav)).rejects.toThrow(/authentication required/i)
    expect(fakeFind).not.toHaveBeenCalled()
    expect(fakeUpdate).not.toHaveBeenCalled()
  })

  it("rejects when no settings row is accessible for the tenant", async () => {
    fakeAuth.mockResolvedValueOnce({ user: { id: 1, role: "owner" } })
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    await expect(updateNav(7, validNav)).rejects.toThrow(/no site settings accessible/i)
    expect(fakeUpdate).not.toHaveBeenCalled()
  })

  it("rejects a malformed navbar navigation before auth runs", async () => {
    await expect(
      updateNav(7, { primary: [{ type: "banana" }], footer: [] }),
    ).rejects.toThrow(/Invalid navbar navigation/i)
    expect(fakeAuth).not.toHaveBeenCalled()
  })

  it("rejects a malformed navFooter", async () => {
    await expect(
      updateNav(7, { primary: [], footer: "not-an-array" }),
    ).rejects.toThrow(/Invalid footer navigation/i)
    expect(fakeAuth).not.toHaveBeenCalled()
  })

  it("accepts empty nav lists (clearing the menus)", async () => {
    fakeAuth.mockResolvedValueOnce({ user: { id: 1, role: "super-admin" } })
    fakeFind.mockResolvedValueOnce({ docs: [{ id: 10 }], totalDocs: 1 })
    await updateNav(7, { primary: [], footer: [] })
    expect(fakeUpdate.mock.calls[0]![0].data).toEqual({ navigation: { primary: [], footer: [] } })
  })
})
