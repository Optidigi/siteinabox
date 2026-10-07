import { execFileSync, spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { setTimeout } from "node:timers/promises"

const app = process.argv[2]
const application = { cms: "cms", renderer: "renderer", site: "landing" }[app]
if (!application || process.argv.length !== 3) throw new Error("Usage: node scripts/verify-image.mjs <cms|renderer|site>")
const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) {
  throw new Error("Commit the image source before recording exact-revision verification")
}
const prefix = "siab-verify-" + randomUUID().slice(0, 8)
const image = prefix + ":" + app
const container = prefix + "-app"
const database = prefix + "-db"
const network = prefix + "-network"

function docker(args, capture = false) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: capture ? "pipe" : "inherit" })
}

async function health(probe) {
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    try {
      if (await probe()) return
    } catch { /* Retry only within the bounded disposable-start window. */ }
    await setTimeout(2000)
  }
  throw new Error("Packaged image did not satisfy its health contract")
}

try {
  docker(["version", "--format", "{{.Server.Version}}"])
  docker(["build", "--build-arg", "SIAB_BUILD_REVISION=" + revision, "--file", "apps/" + application + "/Dockerfile", "--tag", image, "."])
  const imageId = docker(["image", "inspect", "--format", "{{.Id}}", image], true).trim()
  const expectedNode = (await readFile(".nvmrc", "utf8")).trim()
  if (app !== "site") {
    const node = docker(["run", "--rm", "--entrypoint", "node", image, "--version"], true).trim()
    if (node !== "v" + expectedNode) throw new Error("Packaged Node differs from .nvmrc")
  }
  if (app === "renderer") {
    const result = spawnSync("pnpm", ["--dir", "apps/renderer", "smoke:packaged-image"], {
      env: { ...process.env, IMAGE_TAG: image }, stdio: "inherit",
    })
    if (result.error || result.status !== 0) throw new Error("Packaged renderer smoke failed")
  } else if (app === "cms") {
    docker(["run", "--rm", "--entrypoint", "/usr/bin/named-checkzone", image, "-v"])
    docker(["network", "create", "--internal", network])
    docker(["run", "--rm", "--detach", "--name", database, "--network", network, "--network-alias", "postgres",
      "--tmpfs", "/var/lib/postgresql",
      "--env", "POSTGRES_USER=payload", "--env", "POSTGRES_PASSWORD=verification-only", "--env", "POSTGRES_DB=payload_test", "postgres:18-alpine"])
    let ready = false
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = spawnSync("docker", ["exec", database, "pg_isready", "-U", "payload", "-d", "payload_test"], { stdio: "ignore" })
      if (result.status === 0) { ready = true; break }
      await setTimeout(1000)
    }
    if (!ready) throw new Error("Disposable image-smoke database did not start")
    docker(["run", "--detach", "--name", container, "--network", network,
      "--tmpfs", "/tmp/siab-data:mode=1777", "--env", "DATABASE_URI=postgres://payload:verification-only@postgres:5432/payload_test",
      "--env", "PAYLOAD_SECRET=verification-only-synthetic-secret", "--env", "DATA_DIR=/tmp/siab-data",
      "--env", "PAYLOAD_DISABLE_JOBS_AUTORUN=1", "--env", "SITE_GENERATION_PROVIDER=mock", image])
    // Probe the actual server inside its isolated network; internal-only
    // networks need no host publication to prove the packaged health contract.
    await health(async () => {
      const probe = spawnSync("docker", ["exec", container, "node", "--input-type=module", "--eval",
        'const response = await fetch("http://127.0.0.1:3000/api/health", { signal: AbortSignal.timeout(5000) }); if (!response.ok) process.exit(1); console.log(await response.text());'],
        { encoding: "utf8", timeout: 10000 })
      if (probe.error || probe.status !== 0) return false
      const result = JSON.parse(probe.stdout)
      return result.status === "ok" && result.db === "connected" && result.dataDir === "writable" && result.revision === revision
    })
  } else {
    docker(["run", "--detach", "--name", container, "--publish", "127.0.0.1::80", image])
    const port = docker(["port", container, "80/tcp"], true).trim()
    await health(async () => {
      const response = await fetch("http://" + port + "/", { signal: AbortSignal.timeout(5000) })
      return response.ok && (await response.text()).includes("<html")
    })
  }
  await mkdir("artifacts", { recursive: true })
  await writeFile("artifacts/image-" + app + ".json", JSON.stringify({ application: app, sourceSHA: revision,
    imageId, nodeVersion: expectedNode, packagedSmoke: "passed", published: false }, null, 2) + "\n")
  console.log("Packaged " + app + " image verification passed; no image published")
} catch (error) {
  try { docker(["logs", container]) } catch { /* The container may not have started. */ }
  throw error
} finally {
  for (const args of [["rm", "--force", "--volumes", container], ["rm", "--force", "--volumes", database], ["network", "rm", network], ["image", "rm", image]]) {
    try { docker(args, true) } catch { /* Only these uniquely owned disposable resources are eligible for cleanup. */ }
  }
}
