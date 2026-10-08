import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { APIError } from "better-auth/api"
import type { Payload, PayloadRequest } from "payload"
import { z } from "zod"
import { BuilderQuotaError, BuilderQuotaService } from "@/lib/builder/quota"
import { builderQuotaPolicy } from "@/lib/builder/quotaPolicy"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"

const budgetSchema = z.object({ id: z.number().int().positive(), budgetKey: z.string(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), attempts: z.number().int().nonnegative().max(500), lastClaimToken: z.string().nullish(), lastClaimAt: z.string().datetime().nullish() })
type MailBudget = z.infer<typeof budgetSchema>
export const magicMailAccountKey = (email: string) => createHash("sha256").update(`magic-mail:${z.email().parse(email.trim().toLowerCase())}`).digest("hex")
const globalKey = createHash("sha256").update("magic-mail:global").digest("hex")

export function nextMagicMailAttempt(budget: MailBudget, now: Date, global: boolean): number {
  const day = now.toISOString().slice(0, 10)
  const attempts = budget.day === day ? budget.attempts : 0
  if (attempts >= (global ? 500 : 10)) throw new APIError("TOO_MANY_REQUESTS", { message: "Email link limit reached. Try again later." })
  if (!global && budget.lastClaimAt && now.getTime() - new Date(budget.lastClaimAt).getTime() < 60_000) throw new APIError("TOO_MANY_REQUESTS", { message: "Wait before requesting another email link." })
  return attempts + 1
}

async function loadBudget(payload: Payload, req: Partial<PayloadRequest>, budgetKey: string, day: string): Promise<MailBudget> {
  assertLiveBuilderTransaction(payload, req)
  const result = await payload.find({ collection: "magic-mail-budgets", where: { budgetKey: { equals: budgetKey } }, limit: 2, depth: 0, overrideAccess: true, req })
  if (result.totalDocs > 1) throw new Error("Duplicate magic mail authority")
  const existing = result.docs[0]
  if (existing) return budgetSchema.parse(existing)
  assertLiveBuilderTransaction(payload, req)
  return budgetSchema.parse(await payload.create({ collection: "magic-mail-budgets", data: { budgetKey, day, attempts: 0 }, overrideAccess: true, req }))
}

// Claims count attempts before transport. Failed or unknown transport outcomes
// remain consumed; replay never refunds a provider attempt.
export async function claimMagicMailAttempt(payload: Payload, email: string): Promise<void> {
  const accountKey = magicMailAccountKey(email)
  // Five bounded CAS rounds allow four distinct recipients to serialize;
  // this changes retry opportunity, never recipient/global mail allowances.
  const service = new BuilderQuotaService(payload, { ...builderQuotaPolicy, transactionRetries: 5 })
  await service.initialize()
  const token = randomUUID()
  const receipt = await service.retry(() => service.transaction(async (req) => {
    await service.lockGlobal(req)
    const now = new Date(), day = now.toISOString().slice(0, 10)
    const global = await loadBudget(payload, req, globalKey, day)
    const account = await loadBudget(payload, req, accountKey, day)
    const budgets = [{ row: global, attempts: nextMagicMailAttempt(global, now, true) }, { row: account, attempts: nextMagicMailAttempt(account, now, false) }]
    for (const budget of budgets) {
      assertLiveBuilderTransaction(payload, req)
      await payload.update({ collection: "magic-mail-budgets", id: budget.row.id, data: { day, attempts: budget.attempts, lastClaimToken: token, lastClaimAt: now.toISOString() }, overrideAccess: true, req })
    }
    return budgets.map((budget) => ({ id: budget.row.id, day, attempts: budget.attempts, global: budget.row.budgetKey === globalKey }))
  })).catch((error: unknown) => {
    if (error instanceof BuilderQuotaError && error.code === "builder_quota_contention") throw new APIError("TOO_MANY_REQUESTS", { message: "Email link requests are busy. Try again later." })
    throw error
  })
  // The exact recipient token proves the atomic account/global commit. Other
  // recipients may advance the global row before this readback; its counter
  // must retain at least this claim. Missing receipts skip transport.
  for (const expected of receipt) {
    const committed = budgetSchema.parse(await payload.findByID({ collection: "magic-mail-budgets", id: expected.id, depth: 0, overrideAccess: true }))
    if (committed.day !== expected.day || (expected.global ? committed.attempts < expected.attempts : committed.lastClaimToken !== token || committed.attempts !== expected.attempts)) throw new Error("Magic mail commit receipt unavailable")
  }
}
