import { z } from "zod"
import type { BuilderModelCall, BuilderTokenUsage } from "./executionContext"

const integer = z.number().int().nonnegative().safe()
export const BuilderQuotaPolicySchema = z.object({
  enabled: z.boolean(), visibleLimit: integer.positive(), globalMaxActive: integer.positive(),
  accountMaxCostUnits: integer.positive(), globalMaxCostUnits: integer.positive(),
  accountMaxAttempts: integer.positive(), globalMaxAttempts: integer.positive(),
  operationCostUnits: integer.positive(), operationMaxCalls: integer.positive(),
  operationMaxWeightedSteps: integer.positive(), operationTimeoutMs: integer.positive(),
  transactionRetries: integer.positive().max(5), configurationRevision: z.string().min(1),
}).strict()
export type BuilderQuotaPolicy = z.infer<typeof BuilderQuotaPolicySchema>
// Engineering ceilings. Customer activation requires separate cost/policy/eval approval.
export const builderQuotaPolicy: BuilderQuotaPolicy = BuilderQuotaPolicySchema.parse({
  enabled: false, visibleLimit: 12, globalMaxActive: 2,
  accountMaxCostUnits: 31_920_000, globalMaxCostUnits: 100_000_000,
  accountMaxAttempts: 100, globalMaxAttempts: 10_000,
  operationCostUnits: 2_660_000, operationMaxCalls: 12, operationMaxWeightedSteps: 16,
  operationTimeoutMs: 120_000, transactionRetries: 3,
  configurationRevision: "pr03-disabled-luna-full-context-v2",
})
const callSchema = z.object({
  model: z.literal("openai/gpt-5.6-luna"), reasoningEffort: z.enum(["low", "medium"]),
  inputBytes: integer.positive().max(64 * 1024), maxOutputTokens: integer.positive().max(8192),
  maxBillableInputTokens: z.literal(1_050_000), maxSteps: integer.positive().max(4),
}).strict()
const stepSchema = z.object({ inputTokens: integer, outputTokens: integer,
  cachedInputTokens: integer.nullable(), cacheCreationInputTokens: integer.nullable(),
}).strict()
const usageSchema = stepSchema.extend({ stepUsage: z.array(stepSchema).optional() }).strict()
const checkedCost = (units: number) => integer.parse(Math.ceil(units))
// Full documented context per wire step, worst cache-write and long-context prices.
// Byte limits bound local payload size; they do not estimate provider token framing.
export function builderCallLiability(raw: BuilderModelCall): number {
  const call = callSchema.parse(raw)
  return checkedCost(call.maxSteps * (call.maxBillableInputTokens * 0.5 + call.maxOutputTokens * 1.8))
}
export function builderKnownCost(raw: BuilderTokenUsage, limits: BuilderModelCall): number {
  const call = callSchema.parse(limits)
  const usage = usageSchema.parse(raw)
  if (usage.inputTokens > call.maxBillableInputTokens * call.maxSteps || usage.outputTokens > call.maxOutputTokens * call.maxSteps) throw new Error("builder_usage_exceeds_envelope")
  const steps = usage.stepUsage ?? (call.maxSteps === 1 ? [usage] : null)
  if (!steps || steps.length < 1 || steps.length > call.maxSteps) throw new Error("builder_usage_missing_steps")
  let total = 0
  let input = 0, output = 0, cachedTotal = 0, createdTotal = 0
  for (const step of steps) {
    if (step.inputTokens > call.maxBillableInputTokens || step.outputTokens > call.maxOutputTokens) throw new Error("builder_usage_exceeds_envelope")
    const cached = step.cachedInputTokens, created = step.cacheCreationInputTokens
    if (cached === null || created === null) throw new Error("builder_usage_unknown_cache")
    if (cached + created > step.inputTokens) throw new Error("builder_usage_invalid")
    const long = step.inputTokens > 272000
    total += (step.inputTokens - cached - created) * (long ? 0.4 : 0.2) + cached * (long ? 0.04 : 0.02) + created * (long ? 0.5 : 0.25) + step.outputTokens * (long ? 1.8 : 1.2)
    input += step.inputTokens; output += step.outputTokens; cachedTotal += cached; createdTotal += created
  }
  if (input !== usage.inputTokens || output !== usage.outputTokens || cachedTotal !== usage.cachedInputTokens || createdTotal !== usage.cacheCreationInputTokens) throw new Error("builder_usage_invalid_aggregate")
  return checkedCost(total)
}
