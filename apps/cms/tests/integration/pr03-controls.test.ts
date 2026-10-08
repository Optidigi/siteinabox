import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { getTestPayload } from "./_helpers"
import { runBudgetedSearch } from "@/lib/builder/costlySearchBudget"
import { BuilderQuotaService } from "@/lib/builder/quota"
import { processInactivePreviews, recordAuthenticatedBuilderActivity, inactivePreviewPolicy } from "@/lib/preview/inactivePreviews"

let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("PR03 controls require isolated payload_test with jobs disabled and mock Sitegen")
  payload = await getTestPayload()
}, 60_000)
const email = () => `controls-${randomUUID()}@example.test`

describe("durable costly-search control", () => {
  it("permits one account request; duplicate contenders cannot dispatch or spend visible AI credits", async () => {
    const customer = email()
    let started!: () => void, release!: () => void
    const admitted = new Promise<void>((resolve) => { started = resolve })
    const pending = new Promise<void>((resolve) => { release = resolve })
    const first = runBudgetedSearch(payload, customer, async () => { started(); await pending; return "result" })
    await admitted
    try {
      const dispatch = vi.fn(async () => "unexpected")
      const contenders = await Promise.allSettled(Array.from({ length: 8 }, () => runBudgetedSearch(payload, customer, dispatch)))
      expect(contenders.every((result) => result.status === "rejected")).toBe(true)
      expect(dispatch).not.toHaveBeenCalled()
      expect(await new BuilderQuotaService(payload).account(customer)).toBeNull()
    } finally { release() }
    expect(await first).toBe("result")
  })
  it("bounds daily account attempts separately from visible turns", async () => {
    const customer = email(), dispatch = vi.fn(async () => "result")
    for (let attempt = 0; attempt < 30; attempt++) await runBudgetedSearch(payload, customer, dispatch)
    await expect(runBudgetedSearch(payload, customer, dispatch)).rejects.toThrow("search_technical_limit")
    expect(dispatch).toHaveBeenCalledTimes(30)
    expect(await new BuilderQuotaService(payload).account(customer)).toBeNull()
  })
  it("retains uncertain remote work across service restart and prevents redispatch", async () => {
    const customer = email()
    await expect(runBudgetedSearch(payload, customer, async () => { throw new Error("unknown remote completion") })).rejects.toThrow("unknown remote completion")
    const dispatch = vi.fn(async () => "unexpected")
    await expect(runBudgetedSearch(payload, customer, dispatch)).rejects.toThrow("search_technical_limit")
    expect(dispatch).not.toHaveBeenCalled()
    const global = await payload.find({ collection: "costly-search-budgets", where: { key: { equals: "global" } }, overrideAccess: true })
    const claims = z.record(z.string(), z.object({ state: z.string() }).passthrough()).parse(global.docs[0]?.activeClaims)
    expect(Object.values(claims).some((claim) => claim.state === "unknown")).toBe(true)
  })
  it("a swallowed transaction rollback cannot authorize a provider call", async () => {
    const service = new BuilderQuotaService(payload)
    await service.initialize()
    const rollback = payload.db.rollbackTransaction.bind(payload.db)
    const commit = vi.spyOn(payload.db, "commitTransaction").mockImplementationOnce(async (id) => { await rollback(id) })
    const dispatch = vi.fn(async () => "unexpected")
    try {
      await expect(runBudgetedSearch(payload, email(), dispatch)).rejects.toThrow()
      expect(dispatch).not.toHaveBeenCalled()
    } finally { commit.mockRestore() }
  })
})

describe("A02 real notice and retained data", () => {
  it("does nothing while policy is unratified", async () => {
    const send = vi.fn(async () => ({ provider: "fixture" }))
    expect(await processInactivePreviews(payload, { sendNotice: send })).toMatchObject({ examined: 0, notices: 0, expired: 0 })
    expect(send).not.toHaveBeenCalled()
  })
  it("requires delivery and a full notice period, then revokes access without deleting content or identity", async () => {
    const key = randomUUID(), customerEmail = email()
    const tenant = await payload.create({ collection: "tenants", overrideAccess: true, data: { name: "Inactive fixture", slug: `inactive-${key}`, domain: `inactive-${key}.test`, status: "provisioning" } })
    const intake = await payload.create({ collection: "intake-submissions", overrideAccess: true, data: { businessName: "Inactive fixture", source: "fixture", status: "submitted", idempotencyKey: key, raw: {} } })
    const run = await payload.create({ collection: "site-generation-runs", overrideAccess: true, data: { intakeSubmission: intake.id, status: "preview_ready", provider: "mock", model: "fixture:generic", idempotencyKey: key, normalizedIntake: {}, normalizedIntakeHash: key, promptVersion: "fixture", generationInputHash: key, tenant: tenant.id } })
    const grant = await payload.create({ collection: "preview-access-grants", overrideAccess: true, data: { customerEmail, tenant: tenant.id, generationRun: run.id, clientSlug: tenant.slug, expiryPolicy: "inactivity", expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString() } })
    await recordAuthenticatedBuilderActivity(payload, customerEmail)
    const account = await new BuilderQuotaService(payload).account(customerEmail)
    if (!account) throw new Error("Missing activity account")
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString()
    await payload.update({ collection: "builder-quota-accounts", id: account.id, overrideAccess: true, data: { lastActivityAt: old } })
    const policy = { ...inactivePreviewPolicy, enabled: true }, send = vi.fn(async () => ({ provider: "fixture", providerMessageId: "notice-receipt" }))
    expect(await processInactivePreviews(payload, { policy, sendNotice: send })).toMatchObject({ notices: 1, expired: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(await processInactivePreviews(payload, { policy, sendNotice: send })).toMatchObject({ notices: 0, expired: 0 })
    const noticed = await payload.findByID({ collection: "preview-access-grants", id: grant.id, overrideAccess: true })
    expect(noticed.inactiveNoticeState).toBe("sent")
    await payload.update({ collection: "preview-access-grants", id: grant.id, overrideAccess: true, data: { inactiveNoticeSentAt: old, inactiveExpiresAt: old } })
    expect(await processInactivePreviews(payload, { policy, sendNotice: send })).toMatchObject({ expired: 1 })
    expect((await payload.findByID({ collection: "preview-access-grants", id: grant.id, overrideAccess: true })).revokedAt).toBeTruthy()
    expect((await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })).id).toBe(tenant.id)
    expect((await payload.findByID({ collection: "site-generation-runs", id: run.id, overrideAccess: true })).id).toBe(run.id)
    expect(await new BuilderQuotaService(payload).account(customerEmail)).toBeTruthy()
  })
})
