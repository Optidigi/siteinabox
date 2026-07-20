import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { describe, it, expect, beforeEach, afterEach } from "vitest"

import { errLike } from "../_helpers/cast"
/**
 * Tests for `scripts/migrate-on-boot.mjs`. We can't run the real script
 * against a real Postgres in unit tests (no DB), so we instead spawn `node`
 * with a fixture dist-runtime folder that exports a stub `default` config —
 * AND override Node's resolution of `payload` via the
 * `--experimental-loader` hook so `getPayload` is replaced with our stub.
 *
 * That's overkill for a smoke test. Cheaper: stage a fixture tree that
 * mirrors the real layout, then invoke a tiny variant of the script that
 * imports a stubbed `payload` module from a relative path. The production
 * script and the test variant share the same control-flow shape, so this
 * still proves "applied count + clean exit" / "thrown error → exit 1".
 *
 * The actual end-to-end migrate test happens in the live VPS smoke test
 * (called out in the wave's DONE_WITH_CONCERNS report).
 */

const repoRoot = path.resolve(__dirname, "..", "..")
const realScript = path.join(repoRoot, "scripts", "migrate-on-boot.mjs")

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "siab-migrate-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

/**
 * Stage a fake `dist-runtime/payload.config.mjs` and a stub `payload` module
 * under `node_modules/payload/index.js`. Spawn a *copy* of the migrate-on-boot
 * script that has its `await import("payload")` rewritten to a relative path
 * resolvable from the temp dir. Returns the spawn result.
 */
function runWithStub(opts: {
  countBefore: number
  countAfter: number
  throwOnMigrate?: Error
}): { status: number | null; stdout: string; stderr: string } {
  // 1. Stub payload.config.
  const distDir = path.join(tmpDir, "dist-runtime")
  const migDir = path.join(distDir, "migrations")
  mkdirSync(migDir, { recursive: true })
  writeFileSync(path.join(distDir, "payload.config.mjs"), "export default {}\n")
  writeFileSync(distDir + "/package.json", JSON.stringify({ type: "module" }))
  writeFileSync(migDir + "/package.json", JSON.stringify({ type: "module" }))

  // 2. Stub the `payload` module that the script imports. We write a local
  //    ESM module and use a Node `--import` data: URL to register an in-memory
  //    loader that maps the bare specifier `payload` to this stub.
  const stubPath = path.join(tmpDir, "payload-stub.mjs")
  const throwLine = opts.throwOnMigrate
    ? `throw new Error(${JSON.stringify(opts.throwOnMigrate.message)})`
    : ""
  writeFileSync(
    stubPath,
    `let calls = 0
export const getPayload = async () => ({
  count: async () => {
    calls++
    return { totalDocs: calls === 1 ? ${opts.countBefore} : ${opts.countAfter} }
  },
  db: {
    migrate: async () => { ${throwLine} },
    destroy: async () => {}
  }
})
`
  )

  // 3. Stage a minimal scripts dir with a copy of the real script that
  //    imports the stub via a relative path instead of the bare 'payload'.
  const scriptsDir = path.join(tmpDir, "scripts")
  mkdirSync(scriptsDir, { recursive: true })
  const realSrc = require("node:fs").readFileSync(realScript, "utf8")
  // pathToFileURL keeps the path Windows-safe (Node's `import()` requires a
  // file:// URL on Windows for absolute paths).
  const stubURL = pathToFileURL(stubPath).href
  // Replace ALL occurrences — the script has both a docstring mention of
  // `await import("payload")` and the real call. `String.prototype.replace`
  // with a string pattern replaces only the first match (the docstring),
  // leaving the real import unpatched and Node failing to resolve `payload`.
  const patched = realSrc.replaceAll(
    'await import("payload")',
    `await import(${JSON.stringify(stubURL)})`
  )
  const scriptCopy = path.join(scriptsDir, "migrate-on-boot.mjs")
  writeFileSync(scriptCopy, patched)

  // 4. Spawn node against the patched script with cwd = tmpDir so the
  //    "../dist-runtime" resolution from the script lands in our fixture.
  const res = spawnSync("node", [scriptCopy], {
    cwd: tmpDir,
    encoding: "utf8",
    timeout: 10000
  })
  return { status: res.status, stdout: res.stdout, stderr: res.stderr }
}

describe("migrate-on-boot.mjs", () => {
  it("exits 0 with 'no pending migrations' when count is unchanged", () => {
    const r = runWithStub({ countBefore: 5, countAfter: 5 })
    expect(r.stderr).toBe("")
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/no pending migrations/)
  })

  it("exits 0 with applied count when migrations run", () => {
    const r = runWithStub({ countBefore: 2, countAfter: 5 })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/3 migration\(s\) applied/)
  })

  it("exits non-zero on migrate failure", () => {
    const r = runWithStub({
      countBefore: 0,
      countAfter: 0,
      throwOnMigrate: new Error("connect ECONNREFUSED")
    })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/\[migrate-on-boot\] FAILED/)
    expect(r.stderr).toMatch(/ECONNREFUSED/)
  })
})
