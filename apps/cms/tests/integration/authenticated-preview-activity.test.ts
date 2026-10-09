import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { betterAuth } from "better-auth"
import { createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import { getTestPayload } from "./_helpers"
import { previewAuth } from "@/lib/preview/betterAuth"
import { createOrRefreshPreviewGrant } from "@/lib/preview/previewAccess"
import { recordVerifiedPreviewActivity } from "@/lib/preview/authenticatedPreviewActivity"
import { BuilderQuotaService } from "@/lib/builder/quota"
let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock" || process.env.BETTER_AUTH_API_KEY) throw new Error("Activity regression requires isolated payload_test, jobs disabled and mock Sitegen")
  payload = await getTestPayload()
}, 60000)
async function fixture() {
  const key = randomUUID(), email = `preview-activity-${key}@example.test`
  const tenant = await payload.create({ collection: "tenants", overrideAccess: true, data: { name: "Activity fixture", slug: `activity-${key}`, domain: `activity-${key}.test`, status: "provisioning" } })
  const intake = await payload.create({ collection: "intake-submissions", overrideAccess: true, data: { businessName: "Activity fixture", source: "fixture", status: "submitted", idempotencyKey: key, raw: {} } })
  const run = await payload.create({ collection: "site-generation-runs", overrideAccess: true, data: { intakeSubmission: intake.id, status: "preview_ready", provider: "mock", model: "fixture:generic", idempotencyKey: key, normalizedIntake: {}, normalizedIntakeHash: key, promptVersion: "fixture", generationInputHash: key, tenant: tenant.id } })
  const grant = await createOrRefreshPreviewGrant({ generationRunId: run.id, customerEmail: email })
  const fixtureAuth = betterAuth({ ...previewAuth.options, plugins: [...(previewAuth.options.plugins ?? []), { id: "activity-fixture", endpoints: { fixtureSession: createAuthEndpoint("/fixture-session", { method: "POST" }, async (ctx) => {
    const user = await ctx.context.internalAdapter.createUser({ email, name: "Activity fixture", emailVerified: true })
    if (!user) throw new Error("Missing fixture user")
    const session = await ctx.context.internalAdapter.createSession(user.id)
    if (!session) throw new Error("Missing fixture session")
    await setSessionCookie(ctx, { user, session })
    return ctx.json({ ok: true })
  }) } }] })
  const response = await fixtureAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/fixture-session", { method: "POST", headers: { host: "admin.siteinabox.nl", origin: "https://admin.siteinabox.nl" } }))
  expect(response.status).toBe(200)
  const headers = new Headers({ host: "admin.siteinabox.nl", cookie: response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ") })
  const service = new BuilderQuotaService(payload)
  return { email, grant, headers, service }
}
describe("verified direct-preview activity under the actual global transaction", () => {
  it("a valid signed visit advances activity; forged, revoked and expired authority cannot", async () => {
    const value = await fixture()
    await recordVerifiedPreviewActivity(value.headers, value.grant.clientSlug)
    const before = await value.service.account(value.email)
    expect(before?.lastActivityAt).toBeTruthy()
    await expect(recordVerifiedPreviewActivity(new Headers({ host: "admin.siteinabox.nl", cookie: "siab-preview-auth.session_token=forged" }), value.grant.clientSlug)).rejects.toThrow()
    await payload.update({ collection: "preview-access-grants", id: value.grant.id, overrideAccess: true, data: { revokedAt: new Date().toISOString() } })
    await expect(recordVerifiedPreviewActivity(value.headers, value.grant.clientSlug)).rejects.toThrow()
    expect((await value.service.account(value.email))?.lastActivityAt).toBe(before?.lastActivityAt)
    const fixed = await fixture()
    await payload.update({ collection: "preview-access-grants", id: fixed.grant.id, overrideAccess: true, data: { expiryPolicy: "fixed", expiresAt: "2000-01-01T00:00:00.000Z" } })
    await expect(recordVerifiedPreviewActivity(fixed.headers, fixed.grant.clientSlug)).rejects.toThrow()
    expect(await fixed.service.account(fixed.email)).toBeNull()
  })
  it("a swallowed activity commit fails its durable receipt and does not claim a retained visit", async () => {
    const value = await fixture()
    await recordVerifiedPreviewActivity(value.headers, value.grant.clientSlug)
    const before = await value.service.account(value.email)
    const commit = vi.spyOn(payload.db, "commitTransaction").mockImplementationOnce(async (id) => payload.db.rollbackTransaction(id))
    try { await expect(recordVerifiedPreviewActivity(value.headers, value.grant.clientSlug)).rejects.toThrow("Preview activity commit receipt unavailable") }
    finally { commit.mockRestore() }
    expect((await value.service.account(value.email))?.lastActivityAt).toBe(before?.lastActivityAt)
  })
})
