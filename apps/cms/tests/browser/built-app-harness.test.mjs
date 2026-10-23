import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { hashBuiltTree, buildEnvironmentFingerprint, assertDiagnosticIdentity } from "./built-app-artifacts.mjs"
import { createServer, connect } from "node:net"
import { once } from "node:events"
import { createBuiltAppTunnel } from "./built-app-tunnel.mjs"
import { cookieCredentials } from "./built-app-credentials.mjs"
import { readDraftDiagnostics } from "./built-private-workspace.mjs"

test("draft diagnostics settle when stores are missing, callbacks throw or IndexedDB stalls", async () => {
  let closed = 0
  for (const exists of [false, true]) {
    const request = { result: { objectStoreNames: { contains: () => exists }, close: () => { closed += 1 }, transaction: () => { throw new Error("unavailable") } } }
    const indexedDB = { open: () => { queueMicrotask(() => request.onsuccess()); return request } }
    assert.deepEqual(await readDraftDiagnostics(indexedDB), { error: exists ? "draft store unavailable" : "draft store missing" })
  }
  assert.equal(closed, 2)
  assert.deepEqual(await readDraftDiagnostics({ open: () => ({}) }, 10), { error: "draft read timed out" })
})

test("diagnostic driver edits cannot reuse changed runtime, guard, environment or artifact bytes", () => {
  const identity = { sourceSHA: "a".repeat(40), sourceDirty: false, configurationHash: "a".repeat(64),
    diagnosticInputsHash: "b".repeat(64), artifactSha256: "c".repeat(64), buildEnvironmentSha256: "d".repeat(64) }
  const changed = { ...identity, sourceSHA: "b".repeat(40), sourceDirty: true, configurationHash: "e".repeat(64) }
  const paths = ["apps/cms/tests/browser/built-private-workspace.mjs"]
  assertDiagnosticIdentity(identity, changed, paths, [])
  for (const key of ["diagnosticInputsHash", "artifactSha256", "buildEnvironmentSha256"]) {
    assert.throws(() => assertDiagnosticIdentity(identity, { ...changed, [key]: "f".repeat(64) }, paths, []))
  }
  for (const file of ["apps/cms/src/payload.config.ts", "apps/cms/tests/browser/built-app-runtime.mjs", "docs/dependency-security.json"]) {
    assert.throws(() => assertDiagnosticIdentity(identity, changed, [file], []))
  }
  assert.throws(() => assertDiagnosticIdentity(identity, changed, paths, ["unknown.ts"]))
  assert.throws(() => assertDiagnosticIdentity({ ...identity, sourceDirty: true }, changed, paths, []))
})

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

test("owned HTTPS tunnel forwards only declared authorities and closes its active sockets", { timeout: 5000 }, async () => {
  const clients = []
  let connections = 0
  const edge = createServer(socket => {
    connections += 1
    socket.on("error", () => socket.destroy())
    socket.on("data", () => socket.write("owned-loopback-response"))
  })
  edge.listen(0, "127.0.0.1"); await once(edge, "listening")
  const tunnel = await createBuiltAppTunnel(edge.address().port, ["owned.test:443"])
  const read = (socket, expected) => new Promise((resolve, reject) => {
    let buffer = ""
    const data = chunk => {
      buffer += chunk
      if (expected(buffer)) { socket.off("data", data); resolve(buffer) }
      else if (buffer.length > 4096) reject(new Error("Tunnel response exceeded the test bound"))
    }
    socket.on("data", data); socket.once("error", reject)
  })
  const dial = async authority => {
    const socket = connect(Number(new URL(tunnel.serverURL).port), "127.0.0.1"); clients.push(socket)
    socket.setEncoding("utf8"); socket.on("error", () => socket.destroy())
    await once(socket, "connect")
    const response = read(socket, value => value.includes("\r\n\r\n"))
    socket.write("CONNECT " + authority + " HTTP/1.1\r\nHost: " + authority + "\r\n\r\n")
    return { socket, response: await response }
  }
  try {
    const accepted = await dial("owned.test:443")
    assert.match(accepted.response, /^HTTP\/1.1 200/)
    const response = read(accepted.socket, value => value === "owned-loopback-response")
    accepted.socket.write("probe"); assert.equal(await response, "owned-loopback-response")
    assert.match((await dial("unowned.example:443")).response, /^HTTP\/1.1 403/)
    assert.equal(connections, 1)
    const closed = once(accepted.socket, "close")
    await tunnel.close(); await closed
    assert.equal(accepted.socket.destroyed, true)
  } finally {
    for (const socket of clients) socket.destroy()
    await tunnel.close().catch(() => undefined)
    await new Promise(resolve => edge.close(resolve))
  }
})

test("trace credentials include raw SDK tokens while language preferences remain intact", () => {
  const token = "synthetic-opaque-session-credential"
  const signed = token + ".signed%2Fmac"
  const values = cookieCredentials([{ name: "siab-locale", value: "nl" }, { name: "theme", value: "en" },
    { name: "__Secure-siab-preview-auth.session_token", value: signed }])
  assert(values.includes(token)); assert(values.includes(signed)); assert(values.includes(decodeURIComponent(signed)))
  assert(!values.includes("nl")); assert(!values.includes("en"))
})

test("trace artifacts redact passwords, cookies and POST bodies before publication", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "siab-trace-redaction-"))
  try {
    const raw = path.join(directory, "raw.zip"), clean = path.join(directory, "clean.zip")
    const secret = "siab-test-private-password"
    const token = "synthetic-opaque-session-credential"
    const credentials = cookieCredentials([{ name: "siab-locale", value: "nl" }, { name: "theme", value: "en" },
      { name: "__Secure-siab-preview-auth.session_token", value: token + ".signed%2Fmac" }])
    execFileSync("python3", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('trace.network',sys.stdin.read()); z.writestr('resources/probe',b'\\x89PNG\\r\\nnl en\\x00'); z.close()", raw],
      { input: JSON.stringify({ request: { headers: [{ name: "Cookie", value: "unknown-cookie" }], postData: { text: "unknown password body" } }, params: { value: secret }, sdkToken: token }) })
    execFileSync("python3", [new URL("./redact-built-trace.py", import.meta.url).pathname, raw, clean], { input: JSON.stringify([secret, ...credentials]) })
    const contents = execFileSync("python3", ["-c", "import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read('trace.network').decode())", clean], { encoding: "utf8" })
    for (const value of [secret, token, "unknown-cookie", "unknown password body"]) assert.equal(contents.includes(value), false)
    assert(contents.includes("[REDACTED]"))
    const resource = execFileSync("python3", ["-c", "import zipfile,sys; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read('resources/probe'))", clean])
    assert.deepEqual(resource, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x6e, 0x6c, 0x20, 0x65, 0x6e, 0x00]))
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("build reuse binds public/CI settings while worker storage stays runtime-owned", () => {
  const settings = { NODE_ENV: "production", CI: "true", NEXT_PUBLIC_SUPER_ADMIN_DOMAIN: "example.test" }
  const fingerprint = buildEnvironmentFingerprint(settings)
  assert.notEqual(buildEnvironmentFingerprint({ ...settings, NEXT_PUBLIC_SUPER_ADMIN_DOMAIN: "other.test" }), fingerprint)
  assert.notEqual(buildEnvironmentFingerprint({ ...settings, CI: "false" }), fingerprint)
  assert.notEqual(buildEnvironmentFingerprint({ ...settings, SIAB_LEGAL_CONTENT_ROOT: "/different/legal/source" }), fingerprint)
  assert.equal(buildEnvironmentFingerprint({ ...settings, DATA_DIR: "/different/owned/worker" }), fingerprint)
})


test("mail double recognizes only synthetic verification and intake notification payloads", async () => {
  const { builtAppMailVerification } = await import("./built-app-mail.mjs")
  const notification = { to: "admin@siteinabox.nl", subject: "Nieuwe intake opgeslagen: M14 Schilders Breda",
    text: "E-mail: m14-free@test.invalid" }
  assert.equal(builtAppMailVerification(notification), null)
  assert.throws(() => builtAppMailVerification({ ...notification, text: "E-mail: another@test.invalid" }))
  assert.throws(() => builtAppMailVerification({ ...notification, to: "another@test.invalid" }))
  const url = "https://admin.siteinabox.nl/api/preview-auth/magic-link/verify?token=synthetic-token"
  assert.equal(builtAppMailVerification({ to: ["m14-free@test.invalid"], text: url }), url)
  assert.throws(() => builtAppMailVerification({ to: ["m14-free@test.invalid"], text: "invalid" }))
})
