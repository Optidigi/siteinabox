import { build } from "esbuild"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import {
  assertHostRouting,
  getOpenPort,
  TEST_RENDERER_API_TOKEN,
  TEST_RENDERER_ORIGIN_SECRET,
  waitForRenderer,
} from "./host-routing-harness.mjs"

const execFileAsync = promisify(execFile)
const imageTag = process.env.IMAGE_TAG

if (!imageTag) {
  console.error("IMAGE_TAG is required")
  process.exit(1)
}

const rendererPort = await getOpenPort()
const baseUrl = `http://127.0.0.1:${rendererPort}`
const containerName = `siteinabox-renderer-smoke-${process.pid}`
const dataDir = await mkdtemp(join(tmpdir(), "siab-renderer-media-"))

async function docker(args, options = {}) {
  return execFileAsync("docker", args, { maxBuffer: 1024 * 1024 * 10, ...options })
}

try {
  await chmod(dataDir, 0o755)
  // Bundle the existing fixture once; its TypeScript workspace imports must not
  // rely on host paths or type stripping under the production node_modules.
  const fixture = join(dataDir, "host-routing-harness.mjs")
  await build({ entryPoints: [fileURLToPath(new URL("./host-routing-harness.mjs", import.meta.url))],
    outfile: fixture, bundle: true, platform: "node", format: "esm" })
  await mkdir(join(dataDir, "tenants", "tenant-ami-care", "media"), { recursive: true })
  await writeFile(join(dataDir, "tenants", "tenant-ami-care", "media", "bedroom.jpg"), "stub media")
  await writeFile(join(dataDir, "tenants", "tenant-ami-care", "media", "toys.jpg"), "stub media")
  await writeFile(
    join(dataDir, "tenants", "tenant-ami-care", "media", "amicare-logo.svg"),
    "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 0h1v1H0z\"/></svg>",
  )
  await writeFile(
    join(dataDir, "tenants", "tenant-ami-care", "media", "amicare-favicon.svg"),
    "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>",
  )

  await docker([
    "run",
    "--rm",
    "-d",
    "--name",
    containerName,
    "--entrypoint",
    "node",
    "-e",
    "HOST=0.0.0.0",
    "-e",
    "PORT=4321",
    "-e",
    `SIAB_RENDERER_API_TOKEN=${TEST_RENDERER_API_TOKEN}`,
    "-e",
    `SIAB_RENDERER_ORIGIN_SECRET=${TEST_RENDERER_ORIGIN_SECRET}`,
    "-e",
    `SITE_URL=${baseUrl}`,
    "-e",
    "DATA_DIR=/data-out",
    "-v",
    `${dataDir}:/data-out:ro,z`,
    "-p",
    `127.0.0.1:${rendererPort}:4321`,
    "--mount",
    `type=bind,src=${fixture},dst=/app/siab-smoke/host-routing-harness.mjs,readonly`,
    imageTag,
    "--input-type=module",
    "--eval",
    'const {startStubCms}=await import("/app/siab-smoke/host-routing-harness.mjs"); const cms=await startStubCms(); process.env.SIAB_CMS_URL=cms.url; await import("/app/dist/server/entry.mjs");',
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
}

console.log("Packaged renderer host-routing smoke OK")
