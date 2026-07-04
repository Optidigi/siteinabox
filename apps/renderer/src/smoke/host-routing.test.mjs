import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  assertHostRouting,
  assertStubCmsSnapshots,
  closeServer,
  getOpenPort,
  startStubCms,
  waitForRenderer,
} from "./host-routing-harness.mjs"

async function stopChild(child) {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  const timeout = setTimeout(() => child.kill("SIGKILL"), 5000)
  try {
    await once(child, "exit")
  } finally {
    clearTimeout(timeout)
  }
}

test("routes production hosts through CMS snapshots, dispatches tenant renderers, and keeps 404s analytics-free", async (t) => {
  const cms = await startStubCms()
  await assertStubCmsSnapshots(cms)
  const dataDir = await mkdtemp(join(tmpdir(), "siab-renderer-media-"))
  await mkdir(join(dataDir, "tenants", "tenant-ami-care", "media"), { recursive: true })
  await writeFile(join(dataDir, "tenants", "tenant-ami-care", "media", "bedroom.jpg"), "stub media")
  const port = await getOpenPort()
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn("pnpm", ["exec", "astro", "dev", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      SIAB_CMS_URL: cms.url,
      SIAB_RENDERER_FIXTURE_MODE: "",
      SITE_URL: baseUrl,
      DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let output = ""
  child.stdout.on("data", (chunk) => {
    output += chunk
  })
  child.stderr.on("data", (chunk) => {
    output += chunk
  })
  t.after(async () => {
    await stopChild(child)
    await closeServer(cms.server)
    await rm(dataDir, { recursive: true, force: true })
  })

  await waitForRenderer(baseUrl, () => {
    if (child.exitCode !== null) return `Astro dev server exited with code ${child.exitCode}\n${output}`
    return output
  })
  await assertHostRouting(baseUrl, () => output, { includeMalformedEncodedPath: false })
})
