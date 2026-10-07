import "server-only"
import { getPayload } from "payload"
import type { Where } from "payload"
import config from "@/payload.config"
import type { Form } from "@/payload-types"
import {
  normalisePagination,
  normaliseFindResult,
  type PayloadFindResult,
  type PayloadFindClient,
} from "./paginate"

// Audit-p2 #13 (T10/T8) — see ./pages.ts for the rationale.

export interface ListFormsOpts {
  page?: number
  pageSize?: number
  status?: string
  /** Optional case-insensitive search across email + name + formName. */
  q?: string
}

export async function listFormsPaginated(
  tenantId: number | string,
  opts?: ListFormsOpts,
  payload?: PayloadFindClient<"forms">,
): Promise<PayloadFindResult<Form>> {
  const client = payload ?? (await getPayload({ config }))
  const { page, limit } = normalisePagination(opts)
  const where: Where = { tenant: { equals: tenantId } }
  if (opts?.status) where.status = { equals: opts.status }
  const q = opts?.q?.trim()
  if (q) where.or = [{ email: { like: q } }, { name: { like: q } }, { formName: { like: q } }]
  return client.find({
    collection: "forms",
    overrideAccess: true,
    where,
    sort: "-createdAt",
    page,
    limit,
  }).then(normaliseFindResult)
}
