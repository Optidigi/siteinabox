import { execFile } from "node:child_process"
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import { assertHostRouting, closeServer, getOpenPort, startStubCms, waitForRenderer } from "./host-routing-harness.mjs"

const execFileAsync = promisify(execFile)
const imageTag = process.env.IMAGE_TAG

if (!imageTag) {
  console.error("IMAGE_TAG is required")
  process.exit(1)
}

const cms = await startStubCms({ listenHost: "0.0.0.0", publicHost: "host.docker.internal" })
const rendererPort = await getOpenPort()
const baseUrl = `http://127.0.0.1:${rendererPort}`
const containerName = `siteinabox-renderer-smoke-${process.pid}`
const dataDir = await mkdtemp(join(tmpdir(), "siab-renderer-media-"))

async function docker(args, options = {}) {
  return execFileAsync("docker", args, { maxBuffer: 1024 * 1024 * 10, ...options })
}

try {
  await chmod(dataDir, 0o755)
  await mkdir(join(dataDir, "tenants", "tenant-ami-care", "media"), { recursive: true })
  await writeFile(join(dataDir, "tenants", "tenant-ami-care", "media", "bedroom.jpg"), "stub media")

  await docker([
    "run",
    "--rm",
    "-d",
    "--name",
    containerName,
    "--add-host",
    "host.docker.internal:host-gateway",
    "-e",
    "HOST=0.0.0.0",
    "-e",
    "PORT=4321",
    "-e",
    `SIAB_CMS_URL=${cms.url}`,
    "-e",
    `SITE_URL=${baseUrl}`,
    "-e",
    "DATA_DIR=/data-out",
    "-v",
    `${dataDir}:/data-out:ro`,
    "-p",
    `${rendererPort}:4321`,
    imageTag,
  ])

  await waitForRenderer(baseUrl, async () => {
    const { stdout, stderr } = await docker(["logs", containerName]).catch((error) => ({
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error),
    }))
    return `${stdout}\n${stderr}`
  })
  await assertHostRouting(baseUrl, async () => {
    const { stdout, stderr } = await docker(["logs", containerName]).catch((error) => ({
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error),
    }))
    return `${stdout}\n${stderr}`
  })
} finally {
  await docker(["rm", "-f", containerName]).catch(() => {})
  await rm(dataDir, { recursive: true, force: true })
  await closeServer(cms.server)
}

console.log("Packaged renderer host-routing smoke OK")
