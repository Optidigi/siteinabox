import { execFileSync, spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises"
import { setTimeout } from "node:timers/promises"
import path from "node:path"
import { infrastructure } from "./infrastructure-images.mjs"
import { sha256File } from "./image-artifact.mjs"

const root = process.cwd()
if (process.argv.length !== 2) throw new Error("Usage: node scripts/verify-exchange-worker.mjs")
const expectedNode = (await readFile(".nvmrc", "utf8")).trim()
if (process.versions.node !== expectedNode || !process.release.lts) throw new Error("Worker verification requires the exact governed Node LTS")
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) throw new Error("Worker verification requires committed clean source")
const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
const prefix = "siab-worker-" + randomUUID().slice(0, 8)
const builder = prefix + "-builder", container = prefix + "-smoke", image = prefix + ":" + source
const directory = path.join(root, "artifacts", prefix)
await mkdir(directory, { recursive: true })
const docker = (args, capture = false) => execFileSync("docker", args, { encoding: "utf8", stdio: capture ? "pipe" : "inherit", timeout: 1800000 })
const secret = "synthetic-offline-worker-qualification-" + randomUUID()
let ownsBuilder = false, ownsContainer = false
try {
  docker(["buildx", "create", "--name", builder, "--driver", "docker-container", "--driver-opt", "image=" + infrastructure.ciBuildkit.reference, "--driver-opt", "memory=2g,cpu-period=100000,cpu-quota=100000"])
  ownsBuilder = true
  docker(["buildx", "build", "--builder", builder, "--load", "--platform", infrastructure.verificationPlatform, "--label", "org.opencontainers.image.revision=" + source, "--tag", image, "ops/exchange-worker"])
  const imageId = docker(["image", "inspect", "--format", "{{.Id}}", image], true).trim()
  docker(["run", "--rm", "--network", "none", "--memory", "2g", "--cpus", "1", "--entrypoint", "pwsh", "--mount", "type=bind,src=" + path.join(root, "ops/exchange-worker/Test-ExchangeWorker.ps1") + ",dst=/tests/contract.ps1,readonly", image,
    "-NoLogo", "-NoProfile", "-NonInteractive", "-File", "/tests/contract.ps1", "-WorkerPath", "/app/Invoke-ExchangeWorker.ps1"])
  docker(["run", "-d", "--name", container, "--network", "none", "--memory", "2g", "--cpus", "1", "--read-only", "--tmpfs", "/tmp", "--tmpfs", "/home/exchange-worker:uid=10001,gid=10001,mode=0700", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "-e", "EXCHANGE_WORKER_SHARED_SECRET=" + secret, image])
  ownsContainer = true
  let health
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      health = JSON.parse(docker(["exec", container, "curl", "--fail", "--silent", "--max-time", "2", "--header", "Authorization: Bearer " + secret, "http://127.0.0.1:8081/health"], true))
      break
    } catch (error) { if (attempt === 29) throw error; await setTimeout(500) }
  }
  const catalog = JSON.parse(await readFile("ops/exchange-worker/modules.json", "utf8"))
  if (!health?.healthy || health.protocolVersion !== 1 || !health.dnsToolAvailable || health.moduleVersion !== catalog.find(item => item.name === "ExchangeOnlineManagement")?.version) throw new Error("Worker health differs from qualified module/runtime")
  const denied = docker(["exec", container, "curl", "--silent", "--max-time", "2", "--output", "/dev/null", "--write-out", "%{http_code}", "http://127.0.0.1:8081/health"], true)
  if (denied !== "401") throw new Error("Worker accepted unauthenticated access")
  const archive = path.join(directory, "image-exchange-worker.tar")
  docker(["save", image, "--output", archive])
  await writeFile(path.join(directory, "image-exchange-worker.json"), JSON.stringify({ application: "exchange-worker", sourceSHA: source,
    verificationRunId: process.env.GITHUB_RUN_ID ?? null, verificationRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    imageId, archiveSha256: await sha256File(archive), health, commandContract: "passed", unauthenticatedStatus: 401,
    packagedSmoke: "passed", published: false, releaseCleared: false,
    limitation: "Actual offline image/HTTP proof only; no Microsoft connection, advisory clearance or publication authority." }, null, 2) + "\n")
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, "artifact-path=" + directory + "\n")
} catch (error) {
  if (ownsContainer) {
    try {
      const logs = spawnSync("docker", ["logs", container], { encoding: "utf8", timeout: 10000 })
      const state = docker(["inspect", container, "--format", "{{json .State}}"], true)
      await writeFile(path.join(directory, "worker.log"), (logs.stdout ?? "") + (logs.stderr ?? "") + state)
    } catch { /* Retain whatever diagnostics exist. */ }
  }
  throw error
} finally {
  if (ownsContainer) { try { docker(["rm", "-f", container], true) } catch { /* Owned resource only. */ } }
  if (ownsBuilder) { try { docker(["buildx", "rm", builder], true) } catch { /* Owned resource only. */ } }
}
