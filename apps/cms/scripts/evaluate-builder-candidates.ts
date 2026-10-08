import { randomUUID, createHash } from "node:crypto"
import { pathToFileURL } from "node:url"
import { BUILDER_EVALUATION_MANIFEST } from "../tests/fixtures/builderEvaluation"
import { customerModelLimits, CUSTOMER_INPUT_BYTES, CUSTOMER_BILLABLE_INPUT_TOKENS } from "../src/lib/ai-generation/boundedMastra"
import { builderCallLiability, builderQuotaPolicy } from "../src/lib/builder/quotaPolicy"

export const EVALUATION_EXECUTION_BLOCKERS = [
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
      requestInputBytesPerWireStep: CUSTOMER_INPUT_BYTES,
      maxBillableInputTokensPerWireStep: CUSTOMER_BILLABLE_INPUT_TOKENS,
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
    // Documented model context supports the engineering bound, not an invoice warranty.
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
  runnerReview?: string
  approvedManifest?: string
  expectedManifest?: string
}, requiredSpendMicros: number): void {
  if (!input.approvalReference?.trim() || !Number.isSafeInteger(input.approvedSpendMicros) || (input.approvedSpendMicros ?? 0) < requiredSpendMicros) throw new Error("evaluation_requires_explicit_principal_spending_approval")
  let uri: URL
  try { uri = new URL(input.databaseUri ?? "") } catch { throw new Error("evaluation_requires_isolated_database") }
  if (!["postgres:", "postgresql:"].includes(uri.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname) || uri.pathname !== "/payload_test" || input.jobsDisabled !== "1" || input.isolatedExecutionAcknowledgement !== "isolated-no-provider-side-effects") throw new Error("evaluation_requires_isolated_database")
  // Proposed approval metadata is not authenticated principal authority. No flag
  // clears architectural prerequisites or silently authorizes a model request.
  if (input.runnerReview !== "reviewed-isolated-production-runner-v1" || !input.expectedManifest || input.approvedManifest !== input.expectedManifest) throw new Error(`evaluation_architecturally_blocked:${EVALUATION_EXECUTION_BLOCKERS.join(",")}`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.filter((arg) => ["--dry-run", "--execute", "--rehearse", "--rehearse-apply"].includes(arg)).length > 1) throw new Error("evaluation_conflicting_modes")
  const option = (name: string) => args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1)
  if (args.some((value) => !["--dry-run", "--execute", "--rehearse", "--rehearse-apply"].includes(value) && !["--run-id=", "--approval-reference=", "--spend-cap-micros="].some((prefix) => value.startsWith(prefix)))) throw new Error("evaluation_unknown_argument")
  const plan = createBuilderEvaluationDryRun(option("--run-id"))
  if (args.includes("--rehearse") || args.includes("--rehearse-apply")) {
    if (args.includes("--execute")) throw new Error("evaluation_conflicting_modes")
    const { executeIsolatedBuilderEvaluation } = await import("./isolated-builder-evaluation")
    process.env.BUILDER_EVALUATION_OFFLINE_REHEARSAL = "1"
    const rehearsal = { ...plan, runs: plan.runs.slice(0, 1), fullOperationReservationMicros: plan.runs[0]?.operationReservationMicros ?? 0 }
    const first = rehearsal.runs[0]
    const { createOfflineEvaluationTransport } = await import("../tests/fixtures/builderEvaluation")
    await executeIsolatedBuilderEvaluation(rehearsal, args.includes("--rehearse-apply") && first ? { rehearsalTransport: createOfflineEvaluationTransport(first.seedBusinessName, first.identityEmail) } : {})
    // All artifacts, leases and database cleanup are awaited; SDK ambient timers
    // must not keep a completed standalone operation process alive.
    process.exit(0)
  }
  if (args.includes("--execute")) {
    refusePaidEvaluationUnlessReady({
    approvalReference: option("--approval-reference"), approvedSpendMicros: Number(option("--spend-cap-micros")),
    databaseUri: process.env.DATABASE_URI, jobsDisabled: process.env.PAYLOAD_DISABLE_JOBS_AUTORUN,
    isolatedExecutionAcknowledgement: process.env.BUILDER_EVALUATION_ISOLATION,
    runnerReview: process.env.BUILDER_EVALUATION_RUNNER_REVIEW, approvedManifest: process.env.BUILDER_EVALUATION_APPROVED_MANIFEST, expectedManifest: plan.manifestDigest,
    }, plan.fullOperationReservationMicros)
    process.env.BUILDER_EVALUATION_APPROVAL_REFERENCE = option("--approval-reference")
    process.env.BUILDER_EVALUATION_APPROVED_SPEND_MICROS = option("--spend-cap-micros")
    const { executeIsolatedBuilderEvaluation } = await import("./isolated-builder-evaluation")
    await executeIsolatedBuilderEvaluation(plan)
    process.exit(0)
  }
  const { calculateEvaluationSourceSha } = await import("./isolated-builder-evaluation")
  process.stdout.write(`${JSON.stringify({ ...plan, sourceSha: await calculateEvaluationSourceSha() }, null, 2)}\n`)
}
const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "evaluation_failed"}\n`); process.exitCode = 1 })
}
