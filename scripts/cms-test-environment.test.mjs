import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtemp, writeFile, access, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { assertDisposableCmsEnvironment, effectiveTestEnvironment, readEffectiveTestEnvironment, createWorkerStorage, cleanupWorkerStorage } from "../apps/cms/tests/_helpers/cmsTestEnvironment.mjs"

const uri = "postgresql://test:synthetic@127.0.0.1:55432/payload_test"
const resource = { version: 1, id: "b".repeat(32), databaseUri: uri, dataRoot: "/tmp/siab-test-authorized" }
const safe = { DATABASE_URI: uri, PAYLOAD_SECRET: "siab-test-synthetic-secret", PAYLOAD_DISABLE_JOBS_AUTORUN: "1", SITE_GENERATION_PROVIDER: "mock" }

test("destructive tests require exact explicit resource authorization, not a rewritten database name", () => {
  assertDisposableCmsEnvironment(safe, resource)
  for (const change of [{ DATABASE_URI: "postgresql://test:synthetic@production.example/payload_test" },
    { DATABASE_URI: "postgresql://test:synthetic@127.0.0.1:5432/payload_test" },
    { DATABASE_URI: uri + "?host=production.example" }, { DATABASE_URI: uri.replace("payload_test", "payload") },
    { DATA_DIR: "/srv/customer-data" }, { PAYLOAD_DISABLE_JOBS_AUTORUN: "0" }, { SITE_GENERATION_PROVIDER: "mastra" }]) {
    assert.throws(() => assertDisposableCmsEnvironment({ ...safe, ...change }, resource))
  }
  assert.throws(() => assertDisposableCmsEnvironment(safe, undefined))
  assert.throws(() => assertDisposableCmsEnvironment({ ...safe, COMMERCE_RELEASE_STAGE: "live" }, resource))
})

test("the CLI missing-schema fixture may change only its search path, never the authorized server", () => {
  const missingSchema = new URL(uri)
  missingSchema.searchParams.set("options", "-csearch_path=siab_cli_missing_schema")
  assertDisposableCmsEnvironment({ ...safe, DATABASE_URI: missingSchema.toString() }, resource)
  missingSchema.searchParams.set("options", "-chost=production.example")
  assert.throws(() => assertDisposableCmsEnvironment({ ...safe, DATABASE_URI: missingSchema.toString() }, resource))
})

test("worker cleanup removes only its owned directory and rejects an escaped or symlinked target", async () => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "siab-test-guard-"))
  const authorized = { ...resource, dataRoot }
  try {
    await writeFile(path.join(dataRoot, ".siab-test-owner"), resource.id)
    const neighbor = path.join(dataRoot, "preserve.txt")
    await writeFile(neighbor, "unrelated")
    const worker = await createWorkerStorage(safe, authorized)
    await cleanupWorkerStorage(worker)
    await assert.rejects(access(worker.env.DATA_DIR))
    await access(neighbor)
    await assert.rejects(cleanupWorkerStorage({ ...worker, env: { ...worker.env, DATA_DIR: dataRoot } }))
    const link = path.join(dataRoot, "run-" + resource.id + "-link")
    await symlink(dataRoot, link, "dir")
    await assert.rejects(cleanupWorkerStorage({ ...worker, env: { ...worker.env, DATA_DIR: link } }))
    await access(neighbor)
  } finally { await rm(dataRoot, { recursive: true, force: true }) }
})

test("configuration resolves before validation, retaining shell precedence without hiding provider credentials", () => {
  const fromFile = effectiveTestEnvironment(safe, ["OPENAI_API_KEY=sk-real-looking\nPAYLOAD_DISABLE_JOBS_AUTORUN=0"])
  assert.equal(fromFile.PAYLOAD_DISABLE_JOBS_AUTORUN, "1")
  assert.throws(() => assertDisposableCmsEnvironment(fromFile, resource), /OPENAI_API_KEY/)
  for (const name of ["MOLLIE_API_KEY", "OPENPROVIDER_PASSWORD", "CLOUDFLARE_EMAIL_API_TOKEN", "POSTHOG_PERSONAL_API_KEY", "GOOGLE_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET", "TURNSTILE_SECRET_KEY", "SIAB_RENDERER_API_TOKEN_FILE", "PGSERVICE", "PGOPTIONS"]) {
    assert.throws(() => assertDisposableCmsEnvironment({ ...safe, [name]: "real-looking-value" }, resource), new RegExp(name))
  }
  assert.throws(() => assertDisposableCmsEnvironment(effectiveTestEnvironment({}, ["DATABASE_URI=" + uri]), resource))
})

test("dotenv syntax and alternate-loader controls cannot introduce unchecked values after validation", () => {
  const colonSyntax = effectiveTestEnvironment(safe, ["OPENAI_API_KEY: real-looking-provider-key"])
  assert.throws(() => assertDisposableCmsEnvironment(colonSyntax, resource), /OPENAI_API_KEY/)
  for (const name of ["DOTENV_CONFIG_PATH", "DOTENV_CONFIG_OVERRIDE", "DOTENV_KEY"]) {
    assert.throws(() => assertDisposableCmsEnvironment({ ...safe, [name]: "alternate-config" }, resource), /dotenv/i)
  }
})

test("production-mode test children validate their production env files before imports", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "siab-test-env-"))
  try {
    await writeFile(path.join(directory, ".env.production"), "OPENAI_API_KEY=real-looking-provider-key")
    const env = await readEffectiveTestEnvironment({ ...safe, NODE_ENV: "production" }, directory)
    assert.throws(() => assertDisposableCmsEnvironment(env, resource), /OPENAI_API_KEY/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
