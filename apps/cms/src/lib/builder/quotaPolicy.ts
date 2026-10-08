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
  accountMaxCostUnits: 2_400_000, globalMaxCostUnits: 20_000_000,
  accountMaxAttempts: 100, globalMaxAttempts: 10_000,
  operationCostUnits: 200_000, operationMaxCalls: 12, operationMaxWeightedSteps: 16,
  operationTimeoutMs: 120_000, transactionRetries: 3,
  configurationRevision: "pr03-disabled-luna-ceilings-v1",
})
const callSchema = z.object({
  model: z.literal("openai/gpt-5.6-luna"), reasoningEffort: z.enum(["low", "medium"]),
  inputBytes: integer.positive().max(64 * 1024), maxOutputTokens: integer.positive().max(8192),
  maxSteps: integer.positive().max(4),
}).strict()
const usageSchema = z.object({ inputTokens: integer, outputTokens: integer,
  cachedInputTokens: integer.nullable(), cacheCreationInputTokens: integer.nullable(),
}).strict()
const checkedCost = (units: number) => integer.parse(Math.ceil(units))
// USD micro-units: $.20/M input, $.25/M cache creation, $1.20/M output.
// Every input byte is conservatively treated as a token. Reject long context;
// do not silently apply base prices to an unbounded or multiplier-priced call.
export function builderCallLiability(raw: BuilderModelCall): number {
  const call = callSchema.parse(raw)
  return checkedCost(call.maxSteps * (call.inputBytes * 0.25 + call.maxOutputTokens * 1.2))
}
export function builderKnownCost(raw: BuilderTokenUsage, limits: BuilderModelCall): number {
  const call = callSchema.parse(limits)
  const usage = usageSchema.parse(raw)
  if (usage.inputTokens > call.inputBytes * call.maxSteps || usage.outputTokens > call.maxOutputTokens * call.maxSteps) throw new Error("builder_usage_exceeds_envelope")
  const cached = usage.cachedInputTokens ?? 0
  const created = usage.cacheCreationInputTokens ?? 0
  if (cached + created > usage.inputTokens) throw new Error("builder_usage_invalid")
  // Missing cache detail uses the higher cache-write rate, never a free call.
  const inputCost = usage.cachedInputTokens === null || usage.cacheCreationInputTokens === null
    ? usage.inputTokens * 0.25
    : (usage.inputTokens - cached - created) * 0.2 + cached * 0.02 + created * 0.25
  return checkedCost(inputCost + usage.outputTokens * 1.2)
}
