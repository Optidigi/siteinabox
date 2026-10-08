import { createLocalReq, getPayload, generateExpiredPayloadCookie, logoutOperation } from "payload"
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
  if (user) {
    const req = await createLocalReq({ user, req: { headers: normalized.headers, searchParams, payloadAPI: "REST" } }, payload)
    // SDK creates its transaction before the afterLogout hook. The hook fences
    // bindings/epoch under the shared global lock, then SDK removes native sid.
    await logoutOperation({ collection: payload.collections.users!, req, allSessions })
  }
  if (allSessions) await auth.api.revokeSessions({ headers: normalized.headers })
  const result = await auth.api.signOut({ headers: normalized.headers, returnHeaders: true })
  const response = Response.json({ ok: true })
  for (const cookie of result.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie)
  response.headers.append("Set-Cookie", generateExpiredPayloadCookie({ collectionAuthConfig: payload.collections.users!.config.auth, config: payload.config, cookiePrefix: payload.config.cookiePrefix }))
  return response
}
