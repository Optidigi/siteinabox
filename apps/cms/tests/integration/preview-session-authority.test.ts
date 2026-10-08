import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { betterAuth } from "better-auth"
import { createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import { z } from "zod"
import { getTestPayload } from "./_helpers"
import { previewAuth } from "@/lib/preview/betterAuth"
import { ReservedBuilderExecution } from "@/lib/builder/quotaExecution"
import { builderQuotaPolicy } from "@/lib/builder/quotaPolicy"
import { loadBuilderThread } from "@/lib/builder/sessionStore"
import { POST as renewPreview } from "@/app/api/siab-auth/preview-renew/route"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { assertCurrentPreviewSessionAuthority } from "@/lib/auth/previewSessionAuthority"
let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock" || process.env.BETTER_AUTH_API_KEY) throw new Error("Preview authority tests require isolated payload_test, jobs disabled and mock Sitegen")
  payload = await getTestPayload()
}, 60_000)
async function fixture() {
  const email = `preview-authority-${randomUUID()}@example.test`
  let userId = ""
  const fixtureAuth = betterAuth({ ...previewAuth.options, plugins: [...(previewAuth.options.plugins ?? []), { id: "preview-authority-fixture", endpoints: { fixtureSession: createAuthEndpoint("/fixture-session", { method: "POST" }, async (ctx) => {
    const user = userId ? await ctx.context.internalAdapter.findUserById(userId) : await ctx.context.internalAdapter.createUser({ email, name: "Authority fixture", emailVerified: true })
    if (!user) throw new Error("Missing fixture user")
    userId = user.id
    const session = await ctx.context.internalAdapter.createSession(user.id)
    if (!session) throw new Error("Missing fixture session")
    await setSessionCookie(ctx, { user, session })
    return ctx.json({ id: session.id })
  }) } }] })
  const mint = async () => {
    const response = await fixtureAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/fixture-session", { method: "POST", headers: { origin: "https://admin.siteinabox.nl", host: "admin.siteinabox.nl" } }))
    expect(response.status).toBe(200)
    const body: unknown = await response.json()
    const { id } = z.object({ id: z.string() }).parse(body)
    const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ")
    return { headers: new Headers({ cookie, host: "admin.siteinabox.nl" }), subject: { sessionId: id, email } }
  }
  const first = await mint()
  const ctx = await previewAuth.$context
  const service = new BuilderQuotaService(payload)
  await service.initialize()
  const fence = (device = first) => service.retry(() => service.transaction(async (req) => { await service.lockGlobal(req); await assertCurrentPreviewSessionAuthority(payload, req, device.headers, device.subject) }))
  return { email, userId, first, mint, ctx, fence }
}
describe("original preview session authority at every owning fence", () => {
  it("in-flight mock completion cannot write or settle after original device signs out", async () => {
    const { first, email } = await fixture()
    const service = new BuilderQuotaService(payload, { ...builderQuotaPolicy, enabled: true })
    await service.initialize()
    const eligible = (req?: Parameters<typeof assertCurrentPreviewSessionAuthority>[1]) => assertCurrentPreviewSessionAuthority(payload, req, first.headers, first.subject)
    const admission = await service.reserve(email, { operationId: randomUUID(), message: "Preview authority fixture" }, eligible)
    if (admission.status !== "reserved") throw new Error(`Expected reserved, received ${admission.status}`)
    await service.claim(admission.lease, eligible)
    const execution = new ReservedBuilderExecution(service, admission.lease, eligible)
    let complete: ((value: string) => void) | undefined
    let dispatched: (() => void) | undefined
    const pending = new Promise<string>((resolve) => { complete = resolve })
    const started = new Promise<void>((resolve) => { dispatched = resolve })
    const result = execution.modelCall({ model: "openai/gpt-5.6-luna", reasoningEffort: "low", inputBytes: 100, maxBillableInputTokens: 1050000, maxOutputTokens: 100, maxSteps: 1 }, async () => { dispatched?.(); return pending }, () => ({ inputTokens: 100, outputTokens: 100, cachedInputTokens: 0, cacheCreationInputTokens: 0 }))
    const rejectedResult = expect(result).rejects.toThrow("Preview session authority unavailable")
    try {
      await started
      expect((await previewAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/sign-out", { method: "POST", headers: first.headers }))).status).toBe(200)
      if (!complete) throw new Error("Missing mock completion")
      complete("Unpublishable mock output")
      await rejectedResult
      await expect(execution.assertActive()).rejects.toThrow()
      const write = vi.fn(async () => "saved")
      await expect(execution.withWrite(write)).rejects.toThrow()
      expect(write).not.toHaveBeenCalled()
      await expect(service.settle(admission.lease, eligible, { thread: { customerEmail: email, displayName: "Fixture", contactPhone: "", legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false }, facts: null, clientSlug: null, messages: [] }, result: { ok: true, text: "Unpublishable mock output", messages: [] } })).rejects.toThrow()
      expect(await loadBuilderThread(payload, email)).toBeNull()
      expect(await service.account(email)).toMatchObject({ visibleUsed: 0 })
    } finally { execution.dispose() }
  })
  it("explicit writable renewal extends the same live session and never renews a tombstone", async () => {
    const { first, ctx, userId, fence } = await fixture()
    const source = (await ctx.internalAdapter.listSessions(userId)).find((row) => row.id === first.subject.sessionId)
    if (!source) throw new Error("Missing renewing source session")
    const oldExpiry = new Date(Date.now() + 10000)
    await ctx.internalAdapter.updateSession(source.token, { expiresAt: oldExpiry, updatedAt: new Date(Date.now() - 86400000 * 2) })
    const headers = new Headers(first.headers)
    headers.set("origin", "https://admin.siteinabox.nl")
    const response = await renewPreview(new Request("https://admin.siteinabox.nl/api/siab-auth/preview-renew", { method: "POST", headers }))
    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0)
    const renewed = (await ctx.internalAdapter.listSessions(userId)).find((row) => row.id === first.subject.sessionId)
    expect(renewed?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 86400000)
    await fence(first)
    await previewAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/sign-out", { method: "POST", headers: first.headers }))
    expect((await renewPreview(new Request("https://admin.siteinabox.nl/api/siab-auth/preview-renew", { method: "POST", headers }))).status).toBe(401)
  })
  it("per-device signout fences the original stream while another device remains eligible", async () => {
    const { first, mint, fence } = await fixture()
    const second = await mint()
    await fence(first)
    const response = await previewAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/sign-out", { method: "POST", headers: first.headers }))
    expect(response.status).toBe(200)
    await expect(fence(first)).rejects.toThrow()
    await fence(second)
  })
  it("actual SDK global deleteMany invokes exact per-session tombstones", async () => {
    const { first, mint, ctx, userId, fence } = await fixture()
    const second = await mint()
    const sessions = await ctx.internalAdapter.listSessions(userId)
    await ctx.internalAdapter.deleteSessions(sessions.map((session) => session.token))
    for (const device of [first, second]) {
      await expect(fence(device)).rejects.toThrow()
      const rows = await payload.find({ collection: "preview-session-revocations", where: { betterAuthSessionId: { equals: device.subject.sessionId } }, overrideAccess: true })
      expect(rows.totalDocs).toBe(1)
    }
  })
  it("swallowed tombstone commit makes signout fail rather than claiming live authority revoked", async () => {
    const { first, fence } = await fixture()
    const commit = vi.spyOn(payload.db, "commitTransaction").mockImplementationOnce(async (id) => payload.db.rollbackTransaction(id))
    try {
      const response = await previewAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/sign-out", { method: "POST", headers: first.headers }))
      expect(response.status).toBe(500)
      await fence(first)
    } finally { commit.mockRestore() }
  })
  it("expired source authority denies under the global fence without nested cleanup revocation", async () => {
    const { first, ctx, fence, userId } = await fixture()
    const sessions = await ctx.internalAdapter.listSessions(userId)
    const session = sessions.find((candidate) => candidate.id === first.subject.sessionId)
    if (!session) throw new Error("Missing expiring source session")
    await ctx.internalAdapter.updateSession(session.token, { expiresAt: new Date(Date.now() - 1000) })
    await expect(fence(first)).rejects.toThrow("Preview session authority unavailable")
    expect((await payload.find({ collection: "preview-session-revocations", where: { betterAuthSessionId: { equals: first.subject.sessionId } }, overrideAccess: true })).totalDocs).toBe(0)
  })
  it("an exact tombstone denies a surviving source BA session and original cookies", async () => {
    const { first, email, fence } = await fixture()
    await payload.create({ collection: "preview-session-revocations", data: { betterAuthSessionId: first.subject.sessionId, email, revokedAt: new Date().toISOString() }, overrideAccess: true })
    await expect(fence(first)).rejects.toThrow("Preview session authority unavailable")
  })
})
