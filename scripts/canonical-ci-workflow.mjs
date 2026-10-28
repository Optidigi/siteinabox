import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const mainArchiveCondition = "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'"
const cacheCondition = "inputs.cache-mode != 'cold'"
export const condition = value => String(value ?? "").trim().replace(/^\$\{\{\s*|\s*\}\}$/g, "").trim()
const commands = job => (job?.steps ?? []).flatMap(step => String(step.run ?? "").split("\n").map(line => line.trim()).filter(Boolean))
export const hasRequiredCommand = (job, command) => (job?.steps ?? []).some(step => !Object.hasOwn(step, "if") && commands({ steps: [step] }).includes(command))
const equal = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected)
const fail = message => { throw new Error("Canonical CI: " + message) }

// Load YAML only for static policy checks. Native receipt aggregation needs no
// dependency installation and never parses workflow source.
export function parseWorkflow(source) {
  const document = require("yaml").parseDocument(source, { uniqueKeys: true, maxAliasCount: 0 })
  if (document.errors.length) fail(document.errors[0].message)
  const workflow = document.toJS({ maxAliasCount: 0 })
  if (!workflow || typeof workflow !== "object" || !workflow.jobs) fail("workflow jobs are missing")
  return workflow
}

export function assertNoIgnoredFailures(value) {
  if (!value || typeof value !== "object") return
  for (const [key, child] of Object.entries(value)) {
    if (key === "continue-on-error" && child !== false) fail("failures cannot be ignored")
    assertNoIgnoredFailures(child)
  }
}

/** The one owner of unconditional image coverage and trusted archive semantics. */
export function assertCanonicalImageWorkflow(source) {
  const workflow = parseWorkflow(source), triggers = workflow.on
  if (!triggers || !Object.hasOwn(triggers, "pull_request") || !Object.hasOwn(triggers, "workflow_dispatch") ||
      !equal(triggers.push, { branches: ["main"] }) || Object.hasOwn(triggers, "pull_request_target") ||
      (triggers.pull_request !== null && Object.keys(triggers.pull_request ?? {}).length)) fail("every PR and main push must verify all images without filters")
  const mode = triggers.workflow_dispatch?.inputs?.["cache-mode"]
  if (mode?.type !== "choice" || mode.default !== "normal" || !equal(mode.options, ["normal", "cold"])) fail("controlled cache mode must preserve normal defaults")
  for (const candidate of Object.values(workflow.jobs)) {
    for (const step of candidate.steps ?? []) {
      if (step.uses?.startsWith("actions/cache@") && condition(step.if) !== cacheCondition) fail("cold measurements must disable all workflow cache restores/saves")
      if (step.uses === "./.github/actions/setup-ci" && step.with?.dependencies !== "false" && step.with?.cache !== "${{ inputs.cache-mode != 'cold' }}") fail("cold measurements must disable dependency caches")
    }
  }
  const job = workflow.jobs["image-verification"]
  if (job?.env?.SIAB_IMAGE_BUILD_CACHE !== "${{ inputs.cache-mode != 'cold' && '1' || '0' }}") fail("cold measurements must disable compiler layer imports/exports")
  if (!job || Object.hasOwn(job, "if") || job.strategy?.["fail-fast"] !== false ||
      !equal(job.strategy.matrix, { app: ["cms", "renderer", "site"] })) fail("all three image variants must always execute")
  if (workflow.permissions?.contents !== "read") fail("verification requires read-only contents")
  assertNoIgnoredFailures(workflow)
  const inspect = value => {
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      if ((key === "packages" && child === "write") || (key === "push" && child === true) ||
          (typeof child === "string" && /login-action|docker\s+push\b|type=registry|(?:^|\n)\s*node scripts\/publish-image\.mjs/.test(child))) fail("verification cannot publish or write registry inputs")
      inspect(child)
    }
  }
  inspect(workflow)
  let archives = 0, postgresArchives = 0, verifiers = 0
  for (const step of job.steps ?? []) {
    if (step.run && step.uses) fail("a step cannot combine an action with a command")
    const upload = step.uses?.startsWith("actions/upload-artifact@")
    if (upload && step.with?.name === "image-${{ matrix.app }}") {
      archives++
      if (condition(step.if) !== mainArchiveCondition || step.with.path !== "${{ steps.verify.outputs.artifact-path }}" ||
          step.with["if-no-files-found"] !== "error" || step.with["compression-level"] !== 0 || step.with["retention-days"] !== 7) fail("archives require trusted main, exact verified bytes and bounded retention")
    } else if (upload && step.with?.name === "image-postgres") {
      postgresArchives++
      if (condition(step.if) !== "matrix.app == 'cms' && " + mainArchiveCondition || step.with.path !== "${{ steps.verify.outputs.postgres-artifact-path }}" || step.with["if-no-files-found"] !== "error" || step.with["compression-level"] !== 0 || step.with["retention-days"] !== 7) fail("owned PostgreSQL archive requires the same trusted CMS producer and retention")
    } else if (upload && step.with?.name === "ci-dependency-diagnostics-${{ matrix.app }}") {
      if (condition(step.if) !== "always()" || step.with["if-no-files-found"] !== "ignore" ||
          !equal(String(step.with.path).trim().split(/\s+/), ["artifacts/siab-verify-*/image-*.json", "artifacts/siab-verify-*/image-*.log"])) fail("failure diagnostics must retain only scanner reports")
    } else if (Object.hasOwn(step, "if") && !(step.uses?.startsWith("actions/cache@") && condition(step.if) === cacheCondition)) {
      fail("verification steps cannot be conditional")
    }
    if (step.run?.trim() === "pnpm image:verify ${{ matrix.app }}") {
      verifiers++
      if (step.id !== "verify" || Object.hasOwn(step, "if")) fail("image verification must be unconditional")
    }
    if (upload && step.with?.name === "ci-image-${{ matrix.app }}" && step.with["if-no-files-found"] !== "error") fail("image evidence is mandatory")
  }
  if (archives !== 1 || postgresArchives !== 1 || verifiers !== 1 || !(job.steps ?? []).some(step => step.with?.name === "ci-image-${{ matrix.app }}")) fail("exactly one verifier, archive export and mandatory evidence upload are required")
  return workflow
}
