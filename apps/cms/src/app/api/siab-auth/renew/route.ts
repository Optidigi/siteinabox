import { auth } from "@/lib/betterAuth"
import { issuePayloadSessionCookie } from "@/lib/socialAuth/payloadSession"
import { buildCmsAuthRequest, isAllowedSocialAuthHost } from "@/lib/socialAuth/hosts"

export async function POST(request: Request) {
  if (!await isAllowedSocialAuthHost(request)) return new Response("Unknown auth host", { status: 404 })
  const normalized = buildCmsAuthRequest(request)
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(normalized.url).origin) return new Response("Forbidden", { status: 403 })
  const { response: session, headers } = await auth.api.getSession({ headers: normalized.headers, query: { disableCookieCache: true }, returnHeaders: true })
  if (!session || !session.user.payloadUserId) return new Response("Unauthorized", { status: 401 })
  try {
    const payloadCookie = await issuePayloadSessionCookie(session.user.payloadUserId, normalized, session.session.id)
    const response = Response.json({ ok: true })
    for (const cookie of headers.getSetCookie()) response.headers.append("Set-Cookie", cookie)
    response.headers.append("Set-Cookie", payloadCookie)
    return response
  } catch {
    return new Response("Unauthorized", { status: 401 })
  }
}
