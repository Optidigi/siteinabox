import type { CollectionAfterLogoutHook, CollectionBeforeValidateHook } from "payload"
import type { User } from "@/payload-types"

export const revokeCustomerSessionsOnLogout: CollectionAfterLogoutHook<User> = async ({ req }) => {
  if (!req.user) return
  const { BuilderQuotaService } = await import("@/lib/builder/quota")
  const service = new BuilderQuotaService(req.payload)
  await service.initialize(req)
  await service.lockGlobal(req)
  const { revokeCustomerPayloadSessions } = await import("./customerSessionBridge")
  // REST exposes allSessions in searchParams. Internal direct logout operations
  // do not pass their argument to this SDK hook: conservatively fence the account.
  const allSessions = req.searchParams?.get("allSessions") === "true" || req.payloadAPI === "local"
  await revokeCustomerPayloadSessions(req.payload, req.user, allSessions, req)
}

export const fenceChangedCustomerAuthority: CollectionBeforeValidateHook<User> = async ({ data, originalDoc, operation, req }) => {
  if (!data) return data
  if (operation === "create" && data.role !== "super-admin") {
    const { BuilderQuotaService } = await import("@/lib/builder/quota")
    const service = new BuilderQuotaService(req.payload)
    await service.initialize(req)
    await service.lockGlobal(req)
  }
  if (operation !== "update" || !originalDoc) return data
  const changed = (data.role !== undefined && data.role !== originalDoc.role)
    || (data.tenants !== undefined && JSON.stringify(data.tenants) !== JSON.stringify(originalDoc.tenants))
    || typeof data.password === "string"
    || (typeof data.hash === "string" && data.hash !== originalDoc.hash)
  if (changed) {
    const { BuilderQuotaService } = await import("@/lib/builder/quota")
    const service = new BuilderQuotaService(req.payload)
    await service.initialize(req)
    await service.lockGlobal(req)
    const { revokeCustomerPayloadSessions } = await import("./customerSessionBridge")
    await revokeCustomerPayloadSessions(req.payload, originalDoc, true, req)
    data.sessions = []
  }
  return data
}
