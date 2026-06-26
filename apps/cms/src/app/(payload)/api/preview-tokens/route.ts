import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { signPreviewToken } from "@/lib/preview/sign"
import { relationshipId, relationshipIdSet, sameRelationshipId } from "@/lib/relationshipId"
import { legacyPreviewTokensEnabled } from "@/lib/preview/legacyPreview"

/**
 * POST /api/preview-tokens
 *
 * Body: { tenantId: number | string, pageId: number | string }
 *
 * Auth: caller must be an authenticated Payload user with read access to
 * the tenant. Super-admins can preview any tenant; everyone else only
 * their own (validated against the user's `tenants` array).
 *
 * Returns: { token: string, exp: number }
 */
export async function POST(req: NextRequest) {
  if (!legacyPreviewTokensEnabled()) {
    return NextResponse.json({ message: "Legacy preview tokens are disabled" }, { status: 404 })
  }

  const payload = await getPayload({ config })

  // Authenticate via Payload's session/cookie helper.
  type AuthUser = {
    id: number | string
    role: string
    tenants?: Array<{ tenant: number | string | { id: number | string } }>
  }

  let user: AuthUser | null
  try {
    const auth = await payload.auth({ headers: req.headers })
    user = auth.user as AuthUser | null
  } catch {
    user = null
  }
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  let body: { tenantId?: number | string; pageId?: number | string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }
  const { tenantId, pageId } = body
  if (tenantId == null || pageId == null) {
    return NextResponse.json({ message: "tenantId and pageId required" }, { status: 400 })
  }

  // Authorization: super-admin can preview any tenant; everyone else only
  // their own tenant.
  if (user.role !== "super-admin") {
    const userTenantIds = relationshipIdSet((user.tenants ?? []).map((t) => t.tenant))
    const requestedTenantId = relationshipId(tenantId)
    if (requestedTenantId == null || !userTenantIds.has(requestedTenantId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
  }

  let tenant: { status?: string } | null = null
  try {
    tenant = await payload.findByID({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    }) as { status?: string }
  } catch {
    tenant = null
  }
  if (!tenant || tenant.status === "archived" || tenant.status === "suspended") {
    return NextResponse.json({ message: "Preview tenant is not available" }, { status: 404 })
  }

  if (!isDraftPreviewPageId(pageId)) {
    let page: { tenant?: number | string | { id?: number | string } } | null = null
    try {
      page = await payload.findByID({
        collection: "pages",
        id: pageId,
        depth: 0,
        overrideAccess: true,
      }) as { tenant?: number | string | { id?: number | string } }
    } catch {
      page = null
    }
    if (!page || !sameRelationshipId(pageTenantId(page), tenantId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
  }

  const secret = process.env.PREVIEW_HMAC_SECRET
  if (!secret) {
    return NextResponse.json(
      { message: "Server misconfigured (PREVIEW_HMAC_SECRET unset)" },
      { status: 500 },
    )
  }

  try {
    const { token, exp } = signPreviewToken({ tenantId, pageId }, secret)
    return NextResponse.json({ token, exp })
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Token signing failed" },
      { status: 500 },
    )
  }
}

export const isDraftPreviewPageId = (pageId: number | string): boolean =>
  typeof pageId === "string" && pageId.startsWith("draft-")

const pageTenantId = (page: { tenant?: number | string | { id?: number | string } }) => {
  return relationshipId(page.tenant)
}
