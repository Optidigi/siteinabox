import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { compareMainControls } from "./inspect-delivery-controls.mjs"

const proposal = JSON.parse(readFileSync(new URL("../ops/github/main-ruleset.json", import.meta.url), "utf8"))
const inventory = (value) => ({ status: "readable", value: [{ id: 7, name: proposal.name, detail: { status: "readable", value } }] })

test("control readback distinguishes missing, differing, unreadable and matching policy", () => {
  assert.equal(compareMainControls({ status: "unreadable" }, proposal).status, "unknown")
  assert.equal(compareMainControls({ status: "readable", value: [] }, proposal).status, "missing")
  assert.equal(compareMainControls(inventory({ ...proposal, id: 7, created_at: "server metadata" }), proposal).status, "matching_proposal")
  for (const change of [{ enforcement: "disabled" }, { bypass_actors: [{ actor_type: "RepositoryRole", actor_id: 5, bypass_mode: "always" }] },
    { conditions: { ref_name: { include: ["refs/heads/other"], exclude: [] } } }, { rules: [] }]) {
    assert.equal(compareMainControls(inventory({ ...proposal, ...change }), proposal).status, "differs")
  }
  const hidden = { ...proposal }; delete hidden.bypass_actors
  assert.equal(compareMainControls(inventory(hidden), proposal).status, "unknown")
  const changedSource = structuredClone(proposal)
  changedSource.rules.find((rule) => rule.type === "required_status_checks").parameters.required_status_checks[0].integration_id = 0
  assert.equal(compareMainControls(inventory(changedSource), proposal).status, "differs")
})

test("the proposal binds canonical contexts to the observed Actions app and main without bypass", async () => {
  const { expectedHostedJobs, expectedCiJobs, assertRequiredCiWorkflow } = await import("./check-required-ci.mjs")
  const matrix = JSON.parse(readFileSync(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  assert.deepEqual(proposal.conditions, { ref_name: { include: ["refs/heads/main"], exclude: [] } })
  assert.deepEqual(proposal.bypass_actors, [])
  assert.equal(proposal.enforcement, "active")
  const checks = proposal.rules.find((rule) => rule.type === "required_status_checks").parameters
  assert.equal(checks.strict_required_status_checks_policy, true)
  // Browser and image work remain mandatory through the installed required-ci
  // aggregate. Splitting execution must not require changing live branch rules.
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  assertRequiredCiWorkflow(workflow, expectedCiJobs(matrix))
  assert(expectedCiJobs(matrix).includes("cms-browser"))
  assert.throws(() => assertRequiredCiWorkflow(workflow.replace("cms-test, cms-browser,", "cms-test,"), expectedCiJobs(matrix)))
  const direct = [...matrix.protectionContexts].sort()
  assert(direct.includes("required-ci"))
  assert(direct.every(name => expectedHostedJobs(matrix).includes(name)))
  assert.deepEqual(checks.required_status_checks.map((check) => check.context).sort(), direct)
  assert.ok(checks.required_status_checks.every((check) => check.integration_id === 15368))
})
