import { execFileSync } from "node:child_process"
import { readFile, mkdtemp, readdir, copyFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { expectedHostedJobs } from "./check-required-ci.mjs"
import { assertImageVerificationEvidence } from "./image-evidence.mjs"
import { sha256File } from "./image-artifact.mjs"
import { checkDependencySecurity } from "./check-dependency-security.mjs"

export function assertNoDeclaredDependencyBlockers(record) {
  if (!Array.isArray(record?.advisories) || !Array.isArray(record.imageAdvisories) || !Array.isArray(record.nativeAssessments) ||
      record.nativeAssessments.length !== 5 || record.advisories.length || record.imageAdvisories.length ||
      record.nativeAssessments.some((entry) => entry.status !== "qualified") || (record.deferrals ?? []).some((entry) => entry.releaseBlocked)) {
    throw new Error("Publication blocked by declared or unavailable dependency review; refresh non-publishing readiness first")
  }
}

export function assertPublicationRequest({ event, ref, attempt, sha, image, verificationRunId }) {
  if (event !== "workflow_dispatch" || ref !== "refs/heads/main" || attempt !== "1" ||
      !/^[a-f0-9]{40}$/.test(sha ?? "") || !["cms", "renderer", "site"].includes(image) ||
      !/^[1-9][0-9]*$/.test(verificationRunId ?? "")) {
    throw new Error("Publication requires a fresh manual main run, full source SHA, known image and verification run ID")
  }
}

export function assertPublicationApproval(environment, branches, approvals) {
  const reviewers = environment.protection_rules?.find((rule) => rule.type === "required_reviewers")?.reviewers ?? []
  const policy = environment.deployment_branch_policy
  const approval = approvals[0]
  // Some API versions omit this setting. An explicit reviewer decision is
  // required independently; the installed-control gate verifies UI-only policy.
  if (environment.can_admins_bypass === true || !reviewers.length ||
      policy?.protected_branches !== false || policy?.custom_branch_policies !== true ||
      branches.length !== 1 || branches[0].name !== "main" || branches[0].type !== "branch" ||
      approvals.length !== 1 || approval?.state !== "approved" ||
      !approval.environments?.some((entry) => entry.id === environment.id) ||
      !reviewers.some((entry) => entry.type === "User" && entry.reviewer.id === approval.user?.id)) {
    throw new Error("Publication requires installed main-only environment controls and one explicit configured owner approval; bypass is insufficient")
  }
}

export function assertVerifiedSource(request, verification, ci, jobs, expectedJobs) {
  const succeeded = (run, workflow) => run?.head_sha === request.sha && run.head_branch === "main" &&
    ["push", "workflow_dispatch"].includes(run.event) && run.status === "completed" &&
    run.conclusion === "success" && run.path === ".github/workflows/" + workflow
  if (!succeeded(verification, "build-" + request.image + "-image.yml") || !succeeded(ci, "ci.yml") ||
      !expectedJobs.length || jobs.length !== expectedJobs.length ||
      !expectedJobs.every((name) => jobs.some((job) => job.name === name && job.status === "completed" && job.conclusion === "success"))) {
    throw new Error("Publication requires successful exact-source main image verification and complete canonical CI; missing/skipped/cancelled work is not green")
  }
}


export function assertImageArtifact(request, verification, evidence, archiveSha256) {
  assertImageVerificationEvidence({ sha: request.sha, runId: request.verificationRunId,
    attempt: String(verification.run_attempt), image: request.image }, evidence)
  if (evidence.archiveSha256 !== archiveSha256 || evidence.publishable !== true) {
    throw new Error("Image archive does not match the verified bytes or publication build inputs")
  }
}

export function publicationRequest(env = process.env) {
  return { event: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF, attempt: env.GITHUB_RUN_ATTEMPT,
    sha: env.SOURCE_SHA, image: env.IMAGE, verificationRunId: env.VERIFICATION_RUN_ID }
}

export async function checkPublication() {
  const request = publicationRequest()
  assertPublicationRequest(request)
  const dependencyPolicy = JSON.parse(await readFile(new URL("../docs/dependency-security.json", import.meta.url), "utf8"))
  assertNoDeclaredDependencyBlockers(dependencyPolicy)
  const repository = process.env.GITHUB_REPOSITORY
  const runId = process.env.GITHUB_RUN_ID
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") || !/^[1-9][0-9]*$/.test(runId ?? "")) {
    throw new Error("Publication requires a valid repository and workflow run identity")
  }
  const api = (path) => JSON.parse(execFileSync("gh", ["api", "repos/" + repository + path], { encoding: "utf8", timeout: 30000 }))
  const pages = (path) => JSON.parse(execFileSync("gh", ["api", "--paginate", "--slurp", "repos/" + repository + path], { encoding: "utf8", timeout: 30000 }))
  // The trusted manual workflow is checked out from main, never from artifact input.
  execFileSync("git", ["merge-base", "--is-ancestor", request.sha, "HEAD"])
  const environment = api("/environments/ghcr-publish")
  const branches = pages("/environments/ghcr-publish/deployment-branch-policies?per_page=100").flatMap((page) => page.branch_policies)
  assertPublicationApproval(environment, branches, api("/actions/runs/" + runId + "/approvals"))
  const verification = api("/actions/runs/" + request.verificationRunId)
  const runs = pages("/actions/workflows/ci.yml/runs?head_sha=" + request.sha + "&branch=main&per_page=100").flatMap((page) => page.workflow_runs)
  const ci = runs.find((run) => ["push", "workflow_dispatch"].includes(run.event))
  const jobs = ci ? pages("/actions/runs/" + ci.id + "/jobs?per_page=100").flatMap((page) => page.jobs) : []
  const matrix = JSON.parse(await readFile(new URL("../docs/verification-matrix.json", import.meta.url), "utf8"))
  const expectedJobs = expectedHostedJobs(matrix)
  assertVerifiedSource(request, verification, ci, jobs, expectedJobs)
  const evidence = JSON.parse(await readFile("artifacts/image-" + request.image + ".json", "utf8"))
  const archiveSha256 = await sha256File("artifacts/image-" + request.image + ".tar")
  assertImageArtifact(request, verification, evidence, archiveSha256)
  // Supplementary archives are read/scanned only. The owner's request still
  // authorizes publication of exactly request.image, never the other images.
  const dependencyDirectory = await mkdtemp("artifacts/dependency-candidate-")
  for (const file of await readdir("artifacts")) {
    if (file.startsWith("image-" + request.image) && /\.(?:json|tar)$/.test(file)) await copyFile("artifacts/" + file, dependencyDirectory + "/" + file)
  }
  for (const image of ["cms", "renderer", "site"].filter((image) => image !== request.image)) {
    const supplemental = pages("/actions/workflows/build-" + image + "-image.yml/runs?head_sha=" + request.sha + "&branch=main&per_page=100")
      .flatMap((page) => page.workflow_runs).find((run) => run.status === "completed" && run.conclusion === "success" && ["push", "workflow_dispatch"].includes(run.event))
    if (!supplemental) throw new Error("Current dependency readiness requires verified archives for every application")
    const run = api("/actions/runs/" + supplemental.id)
    const supplementalRequest = { ...request, image, verificationRunId: String(run.id) }
    assertVerifiedSource(supplementalRequest, run, ci, jobs, expectedJobs)
    execFileSync("gh", ["run", "download", String(run.id), "--repo", repository, "--name", "image-" + image, "--dir", dependencyDirectory], { timeout: 600000, stdio: "inherit" })
    const metadata = JSON.parse(await readFile(dependencyDirectory + "/image-" + image + ".json", "utf8"))
    assertImageVerificationEvidence({ sha: request.sha, runId: String(run.id), attempt: String(run.run_attempt), image }, metadata)
    if (metadata.archiveSha256 !== await sha256File(dependencyDirectory + "/image-" + image + ".tar")) throw new Error("Supplementary dependency archive bytes changed")
  }
  const dependencyReadiness = await checkDependencySecurity(["--release", "--candidate", request.sha, "--images", dependencyDirectory, "--archive-dir", dependencyDirectory])
  console.log("Exact-source image archive, canonical CI and owner publication approval verified")
  return { request, evidence, dependencyReadiness }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await checkPublication()
