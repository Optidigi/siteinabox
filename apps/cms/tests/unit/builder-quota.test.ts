import { createInitializedTestPayload } from "../_helpers/testPayload"
import { describe, expect, it, vi } from "vitest"
import { BuilderQuotaService, assertLiveBuilderTransaction, builderOperationKey } from "@/lib/builder/quota"
import { builderCallLiability, builderKnownCost, builderQuotaPolicy } from "@/lib/builder/quotaPolicy"
import { builderOperationInputSchema, quotaGlobalSchema, quotaOperationSchema } from "@/lib/builder/quotaSchemas"

// The existing fixture initializes the installed SDK without connecting to a DB.
// Missing-session tests guard its root-connection fallback before dispatch.
const fixture = async () => {
  const payload = await createInitializedTestPayload()
  return { payload, service: new BuilderQuotaService(payload) }
}
const limits = { model: "openai/gpt-5.6-luna", reasoningEffort: "low", inputBytes: 65536, maxOutputTokens: 8192, maxSteps: 4 } as const
const operationId = "1173a72f-c975-4c48-a033-c79a1cc0a248"

describe("durable builder quota boundaries", () => {
  it("blocks the pinned SDK fallback before an atomic write if its transaction session disappeared", async () => {
    const { payload, service } = await fixture()
    const update = vi.spyOn(payload.db, "updateOne")
    const global = quotaGlobalSchema.parse({ id: 1, key: "builder", revision: 0, activeOperations: 0, chargedCostUnits: 0, attempts: 0, ingressDay: "2026-10-08", ingressRequests: 0 })
    await expect(service.cas("builder-quota-global", global, { activeOperations: 1 }, quotaGlobalSchema, { transactionID: "lost-session" })).rejects.toThrow("builder_transaction_lost")
    expect(update).not.toHaveBeenCalled()
    expect(() => assertLiveBuilderTransaction(payload, {})).toThrow("builder_transaction_lost")
  })
  it("blocks transactional reads with a stale transaction instead of calling the root DB", async () => {
    const { payload, service } = await fixture()
    const find = vi.spyOn(payload, "find")
    await expect(service.account("fixture@example.test", { transactionID: "lost-session" })).rejects.toThrow("builder_transaction_lost")
    expect(find).not.toHaveBeenCalled()
  })
  it("keeps customer activation disabled and reports the twelve-turn view", async () => {
    const { service } = await fixture()
    vi.spyOn(service, "operation").mockResolvedValue(null)
    vi.spyOn(service, "account").mockResolvedValue(null)
    const eligible = vi.fn(async () => undefined)
    expect(await service.reserve("Fixture@Example.Test", { operationId, message: "Build a bakery" }, eligible)).toEqual({ status: "denied", reason: "builder_activation_disabled", quota: { limit: 12, used: 0, reserved: 0, remaining: 12 } })
    expect(eligible).toHaveBeenCalledOnce()
    expect(builderQuotaPolicy.enabled).toBe(false)
  })
  it("preserves account identity independently of device/thread IDs and refuses a changed-text UUID", async () => {
    const { service } = await fixture()
    expect(builderOperationKey(" Fixture@Example.Test ", operationId)).toBe(builderOperationKey("fixture@example.test", operationId))
    const op = quotaOperationSchema.parse({ id: 1, operationKey: "key", operationId, customerEmail: "fixture@example.test", messageHash: "0".repeat(64), state: "succeeded", reservationToken: operationId, revision: 2, reservedCostUnits: 200000, settledCostUnits: 1, dispatchedCostUnits: 2, knownCostUnits: 1, modelCalls: 1, weightedSteps: 1, unknownCalls: 0, outstandingCalls: 0, costKnown: true, slotHeld: false, startedAt: new Date().toISOString(), deadlineAt: new Date().toISOString(), configurationRevision: "fixture", result: { ok: true, text: "Complete", messages: [] } })
    expect(service.replay(op, "1".repeat(64), service.view())).toMatchObject({ status: "denied", reason: "operation_conflict" })
    expect(service.replay(op, op.messageHash, service.view())).toMatchObject({ status: "complete", result: op.result })
  })
  it("requires a UUID, enforces the message cap and rejects caller account authority", () => {
    expect(builderOperationInputSchema.safeParse({ message: "Build a bakery" }).success).toBe(false)
    expect(builderOperationInputSchema.safeParse({ operationId, message: "x".repeat(4001) }).success).toBe(false)
    expect(builderOperationInputSchema.safeParse({ operationId, message: "Bakery", customerEmail: "forged@example.test" }).success).toBe(false)
  })
  it("charges the weighted maxSteps liability and rejects unbounded payload/usage", () => {
    expect(builderCallLiability(limits)).toBe(Math.ceil(4 * (65536 * 0.25 + 8192 * 1.2)))
    expect(() => builderCallLiability({ ...limits, inputBytes: 65537 })).toThrow()
    expect(() => builderCallLiability({ ...limits, maxOutputTokens: 8193 })).toThrow()
    expect(() => builderKnownCost({ inputTokens: 1, outputTokens: 32769, cachedInputTokens: 0, cacheCreationInputTokens: 0 }, limits)).toThrow("builder_usage_exceeds_envelope")
    expect(builderKnownCost({ inputTokens: 100, outputTokens: 100, cachedInputTokens: 20, cacheCreationInputTokens: 10 }, limits)).toBe(137)
  })
})
