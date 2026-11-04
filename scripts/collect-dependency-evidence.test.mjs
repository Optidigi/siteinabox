import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, writeFile, mkdir, rm, symlink, chmod } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { dependencyIdentities, fetchPublisherFact, readPublicPublisherJSON } from "./collect-dependency-evidence.mjs"

const descriptor = { id: "fixture-release", kind: "npm-version", url: "https://registry.npmjs.org/fixture/1.0.0" }
test("unavailable or malformed primary evidence never produces a successful fact", async () => {
  const original = globalThis.fetch
  try {
    for (const response of [new Response("unavailable", { status: 503 }), Response.json({}), new Response("not JSON")]) {
      globalThis.fetch = async () => response
      await assert.rejects(fetchPublisherFact(descriptor))
    }
  } finally { globalThis.fetch = original }
})
test("publisher fact hashing is semantic and rejects unsupported origins", async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({ name: "fixture", version: "1.0.0", dist: { integrity: "sha512-fixture" }, engines: { node: ">=24" } })
    const first = await fetchPublisherFact(descriptor)
    globalThis.fetch = async () => Response.json({ engines: { node: ">=24" }, dist: { integrity: "sha512-fixture", downloadCounter: 999 }, version: "1.0.0", name: "fixture" })
    assert.equal((await fetchPublisherFact(descriptor)).sha256, first.sha256)
    await assert.rejects(fetchPublisherFact({ ...descriptor, url: "https://127.0.0.1/private" }), /primary HTTPS/)
  } finally { globalThis.fetch = original }
})
test("graph and relevant source configuration have independently reproducible identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-dependency-identity-"))
  try {
    await mkdir(join(root, "apps", "fixture"), { recursive: true })
    await mkdir(join(root, "docs"))
    await writeFile(join(root, "package.json"), '{"name":"fixture"}')
    await writeFile(join(root, "pnpm-lock.yaml"), "fixture lock")
    await writeFile(join(root, "apps", "fixture", "runtime.ts"), "export const fixture = true")
    await writeFile(join(root, "docs", "dependency-security.json"), "fixture review")
    execFileSync("git", ["init", "-q"], { cwd: root }); execFileSync("git", ["add", "."], { cwd: root })
    const first = await dependencyIdentities(root)
    await writeFile(join(root, "docs", "dependency-security.json"), "changed review avoids self-referential digest")
    assert.deepEqual(await dependencyIdentities(root), first)
    await writeFile(join(root, "apps", "fixture", "runtime.ts"), "export const fixture = false")
    const second = await dependencyIdentities(root)
    assert.equal(second.graph.sha256, first.graph.sha256)
    assert.notEqual(second.configuration.sha256, first.configuration.sha256)
    await writeFile(join(root, "pnpm-lock.yaml"), "changed graph")
    assert.notEqual((await dependencyIdentities(root)).graph.sha256, first.graph.sha256)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("identity collection refuses links to untracked private inputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-dependency-link-"))
  try {
    await mkdir(join(root, "apps", "fixture"), { recursive: true })
    await writeFile(join(root, "package.json"), '{"name":"fixture"}')
    await writeFile(join(root, "pnpm-lock.yaml"), "fixture lock")
    execFileSync("git", ["init", "-q"], { cwd: root }); execFileSync("git", ["add", "."], { cwd: root })
    await writeFile(join(root, "untracked.env"), "synthetic private fixture")
    await symlink("../../untracked.env", join(root, "apps", "fixture", "link.ts"))
    execFileSync("git", ["add", "apps/fixture/link.ts"], { cwd: root })
    await assert.rejects(dependencyIdentities(root), /outside tracked source/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("actual GitHub medium severity is valid while private API paths never reach the transport", async () => {
  const descriptor = { id: "publisher-medium", kind: "github-advisory", url: "https://api.github.com/advisories/GHSA-test-test-test" }
  let reads = 0
  const transport = { readGitHubJSON: async () => {
    reads += 1
    return { ghsa_id: "GHSA-test-test-test", updated_at: "2026-10-20T00:00:00Z", severity: "medium", vulnerabilities: [{ package: { name: "fixture", ecosystem: "npm" }, vulnerable_version_range: "< 1.0.1" }] }
  } }
  assert.equal((await fetchPublisherFact(descriptor, transport)).facts.severity, "medium")
  await assert.rejects(fetchPublisherFact({ ...descriptor, url: "https://api.github.com/user" }, transport), /public primary API/)
  assert.equal(reads, 1)
})

test("public GitHub facts do not inherit authenticated organization IP restrictions", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-public-publisher-"))
  const originalFetch = globalThis.fetch; const originalPath = process.env.PATH
  try {
    await writeFile(join(root, "gh"), '#!/bin/sh\necho "authenticated organization IP denied" >&2\nexit 1\n')
    await chmod(join(root, "gh"), 0o700); process.env.PATH = root + ":" + originalPath
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://api.github.com/repos/aquasecurity/trivy/releases/tags/v0.76.0")
      assert.equal(new Headers(options.headers).has("authorization"), false)
      assert.equal(options.redirect, "error")
      return Response.json({ tag_name: "v0.76.0", published_at: "2026-10-14T11:45:44Z", draft: false, prerelease: false, body: "fixture release" })
    }
    const fact = await fetchPublisherFact({ id: "public-scanner", kind: "github-release", url: "https://api.github.com/repos/aquasecurity/trivy/releases/tags/v0.76.0" })
    assert.equal(fact.facts.tag, "v0.76.0")
  } finally { globalThis.fetch = originalFetch; process.env.PATH = originalPath; await rm(root, { recursive: true, force: true }) }
})

test("only confirmed anonymous quota exhaustion permits authenticated public metadata fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-primary-quota-"))
  const originalFetch = globalThis.fetch; const originalPath = process.env.PATH
  try {
    await writeFile(join(root, "gh"), `#!/bin/sh\nprintf '{"fixture":"authenticated public metadata"}\\n'\n`)
    await chmod(join(root, "gh"), 0o700); process.env.PATH = root + ":" + originalPath
    globalThis.fetch = async () => new Response("quota", { status: 403, headers: { "x-ratelimit-remaining": "0" } })
    assert.deepEqual(await readPublicPublisherJSON("https://api.github.com/advisories/GHSA-test-test-test"), { fixture: "authenticated public metadata" })
    await assert.rejects(readPublicPublisherJSON("https://api.github.com/user"), /public primary API/)
    globalThis.fetch = async () => new Response("organization access denied", { status: 403 })
    await assert.rejects(readPublicPublisherJSON("https://api.github.com/advisories/GHSA-test-test-test"), /HTTP 403/)
  } finally { globalThis.fetch = originalFetch; process.env.PATH = originalPath; await rm(root, { recursive: true, force: true }) }
})

test("selected release assets are hashed while unrelated counters remain irrelevant", async () => {
  const descriptor = { id: "fixture-assets", kind: "github-release", url: "https://api.github.com/repos/aquasecurity/trivy/releases/tags/v0.76.0", assets: ["fixture.tar.gz"] }
  const readGitHubJSON = async () => ({ tag_name: "v0.76.0", published_at: "2026-01-01T00:00:00Z", draft: false, prerelease: false, body: "fixture", assets: [{ name: "fixture.tar.gz", digest: "sha256:" + "a".repeat(64), download_count: 1 }] })
  const fact = await fetchPublisherFact(descriptor, { readGitHubJSON })
  assert.deepEqual(fact.facts.assets, [{ name: "fixture.tar.gz", digest: "sha256:" + "a".repeat(64) }])
  const countsOnly = async () => ({ ...(await readGitHubJSON()), assets: [{ name: "fixture.tar.gz", digest: "sha256:" + "a".repeat(64), download_count: 999 }] })
  assert.equal((await fetchPublisherFact(descriptor, { readGitHubJSON: countsOnly })).sha256, fact.sha256)
  const replaced = async () => ({ ...(await readGitHubJSON()), assets: [{ name: "fixture.tar.gz", digest: "sha256:" + "b".repeat(64) }] })
  assert.notEqual((await fetchPublisherFact(descriptor, { readGitHubJSON: replaced })).sha256, fact.sha256)
  await assert.rejects(fetchPublisherFact({ ...descriptor, assets: ["missing"] }, { readGitHubJSON }), /missing or ambiguous/)
  await assert.rejects(fetchPublisherFact({ ...descriptor, assets: ["fixture.tar.gz", "fixture.tar.gz"] }, { readGitHubJSON }), /malformed/)
})

test("publication waits for the advertised anonymous reset and retries fresh public metadata once", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-public-reset-"))
  const originalFetch = globalThis.fetch, originalPath = process.env.PATH
  try {
    await writeFile(join(root, "gh"), "#!/bin/sh\nexit 9\n"); await chmod(join(root, "gh"), 0o700)
    process.env.PATH = root + ":" + originalPath
    for (const status of [403, 429]) {
      let calls = 0; const waits = []
      globalThis.fetch = async (_url, options) => {
        assert.equal(options.headers.Authorization, undefined)
        calls++
        return calls === 1 ? new Response("quota", { status, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1002" } })
          : Response.json({ fresh: true })
      }
      assert.deepEqual(await readPublicPublisherJSON("https://api.github.com/repos/aquasecurity/trivy/releases/tags/v0.76.1", {
        maxWaitMs: 5000, nowImpl: () => 1000000, waitImpl: async ms => { waits.push(ms) },
      }), { fresh: true })
      assert.deepEqual(waits, [3000]); assert.equal(calls, 2)
    }
  } finally { globalThis.fetch = originalFetch; process.env.PATH = originalPath; await rm(root, { recursive: true, force: true }) }
})

test("publication refuses missing or excessive reset waits and never retries permission denials", async () => {
  const originalFetch = globalThis.fetch, originalPath = process.env.PATH
  const root = await mkdtemp(join(tmpdir(), "siab-public-reset-denied-"))
  try {
    await writeFile(join(root,"gh"),"#!/bin/sh\nexit 9\n");await chmod(join(root,"gh"),0o700);process.env.PATH=root+":"+originalPath
    for (const reset of [undefined, "bad", "999", "1010"]) {
      let calls = 0
      globalThis.fetch = async () => { calls++; return new Response("quota", { status:403, headers:{"x-ratelimit-remaining":"0", ...(reset ? {"x-ratelimit-reset":reset} : {})} }) }
      await assert.rejects(readPublicPublisherJSON("https://api.github.com/advisories/GHSA-test-test-test", {
        maxWaitMs:5000, nowImpl:()=>1000000, waitImpl:async()=>{throw Error("must not wait")},
      }), /reset|budget/)
      assert.equal(calls,1)
    }
    let calls = 0
    globalThis.fetch = async () => { calls++;return new Response("IP access denied",{status:403}) }
    await assert.rejects(readPublicPublisherJSON("https://api.github.com/advisories/GHSA-test-test-test",{
      maxWaitMs:5000,waitImpl:async()=>{throw Error("must not wait")},
    }),/HTTP 403/)
    assert.equal(calls,1)
  } finally {globalThis.fetch=originalFetch;process.env.PATH=originalPath;await rm(root,{recursive:true,force:true})}
})

test("a second quota response fails closed rather than looping or accepting stale evidence", async()=>{
 const originalFetch=globalThis.fetch,originalPath=process.env.PATH
 const root=await mkdtemp(join(tmpdir(),"siab-public-reset-repeat-"))
 try {
  await writeFile(join(root,"gh"),"#!/bin/sh\nexit 9\n");await chmod(join(root,"gh"),0o700);process.env.PATH=root+":"+originalPath
  let calls=0
  globalThis.fetch=async()=>{calls++;return new Response("quota",{status:403,headers:{"x-ratelimit-remaining":"0","x-ratelimit-reset":"1002"}})}
  await assert.rejects(readPublicPublisherJSON("https://api.github.com/advisories/GHSA-test-test-test",{
   maxWaitMs:5000,nowImpl:()=>1000000,waitImpl:async()=>{},
  }),/HTTP 403/)
  assert.equal(calls,2)
 }finally{globalThis.fetch=originalFetch;process.env.PATH=originalPath;await rm(root,{recursive:true,force:true})}
})

test("publication also honors Retry-After and refuses an invalid retry budget", async()=>{
 const originalFetch=globalThis.fetch
 try{
  let calls=0;const waits=[]
  globalThis.fetch=async()=>++calls===1?new Response("quota",{status:429,headers:{"x-ratelimit-remaining":"0","x-ratelimit-reset":"1002","retry-after":"10"}}):Response.json({fresh:true})
  assert.deepEqual(await readPublicPublisherJSON("https://api.github.com/advisories/GHSA-test-test-test",{
   maxWaitMs:15000,nowImpl:()=>1000000,waitImpl:async ms=>{waits.push(ms)},
  }),{fresh:true})
  assert.deepEqual(waits,[11000])
  for(const maxWaitMs of [-1,NaN,3660001]) await assert.rejects(readPublicPublisherJSON("https://api.github.com/advisories/GHSA-test-test-test",{maxWaitMs}),/budget/)
 }finally{globalThis.fetch=originalFetch}
})
