import { randomUUID, createHash } from "node:crypto"
import { pathToFileURL } from "node:url"
import { BUILDER_EVALUATION_MANIFEST } from "../tests/fixtures/builderEvaluation"
import { customerModelLimits, CUSTOMER_INPUT_BYTES, CUSTOMER_PROTOCOL_ALLOWANCE } from "../src/lib/ai-generation/boundedMastra"
import { builderCallLiability, builderQuotaPolicy } from "../src/lib/builder/quotaPolicy"

export const EVALUATION_EXECUTION_BLOCKERS = [
  "provider_token_framing_ceiling_unproved",
  "isolated_production_hooks_and_verified_identity_harness_unreviewed",
] as const

/** Planning only: no Payload import, DB connection, key access or network dispatch. */
export function createBuilderEvaluationDryRun(runId: string = randomUUID()) {
  if (!/^[a-z0-9-]{8,64}$/i.test(runId)) throw new Error("evaluation_run_id_invalid")
  const manifestDigest = createHash("sha256").update(JSON.stringify(BUILDER_EVALUATION_MANIFEST)).digest("hex")
  const runs = BUILDER_EVALUATION_MANIFEST.cases.flatMap((fixture, caseIndex) => BUILDER_EVALUATION_MANIFEST.candidates.map((candidate, candidateIndex) => {
    const namespace = `eval-${runId}-${caseIndex}-${candidateIndex}`.toLowerCase()
    const parent = customerModelLimits(candidate.effort)
    const generation = customerModelLimits(candidate.effort, true)
    const plannedLiabilityMicros = builderCallLiability(parent) + builderCallLiability(generation)
    if (plannedLiabilityMicros > builderQuotaPolicy.operationCostUnits || parent.maxSteps + generation.maxSteps > builderQuotaPolicy.operationMaxWeightedSteps) throw new Error("evaluation_exceeds_runtime_operation_budget")
    return {
      runKey: namespace, caseId: fixture.id, candidate: candidate.label, locale: fixture.locale,
      model: candidate.model, effort: candidate.effort,
      identityEmail: `${namespace}@example.test`, seedBusinessName: namespace,
      expectedTenantSlug: namespace, tenantId: null,
      // Seed a unique literal business name before the scenario. Refusal/clarification
      // may legitimately create no tenant; never reuse another candidate's draft.
      scenarioPrompt: fixture.prompt,
      knownFacts: [namespace, ...fixture.knownFacts],
      parent, generation, maximumModelCallbacks: 2,
      maximumWeightedSteps: parent.maxSteps + generation.maxSteps,
      deadlineMs: builderQuotaPolicy.operationTimeoutMs, stepTimeoutMs: 45000,
      sdkRetries: 0, applicationRetries: 0, toolCallConcurrency: 1,
      maximumWireRequests: parent.maxSteps + generation.maxSteps,
      maximumAggregateOutputTokens: parent.maxSteps * parent.maxOutputTokens + generation.maxSteps * generation.maxOutputTokens,
      requestInputBytesPerWireStep: CUSTOMER_INPUT_BYTES - CUSTOMER_PROTOCOL_ALLOWANCE,
      reservedFramingAllowanceTokens: CUSTOMER_PROTOCOL_ALLOWANCE,
      plannedLiabilityMicros, operationReservationMicros: builderQuotaPolicy.operationCostUnits,
      actual: { schema: null, approvedVariants: null, applied: null, preview: null, factualRestraint: null, injectionResistance: null, actualCostUsd: null, actualLatencyMs: null, providerUsage: null, disposition: "not_executed" as const },
    }
  }))
  const totalLiabilityMicros = runs.reduce((sum, run) => sum + run.plannedLiabilityMicros, 0)
  const totalReservationMicros = runs.reduce((sum, run) => sum + run.operationReservationMicros, 0)
  return {
    mode: "dry-run" as const, runId, manifestDigest, paidExecution: false,
    noDatabaseOrProviderIO: true,
    conservativeLiabilityCeilingMicros: totalLiabilityMicros,
    conservativeLiabilityCeilingUsd: totalLiabilityMicros / 1_000_000,
    fullOperationReservationMicros: totalReservationMicros,
    fullOperationReservationUsd: totalReservationMicros / 1_000_000,
    // The runtime's UTF-8/token inference is not an authoritative provider cap.
    provedProviderHardCostCeilingUsd: null,
    executionBlockers: EVALUATION_EXECUTION_BLOCKERS,
    runs,
  }
}

export function refusePaidEvaluationUnlessReady(input: {
  approvalReference?: string
  approvedSpendMicros?: number
  databaseUri?: string
  jobsDisabled?: string
  isolatedExecutionAcknowledgement?: string
}, requiredSpendMicros: number): never {
  if (!input.approvalReference?.trim() || !Number.isSafeInteger(input.approvedSpendMicros) || (input.approvedSpendMicros ?? 0) < requiredSpendMicros) throw new Error("evaluation_requires_explicit_principal_spending_approval")
  let uri: URL
  try { uri = new URL(input.databaseUri ?? "") } catch { throw new Error("evaluation_requires_isolated_database") }
  if (!["postgres:", "postgresql:"].includes(uri.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname) || uri.pathname !== "/payload_test" || input.jobsDisabled !== "1" || input.isolatedExecutionAcknowledgement !== "isolated-no-provider-side-effects") throw new Error("evaluation_requires_isolated_database")
  // Proposed approval metadata is not authenticated principal authority. No flag
  // clears architectural prerequisites or silently authorizes a model request.
  throw new Error(`evaluation_architecturally_blocked:${EVALUATION_EXECUTION_BLOCKERS.join(",")}`)
}

async function main() {
  const args = process.argv.slice(2)
  const option = (name: string) => args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1)
  if (args.some((value) => !["--dry-run", "--execute"].includes(value) && !["--run-id=", "--approval-reference=", "--spend-cap-micros="].some((prefix) => value.startsWith(prefix)))) throw new Error("evaluation_unknown_argument")
  const plan = createBuilderEvaluationDryRun(option("--run-id"))
  if (args.includes("--execute")) refusePaidEvaluationUnlessReady({
    approvalReference: option("--approval-reference"), approvedSpendMicros: Number(option("--spend-cap-micros")),
    databaseUri: process.env.DATABASE_URI, jobsDisabled: process.env.PAYLOAD_DISABLE_JOBS_AUTORUN,
    isolatedExecutionAcknowledgement: process.env.BUILDER_EVALUATION_ISOLATION,
  }, plan.fullOperationReservationMicros)
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
}
const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "evaluation_failed"}\n`); process.exitCode = 1 })
}
