import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireRole } from "@/lib/authGate"
import { hasWorkspaceService } from "@/lib/tenants/services"

/** A scoped email support surface; global authentication/tenancy is unchanged. */
export async function requireMailWorkspace(tenantInput?: FormDataEntryValue | null) {
  const gate = await requireRole(["owner", "super-admin"])
  if (gate.user.role === "owner" && gate.ctx.mode === "tenant") {
    if (tenantInput && String(gate.ctx.tenant.id) !== String(tenantInput)) throw new Error("Workspace mismatch.")
    return { user: gate.user, ctx: gate.ctx, basePath: "/email" }
  }
  const tenantId = Number(tenantInput)
  if (gate.user.role !== "super-admin" || gate.ctx.mode !== "super-admin" || !Number.isSafeInteger(tenantId) || tenantId < 1) throw new Error("Choose a customer account for email support.")
  const payload = await getPayload({ config })
  const tenant = await payload.findByID({ collection: "tenants", id: tenantId, user: gate.user, overrideAccess: false, depth: 0 })
  if (tenant.status !== "active" || !hasWorkspaceService(tenant, "email")) throw new Error("Email is unavailable for this workspace.")
  return { user: gate.user, ctx: { mode: "tenant" as const, tenant }, basePath: `/accounts/${tenant.id}/email` }
}
