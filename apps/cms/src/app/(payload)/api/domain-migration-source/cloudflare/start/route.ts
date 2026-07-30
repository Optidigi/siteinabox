import { NextResponse } from "next/server"
import {
  createCloudflareSourceAuthorization,
  cloudflareSourceOAuthEnabled,
} from "@/lib/domains/cloudflareSourceOAuth"
import {
  automaticMigrationSourceEnabled,
  inspectExistingDomainPublicEvidence,
} from "@/lib/domains/migrationCheckout"
import { normalizeDomain } from "@/lib/domains/normalize"
import { isPreviewHost } from "@/lib/preview/previewHost"
import { relationshipId } from "@/lib/relationshipId"
import { requirePreviewCheckoutContext } from
  "@/app/(frontend)/(site-preview)/[clientSlug]/checkout/previewCheckoutContext"

export async function POST(request: Request): Promise<Response> {
  if (
    !(await isPreviewHost()) ||
    !cloudflareSourceOAuthEnabled() ||
    !automaticMigrationSourceEnabled("cloudflare_api_v1")
  ) {
    return new Response("Not found", { status: 404 })
  }
  const formData = await request.formData().catch(() => null)
  if (!formData) return new Response("Invalid request", { status: 400 })
  const clientSlug = String(formData.get("clientSlug") ?? "").trim()
  const normalized = normalizeDomain(String(formData.get("domain") ?? ""))
  if (!clientSlug || !normalized.ok) {
    return new Response("Invalid request", { status: 400 })
  }
  const context = await requirePreviewCheckoutContext(
    clientSlug,
    request.headers,
  ).catch(() => null)
  const tenantId = context ? relationshipId(context.tenant) : null
  if (!context || !tenantId) {
    return new Response("Unauthorized", { status: 401 })
  }
  const evidence = await inspectExistingDomainPublicEvidence(
    normalized.domain,
  ).catch(() => null)
  if (evidence?.probableDnsProvider !== "cloudflare") {
    return NextResponse.redirect(
      new URL(
        `/${encodeURIComponent(context.clientSlug)}/checkout?cloudflareSource=provider-mismatch`,
        request.url,
      ),
      303,
    )
  }
  const authorization = await createCloudflareSourceAuthorization(
    context.payload,
    {
      generationRunId: context.run.id,
      tenantId,
      clientSlug: context.clientSlug,
      customerEmail: context.customerEmail,
      domain: normalized.domain,
    },
  )
  const response = NextResponse.redirect(
    authorization.authorizationUrl,
    303,
  )
  response.cookies.set({
    name: authorization.cookieName,
    value: authorization.browserBinding,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/api/domain-migration-source/cloudflare/callback",
  })
  response.headers.set("Cache-Control", "no-store")
  return response
}
