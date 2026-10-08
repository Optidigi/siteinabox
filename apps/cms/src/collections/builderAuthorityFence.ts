import type { CollectionBeforeValidateHook, CollectionBeforeDeleteHook } from "payload"

// Serialize revocation, archival and accepted checkout authority with builder
// mutations. The owning SDK transaction commits the authority change and lock.
export const fenceBuilderAuthority: CollectionBeforeValidateHook = async ({ data, req }) => {
  const { BuilderQuotaService } = await import("@/lib/builder/quota")
  const service = new BuilderQuotaService(req.payload)
  await service.initialize(req)
  await service.lockGlobal(req)
  return data
}

export const fenceBuilderAuthorityDeletion: CollectionBeforeDeleteHook = async ({ req }) => {
  const { BuilderQuotaService } = await import("@/lib/builder/quota")
  const service = new BuilderQuotaService(req.payload)
  await service.initialize(req)
  await service.lockGlobal(req)
}
