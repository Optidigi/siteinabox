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

const policy = { project_retention_months: 11, min_retention_months: 1, max_retention_months: 12,
  retention_months: null, retained_from: null }

function run({ settings = baseline, retention = policy, status = 200, organization = false,
  queryResponse = { results: [[0]], columns: ["over_age_events"] }, queryStatus = 200,
  args = ["--check"], env = {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "siab-posthog-"))
  try {
    const calls = join(directory, "calls.jsonl"), preload = join(directory, "fetch.mjs")
    writeFileSync(calls, "")
    writeFileSync(preload, `import {appendFileSync} from 'node:fs';
      globalThis.fetch=async(url,options={})=>{
        const method=options.method||'GET';
        const body=options.body&&JSON.parse(options.body);
        appendFileSync(${JSON.stringify(calls)},JSON.stringify({url,method,body})+'\\n');
        if(url.endsWith('/query/')) {
          if(method!=='POST'||body.query.kind!=='HogQLQuery'||body.refresh!=='force_blocking')throw Error('read-only fresh query required');
          return Response.json(${JSON.stringify(queryResponse)},{status:${queryStatus}});
        }
        if(!['GET','PATCH'].includes(method))throw Error('unexpected method');
        const isRetention=url.endsWith('/events_retention/');
        if(isRetention&&method!=='GET')throw Error('retention must be read-only');
        return Response.json(isRetention?${JSON.stringify(retention)}:${JSON.stringify(settings)},{status:isRetention?${status}:200});
      };`)
    const result = spawnSync(process.execPath, ["--import", preload, script, ...args], {
      encoding: "utf8", timeout: 5000,
      env: { POSTHOG_HOST: "https://posthog.test", POSTHOG_PROJECT_ID: "193842",
        POSTHOG_PERSONAL_API_KEY: "synthetic-private-key", ...(organization ? { POSTHOG_ORGANIZATION_ID: "owned-org" } : {}), ...env },
    })
    if (result.error) throw result.error
    return { ...result, calls: readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) }
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

const readOnly = call => call.method === "GET" || call.method === "POST" && call.url.endsWith("/query/")

test("explicit cleanup policy and fresh event age pass without query-window or deletion proof", () => {
  const result=run()
  assert.equal(result.status,0,result.stderr)
  assert.deepEqual(result.calls.map(call=>call.url),[
    "https://posthog.test/api/projects/193842/",
    "https://posthog.test/api/projects/193842/events_retention/",
    "https://posthog.test/api/projects/193842/query/",
  ])
  assert(result.calls.every(readOnly))
  const query=result.calls.at(-1).body
  assert.equal(query.refresh,"force_blocking")
  assert.equal(query.query.query,"SELECT count() AS over_age_events FROM events WHERE timestamp < now() - INTERVAL 396 DAY")
  assert.match(result.stdout,/query window.*unknown/i)
  assert.match(result.stdout,/11 months/)
  assert.match(result.stdout,/physical deletion.*not independently verified/i)
})

test("organization-scoped settings use independent project policy and age endpoints", () => {
  const result=run({organization:true})
  assert.equal(result.status,0,result.stderr)
  assert.equal(result.calls[0].url,"https://posthog.test/api/organizations/owned-org/projects/193842/")
  assert.equal(result.calls[1].url,"https://posthog.test/api/projects/193842/events_retention/")
})

test("legacy or plan query windows cannot substitute for an explicit cleanup policy", () => {
  for(const retention of [{}, {plan_retention_months:12,project_retention_months:null,retention_months:12,retained_from:"2025-10-23"}]) {
    const result=run({settings:{...baseline,event_retention_months:13,events_retention_enforced:true},retention})
    assert.notEqual(result.status,0)
    assert(result.calls.every(readOnly))
  }
})

test("malformed, unbounded and overlong cleanup policies fail before querying", () => {
  for(const retention of [null,[],{},... [0,"11",12,13,84].map(value=>({...policy,project_retention_months:value})),
    {...policy,min_retention_months:"1"}, {...policy,max_retention_months:"12"},
    {...policy,min_retention_months:12}, {...policy,max_retention_months:10}]) {
    const result=run({retention})
    assert.notEqual(result.status,0,JSON.stringify(retention))
    assert(!result.calls.some(call=>call.url.endsWith('/query/')))
  }
  assert.notEqual(run({env:{POSTHOG_EVENT_RETENTION_MONTHS:"84"}}).status,0)
  assert.notEqual(run({env:{POSTHOG_EVENT_RETENTION_MONTHS:"13junk"}}).status,0)
})

test("over-age events and malformed/incomplete counts fail closed", () => {
  for(const queryResponse of [{results:[[1]]},{results:[["0"]]},{results:[[-1]]},{results:[]},
    {results:[[0,0]]},{results:[[0],[0]]},{results:[[null]]},{results:[[0.5]]},
    {results:[[0]],error:"query failed"},{results:[[0]],is_cached:true},
    {results:[[0]],query_status:{complete:false}},null]) {
    const result=run({queryResponse})
    assert.notEqual(result.status,0,JSON.stringify(queryResponse))
    assert(result.calls.every(readOnly))
  }
})

test("unavailable policy or age readback fails without exposing credentials", () => {
  for(const status of [403,404,500]) for(const kind of ['policy','query']) {
    const result=run(kind==='policy'?{status}:{queryStatus:status})
    assert.notEqual(result.status,0)
    assert(!result.stderr.includes("synthetic-private-key"))
  }
})

test("mutable privacy drift still fails and read-only mode never patches settings", () => {
 const result=run({settings:{...baseline,anonymize_ips:false}})
 assert.notEqual(result.status,0)
 assert.match(result.stderr,/anonymize_ips/)
 assert(result.calls.every(readOnly))
})

test("settings synchronization never writes retention or deletes event data", () => {
 const result=run({args:[]})
 assert.equal(result.status,0,result.stderr)
 const patch=result.calls.find(call=>call.method==='PATCH')
 assert(patch)
 assert.equal(Object.hasOwn(patch.body,'event_retention_months'),false)
 assert.equal(Object.hasOwn(patch.body,'events_retention_enforced'),false)
 assert.equal(patch.body.anonymize_ips,true)
 assert(result.calls.filter(call=>call.method!=='PATCH').every(readOnly))
})
