"use server"
import { headers } from "next/headers"
import { getPayload } from "payload"
import config from "@/payload.config"
import { themeSchema } from "@/lib/theme/schema"
import type { ThemeTokens } from "@/lib/theme/schema"

/** Persist design-token overrides for a tenant.
 *  Caller is resolved from cookies via Payload's auth strategy — no token-passing
 *  from the client. The incoming theme object is validated with themeSchema before
 *  writing so untrusted client data never reaches the database.
 *
 *  OBS-64: this action is the authorization boundary for theme writes.
 *  `Tenants.access.update` stays `isSuperAdmin` (collection-level access is a
 *  hard gate in Payload v3 — field-level update access does not exist), so the
 *  membership check happens here and the inner `payload.update` runs with
 *  `overrideAccess: true`. Allowed callers: super-admin (any tenant) or a
 *  tenant owner / editor on their own tenant. Viewer is intentionally excluded
 *  — viewer is read-only by the role's invariant. Other Tenant fields
 *  (`notes`, `siteManifest`, `domain`, `slug`, `siteRepo`, `status`, `name`)
 *  remain super-admin-only because nothing outside this action can reach
 *  `payload.update({ collection: "tenants" })` from a tenant-member session. */
export const setTenantTheme = async (
  tenantId: number | string,
  theme: ThemeTokens,
): Promise<void> => {
  const parsed = themeSchema.safeParse(theme)
  if (!parsed.success) {
    throw new Error(`Invalid theme data: ${parsed.error.message}`)
  }
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) throw new Error("Forbidden: authentication required")

  const role = (user as { role?: string }).role
  const tenants = (user as { tenants?: Array<{ tenant: number | string | { id: number | string } }> }).tenants ?? []
  const isMemberOfTarget = tenants.some((t) => {
    const tid = typeof t.tenant === "object" && t.tenant !== null
      ? (t.tenant as { id: number | string }).id
      : t.tenant
    return String(tid) === String(tenantId)
  })
  const isAuthorized =
    role === "super-admin" ||
    ((role === "owner" || role === "editor") && isMemberOfTarget)
  if (!isAuthorized) {
    throw new Error("Forbidden: not authorized to update this tenant's theme")
  }

  await payload.update({
    collection: "tenants",
    id: tenantId,
    data: { theme: parsed.data },
    overrideAccess: true,
  })
}
