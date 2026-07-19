import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { User } from "@/payload-types"
import { relationshipId, relationshipIdSet, type RelationshipIdRef } from "@/lib/relationshipId"
import { themeSchema } from "@/lib/theme/schema"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const userTenantIds = (user: User): Set<string> =>
  relationshipIdSet(
    (user?.tenants ?? []).map((membership: { tenant?: RelationshipIdRef }) =>
      membership.tenant,
    ),
  )

const canUpdateTenantTheme = (user: User | null | undefined, tenantId: string | number | null): boolean => {
  if (user?.role === "super-admin") return tenantId != null
  if (tenantId == null) return false
  if (user?.role !== "owner" && user?.role !== "editor") return false
  const targetTenantId = relationshipId(tenantId)
  return targetTenantId != null && userTenantIds(user).has(targetTenantId)
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: req.headers }).catch(() => ({ user: null }))

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }
  if (!isRecord(body)) {
    return NextResponse.json({ message: "JSON object body required" }, { status: 400 })
  }

  const tenantId = relationshipId(body.tenantId as RelationshipIdRef)
  if (tenantId == null) {
    return NextResponse.json({ message: "tenantId is required" }, { status: 400 })
  }
  if (!auth.user || !canUpdateTenantTheme(auth.user, tenantId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const parsed = themeSchema.safeParse(body.theme)
  if (!parsed.success) {
    return NextResponse.json(
      { message: `Invalid theme data: ${parsed.error.message}` },
      { status: 400 },
    )
  }

  await payload.update({
    collection: "tenants",
    id: tenantId,
    data: { theme: parsed.data },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, theme: parsed.data })
}
