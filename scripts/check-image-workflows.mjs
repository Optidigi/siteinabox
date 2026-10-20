import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function assertVerificationWorkflow(source, image) {
  if (!source.includes("  pull_request:\n") || !source.includes("  push:\n") ||
      !source.includes("  workflow_dispatch:") || source.includes("pull_request_target:") ||
      !source.includes("  contents: read") || !source.includes("run: pnpm image:verify " + image) ||
      /packages:\s*write|login-action|push:\s*true|docker\s+push\b|type=registry|publish-image\.mjs/.test(source)) {
    throw new Error("Automatic image workflows must verify PR/push/manual sources with read-only permissions and no registry writes")
  }
}

export function checkImageWorkflows() {
  for (const image of ["cms", "renderer", "site"]) {
    assertVerificationWorkflow(readFileSync(new URL("../.github/workflows/build-" + image + "-image.yml", import.meta.url), "utf8"), image)
  }
  console.log("All automatic image workflows verify without registry publication")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) checkImageWorkflows()
