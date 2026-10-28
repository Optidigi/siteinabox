import assert from "node:assert/strict"
import { test } from "node:test"
import { assertPublicationRequest, assertPublicationApproval, assertVerifiedSource, assertImageArtifact } from "./check-publication.mjs"

const sha = "a".repeat(40)
const request = { event: "workflow_dispatch", ref: "refs/heads/main", attempt: "1", sha, image: "cms", verificationRunId: "42" }

test("publication accepts only a fresh, exact-source manual request", () => {
  for (const image of ["cms", "renderer", "site", "postgres", "exchange-worker"]) assert.doesNotThrow(() => assertPublicationRequest({ ...request, image }))
  for (const change of [
    { event: "push" }, { event: "pull_request" }, { ref: "refs/heads/feature" },
    { attempt: "2" }, { sha: "main" }, { image: "arbitrary" }, { verificationRunId: "42; echo unsafe" },
  ]) assert.throws(() => assertPublicationRequest({ ...request, ...change }))
})

test("publication binds the smoke evidence and image archive to the selected source and run attempt", () => {
  const evidence = { application: "cms", sourceSHA: sha, tag: "siab-verify-deadbeef-" + sha + ":cms",
    verificationRunId: "42", verificationRunAttempt: "1", imageId: "sha256:" + "b".repeat(64),
    archiveSha256: "c".repeat(64), archiveIdentity: { configDigest: "sha256:" + "b".repeat(64), manifestDigest: null, tag: "siab-verify-deadbeef-" + sha + ":cms", sourceSHA: sha, os: "linux", architecture: "amd64", rootfsDiffIds: ["sha256:" + "d".repeat(64)] }, nodeVersion: "24.22.0", buildNodeLts: "Krypton", nodeLts: "Krypton", packagedSmoke: "passed", publishable: true, published: false }
  const run = { ...verification, run_attempt: 1 }
  assertImageArtifact(request, run, evidence, "c".repeat(64))
  for (const change of [{ sourceSHA: "b".repeat(40) }, { verificationRunId: "43" }, { verificationRunAttempt: "2" },
    { application: "site" }, { packagedSmoke: "failed" }, { publishable: false }, { published: true },
    { tag: "ghcr.io/unrelated:latest" }, { imageId: "unbound" }]) {
    assert.throws(() => assertImageArtifact(request, run, { ...evidence, ...change }, "c".repeat(64)))
  }
  assert.throws(() => assertImageArtifact(request, run, evidence, "d".repeat(64)))
})

const verification = { id: 42, head_sha: sha, head_branch: "main", event: "push", status: "completed", conclusion: "success", path: ".github/workflows/ci.yml" }
const ci = { ...verification, path: ".github/workflows/ci.yml" }
const jobs = [{ name: "package-quality", status: "completed", conclusion: "success" }]

test("publication requires the selected main image run and every exact-source canonical CI job", () => {
  assertVerifiedSource(request, verification, ci, jobs, ["package-quality"])
  for (const change of [{ id: 43 }, { head_sha: "b".repeat(40) }, { head_branch: "feature" }, { event: "pull_request" },
    { conclusion: "failure" }, { status: "in_progress" }, { path: ".github/workflows/other.yml" }, { path: ".github/workflows/build-cms-image.yml" }]) {
    assert.throws(() => assertVerifiedSource(request, { ...verification, ...change }, ci, jobs, ["package-quality"]))
  }
  assert.throws(() => assertVerifiedSource(request, verification, { ...ci, head_sha: "b".repeat(40) }, jobs, ["package-quality"]))
  assert.throws(() => assertVerifiedSource(request, verification, { ...ci, id: 43 }, jobs, ["package-quality"]))
  assert.throws(() => assertVerifiedSource(request, verification, ci, [], ["package-quality"]))
  for (const conclusion of ["skipped", "cancelled", "failure", null]) {
    assert.throws(() => assertVerifiedSource(request, verification, ci, [{ ...jobs[0], conclusion }], ["package-quality"]))
  }
})

const environment = { id: 10,
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User", reviewer: { id: 7 } }] }] }
const branches = [{ name: "main", type: "branch" }]
const approval = { state: "approved", user: { id: 7 }, environments: [{ id: 10 }] }

test("publication requires an installed main-only owner approval; bypass and old decisions fail", () => {
  assertPublicationApproval(environment, branches, [approval])
  for (const history of [[], [approval, approval], [{ ...approval, state: "rejected" }],
    [{ ...approval, user: { id: 8 } }], [{ ...approval, environments: [{ id: 11 }] }]]) {
    assert.throws(() => assertPublicationApproval(environment, branches, history))
  }
  assert.throws(() => assertPublicationApproval({ ...environment, can_admins_bypass: true }, branches, [approval]))
  assert.throws(() => assertPublicationApproval({ ...environment, protection_rules: [] }, branches, [approval]))
  assert.throws(() => assertPublicationApproval(environment, [{ name: "*", type: "branch" }], [approval]))
})
