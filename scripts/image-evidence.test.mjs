import assert from "node:assert/strict"
import { test } from "node:test"
import { assertImageVerificationEvidence } from "./image-evidence.mjs"

const request = { sha: "a".repeat(40), runId: "42", attempt: "1", image: "cms" }
const evidence = { application: "cms", sourceSHA: request.sha, verificationRunId: "42", verificationRunAttempt: "1",
  tag: "siab-verify-deadbeef-" + request.sha + ":cms", imageId: "sha256:" + "b".repeat(64), archiveSha256: "c".repeat(64),
  packagedSmoke: "passed", published: false, publishable: false }

test("CI evidence binds the source, current run/attempt, packaged image and successful smoke", () => {
  assertImageVerificationEvidence(request, evidence)
  for (const change of [{ sourceSHA: "d".repeat(40) }, { verificationRunId: "41" }, { verificationRunAttempt: "2" },
    { application: "renderer" }, { imageId: "latest" }, { tag: "unrelated" }, { archiveSha256: "missing" },
    { packagedSmoke: "failed" }, { published: true }, { publishable: undefined }]) {
    assert.throws(() => assertImageVerificationEvidence(request, { ...evidence, ...change }))
  }
  assert.throws(() => assertImageVerificationEvidence(request, null))
})
