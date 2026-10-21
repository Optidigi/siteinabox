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
  const session = await auth.api.getSession({
    headers: authRequest.headers,
    query: { disableCookieCache: true },
  })

  const payloadUserId = (session?.user as { payloadUserId?: string | null } | undefined)?.payloadUserId
  if (!payloadUserId || !session?.user.email || session.user.emailVerified !== true) {
    return NextResponse.redirect(new URL("/login?error=social-unlinked", url))
  }

  try {
    const payloadCookie = await issuePayloadSessionCookie(payloadUserId, authRequest, session.user.email)
    const destination = validateNextRedirect(url.searchParams.get("next"))
    const response = NextResponse.redirect(new URL(destination, url))
    response.headers.append("Set-Cookie", payloadCookie)
    return response
  } catch {
    return NextResponse.redirect(new URL("/login?error=social-session", url))
  }
}
