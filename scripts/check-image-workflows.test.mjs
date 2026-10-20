import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { assertVerificationWorkflow } from "./check-image-workflows.mjs"

test("automatic image verification cannot log in, publish, or export a registry cache", () => {
  const source = readFileSync(new URL("../.github/workflows/build-cms-image.yml", import.meta.url), "utf8")
  assertVerificationWorkflow(source, "cms")
  for (const unsafe of ["packages: write", "uses: docker/login-action@abc", "push: true",
    "run: docker push example", "cache-to: type=registry,ref=example", "run: node scripts/publish-image.mjs"]) {
    assert.throws(() => assertVerificationWorkflow(source + "\n" + unsafe, "cms"))
  }
  assert.throws(() => assertVerificationWorkflow(source.replace("  pull_request:", "  pull_request_target:"), "cms"))
})
