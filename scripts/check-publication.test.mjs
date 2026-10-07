import assert from "node:assert/strict"
import { test } from "node:test"
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
