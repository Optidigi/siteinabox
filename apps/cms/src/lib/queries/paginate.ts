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

import type { Where } from "payload"

export interface PayloadFindArgs {
  collection: string
  where?: Where
  sort?: string
  depth?: number
  overrideAccess?: boolean
  page?: number
  limit?: number
}

export interface PayloadFindResult<T = unknown> {
  docs: T[]
  totalDocs: number
  totalPages: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
  nextPage: number | null
  prevPage: number | null
}

export interface PayloadLikeFindClient {
  find<T = unknown>(args: PayloadFindArgs): Promise<PayloadFindResult<T>>
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

export interface FindAllPaginatedArgs extends Omit<PayloadFindArgs, "page" | "limit"> {
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
 * list. Loops `page` from 1 until `hasNextPage === false` (or until
 * `maxPages` as a runaway guard).
 *
 * The `where`, `sort`, `depth`, and `overrideAccess` are forwarded to
 * each underlying find call unchanged — tenant scope, sort order, and
 * access posture are preserved across the walk.
 */
export async function findAllPaginated<T = unknown>(
  payload: PayloadLikeFindClient,
  args: FindAllPaginatedArgs,
): Promise<T[]> {
  const limit =
    typeof args.pageSize === "number" && Number.isFinite(args.pageSize) && args.pageSize >= 1
      ? Math.min(Math.floor(args.pageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE
  const maxPages = args.maxPages ?? 1000

  const out: T[] = []
  let page = 1
  while (page <= maxPages) {
    const res = await payload.find<T>({
      collection: args.collection,
      where: args.where,
      sort: args.sort,
      depth: args.depth,
      overrideAccess: args.overrideAccess,
      page,
      limit,
    })
    if (Array.isArray(res.docs)) out.push(...res.docs)
    if (!res.hasNextPage) return out
    page += 1
  }
  return out
}
