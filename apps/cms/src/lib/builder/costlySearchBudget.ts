import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { z } from "zod"
import type { Payload, PayloadRequest } from "payload"
import { BuilderQuotaService } from "./quota"
import { assertLiveBuilderTransaction } from "./quotaTransaction"

const claimsSchema = z.record(z.string(), z.object({ accountKey: z.string(), startedAt: z.string().datetime(), state: z.enum(["running", "unknown"]) }))
const rowSchema = z.object({ id: z.number().int().positive(), key: z.string(), day: z.string(), attempts: z.number().int().nonnegative().safe(), activeClaims: claimsSchema })
// Independent technical limits. Search never spends a visible builder turn.
export const costlySearchPolicy = { accountDailyAttempts: 30, globalDailyAttempts: 500, globalConcurrency: 2 } as const
export class CostlySearchBudgetError extends Error {}

export async function runBudgetedSearch<T>(payload: Payload, email: string, search: () => Promise<T>): Promise<T> {
  const normalized = z.email().parse(email.trim().toLowerCase())
  const accountKey = `account:${createHash("sha256").update(normalized).digest("hex")}`
  const token = randomUUID(), day = new Date().toISOString().slice(0, 10)
  const service = new BuilderQuotaService(payload)
  await service.initialize()
  const row = async (key: string, req?: Partial<PayloadRequest>) => {
    if (req) assertLiveBuilderTransaction(payload, req)
    const result = await payload.find({ collection: "costly-search-budgets", where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true, req })
    if (result.docs[0]) return rowSchema.parse(result.docs[0])
    if (!req) throw new CostlySearchBudgetError("search_claim_missing")
    assertLiveBuilderTransaction(payload, req)
    return rowSchema.parse(await payload.create({ collection: "costly-search-budgets", req, overrideAccess: true, data: { key, day, attempts: 0, activeClaims: {} } }))
  }
  const mutate = async (current: z.infer<typeof rowSchema>, data: { day?: string; attempts?: number; activeClaims?: z.infer<typeof claimsSchema> }, req: Partial<PayloadRequest>) => {
    assertLiveBuilderTransaction(payload, req)
    return rowSchema.parse(await payload.update({ collection: "costly-search-budgets", id: current.id, req, overrideAccess: true, data }))
  }
  await service.retry(() => service.transaction(async (req) => {
    await service.lockGlobal(req)
    const global = await row("global", req), account = await row(accountKey, req)
    const globalAttempts = global.day === day ? global.attempts : 0
    const accountAttempts = account.day === day ? account.attempts : 0
    if (accountAttempts >= costlySearchPolicy.accountDailyAttempts || globalAttempts >= costlySearchPolicy.globalDailyAttempts || Object.keys(account.activeClaims).length || Object.keys(global.activeClaims).length >= costlySearchPolicy.globalConcurrency) throw new CostlySearchBudgetError("search_technical_limit")
    const claim = { accountKey, startedAt: new Date().toISOString(), state: "running" as const }
    await mutate(global, { day, attempts: globalAttempts + 1, activeClaims: { ...global.activeClaims, [token]: claim } }, req)
    await mutate(account, { day, attempts: accountAttempts + 1, activeClaims: { [token]: claim } }, req)
  }))
  // A lost/swallowed commit acknowledgement cannot authorize a provider call.
  const durableGlobal = await row("global"), durableAccount = await row(accountKey)
  if (durableGlobal.activeClaims[token]?.accountKey !== accountKey || durableAccount.activeClaims[token]?.accountKey !== accountKey) throw new CostlySearchBudgetError("search_commit_unverified")
  try {
    const result = await search()
    await service.retry(() => service.transaction(async (req) => {
      await service.lockGlobal(req)
      for (const key of ["global", accountKey]) {
        const current = await row(key, req)
        if (current.activeClaims[token]?.accountKey !== accountKey) throw new CostlySearchBudgetError("search_claim_missing")
        const activeClaims = { ...current.activeClaims }
        delete activeClaims[token]
        await mutate(current, { activeClaims }, req)
      }
    }))
    return result
  } catch (error) {
    // A timeout/abort does not prove provider completion. Retain the slot and
    // attempt until independent provider/runtime proof resolves uncertainty.
    await service.retry(() => service.transaction(async (req) => {
      await service.lockGlobal(req)
      for (const key of ["global", accountKey]) {
        const current = await row(key, req), claim = current.activeClaims[token]
        if (claim) await mutate(current, { activeClaims: { ...current.activeClaims, [token]: { ...claim, state: "unknown" } } }, req)
      }
    })).catch(() => undefined)
    throw error
  }
}
