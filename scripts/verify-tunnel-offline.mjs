import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, writeFile, chmod, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { infrastructure } from "./infrastructure-images.mjs"

const cmsRoot = fileURLToPath(new URL("../apps/cms/", import.meta.url))

export async function verifyTunnelOffline({ binary, image = infrastructure.images.cloudflared.reference } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "siab-tunnel-offline-"))
  await chmod(directory, 0o755) // Synthetic public configuration, readable by the Compose UID.
  const pin = infrastructure.images.cloudflared
  const run = (args, allowFailure = false) => {
    const result = spawnSync(binary || "docker", binary ? ["--no-autoupdate", ...args] : [
      "run", "--platform", infrastructure.verificationPlatform, "--rm", "--network", "none", "--user", "1000:1000",
      "--mount", "type=bind,src=" + directory + ",dst=/fixtures,readonly", image, ...args,
    ], { encoding: "utf8", timeout: 60000, env: binary ? { PATH: process.env.PATH } : process.env })
    if (result.error) throw result.error
    if (result.status !== 0 && !allowFailure) throw new Error((result.stdout + result.stderr).slice(-3000))
    return result
  }
  try {
    const version = run(["--version"])
    assert.ok((version.stdout + version.stderr).includes("cloudflared version " + pin.version + " "))
    // Compile the existing pure ingress builder with its existing server-only
    // shim; this never imports Payload or invokes provider reconciliation.
    const { build } = createRequire(join(cmsRoot, "package.json"))("esbuild")
    const bundle = join(directory, "ingress.mjs")
    await build({
      stdin: { contents: 'export { buildCloudflareTunnelIngress } from "./src/lib/domains/cloudflareTunnels.ts"', resolveDir: cmsRoot },
      outfile: bundle, bundle: true, format: "esm", platform: "node", tsconfig: join(cmsRoot, "tsconfig.json"),
      alias: { "@": join(cmsRoot, "src"), "server-only": join(cmsRoot, "scripts/server-only-shim.ts") },
    })
    const { buildCloudflareTunnelIngress } = await import(pathToFileURL(bundle).href)
    const targets = []
    for (const [kind, service] of [["cms", "http://siteinabox-cms:3000"], ["renderer", "http://siteinabox-renderer:4321"]]) {
      const hostname = kind + ".example.com"
      const ingress = buildCloudflareTunnelIngress(kind, [hostname])
      assert.deepEqual(ingress, [{ hostname, service }, { service: "http_status:404" }])
      const name = kind + ".json"
      const config = { tunnel: "00000000-0000-4000-8000-000000000001", ingress }
      await writeFile(join(directory, name), JSON.stringify(config), { mode: 0o644 })
      const configPath = binary ? join(directory, name) : "/fixtures/" + name
      const args = ["tunnel", "--config", configPath, "ingress"]
      run([...args, "validate"])
      const known = run([...args, "rule", "https://" + hostname])
      assert.ok((known.stdout + known.stderr).includes("service: " + service))
      const unknown = run([...args, "rule", "https://unknown.example.com"])
      assert.ok((unknown.stdout + unknown.stderr).includes("service: http_status:404"))
      // Prove the actual connector rejects losing the final neutral rule.
      await writeFile(join(directory, name), JSON.stringify({ ...config, ingress: ingress.slice(0, -1) }))
      assert.equal(run([...args, "validate"], true).status, 1)
      targets.push({ kind, service, knownHostMatched: true, unknownHost404: true, missingCatchallRejected: true })
    }
    return { cloudflared: pin.version, image: binary ? null : image, networkNone: !binary, offlineCommandsOnly: true, targets }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== "--binary")) throw new Error("Usage: verify-tunnel-offline.mjs [--binary /verified/cloudflared]")
  console.log(JSON.stringify(await verifyTunnelOffline({ binary: args[1] }), null, 2))
}
