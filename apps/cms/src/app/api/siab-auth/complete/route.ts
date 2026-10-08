import { NextResponse } from "next/server"
import { auth } from "@/lib/betterAuth"
import { issuePayloadSessionCookie } from "@/lib/socialAuth/payloadSession"
import { validateNextRedirect } from "@/lib/auth/validateNextRedirect"
import { buildCmsAuthRequest, isAllowedSocialAuthHost } from "@/lib/socialAuth/hosts"

export async function GET(req: Request) {
  if (!(await isAllowedSocialAuthHost(req))) {
    return new Response("Unknown auth host", { status: 404 })
  }

  const authRequest = buildCmsAuthRequest(req)
  const url = new URL(authRequest.url)
  const { response: session, headers: sessionHeaders } = await auth.api.getSession({
    returnHeaders: true,
    headers: authRequest.headers,
    query: { disableCookieCache: true },
  })

  const payloadUserId = session?.user.payloadUserId
  if (!payloadUserId || !session) {
    return NextResponse.redirect(new URL("/login?error=social-unlinked", url))
  }

  try {
    const payloadCookie = await issuePayloadSessionCookie(payloadUserId, authRequest, session.session.id)
    const destination = validateNextRedirect(url.searchParams.get("next"))
    const response = NextResponse.redirect(new URL(destination, url))
    for (const cookie of sessionHeaders.getSetCookie()) response.headers.append("Set-Cookie", cookie)
    response.headers.append("Set-Cookie", payloadCookie)
    return response
  } catch {
    return NextResponse.redirect(new URL("/login?error=social-session", url))
  }
}
