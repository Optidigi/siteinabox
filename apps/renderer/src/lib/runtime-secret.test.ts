import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { readRuntimeSecret } from "./runtime-secret"

test("reads a trimmed mounted secret and keeps an inline value compatible", () => {
  const directory = mkdtempSync(join(tmpdir(), "siab-runtime-secret-"))
  const secretFile = join(directory, "secret")
  try {
    writeFileSync(secretFile, "mounted-secret\n", { mode: 0o600 })
    assert.equal(readRuntimeSecret(undefined, secretFile), "mounted-secret")
    assert.equal(readRuntimeSecret("inline-secret", secretFile), "inline-secret")
  } finally {
    rmSync(directory, { recursive: true })
  }
})

test("fails closed for a missing or unreadable secret", () => {
  assert.equal(readRuntimeSecret(undefined, undefined), "")
  assert.equal(readRuntimeSecret(undefined, "/does/not/exist"), "")
})
