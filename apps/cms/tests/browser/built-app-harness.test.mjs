import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { hashBuiltTree, buildEnvironmentFingerprint } from "./built-app-artifacts.mjs"

test("build identity retains dangling internal links, detects bytes and rejects outside links", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "siab-build-identity-"))
  try {
    await writeFile(path.join(directory, "server.js"), "first build")
    await symlink("missing-optional", path.join(directory, "optional"))
    const before = await hashBuiltTree(directory)
    await writeFile(path.join(directory, "missing-optional"), "now present")
    assert.notEqual(await hashBuiltTree(directory), before)
    await mkdir(path.join(directory, "cache"))
    await writeFile(path.join(directory, "cache/code.js"), "first static code")
    const withCode = await hashBuiltTree(directory)
    await writeFile(path.join(directory, "cache/code.js"), "changed static code")
    assert.notEqual(await hashBuiltTree(directory), withCode)
    await symlink("/etc/hosts", path.join(directory, "outside"))
    await assert.rejects(hashBuiltTree(directory), /escapes/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("trace artifacts redact passwords, cookies and POST bodies before publication", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "siab-trace-redaction-"))
  try {
    const raw = path.join(directory, "raw.zip"), clean = path.join(directory, "clean.zip")
    const secret = "siab-test-private-password"
    execFileSync("python3", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('trace.network',sys.stdin.read()); z.close()", raw],
      { input: JSON.stringify({ request: { headers: [{ name: "Cookie", value: "unknown-cookie" }], postData: { text: "unknown password body" } }, params: { value: secret } }) })
    execFileSync("python3", [new URL("./redact-built-trace.py", import.meta.url).pathname, raw, clean], { input: JSON.stringify([secret]) })
    const contents = execFileSync("python3", ["-c", "import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read('trace.network').decode())", clean], { encoding: "utf8" })
    for (const value of [secret, "unknown-cookie", "unknown password body"]) assert.equal(contents.includes(value), false)
    assert(contents.includes("[REDACTED]"))
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("build reuse binds public/CI settings while worker storage stays runtime-owned", () => {
  const settings = { NODE_ENV: "production", CI: "true", NEXT_PUBLIC_SUPER_ADMIN_DOMAIN: "example.test" }
  const fingerprint = buildEnvironmentFingerprint(settings)
  assert.notEqual(buildEnvironmentFingerprint({ ...settings, NEXT_PUBLIC_SUPER_ADMIN_DOMAIN: "other.test" }), fingerprint)
  assert.notEqual(buildEnvironmentFingerprint({ ...settings, CI: "false" }), fingerprint)
  assert.equal(buildEnvironmentFingerprint({ ...settings, DATA_DIR: "/different/owned/worker" }), fingerprint)
})
