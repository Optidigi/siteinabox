import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { request } from "node:http"
import { once } from "node:events"
import { setTimeout } from "node:timers/promises"
import { loadCmsTestEnvironment, assertDatabaseOwnership, createWorkerStorage, cleanupWorkerStorage,
  applyCmsTestEnvironment } from "../_helpers/cmsTestEnvironment.mjs"

import { prepareBuiltCmsAssets, captureBuiltCmsIdentity } from "../browser/built-app-artifacts.mjs"

const context = await loadCmsTestEnvironment({ ...process.env, NODE_ENV: "production" })
await assertDatabaseOwnership(context.env, context.resource)
const worker = await createWorkerStorage(context.env, context.resource)
applyCmsTestEnvironment(worker.env, context.resource)
const { Client } = createRequire(import.meta.url)("pg")
const database = new Client({ connectionString: context.resource.databaseUri, options: "-c default_transaction_read_only=on" })
const email = "built-action-negative@test.local"
let server
try {
  execFileSync("pnpm", ["payload", "generate:importmap"], { stdio: "inherit", env: process.env })
  execFileSync("pnpm", ["build"], { stdio: "inherit", env: process.env })
  await prepareBuiltCmsAssets()
  const manifest = JSON.parse(await readFile(".next/server/server-reference-manifest.json", "utf8"))
  // Never persist/print the complete manifest: it contains a build encryption key.
  const actions = Object.entries({ ...manifest.node, ...manifest.edge })
    .filter(([, entry]) => entry.filename?.endsWith("/lib/actions/inviteUser.ts"))
  assert.deepEqual(actions.map(([, entry]) => entry.exportedName).sort(), ["inviteUser", "resendUserInvitation"])
  await database.connect()
  const count = async () => (await database.query("SELECT (SELECT count(*) FROM users WHERE email = $1)::int AS users, (SELECT count(*) FROM mail_logs WHERE recipient = $1)::int AS mail", [email])).rows[0]
  const before = await count()
  const listener = createServer()
  listener.listen(0, "127.0.0.1")
  await once(listener, "listening")
  const port = listener.address().port
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()))
  let serverErrors = ""
  server = spawn(process.execPath, [".next/standalone/apps/cms/server.js"], {
    env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port) }, stdio: ["ignore", "ignore", "pipe"],
  })
  server.stderr.setEncoding("utf8")
  server.stderr.on("data", (chunk) => { serverErrors = (serverErrors + chunk).slice(-65_536) })
  let ready = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Built invitation test server exited before readiness")
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) })
      if (response.ok) { ready = true; break }
    } catch { /* Bounded startup wait for the owned child only. */ }
    await setTimeout(1000)
  }
  assert.ok(ready, "Actual built CMS must become healthy")
  const results = []
  for (const [id, entry] of actions) {
    const input = entry.exportedName === "inviteUser"
      ? { email, name: "Forged", role: "super-admin", tenantId: 1, adminUrl: "https://attacker.example", metadata: { role: "super-admin" } }
      : { userId: 1, tenantId: 1, email, adminUrl: "https://attacker.example" }
    // Use the HTTP socket API so the production authority headers reach Next
    // unchanged; fetch may replace Host with its loopback URL authority.
    const previousAuthErrors = (serverErrors.match(/Forbidden: authentication required/g) || []).length
    const response = await new Promise((resolve, reject) => {
      const outgoing = request({ hostname: "127.0.0.1", port, path: "/users", method: "POST",
        headers: { host: "admin.siteinabox.nl", "x-forwarded-host": "admin.siteinabox.nl", "x-forwarded-proto": "https",
          origin: "https://admin.siteinabox.nl", "next-action": id,
          "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" },
      }, (incoming) => {
        let body = ""
        incoming.setEncoding("utf8")
        incoming.on("data", (chunk) => { body += chunk })
        incoming.on("end", () => resolve({ status: incoming.statusCode, body }))
        incoming.on("error", reject)
      })
      outgoing.on("error", reject)
      outgoing.setTimeout(30_000, () => outgoing.destroy(new Error("Built action request timed out")))
      outgoing.end(JSON.stringify([input]))
    })
    const body = response.body
    assert.equal(response.status, 500, "Anonymous action must return the masked production authorization error: " + body.slice(0, 300))
    assert.match(body, /:E\{.*"digest"/, "Request must reach the real server-action error boundary")
    for (let attempt = 0; attempt < 20 && (serverErrors.match(/Forbidden: authentication required/g) || []).length <= previousAuthErrors; attempt += 1) await setTimeout(50)
    assert.ok((serverErrors.match(/Forbidden: authentication required/g) || []).length > previousAuthErrors,
      "The real action must reject for missing authentication, rather than another server error")
    results.push({ action: entry.exportedName, status: response.status, rejected: true })
  }
  assert.deepEqual(await count(), before, "Denied built actions must not create users or mail records")
  await mkdir("test-results", { recursive: true })
  await writeFile("test-results/invitation-actions.json", JSON.stringify({
    evidenceKind: "actual production CMS build and anonymous HTTP server-action negatives; not provider delivery proof",
    sourceDirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
    sourceSHA: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
    publicActions: results, privilegedHelperExposed: false, userAndMailCountsUnchanged: true,
    buildIdentity: await captureBuiltCmsIdentity(),
  }, null, 2) + "\n")
  console.log("Built invitation actions reject anonymous forged input; privileged helper is not exposed; no user/mail records created")
} finally {
  if (server && server.exitCode === null) {
    const closed = once(server, "close")
    server.kill("SIGTERM")
    const stopped = await Promise.race([closed.then(() => true), setTimeout(10_000).then(() => false)])
    if (!stopped) { server.kill("SIGKILL"); await closed }
  }
  await database.end()
  await cleanupWorkerStorage(worker)
}
