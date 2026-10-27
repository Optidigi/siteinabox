import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

export { assertCanonicalImageWorkflow as assertVerificationWorkflow } from "./canonical-ci-workflow.mjs"
import { assertCanonicalImageWorkflow } from "./canonical-ci-workflow.mjs"
export function checkImageWorkflows() {
  const directory = new URL("../.github/workflows/", import.meta.url)
  if (readdirSync(directory).some(file => /^build-.*-image\.ya?ml$/.test(file))) throw new Error("Duplicate main image producers are forbidden")
  assertCanonicalImageWorkflow(readFileSync(new URL("ci.yml", directory), "utf8"))
  console.log("Canonical CI owns PR image proof and trusted main archives; publication remains separately approved")
}
if (process.argv[1] === fileURLToPath(import.meta.url)) checkImageWorkflows()
