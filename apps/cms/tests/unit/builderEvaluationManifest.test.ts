import { describe, expect, it, vi } from "vitest"
import { assertIsolatedEvaluationEnvironment, installEvaluationFetchGuard } from "../../scripts/isolated-builder-evaluation"
import { SitegenOutputSchema } from "@/lib/sitegen/output-schema"
import { approvedCatalogIssues, approvedChromeIssues } from "@/lib/sitegen/catalog"
import { BUILDER_EVALUATION_MANIFEST, offlineEvaluationHomepage, createOfflineEvaluationTransport } from "../fixtures/builderEvaluation"
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
    expect(plan.conservativeLiabilityCeilingMicros).toBe(42_471_872)
    expect(plan.fullOperationReservationMicros).toBe(42_560_000)
    expect(plan.provedProviderHardCostCeilingUsd).toBeNull()
    for (const run of plan.runs) {
      expect(run.parent).toEqual(customerModelLimits(run.effort))
      expect(run.generation).toEqual(customerModelLimits(run.effort, true))
      expect(run.plannedLiabilityMicros).toBe(builderCallLiability(run.parent) + builderCallLiability(run.generation))
      expect(run.requestInputBytesPerWireStep).toBe(65536)
      expect(run.maximumWeightedSteps).toBe(5)
      expect(run.deadlineMs).toBe(120000)
      expect(run.maximumAggregateOutputTokens).toBe(16384)
      expect(run.actual).toMatchObject({ disposition: "not_executed", actualCostUsd: null, actualLatencyMs: null, providerUsage: null, schema: null, applied: null })
    }
  })
  it("refuses absent approval, unsafe DB and even proposed approval while architecture is blocked", () => {
    expect(() => refusePaidEvaluationUnlessReady({}, 42_560_000)).toThrow("principal_spending_approval")
    const proposed = { approvalReference: "fixture-only-not-an-approval", approvedSpendMicros: 42_560_000, jobsDisabled: "1", isolatedExecutionAcknowledgement: "isolated-no-provider-side-effects" }
    expect(() => refusePaidEvaluationUnlessReady({ ...proposed, databaseUri: "postgresql://localhost/production" }, 42_560_000)).toThrow("isolated_database")
    expect(() => refusePaidEvaluationUnlessReady({ ...proposed, databaseUri: "postgresql://localhost/payload_test" }, 42_560_000)).toThrow("architecturally_blocked")
  })
  it("requires exact reviewed manifest, paid metadata and a dedicated isolated runtime", () => {
    const plan = createBuilderEvaluationDryRun("fixture-20261008")
    const env = { NODE_ENV: "test" as const, DATABASE_URI: "postgresql://localhost/payload_test", PAYLOAD_DISABLE_JOBS_AUTORUN: "1", PAYLOAD_DB_PUSH: "false", OPENAI_API_KEY: "synthetic-offline-key", PAYLOAD_SECRET: "synthetic-local-secret", BETTER_AUTH_PREVIEW_SECRET: "synthetic-local-secret", DATA_DIR: `/private/eval-${plan.runId}`, BUILDER_EVALUATION_RUNNER_REVIEW: "reviewed-isolated-production-runner-v1", BUILDER_EVALUATION_APPROVED_MANIFEST: plan.manifestDigest, BUILDER_EVALUATION_APPROVED_SOURCE_SHA: "a".repeat(64), BUILDER_EVALUATION_APPROVAL_REFERENCE: "fixture-only-not-approval", BUILDER_EVALUATION_APPROVED_SPEND_MICROS: String(plan.fullOperationReservationMicros) }
    expect(() => assertIsolatedEvaluationEnvironment(env, plan, "a".repeat(64))).not.toThrow()
    for (const change of [{ BUILDER_EVALUATION_APPROVAL_REFERENCE: "" }, { BUILDER_EVALUATION_APPROVED_SPEND_MICROS: "42559999" }, { DATABASE_URI: "postgresql://localhost/production" }, { PAYLOAD_DB_PUSH: "true" }, { DATA_DIR: "/private/shared" }, { BUILDER_EVALUATION_APPROVED_MANIFEST: "different" }, { BUILDER_EVALUATION_RUNNER_REVIEW: "" }, { BUILDER_EVALUATION_APPROVED_SOURCE_SHA: "b".repeat(64) }]) expect(() => assertIsolatedEvaluationEnvironment({ ...env, ...change }, plan, "a".repeat(64))).toThrow()
  })
  it("denies provider/domain/mail HTTP and enforces the eighty-request ceiling before dispatch", async () => {
    const transport = vi.fn<typeof fetch>(async () => new Response("offline"))
    const lease = vi.fn(async () => {})
    const guard = installEvaluationFetchGuard(transport, lease, 80)
    for (const endpoint of ["https://api.cloudflare.com/client/v4", "https://api.openai.com/v1/chat/completions", "https://admin.siteinabox.nl/api/mail"]) await expect(guard.fetch(endpoint, { method: "POST", redirect: "error" })).rejects.toThrow("external_io_denied")
    expect(transport).not.toHaveBeenCalled()
    for (let i = 0; i < 80; i++) await guard.fetch("https://api.openai.com/v1/responses", { method: "POST", redirect: "error" })
    await expect(guard.fetch("https://api.openai.com/v1/responses", { method: "POST", redirect: "error" })).rejects.toThrow("wire_call_cap")
    expect(guard.calls()).toBe(80)
    expect(transport).toHaveBeenCalledTimes(80)
    expect(lease).toHaveBeenCalledTimes(80)
  })
  it("does not dispatch after the operation lease fence rejects", async () => {
    const transport = vi.fn<typeof fetch>()
    const guard = installEvaluationFetchGuard(transport, async () => { throw new Error("fixture_lost_lease") })
    await expect(guard.fetch("https://api.openai.com/v1/responses", { method: "POST", redirect: "error" })).rejects.toThrow("fixture_lost_lease")
    expect(transport).not.toHaveBeenCalled()
    expect(guard.calls()).toBe(0)
  })
  it("prepares honest offline apply rehearsal with approved meaningful blocks and synthetic usage", async () => {
    const output = SitegenOutputSchema.parse(offlineEvaluationHomepage("Offline fixture", "fixture@example.test"))
    expect(output.pages[0]?.sections.map((section) => section.blockType)).toEqual(["hero", "services", "cta"])
    expect(approvedCatalogIssues(output.pages[0]?.sections)).toEqual([])
    expect(approvedChromeIssues({ navbar: output.navbar, footer: output.footer })).toEqual([])
    const transport = createOfflineEvaluationTransport("Offline fixture", "fixture@example.test")
    const reply = await transport("https://api.openai.com/v1/responses", { body: JSON.stringify({ max_output_tokens: 8192 }) })
    expect(await reply.json()).toMatchObject({ usage: { input_tokens_details: { cache_write_tokens: 0 } } })
    await expect(transport("https://api.openai.com/v1/responses", { body: JSON.stringify({ max_output_tokens: 8192 }) })).rejects.toThrow("duplicate_generation")
  })
  it.each(BUILDER_EVALUATION_MANIFEST.cases.filter((fixture) => fixture.kind === "clarification"))("uses deterministic $locale clarification without provider IO", async (fixture) => {
    const result = await planBuilderTurn({ message: fixture.prompt, locale: fixture.locale, previous: null, hasExistingSite: false })
    expect(result.decision).toBe("ask")
    expect(result.reply).toMatch(fixture.locale === "en" ? /services|work|business/ : /diensten|werk|vak/)
  })
})
