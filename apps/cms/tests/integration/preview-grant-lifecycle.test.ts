import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { getTestPayload } from "./_helpers"
import { createOrRefreshPreviewGrant, loadPreviewGrantAuthority } from "@/lib/preview/previewAccess"
import { inactivePreviewPolicy, processInactivePreviews, recordAuthenticatedBuilderActivity } from "@/lib/preview/inactivePreviews"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { assertBuilderAccountEligible } from "@/lib/builder/access"

let payload: Awaited<ReturnType<typeof getTestPayload>>
const DAY = 86400000
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("Preview lifecycle requires isolated payload_test, disabled jobs and mock Sitegen")
  payload = await getTestPayload()
}, 60000)
async function fixture() {
  const key = randomUUID(), email = `lifecycle-${key}@example.test`
  const tenant = await payload.create({ collection: "tenants", overrideAccess: true, data: { name: "Lifecycle fixture", slug: `lifecycle-${key}`, domain: `lifecycle-${key}.test`, status: "provisioning" } })
  const intake = await payload.create({ collection: "intake-submissions", overrideAccess: true, data: { businessName: "Lifecycle fixture", source: "fixture", status: "submitted", idempotencyKey: key, raw: {} } })
  const run = await payload.create({ collection: "site-generation-runs", overrideAccess: true, data: { intakeSubmission: intake.id, status: "preview_ready", provider: "mock", model: "fixture:generic", idempotencyKey: key, normalizedIntake: {}, normalizedIntakeHash: key, promptVersion: "fixture", generationInputHash: key, tenant: tenant.id } })
  const grant = await createOrRefreshPreviewGrant({ generationRunId: run.id, customerEmail: email })
  await payload.create({ collection: "builder-sessions", overrideAccess: true, data: { customerEmail: email, displayName: "Fixture", legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false }, messages: [], clientSlug: grant.clientSlug } })
  await recordAuthenticatedBuilderActivity(payload, email)
  const service = new BuilderQuotaService(payload)
  const owner = await service.account(email)
  if (!owner) throw new Error("Missing lifecycle account")
  const access = () => loadPreviewGrantAuthority({ email, clientSlug: grant.clientSlug })
  const builder = () => service.transaction(async (req) => { await service.lockGlobal(req); await assertBuilderAccountEligible(payload, email, req) })
  return { email, tenant, run, grant, owner, service, access, builder }
}
describe("explicit grant expiry versus disabled/notice-based inactivity", () => {
  it("new inactivity grants retain result/checkout at day14 and31 while disabled, even after twelve turns", async () => {
    const value = await fixture()
    expect(value.grant.expiryPolicy).toBe("inactivity")
    expect(value.grant.expiresAt).toBeFalsy()
    await payload.update({ collection: "preview-access-grants", id: value.grant.id, overrideAccess: true, data: { expiresAt: new Date(Date.now() - 14 * DAY).toISOString() } })
    await payload.update({ collection: "builder-quota-accounts", id: value.owner.id, overrideAccess: true, data: { visibleUsed: 12, lastActivityAt: new Date(Date.now() - 31 * DAY).toISOString() } })
    const send = vi.fn(async () => ({ provider: "fixture" }))
    expect(await processInactivePreviews(payload, { afterId: value.grant.id - 1, limit: 1, sendNotice: send })).toMatchObject({ examined: 0, expired: 0 })
    expect(send).not.toHaveBeenCalled()
    await value.access()
    await value.builder()
    expect((await value.service.account(value.email))?.visibleUsed).toBe(12)
  })
  it("failed/unknown notice never expires access; authenticated activity restarts the notice clock", async () => {
    const value = await fixture()
    await payload.update({ collection: "builder-quota-accounts", id: value.owner.id, overrideAccess: true, data: { lastActivityAt: new Date(Date.now() - 31 * DAY).toISOString() } })
    const send = vi.fn(async () => { throw new Error("Unknown fixture delivery") })
    const policy = { ...inactivePreviewPolicy, enabled: true }
    await processInactivePreviews(payload, { afterId: value.grant.id - 1, limit: 1, policy, sendNotice: send })
    await processInactivePreviews(payload, { afterId: value.grant.id - 1, limit: 1, policy, sendNotice: send })
    expect(send).toHaveBeenCalledTimes(1)
    await value.access()
    await value.builder()
    await recordAuthenticatedBuilderActivity(payload, value.email)
    expect((await processInactivePreviews(payload, { afterId: value.grant.id - 1, limit: 1, policy, sendNotice: send })).expired).toBe(0)
    await value.access()
  })
  it("delivered notice permits expiry only after a full seven days; automatic refresh never restores it", async () => {
    const value = await fixture()
    const old = new Date(Date.now() - 31 * DAY).toISOString()
    await payload.update({ collection: "builder-quota-accounts", id: value.owner.id, overrideAccess: true, data: { lastActivityAt: old } })
    const policy = { ...inactivePreviewPolicy, enabled: true }, send = vi.fn(async () => ({ provider: "fixture", providerMessageId: "fixture-delivered" }))
    await processInactivePreviews(payload, { afterId: value.grant.id - 1, limit: 1, policy, sendNotice: send })
    await value.access()
    await value.builder()
    await payload.update({ collection: "preview-access-grants", id: value.grant.id, overrideAccess: true, data: { inactiveNoticeSentAt: new Date(Date.now() - 8 * DAY).toISOString(), inactiveExpiresAt: new Date(Date.now() - DAY).toISOString() } })
    await processInactivePreviews(payload, { afterId: value.grant.id - 1, limit: 1, policy, sendNotice: send })
    await expect(value.access()).rejects.toThrow("Preview access is not available")
    await expect(value.builder()).rejects.toThrow("builder_preview_revoked")
    await expect(createOrRefreshPreviewGrant({ generationRunId: value.run.id, customerEmail: value.email })).rejects.toThrow("Preview access is not available")
    expect((await payload.findByID({ collection: "preview-access-grants", id: value.grant.id, overrideAccess: true })).inactiveExpiredAt).toBeTruthy()
  })
  it("fixed expired grants and explicit revocations deny; automatic refresh preserves both", async () => {
    for (const kind of ["fixed", "revoked"] as const) {
      const value = await fixture()
      await payload.update({ collection: "preview-access-grants", id: value.grant.id, overrideAccess: true, data: kind === "fixed" ? { expiryPolicy: "fixed", expiresAt: new Date(Date.now() - DAY).toISOString() } : { revokedAt: new Date().toISOString() } })
      await expect(value.access()).rejects.toThrow("Preview access is not available")
      await expect(value.builder()).rejects.toThrow("builder_preview_revoked")
      await expect(createOrRefreshPreviewGrant({ generationRunId: value.run.id, customerEmail: value.email })).rejects.toThrow("Preview access is not available")
    }
  })
  it("the SDK hook rejects missing fixed deadlines and preserves fixed expiry on partial updates", async () => {
    const value = await fixture()
    await expect(payload.update({ collection: "preview-access-grants", id: value.grant.id, overrideAccess: true, data: { expiryPolicy: "fixed", expiresAt: null } })).rejects.toThrow("Fixed preview grants require an expiry date")
    const expiresAt = new Date(Date.now() + DAY).toISOString()
    await payload.update({ collection: "preview-access-grants", id: value.grant.id, overrideAccess: true, data: { expiryPolicy: "fixed", expiresAt } })
    const refreshed = await createOrRefreshPreviewGrant({ generationRunId: value.run.id, customerEmail: value.email })
    expect(refreshed.expiryPolicy).toBe("fixed")
    expect(refreshed.expiresAt).toBe(expiresAt)
    const send = vi.fn(async () => ({ provider: "fixture" }))
    await processInactivePreviews(payload, { afterId: value.grant.id - 1, limit: 1, policy: { ...inactivePreviewPolicy, enabled: true }, sendNotice: send })
    expect(send).not.toHaveBeenCalled()
  })
})
