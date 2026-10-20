import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
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

test("every Action invocation uses its reviewed release commit", () => {
  for (const file of readdirSync(new URL("../.github/workflows/", import.meta.url)).filter((name) => /\.ya?ml$/.test(name))) {
    for (const match of source(".github/workflows/" + file).matchAll(/\buses:\s*([^@\s]+)@([^\s#]+)/g)) {
      assert.ok(infrastructure.actions[match[1]], "Unreviewed Action: " + match[1])
      assert.equal(match[2], infrastructure.actions[match[1]].commit, file + " " + match[1])
    }
  }
})
