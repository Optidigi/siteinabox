// Audit-p2 #13 (T10/T8) — pagination helpers.
//
// Two shapes:
//   - findAllPaginated: full-walk; iterates Payload's `find` via `page`
//     until `hasNextPage === false`. Used by mediaUsageWalker (which
//     drives the destructive media-delete UI and MUST visit every
//     page in the tenant — a missed reference = an asset deleted out
//     from under a published page).
//   - normalisePagination: clamp/coerce user-supplied pagination params
//     before they reach Payload. Belt-and-braces against negative
//     pages, NaN, and overlarge pageSize.
//
// No `import "server-only"` here — these helpers are pure and unit-
// testable; only their callers (`pages.ts`, `media.ts`, `forms.ts`,
// `mediaUsage.ts`) are server-only.

export const DEFAULT_PAGE_SIZE = 50 as const
export const MAX_PAGE_SIZE = 250 as const

import type { CollectionSlug, DataFromCollectionSlug, FindOptions, PaginatedDocs } from "payload"

// A deliberately narrow Local API surface: no select/draft transforms, and
// the collection slug determines the document type through generated Payload types.
export type PayloadFindArgs<C extends CollectionSlug = CollectionSlug> = Pick<
  FindOptions<C, never>,
  "collection" | "where" | "sort" | "depth" | "overrideAccess" | "page" | "limit" | "user" | "req"
>

export type PayloadFindResult<T> = PaginatedDocs<T> & { page: number }

/** List UI always receives a page number, even when Payload omits its optional field. */
export function normaliseFindResult<T>(result: PaginatedDocs<T>): PayloadFindResult<T> {
  return { ...result, page: result.page ?? 1 }
}

export interface PayloadFindClient<C extends CollectionSlug = CollectionSlug> {
  find<S extends C>(args: PayloadFindArgs<S>): Promise<PaginatedDocs<DataFromCollectionSlug<S>>>
}

export interface NormalisedPagination {
  page: number
  limit: number
}

/**
 * Coerce user-supplied pagination params into a safe `(page, limit)`
 * pair before they reach Payload.find. Defaults: page 1, limit
 * {@link DEFAULT_PAGE_SIZE}. Caps `limit` at {@link MAX_PAGE_SIZE} to
 * prevent re-arming the silent-truncation problem in reverse (a query
 * with `limit: 99999` is a memory/latency footgun).
 */
export function normalisePagination(opts?: { page?: number; pageSize?: number }): NormalisedPagination {
  const rawPage = opts?.page
  const rawSize = opts?.pageSize

  const page =
    typeof rawPage === "number" && Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1

  let limit: number
  if (typeof rawSize === "number" && Number.isFinite(rawSize) && rawSize >= 1) {
    limit = Math.floor(rawSize)
    if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE
  } else {
    limit = DEFAULT_PAGE_SIZE
  }

  return { page, limit }
}

export type FindAllPaginatedArgs<C extends CollectionSlug> = Omit<PayloadFindArgs<C>, "page" | "limit"> & {
  /**
   * Per-page batch size during the walk. Defaults to
   * {@link DEFAULT_PAGE_SIZE}; capped at {@link MAX_PAGE_SIZE}. Higher
   * values reduce roundtrips but increase memory pressure per call.
   */
  pageSize?: number
  /**
   * Hard ceiling on total pages walked, as a runaway-loop guard. With
   * a `pageSize` of 50, the default ceiling permits 50,000 docs per
   * call — well above any plausible tenant size. Tests can override.
   */
  maxPages?: number
}

/**
 * Walk every page of a Payload find query, returning the merged doc
 * list. Loops `page` from 1 until `hasNextPage === false` (or rejects when
 * the `maxPages` runaway guard is exhausted).
 *
 * The `where`, `sort`, `depth`, and `overrideAccess` are forwarded to
 * each underlying find call unchanged — tenant scope, sort order, and
 * access posture are preserved across the walk.
 */
export async function findAllPaginated<C extends CollectionSlug>(
  payload: PayloadFindClient<NoInfer<C>>,
  args: FindAllPaginatedArgs<C>,
): Promise<DataFromCollectionSlug<C>[]> {
  const limit =
    typeof args.pageSize === "number" && Number.isFinite(args.pageSize) && args.pageSize >= 1
      ? Math.min(Math.floor(args.pageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE
  const maxPages = args.maxPages ?? 1000
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 1000) {
    throw new RangeError("Pagination page budget must be an integer between 1 and 1000")
  }

  const out: DataFromCollectionSlug<C>[] = []
  let page = 1
  while (page <= maxPages) {
    const res = await payload.find({
      collection: args.collection,
      where: args.where,
      sort: args.sort,
      depth: args.depth,
      overrideAccess: args.overrideAccess,
      user: args.user as unknown,
      req: args.req,
      page,
      limit,
    })
    out.push(...res.docs)
    if (res.hasNextPage === false) return out
    page += 1
  }
  throw new Error("Pagination walk exhausted before all documents were read")
}
