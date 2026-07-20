import { describe, it, expect } from "vitest"
import type { User } from "@/payload-types"
import { canWrite } from "@/access/roleHelpers"

import { cast } from "../_helpers/cast"
import { accessArgs } from "../_helpers/accessArgs"

// OBS-67 — `canWrite` is the access function applied to create/update/delete
// on Pages, Media, Forms (update only), and BlockPresets. Pre-fix it gated
// only on role, returning `true` for any super-admin/owner/editor — which
// let an editor in tenant T1 `POST /api/pages` with `{ tenant: T2_id, ... }`
// and pollute T2's content because the multi-tenant plugin's withTenantAccess
// wrapper doesn't gate creates against incoming `data.tenant`. This test pins
// the role × target-tenant matrix so the regression can't recur silently.

const callCanWrite = (args: {
  role: string | undefined
  tenants?: Array<{ tenant: number | string | { id: number | string } | null }>
  data?: unknown
  id?: string | number
}) => {
  const user = args.role === undefined
    ? null
    : cast<User>({ id: 1, role: args.role, tenants: args.tenants ?? [], updatedAt: "", createdAt: "", email: "test@test.local" })
  return canWrite(accessArgs({
    req: { user },
    data: args.data,
    id: typeof args.id === "string" ? Number(args.id) : args.id,
  }))
}

describe("canWrite — OBS-67 tenant-membership enforcement", () => {
  describe("authentication & role gate", () => {
    it("rejects unauthenticated callers", () => {
      expect(callCanWrite({ role: undefined, data: { tenant: 1 } })).toBe(false)
    })

    it("rejects viewer (read-only by invariant)", () => {
      expect(callCanWrite({ role: "viewer", tenants: [{ tenant: 1 }], data: { tenant: 1 } })).toBe(false)
    })

    it("rejects unknown roles", () => {
      expect(callCanWrite({ role: "guest", data: { tenant: 1 } })).toBe(false)
    })
  })

  describe("super-admin pass-through", () => {
    it("allows super-admin to write to any tenant", () => {
      expect(callCanWrite({ role: "super-admin", data: { tenant: 99 } })).toBe(true)
    })

    it("allows super-admin even with empty tenants array", () => {
      // super-admin invariant: tenants = []
      expect(callCanWrite({ role: "super-admin", tenants: [], data: { tenant: 99 } })).toBe(true)
    })
  })

  describe("owner/editor — same-tenant writes allowed", () => {
    it("editor in t1 can create in t1 (same tenant)", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }], data: { tenant: 1 } })).toBe(true)
    })

    it("owner in t1 can create in t1", () => {
      expect(callCanWrite({ role: "owner", tenants: [{ tenant: 1 }], data: { tenant: 1 } })).toBe(true)
    })

    it("editor in t1 can update with no tenant in data (no relationship change)", () => {
      // The multi-tenant plugin's read-scoping restricts which docs the editor
      // can load for update — if `data.tenant` is absent, we defer to that.
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }], data: { title: "Renamed" } })).toBe(true)
    })

    it("editor in t1 can delete (data undefined; multi-tenant plugin gates which docs are fetchable)", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }], data: undefined })).toBe(true)
    })
  })

  describe("owner/editor — cross-tenant writes REJECTED (OBS-67 core)", () => {
    it("editor in t1 cannot create in t2", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }], data: { tenant: 2 } })).toBe(false)
    })

    it("owner in t1 cannot create in t2", () => {
      expect(callCanWrite({ role: "owner", tenants: [{ tenant: 1 }], data: { tenant: 2 } })).toBe(false)
    })

    it("editor in t1 cannot move a doc to t2 via update (data carries tenant change)", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }], data: { tenant: 2, title: "moved" }, id: 5 })).toBe(false)
    })
  })

  describe("tenant id-shape robustness", () => {
    it("string vs number ids compare correctly (data.tenant: '1', user tenant: 1 → allow)", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }], data: { tenant: "1" } })).toBe(true)
    })

    it("populated object form on data.tenant ({id: 1}, user tenant: 1 → allow)", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }], data: { tenant: { id: 1, slug: "t1" } } })).toBe(true)
    })

    it("populated object form on user.tenants ({tenant: {id: 1}}, data.tenant: 1 → allow)", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: { id: 1 } }], data: { tenant: 1 } })).toBe(true)
    })

    it("populated on both sides, matching ids → allow", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: { id: 7 } }], data: { tenant: { id: 7 } } })).toBe(true)
    })

    it("populated on both sides, mismatched ids → deny", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: { id: 7 } }], data: { tenant: { id: 8 } } })).toBe(false)
    })
  })

  describe("edge cases — null/undefined safety", () => {
    it("user with no tenants array can still update with no tenant in data (super-admin path or programmatic)", () => {
      expect(callCanWrite({ role: "editor", tenants: [], data: { title: "x" } })).toBe(true)
    })

    it("user with no tenants array but data carries a tenant → deny", () => {
      expect(callCanWrite({ role: "editor", tenants: [], data: { tenant: 1 } })).toBe(false)
    })

    it("data.tenant is null → not an isolation concern, allow if role passes", () => {
      // null indicates 'clear the relationship' (rare; plugin probably rejects
      // upstream). canWrite treats null as 'no tenant target', defers.
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }], data: { tenant: null } })).toBe(true)
    })

    it("data has tenant key but value is undefined → defer to plugin", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }], data: { tenant: undefined, title: "x" } })).toBe(true)
    })
  })

  describe("multi-tenant users (super-admin invariant aside)", () => {
    // The codebase invariant says non-super-admin has exactly one tenant
    // (validateTenants enforces). Test multi-tenant defensively in case the
    // invariant ever relaxes — canWrite should accept any of the user's tenants.
    it("hypothetical multi-tenant editor allowed in any owned tenant", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }, { tenant: 2 }], data: { tenant: 2 } })).toBe(true)
    })

    it("hypothetical multi-tenant editor denied in unowned tenant", () => {
      expect(callCanWrite({ role: "editor", tenants: [{ tenant: 1 }, { tenant: 2 }], data: { tenant: 3 } })).toBe(false)
    })
  })
})
