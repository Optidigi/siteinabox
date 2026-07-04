import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import {
  normalisePagination,
  type PayloadFindResult,
  type PayloadLikeFindClient,
} from "./paginate"

export interface ListTenantsOpts {
  page?: number
  pageSize?: number
  /** Optional case-insensitive search across name + slug + domain. */
  q?: string
}

/**
 * Paginated tenants listing for the /sites admin page. Returns Payload's
 * full result shape so the UI can render pagination controls.
 *
 * The `payload` arg is for unit-test injection only — production call
 * sites omit it and the function resolves the singleton.
 */
export async function listTenantsPaginated(
  opts?: ListTenantsOpts,
  payload?: PayloadLikeFindClient,
): Promise<PayloadFindResult> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  const { page, limit } = normalisePagination(opts)
  const where: Record<string, unknown> = {}
  const q = opts?.q?.trim()
  if (q) {
    where.or = [
      { name: { like: q } },
      { slug: { like: q } },
      { domain: { like: q } },
    ]
  }
  return client.find({
    collection: "tenants",
    overrideAccess: true,
    where,
    sort: "-updatedAt",
    page,
    limit,
  })
}

/**
 * "All tenants" listing — returns just `docs`. Used by the user-edit
 * tenant picker, which needs every tenant to populate its dropdown.
 * Capped at 200; the /sites list pages through listTenantsPaginated.
 * Lifting the cap for the picker needs a searchable async combobox,
 * not a higher number — tracked alongside FE-63.
 */
export async function listTenants() {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: "tenants",
    overrideAccess: true,
    limit: 200,
    sort: "-updatedAt"
  })
  return res.docs
}

export async function getTenantBySlug(slug: string) {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: "tenants",
    overrideAccess: true,
    where: { slug: { equals: slug } },
    limit: 1
  })
  return res.docs[0] ?? null
}

export async function getTenantById(id: number | string) {
  const payload = await getPayload({ config })
  return payload.findByID({
    collection: "tenants",
    id,
    overrideAccess: true,
  })
}
