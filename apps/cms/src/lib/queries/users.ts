import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { Where } from "payload"
import type { User } from "@/payload-types"
import {
  normalisePagination,
  type PayloadFindResult,
  type PayloadLikeFindClient,
} from "./paginate"

export interface ListUsersOpts {
  page?: number
  pageSize?: number
  /** Optional case-insensitive search across name + email. */
  q?: string
  /**
   * When set, scope to users who belong to this tenant (the Team page).
   * Omit for the super-admin all-users listing.
   */
  tenantId?: number | string
}

/**
 * Paginated users listing. With `tenantId` it scopes to that tenant's
 * members; without it, every user (super-admin "All users"). Returns
 * Payload's full result shape so the UI can render pagination controls.
 *
 * The `payload` arg is for unit-test injection only.
 */
export async function listUsersPaginated(
  opts?: ListUsersOpts,
  payload?: PayloadLikeFindClient,
): Promise<PayloadFindResult<User>> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  const { page, limit } = normalisePagination(opts)
  const where: Where = {}
  if (opts?.tenantId != null) where["tenants.tenant"] = { equals: opts.tenantId }
  const q = opts?.q?.trim()
  if (q) where.or = [{ name: { like: q } }, { email: { like: q } }]
  return client.find<User>({
    collection: "users",
    overrideAccess: true,
    where,
    sort: "-createdAt",
    page,
    limit,
  })
}
