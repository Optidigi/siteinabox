import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { Tenant } from "@/payload-types"

export type SiabMode = "super-admin" | "tenant"

export type SiabContext =
  | { mode: "super-admin"; tenant: null }
  | { mode: "tenant"; tenant: Tenant }

/**
 * Server-side helper. Reads the host headers stamped by `src/proxy.ts`
 * and resolves a tenant by `domain` when the host is a tenant subdomain.
 * Behavior matches the spec's URL contract:
 *   - super-admin host  -> { mode: "super-admin", tenant: null }
 *   - tenant host with active record -> { mode: "tenant", tenant }
 *   - tenant host with no record     -> 404 (notFound)
 *   - tenant host with suspended record -> authenticated control plane remains available
 *   - tenant host with archived record  -> Response 410 (Gone)
 *
 * Throws when middleware didn't run (most common cause: caller is in a route
 * the middleware matcher excludes — /api, /admin, /_next).
 */
export const getSiabContext = async (): Promise<SiabContext> => {
  const h = await headers()
  const mode = h.get("x-siab-mode") as SiabMode | null
  const host = h.get("x-siab-host") || ""

  if (!mode) {
    throw new Error("siab middleware did not run — getSiabContext called outside (frontend) route group?")
  }

  if (mode === "super-admin") {
    return { mode, tenant: null }
  }

  // mode === "tenant" — resolve domain to tenant record
  if (!host) {
    throw new Error("middleware set mode=tenant but x-siab-host is empty")
  }

  const payload = await getPayload({ config })
  const tenants = await payload.find({
    collection: "tenants",
    where: { domain: { equals: host } },
    limit: 1,
    overrideAccess: true
  })
  const tenant = tenants.docs[0]

  if (!tenant) {
    notFound() // throws — Next renders the closest not-found.tsx
  }
  if (tenant.status === "archived") {
    throw new Response("Gone", { status: 410 })
  }

  return { mode: "tenant", tenant }
}
