import type { Access, AccessResult } from "payload"

export const canManageUsers: Access<unknown> = ({ req }): AccessResult => {
  const u = req.user
  if (!u) return false
  if (u.role === "super-admin") return true
  if (u.role === "owner") {
    // After Wave 1 the user's tenant lives in `u.tenants[0].tenant` (the
    // plugin-native many-to-many shape, but with our domain invariant of
    // exactly-one). Reduce the relationship to a plain id.
    const first = u.tenants?.[0]?.tenant
    const tenantId = typeof first === "object" && first ? first.id : first
    if (tenantId == null) return false
    // Filter users whose `tenants[].tenant` includes this tenantId. Payload's
    // query syntax supports dot-paths into array fields.
    return { "tenants.tenant": { equals: tenantId } }
  }
  return { id: { equals: u.id } }
}
