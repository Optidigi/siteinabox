import { describe, it, expect, vi, beforeEach } from "vitest"
import { Users } from "@/collections/Users"

// OBS-9 — `Users.access.create` belt-and-braces tenant-membership check on
// the owner-invite path. Pre-fix, the collection-level gate returned `true`
// for any owner caller; cross-tenant guard relied solely on the field-level
// `canCreateUserField` stripping `tenants` from wrong-tenant creates and
// `validateTenants` then rejecting the empty result. Single chain — if
// either is weakened, the cross-tenant invite succeeds silently.
//
// The fix mirrors OBS-67's canWrite pattern: the collection gate now
// independently verifies that every entry in `data.tenants[].tenant`
// matches the caller's own tenant id. When `tenants` is missing/empty we
// defer to validateTenants (that's a "tenant required" error class, not
// the cross-tenant-injection concern).

// We test the actual access function attached to Users.access.create, not
// a copy — so a future refactor that swaps the function still goes through
// these cases.
const createAccess = (Users.access as Record<string, unknown>).create as (args: {
  req: unknown
  data?: unknown
}) => boolean | Promise<boolean>

// Fake `req.payload.count` for the bootstrap path. Each test that touches
// the anonymous branch sets the totalDocs return.
const fakeCount = vi.fn()
beforeEach(() => {
  fakeCount.mockReset()
  fakeCount.mockResolvedValue({ totalDocs: 0 })
})

const makeReq = (role: string | undefined, tenants: unknown[] = [], extras: Record<string, unknown> = {}) => ({
  user: role === undefined ? null : { id: 1, role, tenants },
  payload: { count: fakeCount },
  headers: new Headers(),
  ...extras,
})

describe("Users.access.create — OBS-9 tenant-membership enforcement", () => {
  describe("super-admin pass-through", () => {
    it("super-admin can create users with any role and any tenant", async () => {
      const result = await createAccess({
        req: makeReq("super-admin", []),
        data: { role: "editor", tenants: [{ tenant: 99 }], email: "x@example.com" },
      })
      expect(result).toBe(true)
    })

    it("super-admin creating another super-admin (no tenants required) is allowed", async () => {
      const result = await createAccess({
        req: makeReq("super-admin", []),
        data: { role: "super-admin", tenants: [], email: "x@example.com" },
      })
      expect(result).toBe(true)
    })
  })

  describe("owner same-tenant invite (the legitimate path)", () => {
    it("owner in t1 can invite editor into t1", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "editor", tenants: [{ tenant: 1 }] },
      })
      expect(result).toBe(true)
    })

    it("owner in t1 can invite viewer into t1", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "viewer", tenants: [{ tenant: 1 }] },
      })
      expect(result).toBe(true)
    })
  })

  describe("owner cross-tenant invite — REJECTED (OBS-9 core)", () => {
    it("owner in t1 cannot invite into t2", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "editor", tenants: [{ tenant: 2 }] },
      })
      expect(result).toBe(false)
    })

    it("owner cannot smuggle their tenant + a foreign tenant in one payload", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "editor", tenants: [{ tenant: 1 }, { tenant: 2 }] },
      })
      expect(result).toBe(false)
    })

    it("owner with no tenants on their own user cannot create cross-tenant", async () => {
      // Defensive: if the JWT somehow lacks tenants[], owner can't claim
      // any tenant. (validateTenants ought to prevent this state from
      // existing in the first place; the gate is belt-and-braces.)
      const result = await createAccess({
        req: makeReq("owner", []),
        data: { role: "editor", tenants: [{ tenant: 1 }] },
      })
      expect(result).toBe(false)
    })

    it("rejects when the tenants entry has a null tenant id (malformed payload)", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "editor", tenants: [{ tenant: null }] },
      })
      expect(result).toBe(false)
    })
  })

  describe("owner with missing/empty tenants — defer to validateTenants", () => {
    it("owner submits no tenants[] — allows access; validateTenants will catch", async () => {
      // Not the gate for "tenants is required". canCreateUserField + the
      // validateTenants field-level invariant produce a typed error path;
      // we don't preempt that with a generic 403.
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "editor", email: "x@example.com" },
      })
      expect(result).toBe(true)
    })

    it("owner submits empty tenants[] — allows access; validateTenants will catch", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "editor", tenants: [] },
      })
      expect(result).toBe(true)
    })

    it("owner submits null tenants — allows access; validateTenants will catch", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "editor", tenants: null },
      })
      expect(result).toBe(true)
    })
  })

  describe("tenant id-shape robustness", () => {
    it("populated object form on user.tenants ({tenant: {id: 1}}) matches scalar in data", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: { id: 1, slug: "t1" } }]),
        data: { role: "editor", tenants: [{ tenant: 1 }] },
      })
      expect(result).toBe(true)
    })

    it("populated object form on data.tenants[].tenant matches scalar on user", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "editor", tenants: [{ tenant: { id: 1, slug: "t1" } }] },
      })
      expect(result).toBe(true)
    })

    it("string vs number ids compare correctly", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: 1 }]),
        data: { role: "editor", tenants: [{ tenant: "1" }] },
      })
      expect(result).toBe(true)
    })

    it("populated on both sides, matching ids", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: { id: 7 } }]),
        data: { role: "editor", tenants: [{ tenant: { id: 7 } }] },
      })
      expect(result).toBe(true)
    })

    it("populated on both sides, mismatched ids", async () => {
      const result = await createAccess({
        req: makeReq("owner", [{ tenant: { id: 7 } }]),
        data: { role: "editor", tenants: [{ tenant: { id: 8 } }] },
      })
      expect(result).toBe(false)
    })
  })

  describe("non-owner, non-super-admin authed callers", () => {
    it("editor cannot create users", async () => {
      const result = await createAccess({
        req: makeReq("editor", [{ tenant: 1 }]),
        data: { role: "editor", tenants: [{ tenant: 1 }] },
      })
      expect(result).toBe(false)
    })

    it("viewer cannot create users", async () => {
      const result = await createAccess({
        req: makeReq("viewer", [{ tenant: 1 }]),
        data: { role: "editor", tenants: [{ tenant: 1 }] },
      })
      expect(result).toBe(false)
    })
  })

  describe("anonymous bootstrap path (audit-p1 #6) — unchanged", () => {
    it("anonymous with valid bootstrap token + super-admin role + empty users table → allow", async () => {
      const TOKEN = "test-token-12345678901234567890"
      const prev = process.env.BOOTSTRAP_TOKEN
      process.env.BOOTSTRAP_TOKEN = TOKEN
      try {
        fakeCount.mockResolvedValue({ totalDocs: 0 })
        const req = makeReq(undefined, [], {
          headers: new Headers({ "x-bootstrap-token": TOKEN }),
        })
        const result = await createAccess({
          req,
          data: { role: "super-admin", email: "seed@test.local" },
        })
        expect(result).toBe(true)
      } finally {
        if (prev === undefined) delete process.env.BOOTSTRAP_TOKEN
        else process.env.BOOTSTRAP_TOKEN = prev
      }
    })

    it("anonymous without bootstrap token → deny", async () => {
      const result = await createAccess({
        req: makeReq(undefined),
        data: { role: "super-admin", email: "x@y.test" },
      })
      expect(result).toBe(false)
    })
  })
})
