import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

export { assertCanonicalImageWorkflow as assertVerificationWorkflow } from "./canonical-ci-workflow.mjs"
import { imageApplications } from "./image-evidence.mjs"
import { parseWorkflow } from "./canonical-ci-workflow.mjs"
import { assertCanonicalImageWorkflow } from "./canonical-ci-workflow.mjs"
export function assertPublicationRiskBoundary(source) {
  const workflow = parseWorkflow(source), job = workflow.jobs?.publish
  const commands = job?.steps?.map(step => step.run?.trim()) ?? []
  const risk = commands.indexOf("node scripts/check-publication.mjs")
  const login = commands.findIndex(command => command?.includes("docker login"))
  const promote = commands.indexOf("node scripts/publish-image.mjs")
  if (job?.environment !== "ghcr-publish" || risk < 0 || login <= risk || promote <= login || job.steps[risk].if !== undefined) throw new Error("Publication requires complete canonical risk/approval checks before registry login and promotion")
}

export function checkImageWorkflows() {
  const directory = new URL("../.github/workflows/", import.meta.url)
  if (readdirSync(directory).some(file => /^build-.*-image\.ya?ml$/.test(file))) throw new Error("Duplicate main image producers are forbidden")
  assertCanonicalImageWorkflow(readFileSync(new URL("ci.yml", directory), "utf8"))
  const publisherSource = readFileSync(new URL("publish-image.yml", directory), "utf8")
  assertPublicationRiskBoundary(publisherSource)
  const publisher = parseWorkflow(publisherSource)
  const options = publisher.on?.workflow_dispatch?.inputs?.image?.options
  if (JSON.stringify(options) !== JSON.stringify(imageApplications)) throw new Error("Publisher choices must match every governed image")
  console.log("Canonical CI owns PR image proof and trusted main archives; publication remains separately approved")
}
if (process.argv[1] === fileURLToPath(import.meta.url)) checkImageWorkflows()
