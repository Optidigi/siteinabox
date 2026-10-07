import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { Media } from "@/payload-types"
import {
  normalisePagination,
  normaliseFindResult,
  type PayloadFindResult,
  type PayloadFindClient,
} from "./paginate"

// Audit-p2 #13 (T10/T8) — see ./pages.ts for the rationale.

export interface ListMediaOpts {
  page?: number
  pageSize?: number
}

export async function listMediaPaginated(
  tenantId: number | string,
  opts?: ListMediaOpts,
  payload?: PayloadFindClient<"media">,
): Promise<PayloadFindResult<Media>> {
  const client = payload ?? (await getPayload({ config }))
  const { page, limit } = normalisePagination(opts)
  return client.find({
    collection: "media",
    overrideAccess: true,
    where: { tenant: { equals: tenantId } },
    sort: "-updatedAt",
    page,
    limit,
  }).then(normaliseFindResult)
}

export async function deleteMedia(id: number | string) {
  const payload = await getPayload({ config })
  return payload.delete({ collection: "media", id, overrideAccess: true })
}
