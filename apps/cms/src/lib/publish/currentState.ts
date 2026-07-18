import "server-only"

import type { Payload } from "payload"
import { relationshipId, relationshipIdSet, type RelationshipIdRef } from "@/lib/relationshipId"
import { publishSiteSnapshot } from "@/lib/publish/siteSnapshots"
import { assertTenantPublicationAllowed, recordQualifyingContinuedUse } from "@/lib/legal/customerRequirements"

type PublishCurrentStateUser = {
  id?: string | number | null
  role?: string | null
  tenants?: Array<{ tenant?: RelationshipIdRef }> | null
}

export type PublishCurrentTenantStateOptions = {
  tenantId: string | number
  user: PublishCurrentStateUser
  reason?: string | null
}

const userTenantIds = (user: PublishCurrentStateUser): Set<string> =>
  relationshipIdSet((user.tenants ?? []).map((membership) => membership.tenant))

export async function canPublishCurrentTenantState(
  _payload: Payload,
  user: PublishCurrentStateUser | null | undefined,
  tenantId: string | number | null | undefined,
): Promise<boolean> {
  if (!user || tenantId == null) return false
  if (user.role === "super-admin") return true
  if (user.role !== "owner" && user.role !== "editor") return false
  const targetTenantId = relationshipId(tenantId)
  return targetTenantId != null && userTenantIds(user).has(targetTenantId)
}

export async function publishCurrentTenantState(
  payload: Payload,
  options: PublishCurrentTenantStateOptions,
) {
  const allowed = await canPublishCurrentTenantState(payload, options.user, options.tenantId)
  if (!allowed) throw new Error("Forbidden: not authorized to publish current tenant state")
  if (options.user.role !== "super-admin") await assertTenantPublicationAllowed(payload, options.tenantId)

  const result = await publishSiteSnapshot(payload, {
    tenantId: options.tenantId,
    generationRunId: null,
    includeAllPublishedPages: true,
    activate: true,
    manualActivation: true,
    publishedBy: options.user.id ?? null,
    activationReason: options.reason ?? "auto-publish current CMS state",
  })
  if (options.user.role !== "super-admin" && result.activated) {
    await recordQualifyingContinuedUse({
      payload,
      tenantId: options.tenantId,
      evidenceType: "tenant_publish",
      evidenceId: String(result.snapshot.id),
    })
  }
  return result
}
