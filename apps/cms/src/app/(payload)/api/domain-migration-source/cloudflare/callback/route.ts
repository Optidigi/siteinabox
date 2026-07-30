import config from "@/payload.config"
import { getPayload } from "payload"
import { NextResponse } from "next/server"
import {
  cloudflareOAuthCookieName,
  cloudflareSourceOAuthEnabled,
  cloudflareSourceAuthorizationContext,
  completeCloudflareSourceAuthorization,
} from "@/lib/domains/cloudflareSourceOAuth"
import { isPreviewHost } from "@/lib/preview/previewHost"
import { relationshipId } from "@/lib/relationshipId"
import { requirePreviewCheckoutContext } from
  "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/previewCheckoutContext"

const safeCheckoutRedirect = (
  request: Request,
  clientSlug: string,
  result: string,
): NextResponse => NextResponse.redirect(
  new URL(
    `/${encodeURIComponent(clientSlug)}/checkout?cloudflareSource=${encodeURIComponent(result)}`,
    request.url,
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
  if (!(await isPreviewHost()) || !cloudflareSourceOAuthEnabled()) {
    return new Response("Not found", { status: 404 })
  }
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
      request,
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
      request.url,
    )
    redirect.searchParams.set("cloudflareSource", completed.authorizationKey)
    const response = NextResponse.redirect(redirect, 303)
    clearCorrelationCookie(response, cookieName)
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch {
    const response = safeCheckoutRedirect(
      request,
      authorityContext.clientSlug,
      "failed",
    )
    clearCorrelationCookie(response, cookieName)
    return response
  }
}
