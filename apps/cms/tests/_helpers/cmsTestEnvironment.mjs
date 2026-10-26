import path from "node:path"
import { access, lstat, readFile, realpath, mkdtemp, writeFile, rm } from "node:fs/promises"
import { constants, realpathSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"

// Vite rewrites new URL(..., import.meta.url) as a browser asset in jsdom
// suites. Keep this Node-only setup anchored to its actual filesystem module.
const cmsRoot = path.resolve(import.meta.dirname, "../..")
const require = createRequire(path.join(cmsRoot, "package.json"))
// Match the parser used by the existing dotenv/config CLI imports, including
// colon-form assignments that Node's native parser does not recognize.
const { parse: parseEnv } = require("dotenv")

export function effectiveTestEnvironment(shell, files) {
  return Object.assign({}, ...files.map((text) => parseEnv(text)), shell)
}

export function assertDisposableCmsEnvironment(env, resource) {
  const dotenvOption = Object.keys(env).find((name) => name.startsWith("DOTENV_") && env[name] !== undefined)
  if (dotenvOption) throw new Error("Alternate dotenv loading is forbidden in tests: " + dotenvOption)
  if (/dotenv|--env-file/.test(env["NODE_OPTIONS"] || "")) throw new Error("Alternate dotenv/env-file preload is forbidden in tests")
  let uri
  try { uri = new URL(env.DATABASE_URI) } catch { throw new Error("An explicitly authorized disposable DATABASE_URI is required") }
  // This existing CLI fixture selects a nonexistent schema to exercise a
  // post-initialization error. No host, identity or other option can change.
  const missingSchema = uri.searchParams.size === 1 && uri.searchParams.get("options") === "-csearch_path=siab_cli_missing_schema"
  const targetUri = new URL(uri)
  if (missingSchema) targetUri.search = ""
  if (resource?.version !== 1 || !/^[a-f0-9]{32}$/.test(resource.id ?? "") ||
      resource.databaseUri !== targetUri.toString() || !path.isAbsolute(resource.dataRoot ?? "") ||
      !path.basename(resource.dataRoot).startsWith("siab-test-") ||
      !["postgres:", "postgresql:"].includes(uri.protocol) ||
      !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) ||
      !uri.port || !uri.username || !uri.password || uri.search && !missingSchema || uri.hash ||
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
    if (["SIAB_RENDERER_API_TOKEN", "SIAB_RENDERER_ORIGIN_SECRET"].includes(name)) {
      if (!value.startsWith("siab-test-") || value.length < 32) throw new Error("Renderer test authentication must be explicitly synthetic: " + name)
      continue
    }
    if (["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_EMAIL_API_TOKEN"].includes(name)) {
      if (env.CLOUDFLARE_ACCOUNT_ID !== "0".repeat(32) ||
          !env.CLOUDFLARE_EMAIL_API_TOKEN?.startsWith("siab-test-") || env.CLOUDFLARE_EMAIL_API_TOKEN.length < 32) {
        throw new Error(name + " requires the complete synthetic zero-account mail transport double")
      }
      continue
    }
    if (name === "POSTGRES_PASSWORD" && value === decodeURIComponent(uri.password)) continue
    const provider = /^(?:OPENAI|ANTHROPIC|MOLLIE|PAX8|EXCHANGE|OPENPROVIDER|CLOUDFLARE|POSTHOG|GOOGLE|MICROSOFT|APPLE|SMTP|AWS|S3|RESEND|SENDGRID)_/.test(name)
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

export function applyCmsTestEnvironment(env, resource) {
  assertDisposableCmsEnvironment(env, resource)
  if (realpathSync(process.cwd()) !== realpathSync(cmsRoot)) {
    throw new Error("Run CMS test application/CLI initialization from the owning apps/cms directory")
  }
  if (process.argv.some((argument) => /^dotenv_config_/i.test(argument))) {
    throw new Error("Alternate dotenv CLI loading is forbidden in tests")
  }
  // All keys from the same default dotenv files/parser are now present. Later
  // dotenv/config imports use override=false and cannot replace this result.
  Object.assign(process.env, env, { PAYLOAD_DB_PUSH: "false" })
}

export async function readEffectiveTestEnvironment(shell = process.env, directory = cmsRoot) {
  const mode = shell.NODE_ENV || "test"
  if (!["test", "production", "development"].includes(mode)) throw new Error("Unknown test child NODE_ENV")
  const files = []
  for (const name of [".env", ".env.local", ".env." + mode, ".env." + mode + ".local"]) {
    try { files.push(await readFile(path.join(directory, name), "utf8")) }
    catch (error) { if (error.code !== "ENOENT") throw error }
  }
  const env = effectiveTestEnvironment(shell, files)
  if (env.NODE_ENV && env.NODE_ENV !== mode) throw new Error("Env files cannot change the test child runtime mode")
  return { ...env, NODE_ENV: mode }
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
  await assertStorageRootOwnership(resource)
  return { env: effective, resource }
}

export async function assertDatabaseOwnership(env, resource) {
  assertDisposableCmsEnvironment(env, resource)
  const { Client } = require("pg")
  const client = new Client({ connectionString: resource.databaseUri, connectionTimeoutMillis: 5000,
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

export async function assertEmptyTestDatabase(client) {
  // A fresh database has public and system schemas plus the default plpgsql
  // extension. Namespace dependencies cover every schema-owned object that
  // DROP SCHEMA CASCADE can reach, including collations/text search/operators.
  // https://www.postgresql.org/docs/18/catalog-pg-depend.html
  const result = await client.query(`
    SELECT 'schema-owned object' AS kind FROM pg_depend d
      JOIN pg_namespace n ON d.refclassid = 'pg_namespace'::regclass AND d.refobjid = n.oid
      WHERE NOT starts_with(n.nspname, 'pg_') AND n.nspname <> 'information_schema'
    UNION ALL SELECT 'schema' FROM pg_namespace
      WHERE NOT starts_with(nspname, 'pg_') AND nspname NOT IN ('public', 'information_schema')
    UNION ALL SELECT 'extension' FROM pg_extension WHERE extname <> 'plpgsql'
    UNION ALL SELECT 'event trigger' FROM pg_event_trigger
    UNION ALL SELECT 'large object' FROM pg_largeobject_metadata
    UNION ALL SELECT 'default privileges' FROM pg_default_acl
    UNION ALL SELECT 'publication' FROM pg_publication
    UNION ALL SELECT 'foreign wrapper' FROM pg_foreign_data_wrapper
    UNION ALL SELECT 'foreign server' FROM pg_foreign_server
    UNION ALL SELECT 'database setting' FROM pg_db_role_setting
      WHERE setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
    LIMIT 1
  `)
  if (result.rowCount) throw new Error("Refusing to authorize a nonempty database containing " + result.rows[0].kind)
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
  await assertStorageRootOwnership(resource)
  const dataDir = await mkdtemp(path.join(resource.dataRoot, "run-" + resource.id + "-"))
  await writeFile(path.join(dataDir, ".siab-test-owner"), resource.id, { mode: 0o600 })
  return { env: { ...env, DATA_DIR: dataDir }, resource }
}

async function assertStorageRootOwnership(resource) {
  await assertOwnedPath(resource.dataRoot, true)
  if ((await readFile(path.join(resource.dataRoot, ".siab-test-owner"), "utf8")).trim() !== resource.id) {
    throw new Error("Test storage ownership marker is missing or mismatched")
  }
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
