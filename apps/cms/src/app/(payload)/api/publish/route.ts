import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { activatePublishedSnapshot, publishSiteSnapshot } from "@/lib/publish/siteSnapshots"
import { isOfficialTenant } from "@/lib/officialTenants"
import { relationshipId, relationshipIdSet, type RelationshipIdRef } from "@/lib/relationshipId"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const asId = (value: unknown): string | number | null =>
  typeof value === "string" || typeof value === "number" ? value : null

const userTenantIds = (user: any): Set<string> => {
  return relationshipIdSet(
    (user?.tenants ?? []).map((membership: { tenant?: RelationshipIdRef }) =>
      membership.tenant,
    ),
  )
}

const canPublishForTenant = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  user: any,
  tenantId: string | number | null,
  body: Record<string, unknown>,
) => {
  if (user?.role === "super-admin") return true
  if (tenantId == null) return false
  if (body.action === "rollback") return false
  if (body.includeAllPublishedPages !== true || body.activate !== true) return false
  if (asId(body.generationRunId) != null) return false
  if (user?.role !== "owner" && user?.role !== "editor") return false
  const targetTenantId = relationshipId(tenantId)
  if (targetTenantId == null || !userTenantIds(user).has(targetTenantId)) return false
  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  return isOfficialTenant(tenant)
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  let auth: Awaited<ReturnType<typeof payload.auth>> | null = null
  try {
    auth = await payload.auth({ headers: req.headers })
  } catch {
    auth = null
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }
  if (!isRecord(body)) {
    return NextResponse.json({ message: "JSON object body required" }, { status: 400 })
  }
  const tenantId = asId(body.tenantId)
  const user = auth?.user
  if (!user || !(await canPublishForTenant(payload, user, tenantId, body))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  try {
    if (body.action === "rollback") {
      const snapshotId = asId(body.snapshotId)
      if (snapshotId == null) return NextResponse.json({ message: "snapshotId is required" }, { status: 400 })
      const snapshot = await activatePublishedSnapshot(payload, {
        snapshotId,
        manualActivation: body.manualActivation === true,
        activatedBy: user.id,
        activationReason: typeof body.reason === "string" ? body.reason : "manual rollback",
        rollback: true,
      })
      return NextResponse.json({ ok: true, activated: true, snapshotId: snapshot.id })
    }

    if (tenantId == null) return NextResponse.json({ message: "tenantId is required" }, { status: 400 })

    const result = await publishSiteSnapshot(payload, {
      tenantId,
      generationRunId: asId(body.generationRunId),
      includeAllPublishedPages: body.includeAllPublishedPages === true,
      activate: body.activate === true,
      manualActivation: body.manualActivation === true,
      publishedBy: user.id,
      activationReason: typeof body.reason === "string" ? body.reason : null,
    })

    return NextResponse.json({
      ok: true,
      activated: result.activated,
      snapshotId: result.snapshot.id,
      status: result.snapshot.status,
      version: result.snapshot.version,
      domain: result.snapshot.domain,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed"
    return NextResponse.json({ ok: false, message }, { status: 422 })
  }
}
