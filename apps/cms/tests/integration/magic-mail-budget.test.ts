import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { getTestPayload } from "./_helpers"
import { claimMagicMailAttempt, magicMailAccountKey } from "@/lib/auth/magicMailBudget"
let payload: Awaited<ReturnType<typeof getTestPayload>>
beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) || uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || process.env.SITE_GENERATION_PROVIDER !== "mock") throw new Error("Mail budget requires isolated payload_test with jobs disabled and mock Sitegen")
  payload = await getTestPayload()
}, 60_000)
describe("durable mail budget before transport", () => {
  it("concurrent recipients share one normalized account and only one cooldown claim succeeds", async () => {
    const email = `${randomUUID()}@example.test`
    const outcomes = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => claimMagicMailAttempt(payload, i % 2 ? email.toUpperCase() : ` ${email} `)))
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1)
    const account = await payload.find({ collection: "magic-mail-budgets", where: { budgetKey: { equals: magicMailAccountKey(email) } }, overrideAccess: true })
    expect(account.totalDocs).toBe(1)
    expect(account.docs[0]?.attempts).toBe(1)
    await expect(claimMagicMailAttempt(payload, email)).rejects.toThrow()
  })
  it("four distinct recipients can all claim against the same advancing global receipt", async () => {
    const emails = Array.from({ length: 4 }, () => `${randomUUID()}@example.test`)
    const outcomes = await Promise.allSettled(emails.map((email) => claimMagicMailAttempt(payload, email)))
    const failures = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason instanceof Error ? { name: outcome.reason.name, message: outcome.reason.message, code: "code" in outcome.reason ? outcome.reason.code : undefined } : { name: "unknown" }] : [])
    expect(outcomes.every((outcome) => outcome.status === "fulfilled"), JSON.stringify(failures)).toBe(true)
  })
  it("a swallowed commit acknowledgement cannot authorize transport", async () => {
    const email = `${randomUUID()}@example.test`
    const commit = vi.spyOn(payload.db, "commitTransaction").mockImplementationOnce(async (id) => payload.db.rollbackTransaction(id))
    try {
      await expect(claimMagicMailAttempt(payload, email)).rejects.toThrow()
      expect((await payload.find({ collection: "magic-mail-budgets", where: { budgetKey: { equals: magicMailAccountKey(email) } }, overrideAccess: true })).totalDocs).toBe(0)
    } finally {
      commit.mockRestore()
    }
  })
  it("exhausted account fails without consuming the global attempt", async () => {
    const email = `${randomUUID()}@example.test`, day = new Date().toISOString().slice(0, 10)
    await payload.create({ collection: "magic-mail-budgets", overrideAccess: true, data: { budgetKey: magicMailAccountKey(email), day, attempts: 10 } })
    const before = await payload.find({ collection: "magic-mail-budgets", where: { budgetKey: { not_equals: magicMailAccountKey(email) } }, limit: 100, overrideAccess: true })
    await expect(claimMagicMailAttempt(payload, email)).rejects.toThrow()
    const after = await payload.find({ collection: "magic-mail-budgets", where: { budgetKey: { not_equals: magicMailAccountKey(email) } }, limit: 100, overrideAccess: true })
    expect(after.docs.map((doc) => ({ id: doc.id, attempts: doc.attempts }))).toEqual(before.docs.map((doc) => ({ id: doc.id, attempts: doc.attempts })))
  })
})
