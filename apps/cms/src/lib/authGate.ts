import { redirect } from "next/navigation"
import {
  assertPlatformProxy,
  currentPayloadUser,
  resolveSiabContextForUser,
  type SiabContext,
} from "@/lib/context"
import { evaluateGate } from "@/lib/gateDecision"
import { headers } from "next/headers"
import type { User } from "@/payload-types"

export type GateResult = { user: User; ctx: SiabContext }

/**
 * RSC helper. Resolves the authenticated user, then tenancy from membership,
 * then validates role × tenant:
 *
 *   no user                                                  -> /login
 *   super-admin ctx, user.role !== super-admin               -> /login?error=wrong-host
 *   tenant ctx, user.role === super-admin                    -> /login?error=super-admin-on-tenant-host
 *   tenant ctx, user.tenants[0].tenant !== ctx.tenant.id     -> /login?error=cross-tenant
 *   otherwise                                                -> { user, ctx }
 */
export const requireAuth = async (): Promise<GateResult> => {
  assertPlatformProxy(await headers())
  const user = await currentPayloadUser()
  if (!user) redirect("/login")

  const ctx = await resolveSiabContextForUser(user)
  const decision = evaluateGate(user, ctx)
  if (!decision.allow) {
    if (decision.reason === "no-user") redirect("/login")
    redirect(`/login?error=${decision.reason}`)
  }

  return { user, ctx }
}

/**
 * Convenience wrapper: requireAuth + role check. Common for super-admin-only
 * routes (e.g. /sites, /sites/<slug>/onboarding).
 */
export const requireRole = async (
  allowed: NonNullable<User["role"]>[]
): Promise<GateResult> => {
  const result = await requireAuth()
  if (!allowed.includes(result.user.role)) redirect("/?error=forbidden")
  return result
}
