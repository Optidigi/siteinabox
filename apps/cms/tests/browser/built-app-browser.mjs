import assert from "node:assert/strict"
import { spawn, spawnSync, execFileSync } from "node:child_process"
import { once } from "node:events"
import { createRequire } from "node:module"
import { randomUUID, randomBytes, createHash, X509Certificate } from "node:crypto"
import { createServer } from "node:net"
import { request, createServer as createHttpServer } from "node:http"
import { createServer as createHttpsServer } from "node:https"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { chromium } from "playwright"
import { loadCmsTestEnvironment, assertDatabaseOwnership, assertCmsTestPrerequisites, createWorkerStorage,
  cleanupWorkerStorage, applyCmsTestEnvironment, readEffectiveTestEnvironment, assertDisposableCmsEnvironment } from "../_helpers/cmsTestEnvironment.mjs"
import { cmsRoot, cmsEntry, repositoryRoot, builtCmsTestEnvironment, hashBuiltTree, assertBuiltCmsIdentity, assertDiagnosticBuiltCmsIdentity, buildEnvironmentFingerprint } from "./built-app-artifacts.mjs"
import { runPrivateWorkspaceJourney } from "./built-private-workspace.mjs"
import { runVerifiedCustomerJourney } from "./built-customer-journey.mjs"
import { runProductLegalJourney } from "./built-product-legal.mjs"
import { createBuiltAppTunnel } from "./built-app-tunnel.mjs"
import { cookieCredentials } from "./built-app-credentials.mjs"
import { builtBrowserOptions } from "./built-app-options.mjs"

const { reuse, scenario, qualification } = builtBrowserOptions(process.argv.slice(2))
const focused = qualification === "diagnostic"
const startedAt = performance.now()
const context = await loadCmsTestEnvironment(builtCmsTestEnvironment())
await assertDatabaseOwnership(context.env, context.resource)
await assertCmsTestPrerequisites(context.env)
assert.equal(process.versions.node, (await readFile(path.join(repositoryRoot, ".nvmrc"), "utf8")).trim(), "Pinned Node is required")
execFileSync("python3", ["--version"], { stdio: "ignore", timeout: 5000 })
execFileSync("openssl", ["version"], { stdio: "ignore", timeout: 5000 })
execFileSync(process.execPath, ["--test", "tests/browser/built-app-harness.test.mjs", "tests/browser/built-app-options.test.mjs"], { cwd: cmsRoot, stdio: "inherit" })
const worker = await createWorkerStorage(context.env, context.resource)
const env = { ...worker.env, NODE_ENV: "production", PAYLOAD_DB_PUSH: "false", NEXT_TELEMETRY_DISABLED: "1", ASTRO_TELEMETRY_DISABLED: "1",
  SIAB_RENDERER_API_TOKEN: "siab-test-browser-renderer-" + randomBytes(16).toString("hex"),
  SIAB_RENDERER_ORIGIN_SECRET: "siab-test-browser-origin-" + randomBytes(16).toString("hex"),
  CLOUDFLARE_ACCOUNT_ID: "0".repeat(32), CLOUDFLARE_EMAIL_API_TOKEN: "siab-test-mail-" + randomBytes(16).toString("hex"),
  EMAIL_FROM: "noreply@test.invalid" }
applyCmsTestEnvironment(env, context.resource)
const runtime = path.join(cmsRoot, "tests/browser/built-app-runtime.mjs")
const rendererRoot = path.resolve(cmsRoot, "../renderer")
const output = path.join(cmsRoot, "test-results/built-browser-" + randomUUID())
await mkdir(output, { mode: 0o700, recursive: true })
const secrets = new Set([env.PAYLOAD_SECRET, env.DATABASE_URI, decodeURIComponent(new URL(env.DATABASE_URI).password),
  env.SIAB_RENDERER_API_TOKEN, env.SIAB_RENDERER_ORIGIN_SECRET].filter(Boolean))
secrets.add(env.CLOUDFLARE_EMAIL_API_TOKEN)
const redact = (text) => [...secrets].sort((a, b) => b.length - a.length).reduce((s, secret) => s.replaceAll(secret, "[REDACTED]"), text)
const processes = []
const browserContexts = []
const blockedBrowserReads = []
const assertions = []
const expectedGuardPids = new Set()
let browser, cms, renderer, gateway, browserProxy, cmsBridge, database, fixture, identity, rendererHash, rendererSettings, certificatePin, providerAudit, failure
const verify = (name) => assertions.push(name)

async function freePort() {
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening")
  const port = socket.address().port; await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()))
  return port
}
function start(entry, cwd, childEnv, role) {
  const child = spawn(process.execPath, ["--import", runtime, entry], { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] })
  const owned = { child, role, log: "", spawnError: null }
  child.on("error", error => { owned.spawnError = error })
  expectedGuardPids.add(child.pid)
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { owned.log = (owned.log + chunk).slice(-262144) })
  processes.push(owned); return owned
}
async function stop(owned) {
  if (!owned || owned.spawnError || owned.child.exitCode !== null || owned.child.signalCode !== null) return
  const closed = once(owned.child, "close")
  owned.child.kill("SIGTERM")
  const timeout = setTimeout(() => owned.child.kill("SIGKILL"), 10000)
  try { await closed } finally { clearTimeout(timeout) }
}
function runGuardedScript(entry, args = [], timeout = 180000) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--import", runtime, entry, ...args],
    { cwd: cmsRoot, env, stdio: "inherit", timeout })
  if (result.error) throw result.error
  assert(Number.isInteger(result.pid), "Owned fixture process must start")
  expectedGuardPids.add(result.pid)
  assert.equal(result.status, 0, "Owned fixture process must succeed")
}
async function http(port, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = request({ hostname: "127.0.0.1", port, path: pathname, headers }, incoming => {
      let body = ""; incoming.setEncoding("utf8")
      incoming.on("data", chunk => { body += chunk; if (body.length > 2 * 1024 * 1024) outgoing.destroy(new Error("HTTP response exceeds test bound")) })
      incoming.on("end", () => resolve({ status: incoming.statusCode, body }))
    })
    outgoing.on("error", reject); outgoing.setTimeout(5000, () => outgoing.destroy(new Error("Owned server request timed out"))); outgoing.end()
  })
}
async function ready(owned, port, pathname, status) {
  const started = Date.now()
  while (Date.now() - started < 30000) {
    if (owned.spawnError) throw owned.spawnError
    if (owned.child.exitCode !== null || owned.child.signalCode !== null) throw new Error(owned.role + " exited before readiness")
    try { if ((await http(port, pathname)).status === status) return } catch { /* Wait only for this owned child's bounded startup. */ }
    await delay(500)
  }
  throw new Error(owned.role + " startup prerequisite failed")
}
async function rememberCookies(browserContext) {
  for (const value of cookieCredentials(await browserContext.cookies())) secrets.add(value)
}
async function api(page, pathname, body, method = "POST") {
  return page.evaluate(async ({ pathname, body, method }) => {
    const response = await fetch(pathname, body === undefined ? {} : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const text = await response.text()
    let data; try { data = JSON.parse(text) } catch { data = null }
    return { status: response.status, data }
  }, { pathname, body, method })
}
function forwardApplication(incoming, outgoing, port, host, originSecret) {
  const headers = { ...incoming.headers, host, "x-forwarded-host": host, "x-forwarded-proto": "https" }
  delete headers["x-siab-origin-verify"]
  if (originSecret) headers["x-siab-origin-verify"] = originSecret
  const upstream = request({ hostname: "127.0.0.1", port, path: incoming.url, method: incoming.method, headers }, response => {
    outgoing.writeHead(response.statusCode, response.headers); response.pipe(outgoing)
  })
  upstream.on("error", () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end() })
  incoming.on("aborted", () => upstream.destroy()); incoming.pipe(upstream)
}
async function storedPage(id = fixture.pages[0].id, tenantId = fixture.tenants[0].id) {
  const result = await database.query('SELECT id, title, slug, status, updated_at AS "updatedAt" FROM pages WHERE id=$1 AND tenant_id=$2', [id, tenantId])
  assert.equal(result.rowCount, 1, "The owned fixture must exist in PostgreSQL")
  return { ...result.rows[0], updatedAt: result.rows[0].updatedAt.toISOString() }
}
function saveBody(page, title, publish = true) {
  return { tenantId: fixture.tenants[0].id, publish, page: { id: page.id, expectedUpdatedAt: page.updatedAt,
    data: { title, slug: page.slug, status: "published", blocks: page.blocks, seo: page.seo } } }
}

try {
  if (reuse) {
    const receipt = JSON.parse(await readFile(path.join(cmsRoot, "test-results/invitation-actions.json"), "utf8"))
    assert.equal(receipt.privilegedHelperExposed, false)
    assert.equal(receipt.userAndMailCountsUnchanged, true)
    assert.equal(receipt.transportGuardVerified, true)
    assert.equal(receipt.providerOperationsAttempted, 0)
    identity = focused ? receipt.buildIdentity : await assertBuiltCmsIdentity(receipt.buildIdentity)
    if (focused) await assertDiagnosticBuiltCmsIdentity(identity)
  }
  runGuardedScript("tests/browser/built-app-fixture.ts")
  fixture = JSON.parse(await readFile(path.join(env.DATA_DIR, "browser-fixture.json"), "utf8")); secrets.add(fixture.password)
  if (!reuse) {
    execFileSync("pnpm", ["test:invitation-actions"], { cwd: cmsRoot, env, stdio: "inherit", timeout: 600000 })
    const receipt = JSON.parse(await readFile(path.join(cmsRoot, "test-results/invitation-actions.json"), "utf8"))
    identity = await assertBuiltCmsIdentity(receipt.buildIdentity, true)
  }
  const rendererBuildEnv = await readEffectiveTestEnvironment(env, rendererRoot)
  assertDisposableCmsEnvironment(rendererBuildEnv, context.resource)
  rendererSettings = buildEnvironmentFingerprint(rendererBuildEnv)
  if (!focused) {
    execFileSync("pnpm", ["build"], { cwd: rendererRoot, env: rendererBuildEnv, stdio: "inherit", timeout: 300000 })
    rendererHash = await hashBuiltTree(path.join(rendererRoot, "dist"))
  }
  const { Client } = createRequire(import.meta.url)("pg")
  database = new Client({ connectionString: context.resource.databaseUri, options: "-c default_transaction_read_only=on", connectionTimeoutMillis: 5000, query_timeout: 5000 })
  await database.connect()
  const cmsPort = await freePort(), rendererPort = await freePort()
  const cmsHost = "admin." + (env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN || "siteinabox.nl")
  assert.match(cmsHost, /^admin\.[a-z0-9.-]+$/)
  const edgePort = await freePort(), bridgePort = await freePort()
  const cmsOrigin = "https://" + cmsHost
  const publicOrigin = "https://" + fixture.tenants[0].domain + ":" + edgePort
  const allowedOrigins = new Set([cmsOrigin, publicOrigin])
  const cmsEnv = { ...env, HOSTNAME: "127.0.0.1", PORT: String(cmsPort) }
  const rendererEnv = { ...rendererBuildEnv, HOST: "127.0.0.1", PORT: String(rendererPort), SIAB_CMS_URL: "http://127.0.0.1:" + bridgePort, SIAB_RENDERER_FIXTURE_MODE: "" }
  cms = start(cmsEntry, cmsRoot, cmsEnv, "cms")
  if (!focused) renderer = start(path.join(rendererRoot, "dist/server/entry.mjs"), rendererRoot, rendererEnv, "renderer")
  await ready(cms, cmsPort, "/api/health", 200)
  if (!focused) await ready(renderer, rendererPort, "/", 404)
  verify(focused ? "actual built CMS became ready for workspace diagnosis" : "actual built CMS and production renderer became ready")
  // Production's CMS URL has platform authority. Model that internal hop on
  // loopback without DNS/CA/global environment changes or injected API auth.
  cmsBridge = createHttpServer((incoming, outgoing) => {
    if (incoming.method !== "GET" || incoming.url.split("?")[0] !== "/api/renderer/snapshot") { outgoing.writeHead(404); outgoing.end(); return }
    forwardApplication(incoming, outgoing, cmsPort, cmsHost)
  })
  cmsBridge.listen(bridgePort, "127.0.0.1"); await once(cmsBridge, "listening")
  assert.equal((await http(bridgePort, "/api/renderer/snapshot?host=" + fixture.tenants[0].domain)).status, 401)

  assert.equal((await http(cmsPort, "/api/renderer/snapshot?host=" + fixture.tenants[0].domain, { host: cmsHost })).status, 401)
  if (!focused) {
  assert.equal((await http(rendererPort, "/", { host: fixture.tenants[0].domain, "x-forwarded-proto": "https" })).status, 404)
  verify("snapshot bearer and direct-origin protections deny anonymous access")
  }
  // A loopback-only TLS/edge double preserves the real production HTTPS
  // authority and origin guards. It forwards actual app responses unchanged.
  const keyFile = path.join(env.DATA_DIR, "edge-key.pem"), certFile = path.join(env.DATA_DIR, "edge-cert.pem")
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=" + cmsHost, "-addext", "subjectAltName=DNS:" + cmsHost + ",DNS:" + fixture.tenants[0].domain,
    "-keyout", keyFile, "-out", certFile], { stdio: "ignore", timeout: 10000 })
  gateway = createHttpsServer({ key: await readFile(keyFile), cert: await readFile(certFile) }, (incoming, outgoing) => {
    const host = incoming.headers.host
    const isCms = host === cmsHost
    const isPublic = host === fixture.tenants[0].domain + ":" + edgePort
    if ((!isCms && (!isPublic || focused)) || !incoming.url.startsWith("/")) { outgoing.writeHead(404); outgoing.end(); return }
    forwardApplication(incoming, outgoing, isCms ? cmsPort : rendererPort, isCms ? cmsHost : host,
      isPublic ? env.SIAB_RENDERER_ORIGIN_SECRET : undefined)
  })
  gateway.listen(edgePort, "127.0.0.1"); await once(gateway, "listening")
  const certificate = new X509Certificate(await readFile(certFile))
  certificatePin = createHash("sha256").update(certificate.publicKey.export({ type: "spki", format: "der" })).digest("base64")
  // CONNECT preserves the browser's real origin and every redirect. Only these
  // owned authorities can tunnel, and every tunnel ends at this loopback edge.
  browserProxy = await createBuiltAppTunnel(edgePort, [cmsHost + ":443", fixture.tenants[0].domain + ":" + edgePort])
  // Trust only this run's generated loopback certificate, not arbitrary HTTPS.
  browser = await chromium.launch({ headless: true, proxy: { server: browserProxy.serverURL }, args: ["--ignore-certificate-errors-spki-list=" + certificatePin,
    "--host-resolver-rules=MAP " + cmsHost + " 127.0.0.1, MAP *.test 127.0.0.1"] })
  async function newContext(name, headers = {}, viewport = { width: 1440, height: 1000 }) {
    const current = await browser.newContext({ viewport, isMobile: viewport.width < 500,
      hasTouch: viewport.width < 500, extraHTTPHeaders: headers })
    await current.route("**/*", route => {
      const url = new URL(route.request().url())
      if (allowedOrigins.has(url.origin)) return route.continue()
      blockedBrowserReads.push({ hostname: url.hostname, type: route.request().resourceType() })
      return route.abort("blockedbyclient")
    })
    await current.tracing.start({ screenshots: true, snapshots: true, sources: false })
    browserContexts.push({ context: current, name }); return current
  }
  const ownedPath = "/pages/" + fixture.pages[0].id
  async function login(page, person = fixture.owners[0], target = ownedPath) {
    const loginResponse = await page.goto(cmsOrigin + "/login?next=" + encodeURIComponent(target))
    assert.equal((await loginResponse.serverAddr()).ipAddress, "127.0.0.1", "Credentials must stay on the owned loopback gateway")
    await page.getByRole("button", { name: /password|wachtwoord/i }).click()
    await page.locator('input[name="email"]').fill(person.email)
    await page.locator('input[name="password"]').fill(fixture.password)
    const response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/users/login" && r.request().method() === "POST")
    await page.locator('form').filter({ has: page.locator('input[name="password"]') }).locator('button[type="submit"]').click()
    assert.equal((await response).status(), 200)
    await page.waitForURL(url => url.pathname === target)
    if (target === ownedPath && person.role !== "viewer") await page.locator('input[name="title"]').first().waitFor({ state: "visible" })
    await rememberCookies(page.context())
  }
  if (focused) {
    await runPrivateWorkspaceJourney({ newContext, login, cmsOrigin, cmsRoot, fixture, database, api, verify, output })
  } else {
  const anonymous = await newContext("anonymous"), owner = await newContext("owner"), stolen = await newContext("revoked-session")
  const publicContext = await newContext("published-renderer")
  const guestPage = await anonymous.newPage(), ownerPage = await owner.newPage(), stolenPage = await stolen.newPage(), publicPage = await publicContext.newPage()
  for (const page of [guestPage, ownerPage, stolenPage, publicPage]) page.setDefaultTimeout(20000)
  await guestPage.goto(cmsOrigin + ownedPath)
  assert.equal(new URL(guestPage.url()).pathname, "/login")
  const denialBody = { tenantId: fixture.tenants[0].id, publish: true, page: { id: fixture.pages[0].id, data: { title: "forged", slug: "index", status: "published", blocks: [] } } }
  assert.equal((await api(guestPage, "/api/page-editor-save", denialBody)).status, 403)
  verify("anonymous protected page and real save endpoint deny")
  const cmsFonts = JSON.parse(await readFile(path.join(cmsRoot, "src/styles/font-assets.json"), "utf8"))
  await guestPage.goto(cmsOrigin + "/login")
  for (const asset of cmsFonts.assets) {
    const font = await guestPage.evaluate(async file => {
      const response = await fetch("/fonts/cms/" + file)
      const bytes = await response.arrayBuffer()
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("")
      return { status: response.status, type: response.headers.get("content-type"), cache: response.headers.get("cache-control"), size: bytes.byteLength, digest }
    }, asset.file)
    assert.equal(font.status, 200)
    assert.match(font.type, /^font\/woff2/)
    assert.equal(font.cache, "public, max-age=31536000, immutable")
    assert.equal(font.size, asset.size); assert.equal(font.digest, asset.sha256)
  }
  const fontPreloads = await guestPage.locator('link[rel="preload"][as="font"]').evaluateAll(links => links.map(link => new URL(link.href).pathname).sort())
  assert.deepEqual(fontPreloads, cmsFonts.assets.filter(asset => asset.preload).map(asset => "/fonts/cms/" + asset.file).sort())
  verify("CMS typography serves original licensed local font bytes with preserved preloads and immutable caches")
  await login(ownerPage); await login(stolenPage)
  verify("two genuine password logins establish real Payload sessions")
  const marker = "M13 saved " + randomUUID().slice(0, 8)
  await ownerPage.locator('input[name="title"]').first().fill(marker)
  const saved = ownerPage.waitForResponse(r => new URL(r.url()).pathname === "/api/page-editor-save" && r.request().method() === "POST")
  await ownerPage.getByRole("button", { name: /^(Save|Opslaan)$/ }).first().click()
  const savedResponse = await saved
  assert.equal(savedResponse.status(), 200); assert.equal((await savedResponse.json()).ok, true)
  await ownerPage.reload(); assert.equal(await ownerPage.locator('input[name="title"]').first().inputValue(), marker)
  let stored = await storedPage(); assert.equal(stored.title, marker)
  const restRead = await api(ownerPage, "/api/pages/" + fixture.pages[0].id)
  assert.equal(restRead.status, 200); assert.equal(restRead.data.title, marker)
  for (const suffix of ["", "?overrideAccess=true"]) {
    const me = await api(ownerPage, "/api/users/me" + suffix)
    assert.equal(me.status, 200); assert.equal(me.data.user.id, fixture.owners[0].id)
    assert.equal(Object.hasOwn(me.data.user, "sessions"), false, "Public user serialization must hide sessions")
  }
  verify("authenticated REST reads work without exposing session records or trusting client override flags")
  async function publishedMarker(expected) {
    const response = await publicPage.goto(publicOrigin)
    assert.equal(response.status(), 200, "Actual renderer must serve the published tenant")
    if (!(await publicPage.title()).includes(expected)) throw new Error("E_PUBLISHED_MARKER_MISMATCH: real renderer did not serve the stored marker")
  }
  await publishedMarker(fixture.pages[0].title)
  verify("real editor Save persists privately while the live snapshot remains unchanged")
  const published = ownerPage.waitForResponse(r => new URL(r.url()).pathname === "/api/page-editor-save" && r.request().method() === "POST")
  await ownerPage.getByRole("button", { name: /^(Publish|Publiceren)$/ }).first().click()
  const publishedResponse = await published
  assert.equal(publishedResponse.status(), 200)
  assert.equal((await publishedResponse.json()).snapshot.status, "active")
  await publishedMarker(marker)
  assert.equal((await publicPage.content()).includes(env.SIAB_RENDERER_API_TOKEN), false)
  verify("separate explicit Publish reaches the actual renderer")
  await ownerPage.screenshot({ path: path.join(output, "owned-page.png") })
  await publicPage.screenshot({ path: path.join(output, "published-page.png") })
  const privateResponse = await ownerPage.goto(cmsOrigin + "/pages/" + fixture.draftId)
  assert.equal(privateResponse.status(), 200)
  assert.equal(await ownerPage.locator('input[name="title"]').first().inputValue(), "Private browser draft")
  assert.equal((await storedPage(fixture.draftId)).status, "draft")
  const draftResponse = await publicPage.goto(publicOrigin + "/private-browser-draft")
  assert.equal(draftResponse.status(), 404); assert.equal((await publicPage.content()).includes("PRIVATE-M13-DRAFT-SECRET"), false)
  verify("owned draft is private and absent from actual public renderer")
  const foreignBefore = await storedPage(fixture.pages[1].id, fixture.tenants[1].id)
  const otherResponse = await ownerPage.goto(cmsOrigin + "/pages/" + fixture.pages[1].id)
  // Next's streamed notFound response retains HTTP 200. Require the actual
  // denial boundary and absence of the protected editor/document in both cases.
  assert([200, 404].includes(otherResponse.status()))
  if (otherResponse.status() === 200) assert.match(await otherResponse.text(), /NEXT_HTTP_ERROR_FALLBACK;404/)
  await ownerPage.getByRole("heading", { name: /page not found|pagina niet gevonden/i }).waitFor()
  assert.equal(await ownerPage.locator('input[name="title"]').count(), 0)
  assert.equal((await ownerPage.locator("body").innerText()).includes(fixture.pages[1].title), false)
  assert.equal((await api(ownerPage, "/api/page-editor-save", { ...denialBody, tenantId: fixture.tenants[1].id,
    page: { ...denialBody.page, id: fixture.pages[1].id, expectedUpdatedAt: foreignBefore.updatedAt } })).status, 403)
  assert.deepEqual(await storedPage(fixture.pages[1].id, fixture.tenants[1].id), foreignBefore)
  verify("other-tenant page and real save endpoint deny")
  const rolePages = new Map()
  for (const person of fixture.roles) {
    const context = await newContext("legacy-" + person.role)
    const page = await context.newPage(); page.setDefaultTimeout(20000)
    await login(page, person, person.role === "super-admin" ? "/sites" : ownedPath)
    const me = await api(page, "/api/users/me")
    assert.equal(me.data.user.role, person.role)
    if (person.role === "super-admin") assert.equal(me.data.user.tenants?.length ?? 0, 0)
    else {
      assert.equal((await api(page, "/api/pages/" + fixture.pages[0].id)).status, 200)
      if (person.role === "viewer") {
        await page.getByRole("heading", { name: marker, exact: true }).first().waitFor()
        assert.equal(await page.locator('input[name="title"]').count(), 0)
      } else assert.equal(await page.locator('input[name="title"]').first().isEditable(), true)
    }
    rolePages.set(person.role, page)
  }
  const draftBefore = await storedPage(fixture.draftId)
  const draftEdit = saveBody(draftBefore, "Editor permitted private update", false)
  draftEdit.page.data.status = "draft"
  assert.equal((await api(rolePages.get("editor"), "/api/page-editor-save", draftEdit)).status, 200)
  const afterEditor = await storedPage(fixture.draftId)
  assert.equal(afterEditor.title, "Editor permitted private update")
  assert.equal((await api(rolePages.get("viewer"), "/api/page-editor-save", saveBody(afterEditor, "Viewer must not write", false))).status, 403)
  assert.deepEqual(await storedPage(fixture.draftId), afterEditor)
  verify("synthetic Amicare-compatible owner/editor/viewer access and tenantless super-admin remain effective")
  await runPrivateWorkspaceJourney({ newContext, login, cmsOrigin, cmsRoot, fixture, database, api, verify, output })
  const customerJourney = await runVerifiedCustomerJourney({ newContext, cmsOrigin, cmsRoot, env, fixture, database, api,
    rememberCookies, secrets, output, verify,
    control: action => runGuardedScript("tests/browser/built-customer-control.ts", [action], 30000),
  })
  assert.equal((await http(rendererPort, "/", { host: customerJourney.domain, "x-forwarded-proto": "https",
    "x-siab-origin-verify": env.SIAB_RENDERER_ORIGIN_SECRET })).status, 404)
  verify("free generated website stays private in the actual public renderer")
  await runProductLegalJourney({ newContext, login, cmsOrigin, fixture, verify, api,
    control: action => runGuardedScript("tests/browser/built-legal-control.ts", [action], 30000) })
  await ownerPage.goto(cmsOrigin + "/profile")
  const changedPassword = "siab-test-" + randomBytes(20).toString("hex"); secrets.add(changedPassword)
  assert.equal((await api(ownerPage, "/api/users/change-password", { currentPassword: fixture.password, newPassword: changedPassword })).status, 200)
  await rememberCookies(owner)
  await stolenPage.goto(cmsOrigin + ownedPath); await stolenPage.waitForURL(url => url.pathname === "/login")
  assert.equal((await api(stolenPage, "/api/page-editor-save", denialBody)).status, 403)
  await ownerPage.goto(cmsOrigin + ownedPath); assert.equal(await ownerPage.locator('input[name="title"]').first().inputValue(), marker)
  verify("password rotation revokes the other genuine session while caller stays authenticated")
  await stop(cms); await stop(renderer)
  await assertBuiltCmsIdentity(identity, !reuse)
  assert.equal(await hashBuiltTree(path.join(rendererRoot, "dist")), rendererHash)
  cms = start(cmsEntry, cmsRoot, cmsEnv, "cms-restart")
  renderer = start(path.join(rendererRoot, "dist/server/entry.mjs"), rendererRoot, rendererEnv, "renderer-restart")
  await ready(cms, cmsPort, "/api/health", 200); await ready(renderer, rendererPort, "/", 404)
  await ownerPage.reload(); assert.equal(await ownerPage.locator('input[name="title"]').first().inputValue(), marker)
  stored = await storedPage(); assert.equal(stored.title, marker)
  await publishedMarker(marker)
  await customerJourney.afterRestart()
  verify("same built artifacts restart with real persisted session, document and publication")
  // Deliberately violate the persistence/publication invariant via the actual
  // API's save-without-publish operation. The SAME renderer assertion must fail.
  const negativeMarker = "M13 unpublished negative " + randomUUID().slice(0, 8)
  assert.equal((await api(ownerPage, "/api/page-editor-save", saveBody(stored, negativeMarker, false))).status, 200)
  const negativeStored = await storedPage(); assert.equal(negativeStored.title, negativeMarker)
  await assert.rejects(() => publishedMarker(negativeMarker), /E_PUBLISHED_MARKER_MISMATCH/)
  verify("negative publication fixture is detected by the real served-marker assertion")
  assert.equal((await api(ownerPage, "/api/page-editor-save", saveBody(negativeStored, marker))).status, 200)
  await publishedMarker(marker)
  assert.equal((await api(rolePages.get("super-admin"), "/api/customer-accounts/" + customerJourney.accountId,
    { revokedAt: new Date().toISOString() }, "PATCH")).status, 200)
  await customerJourney.assertRevoked()
  }
} catch (error) {
  failure = error
  for (const item of browserContexts) {
    const page = item.context.pages()[0]
    try { await page?.screenshot({ path: path.join(output, "failure-" + item.name + ".png"), timeout: 5000 }) } catch { /* The redacted trace retains startup/navigation diagnostics. */ }
  }
} finally {
  for (const item of browserContexts) {
    try {
      await rememberCookies(item.context)
      const raw = path.join(env.DATA_DIR, item.name + ".trace.zip")
      await item.context.tracing.stop({ path: raw })
      execFileSync("python3", [path.join(cmsRoot, "tests/browser/redact-built-trace.py"), raw, path.join(output, item.name + ".trace.zip")],
        { input: JSON.stringify([...secrets]), timeout: 30000 })
    } catch (error) { failure ??= error }
  }
  try { await browser?.close() } catch (error) { failure ??= error }
  try { await browserProxy?.close() } catch (error) { failure ??= error }
  for (const server of [gateway, cmsBridge]) if (server) {
    try {
      server.closeAllConnections()
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    } catch (error) { failure ??= error }
  }
  for (const owned of processes) {
    try { await stop(owned) } catch (error) { failure ??= error }
  }
  try {
    if (identity) {
      if (focused && reuse) await assertDiagnosticBuiltCmsIdentity(identity)
      else await assertBuiltCmsIdentity(identity, !reuse)
    }
  } catch (error) { failure ??= error }
  for (const owned of processes) {
    try { await writeFile(path.join(output, owned.role + ".log"), redact(owned.log), { mode: 0o600 }) }
    catch (error) { failure ??= error }
  }
  try {
    const audits = []
    const initializedPids = new Set()
    for (const file of (await readdir(env.DATA_DIR)).filter(name => /^network-\d+\.ndjson$/.test(name))) {
      const events = (await readFile(path.join(env.DATA_DIR, file), "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
      audits.push(...events)
      if (events.some(event => event.kind === "initialized")) initializedPids.add(Number(file.match(/\d+/)[0]))
    }
    providerAudit = { initializedChildren: audits.filter(event => event.kind === "initialized").length,
      deniedBackendOperations: audits.filter(event => event.kind === "denied").length,
      controlledMailOperations: audits.filter(event => event.kind === "controlled-mail").length,
      expectedGuardedChildren: expectedGuardPids.size }
    for (const pid of expectedGuardPids) assert(initializedPids.has(pid), "Every recorded app/fixture/control process must install its explicit provider doubles")
    assert.equal(providerAudit.deniedBackendOperations, 0, "This journey must not attempt backend provider operations")
    assert.equal(Number((await database.query("SELECT count(*) AS count FROM mail_logs")).rows[0].count), providerAudit.controlledMailOperations,
      "Every recorded mail must belong to the explicit captured transport double")
  } catch (error) { failure ??= error }
  try { await database?.end() } catch (error) { failure ??= error }
  try { await cleanupWorkerStorage(worker) } catch (error) { failure ??= error }
  // Evidence failures must not interrupt teardown, and a passing receipt must
  // include successful shutdown/owned-storage cleanup in its final verdict.
  try { await writeFile(path.join(output, "summary.json"), JSON.stringify({ scenario, qualification, elapsedMs: Math.round(performance.now() - startedAt), sourceSHA: identity?.sourceSHA,
    sourceDirty: identity?.sourceDirty, diagnosticDriverSource: focused ? { sourceSHA: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(), sourceDirty: Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: repositoryRoot, encoding: "utf8" }).trim()) } : null, cmsBuild: identity, rendererArtifactSha256: rendererHash, rendererBuildSettingsSha256: rendererSettings, edgeCertificatePin: certificatePin,
    providerAudit, verificationRunId: process.env.GITHUB_RUN_ID ?? null, verificationRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    environment: { node: process.versions.node, mode: "production", database: new URL(env.DATABASE_URI).pathname.slice(1),
      ownershipVerified: true, jobsAutorun: false, ai: "mock", providers: "deny external operations",
      mail: "explicit synthetic captured transport", rendererFixtureMode: false },
    browser: browser?.version(), assertions, blockedBrowserReads, status: failure ? "failed" : "passed",
    error: failure ? redact(failure.stack ?? String(failure)) : null,
    limitations: focused ? "Workspace/settings diagnostic only; excludes renderer, full session/restart, release and provider qualification" :
      "Built local application/session/persistence/renderer proof; not live provider, production, release or visual regression clearance" }, null, 2) + "\n", { mode: 0o600 }) }
  catch (error) { failure ??= error }
}
if (failure) { console.error(redact(failure.stack ?? String(failure))); process.exitCode = 1 }
else console.log((focused ? "Diagnostic workspace/settings journey passed: " : "Real built CMS/browser/renderer journey passed: ") + assertions.length + " boundary assertions; redacted evidence in " + path.relative(cmsRoot, output))
