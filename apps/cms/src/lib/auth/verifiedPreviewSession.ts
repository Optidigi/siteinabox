import "server-only"
import { z } from "zod"

const previewSessionSchema = z.object({
  session: z.object({ id: z.string().min(1), createdAt: z.coerce.date(), expiresAt: z.coerce.date() }),
  user: z.object({ email: z.string().email(), emailVerified: z.literal(true) }),
})

// Better Auth's HTTP handler installs its own adapter context. Calling the
// preview api from a CMS endpoint would inherit the CMS adapter through the
// SDK's shared AsyncLocalStorage and read the wrong session tables.
export async function readVerifiedPreviewSession(headers: Headers) {
  const { previewAuth } = await import("@/lib/preview/betterAuth")
  const response = await previewAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/get-session?disableCookieCache=true&disableRefresh=true", { headers }))
  if (!response.ok) return null
  const body: unknown = await response.json()
  const parsed = previewSessionSchema.safeParse(body)
  if (!parsed.success || parsed.data.session.expiresAt.getTime() <= Date.now()) return null
  return parsed.data
}
