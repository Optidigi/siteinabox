import type { Payload } from "payload"
import type { User } from "@/payload-types"
import { relationshipId } from "@/lib/relationshipId"

export class AppointmentCalendarAdminError extends Error {
  readonly statusCode: 401 | 403 | 404

  constructor(message: string, statusCode: AppointmentCalendarAdminError["statusCode"]) {
    super(message)
    this.name = "AppointmentCalendarAdminError"
    this.statusCode = statusCode
  }
}

const positiveId = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function requireAppointmentCalendarAdmin(input: {
  payload: Payload
  headers: Headers
  requestedTenantId?: string | null
}): Promise<{ user: User; tenantId: number }> {
  const result = await input.payload.auth({ headers: input.headers })
  const user = result.user as User | null
  if (!user) throw new AppointmentCalendarAdminError("Authentication required.", 401)
  if (user.role !== "owner" && user.role !== "super-admin") throw new AppointmentCalendarAdminError("Only a tenant owner can manage calendar connections.", 403)
  const memberTenantId = relationshipId(user.tenants?.[0]?.tenant)
  const tenantId = user.role === "super-admin"
    ? positiveId(input.requestedTenantId ?? null)
    : memberTenantId && positiveId(memberTenantId)
  if (!tenantId) throw new AppointmentCalendarAdminError("A valid tenant is required.", 403)
  const tenant = await input.payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!tenant) throw new AppointmentCalendarAdminError("The selected tenant was not found.", 404)
  return { user, tenantId }
}
