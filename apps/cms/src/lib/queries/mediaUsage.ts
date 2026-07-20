import "server-only"
import { cache } from "react"
import { getPayload } from "payload"
import config from "@/payload.config"
import { buildMediaUsageMap } from "./mediaUsageWalker"
import { findAllPaginated, type PayloadLikeFindClient } from "./paginate"
import type { MediaUsageMap } from "./mediaUsageWalker"
import type { Page, SiteSetting } from "@/payload-types"

export type { MediaPageRef, MediaUsageEntry, MediaUsageMap } from "./mediaUsageWalker"
export { buildMediaUsageMap } from "./mediaUsageWalker"

/**
 * Server helper: fetch a tenant's pages + settings, then walk them to
 * produce the usage map. Wrapped in React.cache() — request-scoped, so
 * multiple components within the same RSC render share one DB roundtrip.
 * Do NOT memoize at module scope (it would leak across users/requests).
 *
 * The walking logic itself lives in `./mediaUsageWalker.ts` (no
 * server-only side effects) so unit tests can import it cleanly.
 *
 * Audit-p2 #13 (T10/T8) — pagination via findAllPaginated. The walker
 * MUST visit every page in the tenant; a missed reference produces an
 * unused-media false positive that drives a destructive delete in the
 * admin UI. The previous `limit: 500` silently truncated past 500 pages
 * — fixed by paginating until hasNextPage === false.
 */
export const getMediaUsage = cache(async (tenantId: number | string): Promise<MediaUsageMap> => {
  const payload = await getPayload({ config })
  const [pages, settingsRes] = await Promise.all([
    findAllPaginated<Page>(payload as unknown as PayloadLikeFindClient, {
      collection: "pages",
      overrideAccess: true,
      where: { tenant: { equals: tenantId } },
      depth: 1,
    }),
    payload.find({
      collection: "site-settings",
      overrideAccess: true,
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 1
    })
  ])

  const settings = (settingsRes.docs[0] as Pick<SiteSetting, "branding"> | undefined) ?? null
  return buildMediaUsageMap(pages, settings)
})
