import { relationshipId } from "../relationshipId.ts"

type MailActor = { role?: string | null; tenants?: Array<{ tenant?: number | { id: number } | null }> | null }

/** Privileged support uses its own identity, never a forged owner session. */
export function mailActorCanOrder(actor: MailActor, tenantId: number): boolean {
  if (actor.role === "super-admin") return !actor.tenants?.length
  return actor.role === "owner" && actor.tenants?.length === 1 && relationshipId(actor.tenants[0]?.tenant) === String(tenantId)
}
