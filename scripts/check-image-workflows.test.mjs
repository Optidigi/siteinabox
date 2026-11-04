import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { parseWorkflow } from "./canonical-ci-workflow.mjs"
import { assertVerificationWorkflow } from "./check-image-workflows.mjs"

test("automatic image verification cannot log in, publish, or export a registry cache", () => {
  const source = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  assertVerificationWorkflow(source, "cms")
  for (const unsafe of ["packages: write", "uses: docker/login-action@abc", "push: true",
    "run: docker push example", "cache-to: type=registry,ref=example", "run: node scripts/publish-image.mjs"]) {
    assert.throws(() => assertVerificationWorkflow(source + "\n" + unsafe, "cms"))
  }
  assert.throws(() => assertVerificationWorkflow(source.replace("if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'", "if: true"), "cms"))
})

test("archive workflows reject untrusted PR-target triggers", () => {
  const source = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  assert.throws(() => assertVerificationWorkflow(source.replace("  push:", "  pull_request_target:\n  push:"), "cms"))
})

test("the owned tunnel archive cannot be omitted or exported from a pull request", () => {
  const source = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  assert.throws(() => assertVerificationWorkflow(source.replace("name: image-cloudflared", "name: unrelated")))
  assert.throws(() => assertVerificationWorkflow(source.replace(/(name: Retain trusted main owned cloudflared archive\n\s+if:) [^\n]+/, "$1 true")))
})

test("scheduled dependency inventory produces and joins Exchange evidence before aggregation", () => {
  const workflow = parseWorkflow(readFileSync(new URL("../.github/workflows/dependency-security.yml", import.meta.url), "utf8"))
  const worker = workflow.jobs["exchange-worker"]
  assert.ok(worker, "the six-image audit must produce Exchange evidence")
  assert.ok(worker.steps.some(step => step.run === "node scripts/verify-exchange-worker.mjs"))
  const upload = worker.steps.find(step => step.with?.name === "dependency-image-exchange-worker")
  assert.match(upload?.with?.path ?? "", /image-\*\.json/)
  assert.ok(workflow.jobs.inventory.needs.includes("exchange-worker"))
  assert.ok(workflow.jobs.inventory.needs.includes("packaged-inventory"))
  assert.ok(worker.steps.some(step => step.with?.name === "dependency-source-evidence" && step.uses?.startsWith("actions/download-artifact@")))
  assert.notEqual(workflow.permissions?.packages, "write")
})
