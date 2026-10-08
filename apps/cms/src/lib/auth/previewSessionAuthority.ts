import "server-only"
import { z } from "zod"
import { getPayload, type Payload, type PayloadRequest } from "payload"
import config from "@/payload.config"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"
import { readVerifiedPreviewSession, readVerifiedPreviewSessionForRevocation } from "./verifiedPreviewSession"

export type PreviewSessionSubject = Readonly<{ sessionId: string; email: string }>
const normalizedEmail = (email: string) => z.email().parse(email.trim().toLowerCase())

export async function assertCurrentPreviewSessionAuthority(payload: Payload, req: Partial<PayloadRequest> | undefined, headers: Headers, expected: PreviewSessionSubject): Promise<void> {
  if (req) assertLiveBuilderTransaction(payload, req)
  const current = await readVerifiedPreviewSession(headers, req)
  if (!current || current.session.id !== expected.sessionId || normalizedEmail(current.user.email) !== normalizedEmail(expected.email) || current.session.expiresAt.getTime() <= Date.now()) throw new Error("Preview session authority unavailable")
  if (req) assertLiveBuilderTransaction(payload, req)
}

export async function revokePreviewSession(betterAuthSessionId: string, betterAuthUserId: string): Promise<void> {
  const [{ previewAuth }, payload] = await Promise.all([import("@/lib/preview/betterAuth"), getPayload({ config })])
  const { adapter } = await previewAuth.$context
  const user = z.object({ email: z.string().email() }).parse(await adapter.findOne({ model: "user", where: [{ field: "id", value: betterAuthUserId }] }))
  const email = normalizedEmail(user.email)
  const service = new BuilderQuotaService(payload)
  await service.initialize()
  const receipt = await service.retry(() => service.transaction(async (req) => {
    await service.lockGlobal(req)
    assertLiveBuilderTransaction(payload, req)
    const existing = await payload.find({ collection: "preview-session-revocations", where: { betterAuthSessionId: { equals: betterAuthSessionId } }, limit: 2, depth: 0, overrideAccess: true, req })
    if (existing.totalDocs > 1) throw new Error("Duplicate preview revocation")
    const prior = existing.docs[0]
    if (prior) {
      if (normalizedEmail(prior.email) !== email) throw new Error("Preview revocation identity mismatch")
      return { id: prior.id, revokedAt: prior.revokedAt }
    }
    const revokedAt = new Date().toISOString()
    assertLiveBuilderTransaction(payload, req)
    const row = await payload.create({ collection: "preview-session-revocations", data: { betterAuthSessionId, email, revokedAt }, overrideAccess: true, req })
    return { id: row.id, revokedAt }
  }))
  const committed = await payload.findByID({ collection: "preview-session-revocations", id: receipt.id, depth: 0, overrideAccess: true })
  if (committed.betterAuthSessionId !== betterAuthSessionId || normalizedEmail(committed.email) !== email || committed.revokedAt !== receipt.revokedAt) throw new Error("Preview revocation commit receipt unavailable")
}

// Before the public SDK endpoint: signOut itself catches database delete-hook
// errors and otherwise reports success. Ownership comes from fresh signed
// session proof and current source rows, never a caller-supplied session ID.
export async function revokePreviewRequestSessions(headers: Headers, path: string, body: unknown): Promise<void> {
  const current = await readVerifiedPreviewSessionForRevocation(headers)
  if (!current) return
  const { previewAuth } = await import("@/lib/preview/betterAuth")
  const { adapter } = await previewAuth.$context
  const rows = z.array(z.object({ id: z.string(), userId: z.string(), token: z.string() })).max(1000).parse(await adapter.findMany({ model: "session", where: [{ field: "userId", value: current.user.id }], limit: 1001 }))
  let selected = rows.filter((row) => row.id === current.session.id)
  if (path === "/revoke-sessions") selected = rows
  if (path === "/revoke-other-sessions") selected = rows.filter((row) => row.id !== current.session.id)
  if (path === "/revoke-session") {
    const request = z.object({ token: z.string().min(1) }).parse(body)
    selected = rows.filter((row) => row.token === request.token)
    if (selected.length !== 1) throw new Error("Preview revoke target not owned")
  }
  for (const row of selected) await revokePreviewSession(row.id, row.userId)
}
