import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { assertPublicationApproval, matchesPolicy } from "./check-publication.mjs"

const environment = { id: 10, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  protection_rules: [{ type: "required_reviewers", prevent_self_review: true, reviewers: [{ type: "User", reviewer: { id: 2 } }] }] }
const branches = [{ name: "main", type: "branch" }]
const approval = { state: "approved", user: { id: 2, login: "reviewer" }, environments: [{ id: 10 }] }

test("publication requires an actual independent authorized approval, not admin bypass or old retries", () => {
  assertPublicationApproval(environment, branches, [approval], "integrator", "1")
  for (const history of [[], [{ ...approval, user: { id: 3, login: "admin-bypasser" } }], [{ ...approval, state: "rejected" }], [approval, approval]]) {
    assert.throws(() => assertPublicationApproval(environment, branches, history, "integrator", "1"))
  }
  assert.throws(() => assertPublicationApproval(environment, branches, [approval], "reviewer", "1"))
  assert.throws(() => assertPublicationApproval(environment, branches, [approval], "integrator", "2"))
  assert.throws(() => assertPublicationApproval(environment, [{ name: "*", type: "branch" }], [approval], "integrator", "1"))
})

test("policy readback allows server defaults but cannot lose approval/check/bypass restrictions", () => {
  assert.ok(matchesPolicy({ bypass_actors: [], count: 1 }, { bypass_actors: [], count: 1, server_default: true }))
  assert.equal(matchesPolicy({ bypass_actors: [] }, { bypass_actors: [{ actor_id: 1 }] }), false)
  assert.equal(matchesPolicy({ count: 1 }, { count: 0 }), false)
})

// The principal's single-account merge policy does not authorize publication.
test("the approved zero-review main policy retains strict controls and independent publication approval", () => {
  const policy = JSON.parse(readFileSync(new URL("../ops/github/main-ruleset.json", import.meta.url), "utf8"))
  const pullRequest = policy.rules.find((rule) => rule.type === "pull_request").parameters
  assert.equal(pullRequest.required_approving_review_count, 0)
  assert.equal(pullRequest.require_last_push_approval, false)
  assert.equal(pullRequest.dismiss_stale_reviews_on_push, true)
  assert.equal(pullRequest.required_review_thread_resolution, true)
  assert.deepEqual(policy.bypass_actors, [])
  const checks = policy.rules.find((rule) => rule.type === "required_status_checks").parameters
  assert.equal(checks.strict_required_status_checks_policy, true)
  assert.deepEqual(checks.required_status_checks.map((check) => check.context).sort(),
    ["package-quality", "cms-quality", "cms-test", "site", "renderer", "required-ci"].sort())
  assert.ok(checks.required_status_checks.every((check) => check.integration_id === 15368))
  assert.ok(policy.rules.some((rule) => rule.type === "non_fast_forward"))
  assert.ok(policy.rules.some((rule) => rule.type === "deletion"))
  assert.ok(matchesPolicy(policy, { ...policy, id: 123 }))
  assert.equal(matchesPolicy(policy, { ...policy, bypass_actors: [{ actor_id: 1 }] }), false)
  assert.throws(() => assertPublicationApproval(environment, branches, [], "integrator", "1"))
  assert.throws(() => assertPublicationApproval(environment, branches, [approval], "reviewer", "1"))
})
