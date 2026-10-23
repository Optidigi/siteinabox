import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const script = fileURLToPath(new URL("../../scripts/sync-posthog-project-settings.mjs", import.meta.url))
const baseline = { app_urls: ["https://siteinabox.nl"], anonymize_ips: true, autocapture_opt_out: true,
  autocapture_web_vitals_opt_in: true, autocapture_web_vitals_allowed_metrics: ["CLS", "FCP", "INP", "LCP"],
  capture_console_log_opt_in: false, capture_performance_opt_in: true, session_recording_opt_in: false,
  heatmaps_opt_in: false, capture_dead_clicks: false, cookieless_server_hash_mode: 1 }

function run({ settings = baseline, retention = { retention_months: 12, retained_from: "2025-10-23", docs_url: "https://posthog.com/docs/data/events-retention" }, status = 200, organization = false, args = ["--check"] } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "siab-posthog-"))
  try {
    const calls = join(directory, "calls.jsonl"), preload = join(directory, "fetch.mjs")
    writeFileSync(preload, `import {appendFileSync} from 'node:fs';
      const settings=${JSON.stringify(settings)}, retention=${JSON.stringify(retention)};
      globalThis.fetch=async(url,options={})=>{
        const method=options.method||'GET';
        appendFileSync(${JSON.stringify(calls)},JSON.stringify({url,method,body:options.body&&JSON.parse(options.body)})+'\\n');
        if(!['GET','PATCH'].includes(method)) throw Error('unexpected method');
        const isRetention=url.endsWith('/events_retention/');
        if(isRetention&&method!=='GET') throw Error('retention must be read-only');
        return new Response(JSON.stringify(isRetention?retention:settings),{status:isRetention?${status}:200});
      };`)
    const result = spawnSync(process.execPath, ["--import", preload, script, ...args], {
      encoding: "utf8", timeout: 5000,
      env: { PATH: process.env.PATH, POSTHOG_HOST: "https://posthog.test", POSTHOG_PROJECT_ID: "193842",
        POSTHOG_PERSONAL_API_KEY: "synthetic-private-key", ...(organization ? { POSTHOG_ORGANIZATION_ID: "owned-org" } : {}) },
    })
    if (result.error) throw result.error
    return { ...result, calls: readFileSync(calls, "utf8").trim().split("\n").map(line => JSON.parse(line)) }
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

test("read-only check falls back to the supported event-window endpoint and reports enforcement unknown", () => {
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.calls.map(call => [call.method, call.url]), [
    ["GET", "https://posthog.test/api/projects/193842/"],
    ["GET", "https://posthog.test/api/projects/193842/events_retention/"],
  ])
  assert.match(result.stdout, /query window.*12 months/i)
  assert.match(result.stdout, /deletion enforcement.*unknown/i)
  assert.match(result.stdout, /SIAB-002/)
})

test("organization settings still use the independent project retention endpoint", () => {
  const result = run({ organization: true })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.calls[0].url, "https://posthog.test/api/organizations/owned-org/projects/193842/")
  assert.equal(result.calls[1].url, "https://posthog.test/api/projects/193842/events_retention/")
})

test("known legacy retention remains supported without an extra GET", () => {
  const result = run({ settings: { ...baseline, event_retention_months: 13, events_retention_enforced: true } })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.calls.length, 1)
})

test("accepted legacy unenforced windows and the explicit ceiling remain supported", () => {
  assert.equal(run({ settings: { ...baseline, event_retention_months: 12, events_retention_enforced: false } }).status, 0)
  assert.equal(run({ retention: { retention_months: 84, retained_from: "2019-10-23" } }).status, 0)
  assert.notEqual(run({ settings: { ...baseline, event_retention_months: 85, events_retention_enforced: false } }).status, 0)
})

test("unknown, unbounded, malformed and above-ceiling windows fail closed", () => {
  for (const retention of [{}, { retention_months: null, retained_from: null },
    { retention_months: 0, retained_from: "2025-10-23" }, { retention_months: "12", retained_from: "2025-10-23" },
    { retention_months: 12, retained_from: null }, { retention_months: 12, retained_from: "invalid" },
    { retention_months: 85, retained_from: "2019-01-01" }]) {
    const result = run({ retention })
    assert.notEqual(result.status, 0, JSON.stringify(retention))
    assert(result.calls.every(call => call.method === "GET"))
  }
})

test("inaccessible retention fails clearly without inventing a value", () => {
  for (const status of [403, 404, 500]) {
    const result = run({ status })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /retention.*could not be verified/i)
    assert(!result.stderr.includes("synthetic-private-key"))
  }
})

test("mutable privacy drift still fails, and read-only mode never patches", () => {
  const result = run({ settings: { ...baseline, anonymize_ips: false } })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /anonymize_ips/)
  assert(result.calls.every(call => call.method === "GET"))
})

test("sync payload never tries to write provider-managed retention fields", () => {
  const result = run({ args: [] })
  const patch = result.calls.find(call => call.method === "PATCH")
  assert(patch)
  assert.equal(Object.hasOwn(patch.body, "event_retention_months"), false)
  assert.equal(Object.hasOwn(patch.body, "events_retention_enforced"), false)
  assert.equal(patch.body.anonymize_ips, true)
})
