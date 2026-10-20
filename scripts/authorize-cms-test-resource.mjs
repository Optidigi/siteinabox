import { randomBytes } from "node:crypto"
import { readdir, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { assertDisposableCmsEnvironment, assertDatabaseOwnership, loadCmsTestEnvironment, readEffectiveTestEnvironment, assertOwnedPath } from "../apps/cms/tests/_helpers/cmsTestEnvironment.mjs"

const args = process.argv.slice(2)
if (args.length !== 2 || args[0] !== "--authorize-empty-database" || !path.isAbsolute(args[1])) {
  throw new Error("Usage: node scripts/authorize-cms-test-resource.mjs --authorize-empty-database /absolute/siab-test-resource-directory (DATABASE_URI must identify the expressly disposable target)")
}
const directory = args[1]
if (!path.basename(directory).startsWith("siab-test-")) throw new Error("Resource directory must have a siab-test- name")
const env = await readEffectiveTestEnvironment()
await mkdir(directory, { recursive: true, mode: 0o700 })
await assertOwnedPath(directory, true)
const dataRoot = await realpath(directory)
const resourceFile = path.join(dataRoot, "resource.json")
let existing = false
try { await readFile(resourceFile); existing = true } catch (error) { if (error.code !== "ENOENT") throw error }
if (existing) {
  const context = await loadCmsTestEnvironment({ ...env, SIAB_TEST_RESOURCE_FILE: resourceFile })
  await assertDatabaseOwnership(context.env, context.resource)
} else {
  if ((await readdir(dataRoot)).length) throw new Error("Refusing to adopt nonempty unowned test storage")
  const resource = { version: 1, id: randomBytes(16).toString("hex"), databaseUri: env.DATABASE_URI, dataRoot }
  assertDisposableCmsEnvironment(env, resource)
  const require = createRequire(new URL("../apps/cms/package.json", import.meta.url))
  const { Client } = require("pg")
  const client = new Client({ connectionString: env.DATABASE_URI, connectionTimeoutMillis: 5000, query_timeout: 5000 })
  try {
    await client.connect()
    const marker = await client.query("SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = current_database()")
    const objects = await client.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' LIMIT 1")
    if (marker.rows[0]?.marker || objects.rowCount) throw new Error("Refusing to authorize a nonempty or already-owned database without its matching resource file")
    const database = new URL(resource.databaseUri).pathname.slice(1)
    await client.query('COMMENT ON DATABASE "' + database + '" IS \'siab-test:' + resource.id + "'")
    await writeFile(path.join(dataRoot, ".siab-test-owner"), resource.id + "\n", { mode: 0o600, flag: "wx" })
    await writeFile(resourceFile, JSON.stringify(resource, null, 2) + "\n", { mode: 0o600, flag: "wx" })
  } finally { await client.end() }
}
console.log("Authorized disposable CMS resource. Set SIAB_TEST_RESOURCE_FILE=" + resourceFile)
