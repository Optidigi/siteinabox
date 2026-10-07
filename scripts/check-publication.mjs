import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { setTimeout } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { expectedCiJobs } from "./check-required-ci.mjs"

export function matchesPolicy(expected, observed) {
  if (Array.isArray(expected)) return Array.isArray(observed) && expected.length === observed.length && expected.every((value, index) => matchesPolicy(value, observed[index]))
  if (expected && typeof expected === "object") return observed && typeof observed === "object" && Object.entries(expected).every(([key, value]) => matchesPolicy(value, observed[key]))
  return expected === observed
}

export function assertPublicationApproval(environment, branches, history, actor, attempt) {
  const reviewers = environment.protection_rules?.find((rule) => rule.type === "required_reviewers")
  if (!reviewers?.prevent_self_review || !reviewers.reviewers?.length ||
      !matchesPolicy({ protected_branches: false, custom_branch_policies: true }, environment.deployment_branch_policy) ||
      branches.length !== 1 || branches[0].name !== "main" || branches[0].type !== "branch") {
    throw new Error("Configure independent reviewers, prevent-self-review and main-only publication environment")
  }
  // Public approval history has no run-attempt discriminator. A fresh run and
  // exactly one decision avoid borrowing approval from a prior retry/decision.
  if (attempt !== "1" || history.length !== 1) throw new Error("Publication requires a fresh workflow run with one explicit approval")
  const approval = history[0]
  if (approval.state !== "approved" || approval.user?.login === actor ||
      !approval.environments?.some((entry) => entry.id === environment.id) ||
      !reviewers.reviewers.some((entry) => entry.type === "User" && entry.reviewer.id === approval.user?.id)) {
    throw new Error("An independent configured reviewer must explicitly approve this publication run; bypass is insufficient")
  }
}

async function main() {
  const { GITHUB_REPOSITORY: repository, GITHUB_SHA: sha, GITHUB_REF: ref, GITHUB_ACTOR: actor,
    GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: attempt } = process.env
  if (ref !== "refs/heads/main" || !/^[a-f0-9]{40}$/.test(sha ?? "") || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") || !/^\d+$/.test(runId ?? "")) {
    throw new Error("Publication is restricted to a trusted exact-SHA main workflow")
  }
  function api(path) {
    return JSON.parse(execFileSync("gh", ["api", "repos/" + repository + path], { encoding: "utf8", timeout: 30000 }))
  }
  const expected = JSON.parse(await readFile(new URL("../ops/github/main-ruleset.json", import.meta.url), "utf8"))
  const rule = api("/rulesets?includes_parents=true").find((entry) => entry.name === expected.name)
  if (!rule || !matchesPolicy(expected, api("/rulesets/" + rule.id))) throw new Error("Active main controls differ from the reviewed policy")
  const environment = api("/environments/ghcr-publish")
  const branches = api("/environments/ghcr-publish/deployment-branch-policies?per_page=100").branch_policies
  const history = api("/actions/runs/" + runId + "/approvals")
  assertPublicationApproval(environment, branches, history, actor, attempt)
  const matrix = JSON.parse(await readFile(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  const jobs = expectedCiJobs(matrix)
    .flatMap((job) => job === "image-verification"
      ? matrix.checks.filter((check) => check.ciJob === job && matrix.profiles.ci.includes(check.id))
        .map((check) => job + " (" + check.run[2] + ")")
      : [job])
  jobs.push("required-ci")
  const deadline = Date.now() + 30 * 60 * 1000
  while (Date.now() < deadline) {
    const runs = api("/actions/workflows/ci.yml/runs?head_sha=" + sha + "&branch=main&per_page=50").workflow_runs
    const run = runs.find((entry) => entry.head_sha === sha && entry.head_branch === "main" && ["push", "workflow_dispatch"].includes(entry.event))
    if (run?.status === "completed") {
      const actual = api("/actions/runs/" + run.id + "/jobs?per_page=100").jobs
      if (run.conclusion !== "success" || actual.length !== jobs.length ||
          !jobs.every((name) => actual.some((job) => job.name === name && job.conclusion === "success"))) {
        throw new Error("Exact-SHA canonical CI failed, skipped a job or has incomplete evidence")
      }
      console.log("Exact-SHA canonical CI and independent publication approval verified")
      return
    }
    await setTimeout(10000)
  }
  throw new Error("Exact-SHA canonical CI evidence was unavailable within the publication window")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
