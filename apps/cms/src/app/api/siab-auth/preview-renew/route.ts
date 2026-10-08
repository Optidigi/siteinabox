import { previewAuth } from "@/lib/preview/betterAuth"
import { readVerifiedPreviewSession } from "@/lib/auth/verifiedPreviewSession"
import { browserOriginMatchesAuthority, canonicalRequestAuthority, isPreviewRequestAuthority } from "@/lib/requestAuthority"
import { previewAuthRequestHeaders } from "@/lib/preview/previewHost"

// Renewal belongs to a writable HTTP boundary; eligibility reads never refresh
// cookies or clean up expired sessions while holding the global quota lock.
export async function POST(request: Request) {
  const authority = canonicalRequestAuthority(request.headers)
  if (!authority || !isPreviewRequestAuthority(request.headers)) return new Response("Unknown auth host", { status: 404 })
  if (!browserOriginMatchesAuthority(request.headers, { originRequired: true })) return new Response("Forbidden", { status: 403 })
  const headers = previewAuthRequestHeaders(request.headers)
  const before = await readVerifiedPreviewSession(headers)
  if (!before) return new Response("Unauthorized", { status: 401 })
  // Use the public handler to install the preview adapter context, including
  // when this route was reached from a CMS Better Auth request.
  const renewed = await previewAuth.handler(new Request(new URL("/api/preview-auth/get-session?disableCookieCache=true", authority.origin), { headers }))
  if (!renewed.ok) return new Response("Unauthorized", { status: 401 })
  const after = await readVerifiedPreviewSession(headers)
  if (!after || after.session.id !== before.session.id || after.user.id !== before.user.id || after.user.email !== before.user.email) return new Response("Unauthorized", { status: 401 })
  const response = Response.json({ ok: true })
  for (const cookie of renewed.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie)
  return response
}
