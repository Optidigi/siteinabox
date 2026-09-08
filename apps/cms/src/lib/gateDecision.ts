import type { SiabContext } from "@/lib/context"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import type { User } from "@/payload-types"

export type GateDecision =
  | { allow: true }
  | { allow: false; reason: "no-user" | "wrong-host" | "super-admin-on-tenant-host" | "cross-tenant" }

/**
 * Pure decision function for the role × membership matrix. Lives apart
 * from `authGate.ts` so unit tests can import it without booting Payload.
 *
 * The matrix (tenancy is resolved from the user, not from Host):
 *   no user                                                       -> no-user
 *   super-admin ctx, user.role !== super-admin                    -> wrong-host
 *   tenant ctx,      user.role === super-admin                    -> super-admin-on-tenant-host
 *   tenant ctx,      user.tenants[0].tenant !== ctx.tenant.id     -> cross-tenant
 *   otherwise                                                     -> allow
 */
export const evaluateGate = (user: User | null, ctx: SiabContext): GateDecision => {
  if (!user) return { allow: false, reason: "no-user" }

  if (ctx.mode === "super-admin") {
    if (user.role !== "super-admin") return { allow: false, reason: "wrong-host" }
    return { allow: true }
  }

  if (user.role === "super-admin") {
    return { allow: false, reason: "super-admin-on-tenant-host" }
  }

  const first = user.tenants?.[0]?.tenant
  const userTenantId = relationshipId(first)
  if (!sameRelationshipId(userTenantId, ctx.tenant.id)) {
    return { allow: false, reason: "cross-tenant" }
  }
  return { allow: true }
}
