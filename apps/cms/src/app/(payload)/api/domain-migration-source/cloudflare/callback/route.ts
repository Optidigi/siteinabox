import config from "@/payload.config"
import { getPayload } from "payload"
import { NextResponse } from "next/server"
import {
  cloudflareOAuthCookieName,
  cloudflareSourceCheckoutEnabled,
  cloudflareSourceAuthorizationContext,
  completeCloudflareSourceAuthorization,
} from "@/lib/domains/cloudflareSourceOAuth"
import {
  canonicalRequestAuthority,
  isPreviewRequestAuthority,
} from "@/lib/requestAuthority"
import { relationshipId } from "@/lib/relationshipId"
import { requirePreviewCheckoutContext } from
  "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/previewCheckoutContext"

const safeCheckoutRedirect = (
  origin: string,
  clientSlug: string,
  result: string,
): NextResponse => NextResponse.redirect(
  new URL(
    `/${encodeURIComponent(clientSlug)}/checkout?cloudflareSource=${encodeURIComponent(result)}`,
    origin,
  ),
  303,
)

const clearCorrelationCookie = (
  response: NextResponse,
  cookieName: string,
): void => {
  response.cookies.set({
    name: cookieName,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/api/domain-migration-source/cloudflare/callback",
  })
}

export async function GET(request: Request): Promise<Response> {
  if (
    !isPreviewRequestAuthority(request.headers) ||
    !cloudflareSourceCheckoutEnabled()
  ) {
    return new Response("Not found", { status: 404 })
  }
  const authority = canonicalRequestAuthority(request.headers)
  if (!authority) return new Response("Invalid request authority", { status: 400 })
  const url = new URL(request.url)
  const state = url.searchParams.get("state")?.trim() ?? ""
  const code = url.searchParams.get("code")?.trim() ?? ""
  const payload = await getPayload({ config })
  const authorityContext = state
    ? await cloudflareSourceAuthorizationContext(payload, state)
    : null
  if (!authorityContext) {
    return new Response("Invalid OAuth state", { status: 400 })
  }
  const checkoutContext = await requirePreviewCheckoutContext(
    authorityContext.clientSlug,
    request.headers,
  ).catch(() => null)
  const tenantId = checkoutContext
    ? relationshipId(checkoutContext.tenant)
    : null
  const cookieName = cloudflareOAuthCookieName(state)
  const browserBinding = request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)
  if (
    !checkoutContext ||
    !tenantId ||
    !code ||
    url.searchParams.has("error") ||
    !browserBinding
  ) {
    const response = safeCheckoutRedirect(
      authority.origin,
      authorityContext.clientSlug,
      "failed",
    )
    clearCorrelationCookie(response, cookieName)
    return response
  }
  try {
    const completed = await completeCloudflareSourceAuthorization(payload, {
      state,
      code,
      browserBinding: decodeURIComponent(browserBinding),
      context: {
        generationRunId: checkoutContext.run.id,
        tenantId,
        clientSlug: checkoutContext.clientSlug,
        customerEmail: checkoutContext.customerEmail,
      },
    })
    const redirect = new URL(
      `/${encodeURIComponent(completed.clientSlug)}/checkout`,
      authority.origin,
    )
    redirect.searchParams.set("cloudflareSource", completed.authorizationKey)
    const response = NextResponse.redirect(redirect, 303)
    clearCorrelationCookie(response, cookieName)
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch {
    const response = safeCheckoutRedirect(
      authority.origin,
      authorityContext.clientSlug,
      "failed",
    )
    clearCorrelationCookie(response, cookieName)
    return response
  }
}
