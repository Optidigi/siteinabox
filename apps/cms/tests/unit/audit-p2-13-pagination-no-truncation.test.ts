import { describe, it, expect, vi } from "vitest"

import { createFindClient } from "../_helpers/payloadFindClient"
import type { Page } from "@/payload-types"
import type { PayloadFindArgs } from "@/lib/queries/paginate"
// Stub the real payload config (it fail-fast-throws on missing env
// vars). Same pattern as audit-p0-1-inviteUser-auth.test.ts.
vi.mock("@/payload.config", () => ({ default: {} }))
// `getPayload` is unused in this test (we inject a fake client into
// each *Paginated function) but is statically imported by pages.ts /
// media.ts / forms.ts. Stub it so no module-load-time side effects fire.
vi.mock("payload", async () => {
  const actual = (await vi.importActual<typeof import("payload")>("payload"))
  return { ...actual, getPayload: vi.fn(async () => ({ find: vi.fn() })) }
})

import { findAllPaginated, DEFAULT_PAGE_SIZE } from "@/lib/queries/paginate"
import { listPages, listPagesPaginated } from "@/lib/queries/pages"
import { listMediaPaginated } from "@/lib/queries/media"
import { listFormsPaginated } from "@/lib/queries/forms"

// Audit finding #13 (P2, T10/T8) — Silent truncation at limit:200/500/1000.
//
// Most concerning: `getMediaUsage` (drives the destructive media-delete
// UI) hardcodes `limit: 500` with NO pagination. If a tenant exceeds 500
// pages, references on overflow pages silently drop from the usage map →
// admin "delete unused media" UX destroys an asset that's actually in
// use on page #501.
//
// Fix shape (per dispatch §Sub-fix C):
//   - Extract `findAllPaginated(payload, args)` — iterates `page` from 1
//     until `hasNextPage === false`, returns the merged doc list.
//   - Refactor `getMediaUsage` to walk via findAllPaginated (no surface
//     change to the consumer; the result is still a complete map).
//   - Add `*Paginated(tenantId, opts)` variants of the listing queries
//     that accept `{ page, pageSize }` and return Payload's full result
//     shape (`{ docs, totalDocs, totalPages, hasNextPage, hasPrevPage }`)
//     so a consumer can render pagination UI.
//   - Default page size: 50 (Payload's idiomatic default).
//
// Test coverage (5 dispatch TDD cases + adversarial-walk hardening):
//   1. mediaUsage walker visits ALL pages (mocked find returns 600 pages
//      across two pages of 300 → result aggregates both)
//   2. Listing queries respect a `page` param when provided
//   3. Listing queries default to `page: 1, pageSize: DEFAULT_PAGE_SIZE`
//   4. Listing queries return `totalDocs` + `totalPages` for the UI
//   5. Cross-tenant isolation: tenant-scoped query never returns docs
//      from a different tenant, regardless of pagination
//   H6. mediaUsage walker boundary: exactly N*pageSize docs (e.g. 300
//       across 6 pages of 50, last page has exactly 50 — no off-by-one)
//   H7. Pagination param injection: page=-1, page=99999, pageSize=99999
//       are clamped to safe defaults

// -----------------------------------------------------------------------------
// Mock payload client supporting paginated find
// -----------------------------------------------------------------------------

type PaginatedDoc = Page & { tenant: number }

const makePaginatedFind = (corpus: PaginatedDoc[]) => {
  const calls: PayloadFindArgs[] = []
  const find = vi.fn(async (args: PayloadFindArgs) => {
    calls.push(args)
    const where = args.where ?? {}
    let docs = corpus.slice()
    const clause = where.tenant
    if (typeof clause === "object" && clause !== null && "equals" in clause) {
      docs = docs.filter((d) => d.tenant === clause.equals)
    }
    const limit = args.limit ?? DEFAULT_PAGE_SIZE
    const page = args.page ?? 1
    const start = (page - 1) * limit
    const slice = docs.slice(start, start + limit)
    const totalDocs = docs.length
    const totalPages = Math.max(1, Math.ceil(totalDocs / limit))
    return {
      docs: slice,
      totalDocs,
      totalPages,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      pagingCounter: start + 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    }
  })
  return { client: createFindClient({
    pages: find,
    media: async (args) => {
      const result = await find(args)
      return { ...result, docs: result.docs.map(({ id, tenant, createdAt, updatedAt }) => ({ id, tenant, createdAt, updatedAt })) }
    },
    forms: async (args) => {
      const result = await find(args)
      return { ...result, docs: result.docs.map((doc) => ({ ...doc, status: "new" as const, formName: "contact", data: null })) }
    },
  }), calls }
}

const seedCorpus = (n: number, tenant: number, baseId = 1): PaginatedDoc[] =>
  Array.from({ length: n }, (_, i) => ({
    id: baseId + i,
    tenant,
    slug: `page-${baseId + i}`,
    status: "draft",
    createdAt: "2026-01-01T00:00:00Z",
    title: `doc-${baseId + i}`,
    updatedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
  }))

// -----------------------------------------------------------------------------
// Case 1 — mediaUsage walker visits ALL pages, not just the first 500
// -----------------------------------------------------------------------------

describe("audit-p2 #13 — findAllPaginated (full-walk)", () => {
  it("fails closed when the page budget is exhausted before the complete reference walk", async () => {
    const { client } = makePaginatedFind(seedCorpus(51, 42))
    await expect(findAllPaginated(client, {
      collection: "pages", where: { tenant: { equals: 42 } }, pageSize: 50, maxPages: 1,
    })).rejects.toThrow("Pagination walk exhausted")
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1001])("rejects invalid page budget %s before reading", async (maxPages) => {
    const { client, calls } = makePaginatedFind(seedCorpus(2, 42))
    await expect(findAllPaginated(client, { collection: "pages", maxPages })).rejects.toThrow("Pagination page budget")
    expect(calls).toHaveLength(0)
  })

  it("completes at the exact page budget and forwards access context on every page", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(51, 42))
    const user = { id: 3, email: "fixture@example.com" }
    const req = { transactionID: "fixture-transaction" }
    const docs = await findAllPaginated(client, {
      collection: "pages", where: { tenant: { equals: 42 } }, maxPages: 2,
      overrideAccess: false, user, req,
    })
    expect(docs).toHaveLength(51)
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.overrideAccess).toBe(false)
      expect(call.user).toBe(user)
      expect(call.req).toBe(req)
    }
  })

  it("Case 1 — walks all pages across pagination boundary (600 docs in two 300-row pages)", async () => {
    const corpus = seedCorpus(600, 42)
    const { client, calls } = makePaginatedFind(corpus)

    const docs = await findAllPaginated(client, {
      collection: "pages",
      overrideAccess: true,
      where: { tenant: { equals: 42 } },
      pageSize: 300,
    })

    expect(docs).toHaveLength(600)
    // Pin sort stability: ids appear in order 1..600.
    expect(docs.map((d) => d.id)).toEqual(Array.from({ length: 600 }, (_, i) => i + 1))
    // The walker MUST have made multiple find calls — not relied on a
    // single huge limit. With 600 docs and pageSize 300 we expect at
    // least 2 calls; a third call may happen as the "is there more?"
    // check (depending on whether the impl reads hasNextPage from the
    // last response or queries again to confirm).
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(calls.length).toBeLessThanOrEqual(3)
    // Each call must carry the same where clause (tenant scope preserved).
    for (const c of calls) expect(c.where).toEqual({ tenant: { equals: 42 } })
  })

  it("Case H6 — boundary: exactly N*pageSize docs walks cleanly (300 docs, pageSize 50 → 6 pages, last has exactly 50)", async () => {
    const corpus = seedCorpus(300, 7)
    const { client, calls } = makePaginatedFind(corpus)

    const docs = await findAllPaginated(client, {
      collection: "pages",
      overrideAccess: true,
      where: { tenant: { equals: 7 } },
      pageSize: 50,
    })

    expect(docs).toHaveLength(300)
    // Six full pages — each call must use limit=50.
    expect(calls.length).toBeGreaterThanOrEqual(6)
    for (const c of calls) expect(c.limit).toBe(50)
  })

  it("Case 1b — walker is safe on empty corpus (returns []; one call max)", async () => {
    const { client, calls } = makePaginatedFind([])

    const docs = await findAllPaginated(client, {
      collection: "pages",
      overrideAccess: true,
      where: { tenant: { equals: 42 } },
    })

    expect(docs).toEqual([])
    // One call — the walker can't know it's empty without asking.
    expect(calls.length).toBe(1)
  })

  it("Case 1c — walker terminates on a finite corpus (does not infinite-loop)", async () => {
    // Belt-and-braces: 3000 docs, pageSize 100 → 30 pages. Walker
    // should NOT exceed roughly the totalPages count of calls.
    const corpus = seedCorpus(3000, 1)
    const { client, calls } = makePaginatedFind(corpus)
    const docs = await findAllPaginated(client, {
      collection: "pages",
      overrideAccess: true,
      where: { tenant: { equals: 1 } },
      pageSize: 100,
    })
    expect(docs).toHaveLength(3000)
    expect(calls.length).toBeLessThanOrEqual(31) // 30 + at most 1 end-marker call
  })
})

// -----------------------------------------------------------------------------
// Cases 2-4 — listing queries (page/pageSize, defaults, totalDocs/totalPages)
// -----------------------------------------------------------------------------

describe("audit-p2 #13 — listing queries (page + pageSize + result shape)", () => {
  // The *Paginated functions are thin wrappers around payload.find; we
  // pass an injected payload to avoid a real DB. Each function's
  // contract: (tenantId, opts?) → Payload find-result shape with the
  // tenant where-clause baked in.

  it("Case 3 — listPagesPaginated defaults to page=1, pageSize=DEFAULT_PAGE_SIZE when no opts", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(120, 1))
    await listPagesPaginated(1, undefined, client)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.page).toBe(1)
    expect(calls[0]!.limit).toBe(DEFAULT_PAGE_SIZE)
    expect(DEFAULT_PAGE_SIZE).toBe(50)
  })

  it("Case 2 — listPagesPaginated respects page when provided", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(120, 1))
    await listPagesPaginated(1, { page: 2, pageSize: 25 }, client)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.page).toBe(2)
    expect(calls[0]!.limit).toBe(25)
  })

  it("Case 4 — listing queries return totalDocs + totalPages (UI can render pagination)", async () => {
    const { client } = makePaginatedFind(seedCorpus(120, 1))
    const result = await listPagesPaginated(1, { pageSize: 50 }, client)
    expect(result.totalDocs).toBe(120)
    expect(result.totalPages).toBe(3)
    expect(result.page).toBe(1)
    expect(result.hasNextPage).toBe(true)
    expect(result.hasPrevPage).toBe(false)
    expect(result.docs.length).toBe(50)
  })

  it("Case 2b — listMediaPaginated respects page+pageSize", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(60, 1))
    await listMediaPaginated(1, { page: 3, pageSize: 20 }, client)
    expect(calls[0]!.page).toBe(3)
    expect(calls[0]!.limit).toBe(20)
  })

  it("Case 2c — listFormsPaginated respects page+pageSize", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(80, 1))
    await listFormsPaginated(1, { page: 2, pageSize: 30, status: "new" }, client)
    expect(calls[0]!.page).toBe(2)
    expect(calls[0]!.limit).toBe(30)
    // status filter stacks alongside the tenant scope.
    expect(calls[0]!.where).toEqual({ tenant: { equals: 1 }, status: { equals: "new" } })
  })

  it("Case 4b — listMediaPaginated returns totalDocs/totalPages", async () => {
    const { client } = makePaginatedFind(seedCorpus(75, 1))
    const result = await listMediaPaginated(1, { pageSize: 25 }, client)
    expect(result.totalDocs).toBe(75)
    expect(result.totalPages).toBe(3)
    expect(result.page).toBe(1)
  })

  it("Case 4c — listFormsPaginated returns totalDocs/totalPages", async () => {
    const { client } = makePaginatedFind(seedCorpus(100, 1))
    const result = await listFormsPaginated(1, { pageSize: 50 }, client)
    expect(result.totalDocs).toBe(100)
    expect(result.totalPages).toBe(2)
  })
})

// -----------------------------------------------------------------------------
// Case 5 — cross-tenant isolation
// -----------------------------------------------------------------------------

describe("audit-p2 #13 — cross-tenant isolation", () => {
  it("Case 5 — listPagesPaginated for tenant A never returns tenant B's docs (regardless of pagination)", async () => {
    const tenantA = seedCorpus(40, 100, 1)
    const tenantB = seedCorpus(40, 200, 1000)
    const { client } = makePaginatedFind([...tenantA, ...tenantB])

    // Walk all pages of tenant A's listing.
    const page1 = await listPagesPaginated(100, { page: 1, pageSize: 25 }, client)
    const page2 = await listPagesPaginated(100, { page: 2, pageSize: 25 }, client)

    expect(page1.totalDocs).toBe(40)
    expect(page2.totalDocs).toBe(40)
    const allTenants = [...page1.docs, ...page2.docs].map((d) => d.tenant)
    expect(allTenants.every((t) => t === 100)).toBe(true)
    // Pin: NONE of the returned ids belong to tenant B's id range.
    const allIds = [...page1.docs, ...page2.docs].map((d) => d.id)
    expect(allIds.some((id) => id >= 1000)).toBe(false)
  })

  it("Case 5b — findAllPaginated for tenant A walks tenant A's full set, NEVER tenant B's", async () => {
    const tenantA = seedCorpus(120, 100, 1)
    const tenantB = seedCorpus(120, 200, 1000)
    const { client } = makePaginatedFind([...tenantA, ...tenantB])

    const all = await findAllPaginated(client, {
      collection: "pages",
      overrideAccess: true,
      where: { tenant: { equals: 100 } },
      pageSize: 50,
    })

    expect(all).toHaveLength(120)
    expect(all.every((d) => d.tenant === 100)).toBe(true)
    expect(all.some((d) => d.id >= 1000)).toBe(false)
  })

  it("FE-63 — listPages walks every tenant page for the navigation picker", async () => {
    const tenantA = seedCorpus(120, 100, 1)
    const tenantB = seedCorpus(80, 200, 1000)
    const { client, calls } = makePaginatedFind([...tenantA, ...tenantB])

    const all = await listPages(100, client)

    expect(all).toHaveLength(120)
    expect(all.every((d) => d.tenant === 100)).toBe(true)
    expect(all.some((d) => d.id >= 1000)).toBe(false)
    expect(calls).toHaveLength(3)
    expect(calls.map((c) => c.page)).toEqual([1, 2, 3])
    for (const c of calls) {
      expect(c.collection).toBe("pages")
      expect(c.where).toEqual({ tenant: { equals: 100 } })
      expect(c.sort).toBe("-updatedAt")
      expect(c.depth).toBe(1)
      expect(c.overrideAccess).toBe(true)
    }
  })
})

// -----------------------------------------------------------------------------
// Hardening — pagination param injection
// -----------------------------------------------------------------------------

describe("audit-p2 #13 — pagination param hardening", () => {
  it("Case H7a — page=-1 is normalised to 1", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listPagesPaginated(1, { page: -1, pageSize: 10 }, client)
    expect(calls[0]!.page).toBe(1)
  })

  it("Case H7b — page=0 is normalised to 1", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listPagesPaginated(1, { page: 0, pageSize: 10 }, client)
    expect(calls[0]!.page).toBe(1)
  })

  it("Case H7c — pageSize=99999 is clamped to a safe MAX_PAGE_SIZE", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listPagesPaginated(1, { page: 1, pageSize: 99_999 }, client)
    // We don't pin the exact MAX, but it must NOT be 99999 — that
    // would re-arm the truncation/over-fetch problem in reverse.
    expect(calls[0]!.limit).toBeLessThan(99_999)
    expect(calls[0]!.limit).toBeGreaterThanOrEqual(50)
  })

  it("Case H7d — pageSize=0 / negative is normalised to default", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listPagesPaginated(1, { page: 1, pageSize: 0 }, client)
    expect(calls[0]!.limit).toBe(DEFAULT_PAGE_SIZE)
    await listPagesPaginated(1, { page: 1, pageSize: -10 }, client)
    expect(calls[1]!.limit).toBe(DEFAULT_PAGE_SIZE)
  })

  it("Case H7e — non-integer page (NaN, Infinity) normalised to 1", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listPagesPaginated(1, { page: Number.NaN, pageSize: 10 }, client)
    expect(calls[0]!.page).toBe(1)
    await listPagesPaginated(1, { page: Number.POSITIVE_INFINITY, pageSize: 10 }, client)
    expect(calls[1]!.page).toBe(1)
  })
})

// -----------------------------------------------------------------------------
// OBS-7 — server-side search: the `q` opt builds an `or` where-clause so
// list-page filtering spans every page, not just the rows in the browser.
// -----------------------------------------------------------------------------

describe("OBS-7 — list search (q param → where.or)", () => {
  it("listPagesPaginated with q searches title + slug, tenant scope preserved", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listPagesPaginated(1, { q: "about" }, client)
    expect(calls[0]!.where).toEqual({
      tenant: { equals: 1 },
      or: [{ title: { like: "about" } }, { slug: { like: "about" } }],
    })
  })

  it("listFormsPaginated with q searches email + name + formName, stacks with status", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listFormsPaginated(1, { q: "jane", status: "new" }, client)
    expect(calls[0]!.where).toEqual({
      tenant: { equals: 1 },
      status: { equals: "new" },
      or: [
        { email: { like: "jane" } },
        { name: { like: "jane" } },
        { formName: { like: "jane" } },
      ],
    })
  })

  it("q is trimmed before it reaches the where-clause", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listPagesPaginated(1, { q: "  spaced  " }, client)
    expect(calls[0]!.where?.or).toEqual([
      { title: { like: "spaced" } },
      { slug: { like: "spaced" } },
    ])
  })

  it("blank / whitespace-only q adds no or-clause (no accidental match-all)", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listPagesPaginated(1, { q: "   " }, client)
    expect(calls[0]!.where).toEqual({ tenant: { equals: 1 } })
    expect(calls[0]!.where?.or).toBeUndefined()
  })

  it("no q leaves the where-clause tenant-only (regression guard)", async () => {
    const { client, calls } = makePaginatedFind(seedCorpus(20, 1))
    await listPagesPaginated(1, { page: 2 }, client)
    expect(calls[0]!.where).toEqual({ tenant: { equals: 1 } })
  })
})
