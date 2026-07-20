import "server-only"
import { getPayload } from "payload"
import type { Where } from "payload"
import config from "@/payload.config"
import type { Page } from "@/payload-types"
import {
  findAllPaginated,
  normalisePagination,
  type PayloadFindResult,
  type PayloadLikeFindClient,
} from "./paginate"

// Audit-p2 #13 (T10/T8) — listing queries no longer use a hardcoded
// `limit: 500`. `listPagesPaginated` accepts page + pageSize + q and
// returns Payload's full result shape; the admin list pages wire it to
// URL-driven pagination (OBS-7). `listPages` remains as the "all pages"
// wrapper for the navigation page-picker.

export interface ListOpts {
  page?: number
  pageSize?: number
  /** Optional case-insensitive search across title + slug. */
  q?: string
}

/**
 * Tenant-scoped pages listing. Returns the full Payload find result
 * (`{ docs, totalDocs, totalPages, page, hasNextPage, hasPrevPage, ... }`)
 * so the UI can render pagination controls.
 *
 * The third `payload` arg is for unit-test injection only — production
 * call sites omit it and the function resolves the singleton via
 * `getPayload({ config })`.
 */
export async function listPagesPaginated(
  tenantId: number | string,
  opts?: ListOpts,
  payload?: PayloadLikeFindClient,
): Promise<PayloadFindResult<Page>> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  const { page, limit } = normalisePagination(opts)
  const where: Where = { tenant: { equals: tenantId } }
  const q = opts?.q?.trim()
  if (q) where.or = [{ title: { like: q } }, { slug: { like: q } }]
  return client.find<Page>({
    collection: "pages",
    overrideAccess: true,
    where,
    sort: "-updatedAt",
    depth: 1,
    page,
    limit,
  })
}

/**
 * "All pages" listing — returns just `docs`. Used by the navigation
 * page-picker, which needs every tenant page to populate its link dropdown.
 * The admin list pages page through listPagesPaginated directly and do
 * not use this.
 */
export async function listPages(
  tenantId: number | string,
  payload?: PayloadLikeFindClient,
): Promise<Page[]> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  return findAllPaginated<Page>(client, {
    collection: "pages",
    overrideAccess: true,
    where: { tenant: { equals: tenantId } },
    sort: "-updatedAt",
    depth: 1,
  })
}

export async function getPageById(id: number | string) {
  const payload = await getPayload({ config })
  return payload.findByID({ collection: "pages", id, overrideAccess: true, depth: 2 })
}

export async function getPageBySlug(tenantId: number | string, slug: string) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: "pages",
    overrideAccess: true,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { slug: { equals: slug } },
      ],
    },
    depth: 2,
    limit: 1,
  })
  return result.docs[0] ?? null
}
