import "server-only"
import { z } from "zod"
import type { PayloadRequest } from "payload"
import type { BuilderExecutionContext, BuilderModelCall, BuilderTokenUsage } from "./executionContext"
import { BuilderQuotaError, type BuilderEligibilityCheck, type BuilderOperationLease, BuilderQuotaService } from "./quota"
import { builderCallLiability, builderKnownCost } from "./quotaPolicy"
import { quotaAccountSchema, quotaGlobalSchema, quotaOperationSchema } from "./quotaSchemas"

export class ReservedBuilderExecution implements BuilderExecutionContext {
  readonly signal: AbortSignal
  readonly deadlineAt: string
  private readonly controller = new AbortController()
  private readonly timer: ReturnType<typeof setTimeout>
  private readonly disconnect: () => void
  constructor(readonly service: BuilderQuotaService, readonly lease: BuilderOperationLease, private readonly eligible: BuilderEligibilityCheck, requestSignal?: AbortSignal) {
    this.deadlineAt = lease.deadlineAt
    this.disconnect = () => this.controller.abort(new BuilderQuotaError("builder_disconnected"))
    this.signal = this.controller.signal
    requestSignal?.addEventListener("abort", this.disconnect, { once: true })
    if (requestSignal?.aborted) this.disconnect()
    this.timer = setTimeout(() => this.controller.abort(new BuilderQuotaError("builder_deadline_exceeded")), Math.max(0, Date.parse(lease.deadlineAt) - Date.now()))
    this.timer.unref?.()
    this.requestSignal = requestSignal
  }
  private readonly requestSignal?: AbortSignal
  dispose(): void { clearTimeout(this.timer); this.requestSignal?.removeEventListener("abort", this.disconnect) }
  async assertActive(): Promise<void> {
    if (this.signal.aborted) throw new BuilderQuotaError("builder_execution_aborted")
    await this.eligible()
    await this.service.readLease(this.lease)
    const owner = await this.service.account(this.lease.customerEmail)
    if (!owner || owner.activeOperationKey !== this.lease.operationKey || owner.visibleReserved !== 1) throw new BuilderQuotaError("builder_lease_lost")
  }
  async modelCall<T>(limits: BuilderModelCall, generate: (signal: AbortSignal) => Promise<T>, usage: (result: T) => BuilderTokenUsage | null | Promise<BuilderTokenUsage | null>): Promise<T> {
    await this.assertActive()
    const cost = builderCallLiability(limits)
    const dispatch = await this.service.ownedWrite(this.lease, this.eligible, async (req, op, owner, global) => {
      if (this.signal.aborted) throw new BuilderQuotaError("builder_execution_aborted")
      if (op.dispatchedCostUnits + cost > op.reservedCostUnits || op.modelCalls + 1 > this.service.policy.operationMaxCalls || op.weightedSteps + limits.maxSteps > this.service.policy.operationMaxWeightedSteps || owner.attempts + limits.maxSteps > this.service.policy.accountMaxAttempts || global.attempts + limits.maxSteps > this.service.policy.globalMaxAttempts) throw new BuilderQuotaError("builder_model_budget_exhausted")
      await this.service.cas("builder-quota-global", global, { attempts: global.attempts + limits.maxSteps }, quotaGlobalSchema, req)
      await this.service.cas("builder-quota-accounts", owner, { attempts: owner.attempts + limits.maxSteps }, quotaAccountSchema, req)
      return this.service.cas("builder-operations", op, { dispatchedCostUnits: op.dispatchedCostUnits + cost, modelCalls: op.modelCalls + 1, weightedSteps: op.weightedSteps + limits.maxSteps, unknownCalls: op.unknownCalls + 1, outstandingCalls: op.outstandingCalls + 1, costKnown: false }, quotaOperationSchema, req)
    })
    // SDK commit swallowing/lost acknowledgement cannot authorize paid work.
    const durable = await this.service.readLease(this.lease)
    if (durable.revision !== dispatch.revision || durable.dispatchedCostUnits !== dispatch.dispatchedCostUnits || durable.modelCalls !== dispatch.modelCalls) throw new BuilderQuotaError("builder_dispatch_commit_unverified")
    if (this.signal.aborted) throw new BuilderQuotaError("builder_execution_aborted")
    let abortListener: (() => void) | undefined
    const aborted = new Promise<never>((_, reject) => {
      abortListener = () => reject(new BuilderQuotaError("builder_execution_aborted"))
      this.signal.addEventListener("abort", abortListener, { once: true })
      if (this.signal.aborted) abortListener()
    })
    try {
      // Aborting local waiting cannot prove provider completion. Unknown cost
      // and the technical slot remain durable until authoritative proof exists.
      const result = await Promise.race([generate(this.signal), aborted])
      await this.assertActive()
      const actual = await usage(result)
      const knownCost = actual && actual.cachedInputTokens !== null && actual.cacheCreationInputTokens !== null ? builderKnownCost(actual, limits) : null
      if (knownCost !== null && knownCost > cost) throw new BuilderQuotaError("builder_usage_exceeds_envelope")
      await this.service.ownedWrite(this.lease, this.eligible, async (req, op) => {
        if (op.outstandingCalls < 1 || op.unknownCalls < 1 || knownCost !== null && op.knownCostUnits + knownCost > op.reservedCostUnits) throw new BuilderQuotaError("builder_usage_invalid")
        await this.service.cas("builder-operations", op, { outstandingCalls: op.outstandingCalls - 1,
          ...(knownCost !== null ? { knownCostUnits: op.knownCostUnits + knownCost, unknownCalls: op.unknownCalls - 1, costKnown: op.unknownCalls === 1 } : {}),
        }, quotaOperationSchema, req)
      })
      return result
    } finally { if (abortListener) this.signal.removeEventListener("abort", abortListener) }
  }
  async withWrite<T>(mutation: (req: Partial<PayloadRequest>) => Promise<T>): Promise<T> {
    await this.assertActive()
    const result = await this.service.ownedWrite(this.lease, this.eligible, async (req) => {
      if (this.signal.aborted) throw new BuilderQuotaError("builder_execution_aborted")
      const value = await mutation(req)
      if (this.signal.aborted) throw new BuilderQuotaError("builder_execution_aborted")
      return value
    })
    // Readback proves the operation is still owned after callback commit.
    await this.assertActive()
    return result
  }
  async recordGenerationReferences(references: { intakeSubmissionId?: number; generationRunId?: number }): Promise<void> {
    const parsed = z.object({ intakeSubmissionId: z.number().int().positive().safe().optional(), generationRunId: z.number().int().positive().safe().optional() }).strict().parse(references)
    await this.service.ownedWrite(this.lease, this.eligible, async (req, op) => {
      await this.service.cas("builder-operations", op, parsed, quotaOperationSchema, req)
    })
  }
}
