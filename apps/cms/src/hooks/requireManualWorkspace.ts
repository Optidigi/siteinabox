import { Forbidden, type CollectionBeforeOperationHook } from "payload"
import { relationshipId } from "@/lib/relationshipId"
import { hasManualWorkspaceAccess, hasWorkspaceAccountAccess } from "@/lib/workspace/manualAccess"
import { asRecord } from "@/lib/record"

export const requireManualWorkspace: CollectionBeforeOperationHook = async ({ args, req, overrideAccess }) => {
  // Reviewed internal AI/provisioning writes retain their own authority. HTTP
  // callers cannot select Local API overrideAccess or request context flags.
  if (overrideAccess === true || req.user?.role === "super-admin") return args
  if (!req.user) throw new Forbidden()
  const memberships = req.user.tenants ?? []
  const tenantId = relationshipId(memberships[0]?.tenant)
  if (memberships.length !== 1 || !tenantId || !await hasManualWorkspaceAccess(req.payload, tenantId, req)) throw new Forbidden()
  return args
}

export const requireManualWorkspaceUserManagement: CollectionBeforeOperationHook = async input => {
  const { args, req, operation } = input
  // Authentication/recovery and self-profile writes keep their existing gates.
  // Creating or managing another team identity is a manual workspace control.
  if (req.user?.role !== "owner" || !["create", "update", "delete"].includes(operation)) return args
  if (operation === "update" && String(asRecord(args)?.id) === String(req.user.id)) return args
  const memberships = req.user.tenants ?? []
  const tenantId = relationshipId(memberships[0]?.tenant)
  if (memberships.length !== 1 || !tenantId || !await hasWorkspaceAccountAccess(req.payload, tenantId, req)) throw new Forbidden()
  return args
}
