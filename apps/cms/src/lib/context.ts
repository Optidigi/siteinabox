import { cookies, headers } from "next/headers"
import { notFound } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import { PLATFORM_PROXY_MODE } from "@/lib/hostToTenant"
import { relationshipId } from "@/lib/relationshipId"
import type { Tenant, User } from "@/payload-types"

export type SiabMode = "super-admin" | "tenant"

export type SiabContext =
  | { mode: "super-admin"; tenant: null }
  | { mode: "tenant"; tenant: Tenant }

export class UnauthenticatedSiabError extends Error {
  constructor() {
    super("getSiabContext requires an authenticated user")
    this.name = "UnauthenticatedSiabError"
  }
}

export const assertPlatformProxy = (headerStore: Headers): void => {
  const mode = headerStore.get("x-siab-mode")
  if (!mode) {
    throw new Error("siab middleware did not run — getSiabContext called outside (frontend) route group?")
  }
  if (mode !== PLATFORM_PROXY_MODE) {
    notFound()
  }
}

export const payloadAuthHeaders = async (): Promise<Headers> => {
  const headersList = await headers()
  const cookieStore = await cookies()
  const reqHeaders = new Headers()
  headersList.forEach((value, key) => {
    reqHeaders.set(key, value)
  })
  const cookieHeader = cookieStore.toString()
  if (cookieHeader) reqHeaders.set("cookie", cookieHeader)
  return reqHeaders
}

export const currentPayloadUser = async (): Promise<User | null> => {
  const payload = await getPayload({ config })
  const result = await payload.auth({ headers: await payloadAuthHeaders() })
  return (result.user as User | null) ?? null
}

/**
 * Resolves CMS tenancy from the authenticated user's membership. Super-admin
 * has no tenant; owner/editor/viewer have exactly one. Host is no longer the
 * lock — `src/proxy.ts` only admits the platform admin host.
 */
export const resolveSiabContextForUser = async (user: User): Promise<SiabContext> => {
  const payload = await getPayload({ config })

  if (user.role === "super-admin") {
    const tenants = Array.isArray(user.tenants) ? user.tenants : []
    if (tenants.length !== 0) notFound()
    return { mode: "super-admin", tenant: null }
  }

  const memberships = Array.isArray(user.tenants) ? user.tenants : []
  if (memberships.length !== 1) notFound()
  const tenantId = relationshipId(memberships[0]?.tenant)
  if (!tenantId) notFound()

  let tenant: Tenant
  try {
    tenant = await payload.findByID({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    }) as Tenant
  } catch {
    notFound()
  }

  if (!tenant) notFound()
  if (tenant.status === "archived") {
    throw new Response("Gone", { status: 410 })
  }

  return { mode: "tenant", tenant }
}

/**
 * Server-side helper. Reads the platform-host marker stamped by `src/proxy.ts`
 * and resolves tenancy from the authenticated Payload user:
 *   - super-admin with zero tenants -> { mode: "super-admin", tenant: null }
 *   - owner/editor/viewer with one live/suspended tenant -> { mode: "tenant", tenant }
 *   - archived tenant -> Response 410 (Gone)
 *   - missing membership or tenant record -> 404 (notFound)
 *
 * Throws when middleware didn't run (most common cause: caller is in a route
 * the middleware matcher excludes — /api, /admin, /_next). Throws
 * `UnauthenticatedSiabError` when there is no session; callers that need a
 * login redirect use `requireAuth()`.
 */
export const getSiabContext = async (): Promise<SiabContext> => {
  assertPlatformProxy(await headers())
  const user = await currentPayloadUser()
  if (!user) throw new UnauthenticatedSiabError()
  return resolveSiabContextForUser(user)
}
