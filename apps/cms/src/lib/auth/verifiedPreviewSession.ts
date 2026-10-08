import "server-only"
import type { PayloadRequest } from "payload"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"
import { betterAuth } from "better-auth"
import { z } from "zod"

const previewSessionSchema = z.object({
  session: z.object({ id: z.string().min(1), createdAt: z.coerce.date(), expiresAt: z.coerce.date() }),
  user: z.object({ id: z.string().min(1), email: z.string().email(), emailVerified: z.literal(true) }),
})

// Better Auth's HTTP handler installs its own adapter context. Calling the
// preview api from a CMS endpoint would inherit the CMS adapter through the
// SDK's shared AsyncLocalStorage and read the wrong session tables.
async function createReadOnlyPreviewAuth() {
  const { previewAuth } = await import("@/lib/preview/betterAuth")
  // GET expiry cleanup normally invokes delete hooks even with disableRefresh.
  // A read-only instance defers cleanup to POST and cannot nest a revoke lock
  // while its caller already owns the global eligibility transaction.
  return betterAuth({ ...previewAuth.options, session: { ...previewAuth.options.session, deferSessionRefresh: true } })
}
let readOnlyPreviewAuth: ReturnType<typeof createReadOnlyPreviewAuth> | undefined
export async function readVerifiedPreviewSessionForRevocation(headers: Headers) {
  readOnlyPreviewAuth ??= createReadOnlyPreviewAuth()
  const reader = await readOnlyPreviewAuth
  const response = await reader.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/get-session?disableCookieCache=true&disableRefresh=true", { headers }))
  if (!response.ok) return null
  const body: unknown = await response.json()
  const parsed = previewSessionSchema.safeParse(body)
  if (!parsed.success || parsed.data.session.expiresAt.getTime() <= Date.now()) return null
  return parsed.data
}

export async function readVerifiedPreviewSession(headers: Headers, req?: Partial<PayloadRequest>) {
  const subject = await readVerifiedPreviewSessionForRevocation(headers)
  if (!subject) return null
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("@/payload.config")])
  const payload = req?.payload ?? await getPayload({ config })
  if (req) assertLiveBuilderTransaction(payload, req)
  const revoked = await payload.find({ collection: "preview-session-revocations", where: { betterAuthSessionId: { equals: subject.session.id } }, depth: 0, limit: 1, overrideAccess: true, req })
  return revoked.totalDocs === 0 ? subject : null
}
