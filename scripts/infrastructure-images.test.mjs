import { workflowActionSources, assertImmutableActions } from "./check-workflow-actions.mjs"
import assert from "node:assert/strict"
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { infrastructure } from "./infrastructure-images.mjs"

const source = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8")
const shortRef = (name) => infrastructure.images[name].reference.replace("docker.io/library/", "")

test("reviewed images have immutable publisher identities and the production architecture", () => {
  for (const image of Object.values(infrastructure.images)) {
    assert.match(image.reference, /^docker\.io\/[\w./-]+:[\w.-]+@sha256:[a-f0-9]{64}$/)
    assert.match(image.version, /^\d+(?:\.\d+)+$/)
    assert.ok(image.platforms.some(({ platform }) => platform.os === "linux" && platform.architecture === "amd64"))
  }
  assert.equal(infrastructure.images.node.version, source(".nvmrc").trim())
  assert.equal(infrastructure.images.postgres.version.split(".")[0], "18", "No implicit database-major upgrade")
  assert.equal(infrastructure.images["postgres-rehearsal-baseline"].verificationOnly, true)
})

test("all application builders and runners use the reviewed immutable bases", () => {
  for (const app of ["cms", "renderer", "landing"]) {
    assert.equal(source("apps/" + app + "/Dockerfile").match(/^# syntax=(\S+)/m)?.[1], infrastructure.images.dockerfile.reference.replace("docker.io/", ""))
  }
  for (const app of ["cms", "renderer"]) {
    const refs = [...source("apps/" + app + "/Dockerfile").matchAll(/^FROM (\S+)/gm)].map((match) => match[1])
    assert.deepEqual(refs, [shortRef("node"), shortRef("node")], app)
  }
  const landing = source("apps/landing/Dockerfile")
  assert.equal(landing.match(/^ARG NODE_VERSION=(\S+)/m)?.[1], shortRef("node").slice("node:".length))
  assert.equal(landing.match(/^ARG NGINX_VERSION=(\S+)/m)?.[1], shortRef("nginx").slice("nginx:".length))
  assert.ok(landing.includes("FROM node:${NODE_VERSION}"))
  assert.ok(landing.includes("FROM nginx:${NGINX_VERSION}"))
})

test("database and tunnel pins agree across Compose and CI without renaming persisted storage", () => {
  for (const file of ["apps/cms/docker-compose.yml", "apps/cms/docker-compose.local.yml", ".github/workflows/ci.yml"]) {
    assert.equal(source(file).match(/^\s+image: (postgres:\S+)/m)?.[1], shortRef("postgres"), file)
  }
  for (const file of ["apps/cms/docker-compose.yml", "apps/renderer/compose.yml"]) {
    assert.equal(source(file).match(/^\s+image: (docker\.io\/cloudflare\/cloudflared:\S+)/m)?.[1], infrastructure.images.cloudflared.reference, file)
  }
  assert.ok(source("apps/cms/docker-compose.yml").includes("name: siab-payload_postgres-data"))
  assert.ok(source("apps/cms/docker-compose.yml").includes("postgres-data:/var/lib/postgresql"))
  assert.ok(source("apps/cms/docker-compose.local.yml").includes("siteinabox-cms-postgres-dev:/var/lib/postgresql"))
})

test("every Action invocation uses its reviewed release commit", async () => {
  for (const { file, source: actionSource } of await workflowActionSources()) {
    assertImmutableActions(actionSource)
    for (const match of actionSource.matchAll(/\buses:\s*([^@\s]+)@([^\s#]+)/g)) {
      assert.ok(infrastructure.actions[match[1]], "Unreviewed Action: " + match[1])
      assert.equal(match[2], infrastructure.actions[match[1]].commit, file + " " + match[1])
    }
  }
})

test("CI browser and BuildKit are immutable verification-only tools, separate from production bases", () => {
  const browser = infrastructure.ciBrowser, buildkit = infrastructure.ciBuildkit
  assert.equal(browser.verificationOnly,true); assert.equal(buildkit.verificationOnly,true)
  assert.match(browser.reference, new RegExp("^mcr\\.microsoft\\.com/playwright:v" + browser.version.replaceAll(".","\\.") + "-noble@sha256:[a-f0-9]{64}$"))
  assert.match(buildkit.reference,/^docker\.io\/moby\/buildkit:v[\d.]+@sha256:[a-f0-9]{64}$/)
  assert(Date.now()-Date.parse(browser.createdAt)>=1440*60000)
  assert(Date.now()-Date.parse(buildkit.publishedAt)>=1440*60000)
  const workflow=source(".github/workflows/ci.yml")
  for(const name of ["cms-tests","cms-browser","site","renderer"]) {
    const block=workflow.match(new RegExp("^  "+name+":\\n([\\s\\S]*?)(?=^  [\\w-]+:|(?![\\s\\S]))","m"))?.[1]
    assert(block?.includes(browser.reference),name)
    assert(block.includes('uses: ./.github/actions/setup-ci'),name)
    assert(!block.includes("playwright install --with-deps"),"Image must provide browser OS dependencies")
  }
  for(const app of ["cms","landing","renderer"]) assert.equal(JSON.parse(source("apps/"+app+"/package.json")).devDependencies?.playwright?.replace(/^[~^]/,"")??JSON.parse(source("apps/"+app+"/package.json")).dependencies?.playwright?.replace(/^[~^]/,""),browser.version)
  assert(source("scripts/verify-image.mjs").includes('"--driver", "docker-container"'))
  assert(source("scripts/verify-image.mjs").includes('"image=" + infrastructure.ciBuildkit.reference'))
})

test("container trust fixes only the checked-out workspace under mismatched ownership", () => {
  const root=mkdtempSync(path.join(tmpdir(),"siab-git-trust-")), home=path.join(root,"home"), repo=path.join(root,"checkout"), other=path.join(root,"other")
  for(const directory of [home,repo,other]) mkdirSync(directory)
  const env={...process.env,HOME:home,XDG_CONFIG_HOME:path.join(root,"xdg"),GIT_CONFIG_GLOBAL:path.join(home,".gitconfig"),GIT_CONFIG_NOSYSTEM:"1"}
  const git=(cwd,args,forced=false)=>spawnSync("git",args,{cwd,env:{...env,...(forced?{GIT_TEST_ASSUME_DIFFERENT_OWNER:"1"}:{})},encoding:"utf8"})
  try {
    for(const directory of [repo,other]) assert.equal(git(directory,["init"]).status,0)
    writeFileSync(path.join(repo,"fixture"),"synthetic")
    assert.equal(git(repo,["add","fixture"]).status,0)
    assert.equal(git(repo,["-c","user.name=Synthetic","-c","user.email=fixture@example.test","commit","-m","fixture"]).status,0)
    const refused=git(repo,["rev-parse","HEAD"],true)
    assert.equal(refused.status,128);assert.match(refused.stderr,/dubious ownership/)
    assert.equal(git(repo,["config","--global","--add","safe.directory",repo],true).status,0)
    assert.equal(git(repo,["rev-parse","HEAD"],true).status,0)
    assert.match(git(other,["status","--porcelain"],true).stderr,/dubious ownership/)
    assert.equal(git(repo,["config","--global","--get-all","safe.directory"],true).stdout.trim(),repo)
  } finally {rmSync(root,{recursive:true})}
})

test("shared CI setup preserves exact workspace trust, frozen dependencies and immutable actions", () => {
  const setup = source(".github/actions/setup-ci/action.yml")
  assert(setup.includes('git config --global --add safe.directory "$GITHUB_WORKSPACE"'))
  assert(!setup.includes('safe.directory "*"'))
  assert(setup.includes("pnpm install --frozen-lockfile"))
  assert(setup.includes("package-manager-cache: false"))
  assert(setup.includes("node-version-file: .nvmrc"))
  for (const ref of ["actions/checkout@main", "./.github/actions/other", "./.github/actions/../outside", "docker://alpine:latest"]) {
    assert.throws(() => assertImmutableActions("- uses: " + ref))
  }
  assertImmutableActions("- uses: ./.github/actions/setup-ci")
})
