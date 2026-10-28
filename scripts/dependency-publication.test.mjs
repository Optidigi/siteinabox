import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { assertPublicationRiskBoundary } from "./check-image-workflows.mjs"

test("publication validates complete risk and owner approval before registry access", () => {
  const source = readFileSync(new URL("../.github/workflows/publish-image.yml", import.meta.url), "utf8")
  assertPublicationRiskBoundary(source)
  assert.throws(() => assertPublicationRiskBoundary(source.replace("run: node scripts/check-publication.mjs", "run: echo skipped-risk")))
  assert.throws(() => assertPublicationRiskBoundary(source.replace("environment: ghcr-publish", "environment: unapproved")))
  assert.throws(() => assertPublicationRiskBoundary(source.replace("run: node scripts/check-publication.mjs", "if: false\n        run: node scripts/check-publication.mjs")))
})
