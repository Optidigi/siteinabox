import { describe, it, expect, vi } from "vitest"

import { asPayload, matchesWhere, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockUpdateArgs, type MockWhere } from "../_helpers/mockPayload"
// FE-64 — server-side pagination for the Tenants (/sites) and Users
// (/users) admin lists. Mirrors the audit-p2 #13 mock-client pattern:
// listTenantsPaginated / listUsersPaginated are thin wrappers around
// payload.find, so we inject a fake client and assert the find args
// (where-clause, page, limit) they build.

vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("payload", async () => {
  const actual = await vi.importActual<typeof import("payload")>("payload")
  return { ...actual, getPayload: vi.fn(async () => ({ find: vi.fn() })) }
})

import { listTenantsPaginated } from "@/lib/queries/tenants"
import { listUsersPaginated } from "@/lib/queries/users"

const mockClient = () => {
  const calls: MockFindArgs[] = []
  const find = vi.fn(async (args: MockFindArgs) => {
    calls.push(args)
    return {
      docs: [],
      totalDocs: 0,
      totalPages: 1,
      page: args.page ?? 1,
      limit: args.limit ?? 50,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: null,
      prevPage: null,
    }
  })
  return { client: { find }, calls }
}

describe("FE-64 — listTenantsPaginated", () => {
  it("respects page + pageSize and targets the tenants collection", async () => {
    const { client, calls } = mockClient()
    await listTenantsPaginated({ page: 3, pageSize: 10 }, client)
    expect(calls[0]!.collection).toBe("tenants")
    expect(calls[0]!.page).toBe(3)
    expect(calls[0]!.limit).toBe(10)
  })

  it("q searches name + slug + domain", async () => {
    const { client, calls } = mockClient()
    await listTenantsPaginated({ q: "acme" }, client)
    expect(calls[0]!.where).toEqual({
      or: [
        { name: { like: "acme" } },
        { slug: { like: "acme" } },
        { domain: { like: "acme" } },
      ],
    })
  })

  it("blank / absent q leaves the where-clause empty (no match-all)", async () => {
    const { client, calls } = mockClient()
    await listTenantsPaginated({ page: 1 }, client)
    expect(calls[0]!.where).toEqual({})
    await listTenantsPaginated({ q: "   " }, client)
    expect(calls[1]!.where).toEqual({})
  })

  it("clamps an overlarge pageSize (no truncation footgun in reverse)", async () => {
    const { client, calls } = mockClient()
    await listTenantsPaginated({ pageSize: 99_999 }, client)
    expect(calls[0]!.limit).toBeLessThan(99_999)
  })
})

describe("FE-64 — listUsersPaginated", () => {
  it("all-users mode: no tenant scope, targets the users collection", async () => {
    const { client, calls } = mockClient()
    await listUsersPaginated({ page: 2, pageSize: 10 }, client)
    expect(calls[0]!.collection).toBe("users")
    expect(calls[0]!.where).toEqual({})
    expect(calls[0]!.page).toBe(2)
  })

  it("tenant mode: scopes to tenants.tenant", async () => {
    const { client, calls } = mockClient()
    await listUsersPaginated({ tenantId: 7 }, client)
    expect(calls[0]!.where).toEqual({ "tenants.tenant": { equals: 7 } })
  })

  it("q searches name + email, stacking with the tenant scope", async () => {
    const { client, calls } = mockClient()
    await listUsersPaginated({ tenantId: 7, q: "jane" }, client)
    expect(calls[0]!.where).toEqual({
      "tenants.tenant": { equals: 7 },
      or: [{ name: { like: "jane" } }, { email: { like: "jane" } }],
    })
  })

  it("blank q adds no or-clause", async () => {
    const { client, calls } = mockClient()
    await listUsersPaginated({ q: "  " }, client)
    expect(calls[0]!.where).toEqual({})
  })
})
