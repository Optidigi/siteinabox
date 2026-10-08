import { mkdir, writeFile, access, readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { performance } from "node:perf_hooks"
import type { Payload, CollectionSlug } from "payload"
import type { BuilderExecutionContext, BuilderModelCall, BuilderTokenUsage } from "../src/lib/builder/executionContext"
import { createBuilderEvaluationDryRun } from "./evaluate-builder-candidates"

export type EvaluationPlan = ReturnType<typeof createBuilderEvaluationDryRun>
export async function calculateEvaluationSourceSha() {
  const root = fileURLToPath(new URL("../../../", import.meta.url))
  const { stdout } = await promisify(execFile)("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, maxBuffer: 4 * 1024 * 1024 })
  const files = [...new Set(stdout.split("\0").filter((file) => /\.(?:ts|tsx|mjs|js|json|yaml|yml|sql|astro)$/.test(file) && !file.includes("node_modules/")))].sort()
  const digest = createHash("sha256")
  for (const file of files) { digest.update(`${file}\0`); digest.update(await readFile(resolve(root, file))); digest.update("\0") }
  return digest.digest("hex")
}
export function assertIsolatedEvaluationEnvironment(env: NodeJS.ProcessEnv, plan: EvaluationPlan, sourceSha: string) {
  if (env.NODE_ENV !== "test") throw new Error("evaluation_requires_test_runtime")
  const offline = env.BUILDER_EVALUATION_OFFLINE_REHEARSAL === "1"
  if (offline && (plan.runs.length !== 1 || env.OPENAI_API_KEY !== "synthetic-offline-evaluation-key")) throw new Error("evaluation_offline_rehearsal_requires_single_case_and_dummy_key")
  if (env.BUILDER_EVALUATION_APPROVED_SOURCE_SHA !== sourceSha || !/^[a-f0-9]{64}$/.test(sourceSha)) throw new Error("evaluation_requires_reviewed_source_sha")
  if (!offline && (!env.BUILDER_EVALUATION_APPROVAL_REFERENCE?.trim() || !Number.isSafeInteger(Number(env.BUILDER_EVALUATION_APPROVED_SPEND_MICROS)) || Number(env.BUILDER_EVALUATION_APPROVED_SPEND_MICROS) < plan.fullOperationReservationMicros)) throw new Error("evaluation_requires_explicit_principal_spending_approval")
  let uri: URL
  try { uri = new URL(env.DATABASE_URI ?? "") } catch { throw new Error("evaluation_requires_isolated_database") }
  if (!["postgres:", "postgresql:"].includes(uri.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname) || uri.pathname !== "/payload_test" || env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || env.PAYLOAD_DB_PUSH !== "false") throw new Error("evaluation_requires_isolated_database")
  if (env.BUILDER_EVALUATION_RUNNER_REVIEW !== "reviewed-isolated-production-runner-v1" || env.BUILDER_EVALUATION_APPROVED_MANIFEST !== plan.manifestDigest) throw new Error("evaluation_requires_reviewed_exact_manifest")
  if (!env.OPENAI_API_KEY?.trim() || !env.PAYLOAD_SECRET?.trim() || !(env.BETTER_AUTH_PREVIEW_SECRET || env.BETTER_AUTH_SECRET)?.trim()) throw new Error("evaluation_missing_local_runtime_configuration")
  if (!env.DATA_DIR || !isAbsolute(env.DATA_DIR) || !resolve(env.DATA_DIR).endsWith(`/eval-${plan.runId}`)) throw new Error("evaluation_requires_fresh_dedicated_data_dir")
}

/** Global deny-by-default HTTP guard; only the reviewed paid transport is allowed. */
export function installEvaluationFetchGuard(transport: typeof fetch, onDispatch: () => Promise<void>, maximumCalls = 80) {
  let calls = 0
  const guarded: typeof fetch = async (url, init) => {
    const address = typeof url === "string" ? url : url instanceof URL ? url.href : url.url
    if (address !== "https://api.openai.com/v1/responses" || init?.method !== "POST" || init.redirect !== "error") throw new Error("evaluation_external_io_denied")
    if (calls >= maximumCalls) throw new Error("evaluation_wire_call_cap")
    await onDispatch()
    calls++
    return transport(url, init)
  }
  return { fetch: guarded, calls: () => calls }
}

const protectedCollections = ["tenants", "pages", "site-settings", "users", "orders", "published-site-snapshots", "mail-logs", "media"] as const satisfies readonly CollectionSlug[]
async function baseline(payload: Payload) {
  return Promise.all(protectedCollections.map(async (collection) => {
    const result = await payload.find({ collection, limit: 10000, depth: 0, overrideAccess: true })
    if (result.totalDocs >= 10000) throw new Error("evaluation_baseline_too_large")
    return { collection, docs: result.docs.map((doc) => ({ id: doc.id, serialized: JSON.stringify(doc) })) }
  }))
}
async function verifyBaseline(payload: Payload, before: Awaited<ReturnType<typeof baseline>>) {
  for (const entry of before) for (const doc of entry.docs) {
    const actual = await payload.findByID({ collection: entry.collection, id: doc.id, depth: 0, overrideAccess: true })
    if (JSON.stringify(actual) !== doc.serialized) throw new Error("evaluation_changed_existing_authority_or_tenant")
  }
  for (const collection of ["users", "orders", "published-site-snapshots", "mail-logs", "media"] as const) {
    const count = await payload.count({ collection, overrideAccess: true })
    if (count.totalDocs !== before.find((entry) => entry.collection === collection)?.docs.length) throw new Error("evaluation_forbidden_customer_or_provider_side_effect")
  }
}

/** Execute only after caller validates principal approval and this runner's review gates. */
export async function executeIsolatedBuilderEvaluation(plan: EvaluationPlan, options: { rehearsalTransport?: typeof fetch } = {}) {
  const sourceSha = await calculateEvaluationSourceSha()
  assertIsolatedEvaluationEnvironment(process.env, plan, sourceSha)
  const offline = process.env.BUILDER_EVALUATION_OFFLINE_REHEARSAL === "1"
  if (options.rehearsalTransport && !offline) throw new Error("evaluation_fixture_transport_forbidden_in_paid_mode")
  const dataDir = resolve(process.env.DATA_DIR ?? "")
  try { await access(dataDir); throw new Error("evaluation_data_dir_already_exists") } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
  }
  // Keep only explicit local configuration and the one approved provider credential.
  const allowed = new Set(["PATH", "HOME", "NODE_OPTIONS", "NODE_ENV", "DATABASE_URI", "PAYLOAD_SECRET", "BETTER_AUTH_SECRET", "BETTER_AUTH_PREVIEW_SECRET", "OPENAI_API_KEY", "DATA_DIR", "PAYLOAD_DISABLE_JOBS_AUTORUN", "PAYLOAD_DB_PUSH", "PG_POOL_MAX", "PG_CONN_TIMEOUT_MS", "BUILDER_EVALUATION_RUNNER_REVIEW", "BUILDER_EVALUATION_APPROVED_MANIFEST", "BUILDER_EVALUATION_APPROVAL_REFERENCE", "BUILDER_EVALUATION_APPROVED_SPEND_MICROS", "BUILDER_EVALUATION_APPROVED_SOURCE_SHA", "BUILDER_EVALUATION_OFFLINE_REHEARSAL"])
  for (const key of Object.keys(process.env)) if (!allowed.has(key)) delete process.env[key]
  process.env.SITE_GENERATION_PROVIDER = "mastra"
  process.env.SITE_GENERATION_MASTRA_MODEL = "openai/gpt-5.6-luna"
  await mkdir(dataDir, { recursive: false, mode: 0o700 })
  const artifact = async (name: string, value: unknown) => writeFile(resolve(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" })
  await artifact("plan.json", { ...plan, sourceSha, executionMode: offline ? "offline_rehearsal" : "approved_paid_evaluation" })
  const { enableServerOnlyForOperations } = await import("./serverOnlyForOperations")
  enableServerOnlyForOperations()
  const nativeFetch = globalThis.fetch
  let currentExecution: BuilderExecutionContext | undefined
  const transport: typeof fetch = offline ? options.rehearsalTransport ?? (async () => { throw new Error("evaluation_offline_first_dispatch_denied") }) : nativeFetch
  const guard = installEvaluationFetchGuard(transport, async () => {
    if (!currentExecution) throw new Error("evaluation_unleased_provider_dispatch")
    if (await calculateEvaluationSourceSha() !== sourceSha) throw new Error("evaluation_reviewed_source_changed")
    await currentExecution.assertActive()
  })
  globalThis.fetch = guard.fetch
  let payload: Payload | undefined
  try {
    const [{ getPayload }, { default: config }, { Pool }, { migrations }] = await Promise.all([import("payload"), import("../src/payload.config"), import("pg"), import("../src/migrations")])
    // No bootstrap/migrate/drop. Refuse missing schema before initializing Payload.
    const pool = new Pool({ connectionString: process.env.DATABASE_URI, max: 1 })
    try {
      for (const table of ["payload_migrations", "preview_auth_users", "preview_auth_sessions", "preview_auth_accounts", "preview_auth_verifications"]) {
        const result = await pool.query<{ present: string | null }>("SELECT to_regclass($1)::text AS present", [`public.${table}`])
        if (!result.rows[0]?.present) throw new Error("evaluation_requires_already_migrated_auth_schema")
      }
      const latest = migrations.at(-1)?.name
      if (!latest) throw new Error("evaluation_migration_manifest_missing")
      const result = await pool.query<{ name: string }>("SELECT name FROM payload_migrations WHERE name = $1", [latest])
      if (result.rows.length !== 1) throw new Error("evaluation_requires_current_migration")
    } finally { await pool.end() }
    payload = await getPayload({ config })
    const activePayload = payload
    const [{ BuilderQuotaService }, { ReservedBuilderExecution }, { builderQuotaPolicy }, { runBuilderTurn }, { upsertBuilderRegistration }, { assertBuilderAccountEligible }, { assertCurrentPreviewSessionAuthority }, { previewAuth }, { betterAuth }, { createAuthEndpoint }, { setSessionCookie }, { z }, { builderTerminalResultSchema }, { getPreviewCustomizerDataForGrant }, { validateSiteGenerationSpecForCms }, { approvedCatalogIssues, approvedChromeIssues }] = await Promise.all([
      import("../src/lib/builder/quota"), import("../src/lib/builder/quotaExecution"), import("../src/lib/builder/quotaPolicy"), import("../src/lib/builder/runBuilderTurn"), import("../src/lib/builder/sessionStore"), import("../src/lib/builder/access"), import("../src/lib/auth/previewSessionAuthority"), import("../src/lib/preview/betterAuth"), import("better-auth"), import("better-auth/api"), import("better-auth/cookies"), import("zod"), import("../src/lib/builder/quotaSchemas"), import("../src/lib/preview/customizer"), import("../src/lib/site-generation/applySiteGenerationSpec"), import("../src/lib/sitegen/catalog"),
    ])
    // This instance-only test seam cannot mutate the disabled application policy.
    const service = new BuilderQuotaService(payload, { ...builderQuotaPolicy, enabled: true })
    await service.initialize()
    for (const run of plan.runs) {
      process.env.SITE_GENERATION_MASTRA_CHAT_REASONING_EFFORT = run.effort
      process.env.SITE_GENERATION_MASTRA_MAINTAIN_REASONING_EFFORT = run.effort
      const before = await baseline(payload)
      const fixtureAuth = betterAuth({ ...previewAuth.options, plugins: [...(previewAuth.options.plugins ?? []), { id: "isolated-evaluation-session", endpoints: { fixtureSession: createAuthEndpoint("/evaluation-session", { method: "POST" }, async (ctx) => {
        const user = await ctx.context.internalAdapter.createUser({ email: run.identityEmail, name: run.seedBusinessName, emailVerified: true })
        if (!user) throw new Error("evaluation_identity_creation_failed")
        const session = await ctx.context.internalAdapter.createSession(user.id)
        if (!session) throw new Error("evaluation_session_creation_failed")
        await setSessionCookie(ctx, { user, session })
        return ctx.json({ sessionId: session.id, userId: user.id })
      }) } }] })
      const response = await fixtureAuth.handler(new Request("https://admin.siteinabox.nl/api/preview-auth/evaluation-session", { method: "POST", headers: { origin: "https://admin.siteinabox.nl", host: "admin.siteinabox.nl" } }))
      if (!response.ok) throw new Error("evaluation_signed_identity_failed")
      const subject = z.object({ sessionId: z.string(), userId: z.string() }).parse(await response.json())
      await artifact(`${run.runKey}-identity.json`, { runKey: run.runKey, email: run.identityEmail, identityId: subject.userId, sessionId: subject.sessionId, executionMode: offline ? "offline_rehearsal" : "paid_evaluation" })
      const headers = new Headers({ cookie: response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; "), host: "admin.siteinabox.nl" })
      const registered = await upsertBuilderRegistration(payload, { email: run.identityEmail, displayName: run.seedBusinessName, legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false } })
      const eligible = async (req?: Parameters<typeof assertBuilderAccountEligible>[2]) => {
        await assertCurrentPreviewSessionAuthority(activePayload, req, headers, { sessionId: subject.sessionId, email: run.identityEmail })
        await assertBuilderAccountEligible(activePayload, run.identityEmail, req)
      }
      const operationId = randomUUID()
      const message = `${run.locale === "en" ? "My business name is" : "Mijn bedrijfsnaam is"} ${run.seedBusinessName}. ${run.scenarioPrompt}`
      const admission = await service.reserve(run.identityEmail, { operationId, message, locale: run.locale }, eligible)
      if (admission.status !== "reserved") throw new Error(`evaluation_admission_${admission.status}`)
      await artifact(`${run.runKey}-operation.json`, { runKey: run.runKey, operationId, operationKey: admission.lease.operationKey })
      await service.claim(admission.lease, eligible)
      const execution = new ReservedBuilderExecution(service, admission.lease, eligible)
      const observations: { limits: BuilderModelCall; usage: BuilderTokenUsage | null; latencyMs: number }[] = []
      const observed: BuilderExecutionContext = {
        signal: execution.signal, deadlineAt: execution.deadlineAt,
        assertActive: () => execution.assertActive(), withWrite: (write) => execution.withWrite(write), recordGenerationReferences: (refs) => execution.recordGenerationReferences(refs),
        modelCall: (limits, generate, readUsage) => {
          if (![JSON.stringify(run.parent), JSON.stringify(run.generation)].includes(JSON.stringify(limits))) throw new Error("evaluation_unplanned_model_envelope")
          const started = performance.now()
          return execution.modelCall(limits, generate, async (result) => {
            const usage = await readUsage(result)
            observations.push({ limits, usage, latencyMs: performance.now() - started })
            return usage
          })
        },
      }
      currentExecution = observed
      const started = performance.now()
      try {
        const result = await runBuilderTurn(payload, { locale: run.locale, message, contactName: registered.displayName, contactEmail: run.identityEmail, contactPhone: "", legal: registered.legal, previousFacts: null, recentMessages: [] }, observed)
        const thread = { ...registered, facts: result.facts ?? null, clientSlug: result.clientSlug ?? null, messages: [...registered.messages, { role: "user" as const, text: message }, { role: "assistant" as const, text: result.text }] }
        const receipt = builderTerminalResultSchema.parse({ ...result, facts: thread.facts, clientSlug: thread.clientSlug, messages: thread.messages })
        await service.settle(admission.lease, eligible, { result: receipt, thread })
        const op = await service.operation(admission.lease.operationKey)
        if (!op) throw new Error("evaluation_durable_result_missing")
        const generated = op.generationRunId ? await payload.findByID({ collection: "site-generation-runs", id: op.generationRunId, depth: 0, overrideAccess: true }) : null
        const validation = generated ? validateSiteGenerationSpecForCms(generated.spec, { variantScope: "self-serve" }) : null
        const preview = result.clientSlug ? await getPreviewCustomizerDataForGrant({ clientSlug: result.clientSlug, customerEmail: run.identityEmail }) : null
        const tenantId = generated ? typeof generated.tenant === "object" ? generated.tenant?.id : generated.tenant : null
        const pages = tenantId ? await payload.find({ collection: "pages", where: { tenant: { equals: tenantId } }, limit: 100, depth: 0, overrideAccess: true }) : null
        const settings = tenantId ? await payload.find({ collection: "site-settings", where: { tenant: { equals: tenantId } }, limit: 2, depth: 0, overrideAccess: true }) : null
        if (tenantId) {
          const tenant = await payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true })
          if (tenant.slug !== run.expectedTenantSlug) throw new Error("evaluation_tenant_namespace_mismatch")
        }
        const catalogIssues = [...(pages?.docs.flatMap((page) => approvedCatalogIssues(page.blocks)) ?? []), ...(settings?.docs.flatMap((setting) => approvedChromeIssues(setting.chrome)) ?? [])]
        const priorTenants = new Set(before.find((entry) => entry.collection === "tenants")?.docs.map((doc) => String(doc.id)))
        const allTenants = await payload.find({ collection: "tenants", limit: 10000, depth: 0, overrideAccess: true })
        const newTenants = allTenants.docs.filter((tenant) => !priorTenants.has(String(tenant.id)))
        if (newTenants.length !== (tenantId ? 1 : 0) || newTenants.some((tenant) => String(tenant.id) !== String(tenantId))) throw new Error("evaluation_unowned_new_tenant")
        for (const collection of ["pages", "site-settings"] as const) {
          const previousIds = new Set(before.find((entry) => entry.collection === collection)?.docs.map((doc) => String(doc.id)))
          const all = await payload.find({ collection, limit: 10000, depth: 0, overrideAccess: true })
          for (const doc of all.docs) if (!previousIds.has(String(doc.id))) {
            const owner = doc.tenant && typeof doc.tenant === "object" ? doc.tenant.id : doc.tenant
            if (!tenantId || String(owner) !== String(tenantId)) throw new Error("evaluation_unowned_new_page_or_settings")
          }
        }
        await verifyBaseline(payload, before)
        await artifact(`${run.runKey}.json`, { run, operationId, identityId: subject.userId, sessionId: subject.sessionId, operation: op, result, generationRun: generated, pages, settings, preview, schema: offline ? null : validation, applied: offline ? null : result.applied === true && Boolean(pages?.docs.length), previewAvailable: offline ? null : preview !== null, approvedCatalog: !offline && generated ? { issues: catalogIssues, passed: catalogIssues.length === 0 } : null, actualLatencyMs: offline ? null : performance.now() - started, executionMode: offline ? "offline_rehearsal" : "paid_evaluation", providerUsage: offline ? null : observations, offlineRuntimeChecks: offline ? { schema: validation, applied: result.applied === true && Boolean(pages?.docs.length), previewAvailable: preview !== null, catalogIssues, fixtureUsage: observations, latencyMs: performance.now() - started } : null, actualCostUsd: null, knownCostEstimateUsd: !offline && op.costKnown ? op.knownCostUnits / 1000000 : null, retainedLiabilityUsd: offline ? null : op.settledCostUnits / 1000000, factualRestraint: "pending_human_review", injectionResistance: "pending_human_review", preservedExistingRecords: true, wireCallsSoFar: guard.calls() })
        if (offline && options.rehearsalTransport && (!generated || !validation?.valid || !result.applied || !preview || !pages?.docs.length || catalogIssues.length)) throw new Error("evaluation_offline_apply_rehearsal_incomplete")
        if (op.outstandingCalls !== 0 || !op.costKnown && op.modelCalls > 0) throw new Error("evaluation_unknown_remote_completion_or_billing_stop")
      } catch (error) {
        await service.fail(admission.lease, "evaluation_stopped", false).catch(() => undefined)
        await artifact(`${run.runKey}-failure.json`, { runKey: run.runKey, operationId, operation: await service.operation(admission.lease.operationKey), observations, error: error instanceof Error ? error.message : "evaluation_failure", actualCostUsd: null })
        throw error
      } finally { currentExecution = undefined; execution.dispose() }
    }
    await artifact("completion.json", { executionMode: offline ? "offline_rehearsal" : "paid_evaluation", completedCases: plan.runs.length, wireCalls: guard.calls(), paidQualityReleaseApproved: false, humanReview: "pending" })
  } finally { globalThis.fetch = nativeFetch; await payload?.destroy(); await globalThis.__siabPreviewBetterAuthPool?.end(); await globalThis.__siabBetterAuthPool?.end() }
}
