import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function assertVerificationWorkflow(source) {
  if (!source.includes("  pull_request:\n") || !source.includes("  push:\n") || !source.includes("  workflow_dispatch:") ||
      /pull_request_target:|push:\s*true|packages:\s*write|login-action|docker\s+push\b|type=registry|run: node scripts\/publish-image\.mjs/.test(source) ||
      !source.includes("app: [cms, renderer, site]") || !source.includes("run: pnpm image:verify ${{ matrix.app }}") ||
      !source.includes("if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'") ||
      !source.includes("name: image-${{ matrix.app }}") || !source.includes("path: ${{ steps.verify.outputs.artifact-path }}") ||
      !source.includes("compression-level: 0") || !source.includes("  contents: read")) {
    throw new Error("Canonical CI must be the sole read-only main archive producer, without PR publication inputs or registry writes")
  }
}
export function checkImageWorkflows() {
  const directory = new URL("../.github/workflows/", import.meta.url)
  if (readdirSync(directory).some(file => /^build-.*-image\.ya?ml$/.test(file))) throw new Error("Duplicate main image producers are forbidden")
  assertVerificationWorkflow(readFileSync(new URL("ci.yml", directory), "utf8"))
  console.log("Canonical CI owns PR image proof and trusted main archives; publication remains separately approved")
}
if (process.argv[1] === fileURLToPath(import.meta.url)) checkImageWorkflows()
