import path from "node:path"
import { parseEnv } from "node:util"
import { access, lstat, readFile, realpath, mkdtemp, writeFile, rm } from "node:fs/promises"
import { constants } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const cmsRoot = fileURLToPath(new URL("../../", import.meta.url))
const require = createRequire(new URL("../../package.json", import.meta.url))

export function effectiveTestEnvironment(shell, files) {
  return Object.assign({}, ...files.map((text) => parseEnv(text)), shell)
}

export function assertDisposableCmsEnvironment(env, resource) {
  let uri
  try { uri = new URL(env.DATABASE_URI) } catch { throw new Error("An explicitly authorized disposable DATABASE_URI is required") }
  if (resource?.version !== 1 || !/^[a-f0-9]{32}$/.test(resource.id ?? "") ||
      resource.databaseUri !== env.DATABASE_URI || !path.isAbsolute(resource.dataRoot ?? "") ||
      !path.basename(resource.dataRoot).startsWith("siab-test-") ||
      !["postgres:", "postgresql:"].includes(uri.protocol) ||
      !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) ||
      !uri.port || !uri.username || !uri.password || uri.search || uri.hash ||
      !["/payload_test", "/siab_migration_test"].includes(uri.pathname)) {
    throw new Error("Database/storage must match an explicitly authorized disposable resource; no database-name rewriting is permitted")
  }
  if (!env.PAYLOAD_SECRET?.startsWith("siab-test-") || env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || env.SITE_GENERATION_PROVIDER !== "mock") {
    throw new Error("Tests require a synthetic siab-test- PAYLOAD_SECRET, disabled background jobs and mock AI")
  }
  for (const [name, value] of Object.entries(env)) {
    if (!value) continue
    if (name === "PAYLOAD_SECRET" || /^BETTER_AUTH.*SECRET$/.test(name)) {
      if (!value.startsWith("siab-test-")) throw new Error("Inherited authentication secret must be synthetic: " + name)
      continue
    }
    if (name === "POSTGRES_PASSWORD" && value === decodeURIComponent(uri.password)) continue
    const provider = /^(?:OPENAI|ANTHROPIC|MOLLIE|OPENPROVIDER|CLOUDFLARE|POSTHOG|GOOGLE|MICROSOFT|APPLE|SMTP|AWS|S3|RESEND|SENDGRID)_/.test(name)
    const credential = /(?:KEY|TOKEN|SECRET|PASSWORD)(?:_FILE)?$/.test(name)
    const harness = /^(?:GITHUB|GH|T3|CODEX)_/.test(name)
    if (provider || credential && !harness ||
        /^PG(?:HOST|HOSTADDR|PORT|DATABASE|USER|PASSWORD|SERVICE|SERVICEFILE|OPTIONS|SSLMODE)$/.test(name)) {
      throw new Error("Inherited credential or database override is forbidden in tests: " + name)
    }
  }
  if (env.COMMERCE_RELEASE_STAGE && env.COMMERCE_RELEASE_STAGE !== "disabled" ||
      env.COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED && !["0", "false"].includes(env.COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED)) {
    throw new Error("Live commerce provider writes must be disabled in tests")
  }
  if (env.DATA_DIR) {
    const relative = path.relative(resource.dataRoot, path.resolve(env.DATA_DIR))
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("DATA_DIR escapes the authorized test resource")
  }
}

export async function readEffectiveTestEnvironment(shell = process.env, directory = cmsRoot) {
  const files = []
  for (const name of [".env", ".env.local", ".env.test", ".env.test.local"]) {
    try { files.push(await readFile(path.join(directory, name), "utf8")) }
    catch (error) { if (error.code !== "ENOENT") throw error }
  }
  return effectiveTestEnvironment(shell, files)
}

export async function assertOwnedPath(file, directory = false) {
  const stat = await lstat(file)
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) ||
      process.getuid && stat.uid !== process.getuid() ||
      process.platform !== "win32" && (stat.mode & 0o077) !== 0 ||
      await realpath(file) !== path.resolve(file)) {
    throw new Error("Test authorization and storage must be private, owned paths without symlinks")
  }
}

export async function loadCmsTestEnvironment(env = process.env) {
  const effective = await readEffectiveTestEnvironment(env)
  const resourceFile = effective["SIAB_TEST_RESOURCE_FILE"]
  if (!resourceFile || !path.isAbsolute(resourceFile)) throw new Error("SIAB_TEST_RESOURCE_FILE must name the explicitly authorized disposable resource")
  await assertOwnedPath(resourceFile)
  const resource = JSON.parse(await readFile(resourceFile, "utf8"))
  assertDisposableCmsEnvironment(effective, resource)
  await assertOwnedPath(resource.dataRoot, true)
  const owner = await readFile(path.join(resource.dataRoot, ".siab-test-owner"), "utf8")
  if (owner.trim() !== resource.id) throw new Error("Test storage ownership marker is missing or mismatched")
  return { env: effective, resource }
}

export async function assertDatabaseOwnership(env, resource) {
  assertDisposableCmsEnvironment(env, resource)
  const { Client } = require("pg")
  const client = new Client({ connectionString: env.DATABASE_URI, connectionTimeoutMillis: 5000,
    query_timeout: 5000, options: "-c default_transaction_read_only=on" })
  try {
    await client.connect()
    const result = await client.query("SELECT current_database() AS name, current_setting('server_version_num')::int AS version, shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = current_database()")
    if (Math.floor(result.rows[0]?.version / 10000) !== 18) throw new Error("Authorized disposable PostgreSQL 18 is required")
    if (result.rows[0]?.name !== new URL(resource.databaseUri).pathname.slice(1) || result.rows[0]?.marker !== "siab-test:" + resource.id) {
      throw new Error("Database ownership marker is missing or mismatched; no test reset was authorized")
    }
  } catch (error) {
    if (error.message?.includes("ownership marker")) throw error
    throw new Error("Authorized disposable PostgreSQL prerequisite failed before application initialization")
  } finally { await client.end() }
}

export async function assertWorkerStorage(env, resource) {
  assertDisposableCmsEnvironment(env, resource)
  if (!env.DATA_DIR || !path.basename(env.DATA_DIR).startsWith("run-" + resource.id + "-")) {
    throw new Error("A guarded test worker must initialize its owned DATA_DIR before Payload")
  }
  await assertOwnedPath(env.DATA_DIR, true)
  if ((await readFile(path.join(env.DATA_DIR, ".siab-test-owner"), "utf8")).trim() !== resource.id) {
    throw new Error("Test worker storage ownership marker is missing or mismatched")
  }
}

export async function createWorkerStorage(env, resource) {
  assertDisposableCmsEnvironment(env, resource)
  await assertOwnedPath(resource.dataRoot, true)
  if ((await readFile(path.join(resource.dataRoot, ".siab-test-owner"), "utf8")).trim() !== resource.id) {
    throw new Error("Test storage ownership marker is missing or mismatched")
  }
  const dataDir = await mkdtemp(path.join(resource.dataRoot, "run-" + resource.id + "-"))
  await writeFile(path.join(dataDir, ".siab-test-owner"), resource.id, { mode: 0o600 })
  return { env: { ...env, DATA_DIR: dataDir }, resource }
}

export async function cleanupWorkerStorage(worker) {
  await assertWorkerStorage(worker.env, worker.resource)
  await rm(worker.env.DATA_DIR, { recursive: true })
}

export async function assertCmsTestPrerequisites(env = process.env) {
  const validator = env["SIAB_TEST_BIND_VALIDATOR_PATH"] || "/usr/bin/named-checkzone"
  try {
    const output = execFileSync(validator, ["-v"], { encoding: "utf8", timeout: 5000 })
    if (!/\b9\.\d+/.test(output)) throw new Error("Unsupported BIND validator")
  } catch { throw new Error("Real authoritative BIND named-checkzone is required; install bind9-utils (no test skip or fake validator)") }
  try { await access(require("playwright").chromium.executablePath(), constants.X_OK) }
  catch { throw new Error("Playwright Chromium is required; install the package-owned browser before CMS verification") }
}
