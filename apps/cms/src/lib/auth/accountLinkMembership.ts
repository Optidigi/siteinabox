import type { User } from "@/payload-types"
import { relationshipId } from "@/lib/relationshipId"

type AccountLinkMembership = {
  recipient: string
  payloadUserId?: string | null
  role?: string | null
  tenantId?: string | null
}

export function accountLinkMembershipMatches(target: AccountLinkMembership, user: User): boolean {
  const tenants = user.tenants ?? []
  return target.payloadUserId === String(user.id) && target.recipient === user.email.trim().toLowerCase() &&
    target.role === user.role && (target.tenantId ?? null) === relationshipId(tenants[0]?.tenant) &&
    (user.role === "super-admin" ? tenants.length === 0 : tenants.length === 1)
}
