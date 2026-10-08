import { createLocalReq, getPayload, generateExpiredPayloadCookie, logoutOperation } from "payload"
import { revokeCustomerPayloadSessions, verifyCommittedCustomerRevocation } from "@/lib/auth/customerSessionBridge"
import { auth } from "@/lib/betterAuth"
import config from "@/payload.config"
import { buildCmsAuthRequest, isAllowedSocialAuthHost } from "@/lib/socialAuth/hosts"

export async function POST(request: Request) {
  if (!await isAllowedSocialAuthHost(request)) return new Response("Unknown auth host", { status: 404 })
  const normalized = buildCmsAuthRequest(request)
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(normalized.url).origin) return new Response("Forbidden", { status: 403 })
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: normalized.headers })
  const searchParams = new URL(normalized.url).searchParams
  const allSessions = searchParams.get("allSessions") === "true"
  const collection = payload.collections.users
  if (!collection) throw new Error("Users collection unavailable")
  if (user) {
    // Independently committed authority survives a swallowed native logout
    // commit; neither cookie deletion nor the SDK return value proves it.
    const receipt = await revokeCustomerPayloadSessions(payload, user, allSessions)
    const req = await createLocalReq({ user, req: { headers: normalized.headers, searchParams, payloadAPI: "REST" } }, payload)
    // SDK creates its transaction before the afterLogout hook. The hook fences
    // bindings/epoch under the shared global lock, then SDK removes native sid.
    await logoutOperation({ collection, req, allSessions })
    await verifyCommittedCustomerRevocation(payload, receipt)
    const committedUser = await payload.findByID({ collection: "users", id: user.id, depth: 0, overrideAccess: true })
    if (allSessions ? Boolean(committedUser.sessions?.length) : committedUser.sessions?.some((session) => session.id === receipt.sid)) throw new Error("Native logout commit receipt unavailable")
  }
  if (allSessions) await auth.api.revokeSessions({ headers: normalized.headers })
  const result = await auth.api.signOut({ headers: normalized.headers, returnHeaders: true })
  const response = Response.json({ ok: true })
  for (const cookie of result.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie)
  response.headers.append("Set-Cookie", generateExpiredPayloadCookie({ collectionAuthConfig: collection.config.auth, config: payload.config, cookiePrefix: payload.config.cookiePrefix }))
  return response
}
