import { mkdir, readFile, writeFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { setTimeout } from "node:timers/promises"
import { verifyTunnelOffline } from "./verify-tunnel-offline.mjs"
import { collectImageDependencies } from "./collect-image-dependencies.mjs"
import { requiredImageAnalysisTypes } from "./dependency-image-evidence.mjs"
import { sha256File } from "./image-artifact.mjs"
import { infrastructure } from "./infrastructure-images.mjs"

/** The CMS producer owns this small native artifact, just like PostgreSQL. */
export async function verifyCloudflaredImage({ docker, image, sourceSHA, artifactDir, prefix, resourceId }) {
  await mkdir(artifactDir, { recursive: true })
  const config = JSON.parse(docker(["image", "inspect", image], true))[0]
  if (config.Architecture !== "amd64" || config.Os !== "linux" || config.Config.User !== "1000:1000" ||
      JSON.stringify(config.Config.Entrypoint) !== JSON.stringify(["/usr/local/bin/cloudflared", "--no-autoupdate"])) throw new Error("Tunnel image runtime contract differs")
  const tunnelVerification = await verifyTunnelOffline({ image })
  const name = prefix + "-tunnel-contract"
  const token = Buffer.from(JSON.stringify({ a: "synthetic-offline-account", s: Buffer.alloc(32).toString("base64"), t: "00000000-0000-4000-8000-000000000001" })).toString("base64")
  let created = false
  let trustProof
  try {
    docker(["run", "--detach", "--name", name, "--label", "siteinabox.verification=" + resourceId,
      "--network", "none", "--read-only", "--tmpfs", "/tmp:uid=1000,gid=1000", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
      image, "tunnel", "--edge", "127.0.0.1:7844", "--protocol", "http2", "--metrics", "127.0.0.1:2000", "--grace-period", "1s", "run", "--token", token])
    created = true
    docker(["cp", name + ":/usr/local/share/cloudflared/trust-proof.json", path.join(artifactDir, "cloudflared-trust-proof.json")])
    trustProof = JSON.parse(await readFile(path.join(artifactDir, "cloudflared-trust-proof.json"), "utf8"))
    if (trustProof.rootCount < 100 || !["compromisedRootsAbsent", "trustedAccepted", "untrustedRejected"].every(key => trustProof[key] === true)) throw new Error("Tunnel trust proof is incomplete")
    let started = false
    for (let attempt = 0; attempt < 30; attempt++) {
      const state = JSON.parse(docker(["inspect", "--format", "{{json .State}}", name], true))
      const logResult = spawnSync("docker", ["logs", name], { encoding: "utf8", timeout: 10000 })
      if (logResult.error || logResult.status !== 0) throw new Error("Could not read owned tunnel diagnostics")
      const logs = (logResult.stdout ?? "") + (logResult.stderr ?? "")
      if (!state.Running) throw new Error("Offline tunnel exited before shutdown contract: " + logs.slice(-2000))
      if (logs.includes("Starting metrics server")) { started = true; break }
      await setTimeout(200)
    }
    if (!started) throw new Error("Offline tunnel did not start its metrics server")
    docker(["stop", "--timeout", "10", name])
    if (docker(["inspect", "--format", "{{.State.ExitCode}}", name], true).trim() !== "0") throw new Error("Tunnel failed graceful SIGTERM shutdown")
  } finally {
    if (created) docker(["rm", "--force", name], true)
  }
  const archive = path.join(artifactDir, "image-cloudflared.tar")
  docker(["save", "--output", archive, image])
  const verified = { application: "cloudflared", sourceSHA, tag: image, imageId: config.Id,
    archiveSha256: await sha256File(archive), runtimePlatform: { architecture: "amd64", uid: 1000, gid: 1000 } }
  const dependencyInventory = await collectImageDependencies({ docker, root: process.cwd(), archive, image: verified, artifactDir, prefix, resourceId,
    requiredTypes: requiredImageAnalysisTypes("cloudflared") })
  await writeFile(path.join(artifactDir, "image-cloudflared.json"), JSON.stringify({ ...verified,
    archiveIdentity: dependencyInventory.archiveIdentity, dependencyInventory,
    verificationRunId: process.env.GITHUB_RUN_ID ?? null, verificationRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    runtimeVersion: infrastructure.images.cloudflared.version, staticRuntime: true, runtimeContract: "passed", gracefulStop: true,
    trustProof, tunnelVerification, packagedSmoke: "passed", published: false, publishable: true }, null, 2) + "\n")
  return tunnelVerification
}
