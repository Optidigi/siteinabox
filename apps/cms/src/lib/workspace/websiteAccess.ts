import "server-only"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { getPayload } from "payload"
import config from "@/payload.config"
import { hasManualWorkspaceAccess } from "./manualAccess"

export async function requireWebsiteAccess() {
  const gate = await requireAuth()
  if (gate.ctx.mode === "tenant" && !await hasManualWorkspaceAccess(await getPayload({ config }), String(gate.ctx.tenant.id))) redirect(gate.user.role === "owner" ? "/email" : "/settings")
  return gate
}
