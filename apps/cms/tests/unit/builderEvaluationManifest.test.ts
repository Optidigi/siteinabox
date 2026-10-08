import { describe, expect, it } from "vitest"
import { BUILDER_EVALUATION_MANIFEST } from "../fixtures/builderEvaluation"
import { createBuilderEvaluationDryRun, refusePaidEvaluationUnlessReady } from "../../scripts/evaluate-builder-candidates"
import { builderCallLiability } from "@/lib/builder/quotaPolicy"
import { customerModelLimits } from "@/lib/ai-generation/boundedMastra"
import { planBuilderTurn } from "@/lib/builder/planTurn"

describe("offline NL/EN evaluation manifest", () => {
  it("defines sixteen bounded runs and keeps all paid evidence unknown", () => {
    const manifest = BUILDER_EVALUATION_MANIFEST
    expect(manifest.cases).toHaveLength(8)
    expect(manifest.results).toHaveLength(16)
    expect(manifest.candidates.map((candidate) => candidate.model)).toEqual(["openai/gpt-5.6-luna", "openai/gpt-5.6-luna"])
    expect(manifest.results.every((result) => result.actualCostUsd === null && result.actualLatencyMs === null && result.applied === null)).toBe(true)
    expect(manifest.bounds.sdkRetries).toBe(0)
  })
  it("dry-runs sixteen distinct identities and exact production call liabilities", () => {
    const plan = createBuilderEvaluationDryRun("fixture-20261008")
    expect(plan.runs).toHaveLength(16)
    expect(new Set(plan.runs.map((run) => run.identityEmail)).size).toBe(16)
    expect(new Set(plan.runs.map((run) => run.expectedTenantSlug)).size).toBe(16)
    expect(plan.conservativeLiabilityCeilingMicros).toBe(1_625_312)
    expect(plan.fullOperationReservationMicros).toBe(3_200_000)
    expect(plan.provedProviderHardCostCeilingUsd).toBeNull()
    for (const run of plan.runs) {
      expect(run.parent).toEqual(customerModelLimits(run.effort))
      expect(run.generation).toEqual(customerModelLimits(run.effort, true))
      expect(run.plannedLiabilityMicros).toBe(builderCallLiability(run.parent) + builderCallLiability(run.generation))
      expect(run.requestInputBytesPerWireStep).toBe(61440)
      expect(run.maximumWeightedSteps).toBe(5)
      expect(run.deadlineMs).toBe(120000)
      expect(run.maximumAggregateOutputTokens).toBe(16384)
      expect(run.actual).toMatchObject({ disposition: "not_executed", actualCostUsd: null, actualLatencyMs: null, providerUsage: null, schema: null, applied: null })
    }
  })
  it("refuses absent approval, unsafe DB and even proposed approval while architecture is blocked", () => {
    expect(() => refusePaidEvaluationUnlessReady({}, 3_200_000)).toThrow("principal_spending_approval")
    const proposed = { approvalReference: "fixture-only-not-an-approval", approvedSpendMicros: 3_200_000, jobsDisabled: "1", isolatedExecutionAcknowledgement: "isolated-no-provider-side-effects" }
    expect(() => refusePaidEvaluationUnlessReady({ ...proposed, databaseUri: "postgresql://localhost/production" }, 3_200_000)).toThrow("isolated_database")
    expect(() => refusePaidEvaluationUnlessReady({ ...proposed, databaseUri: "postgresql://localhost/payload_test" }, 3_200_000)).toThrow("architecturally_blocked")
  })
  it.each(BUILDER_EVALUATION_MANIFEST.cases.filter((fixture) => fixture.kind === "clarification"))("uses deterministic $locale clarification without provider IO", async (fixture) => {
    const result = await planBuilderTurn({ message: fixture.prompt, locale: fixture.locale, previous: null, hasExistingSite: false })
    expect(result.decision).toBe("ask")
    expect(result.reply).toMatch(fixture.locale === "en" ? /services|work|business/ : /diensten|werk|vak/)
  })
})
