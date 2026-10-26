import { mkdir, lstat, readFile, rm, rename, writeFile, realpath } from "node:fs/promises"
import path from "node:path"

const exists = async file => { try { return await lstat(file) } catch (error) { if (error.code === "ENOENT") return null; throw error } }
/** Local OCI cache only. Its bytes never become smoke, source or release evidence. */
export async function prepareImageBuildCache(root, app) {
  if (!["cms", "renderer", "site"].includes(app)) throw new Error("Unknown image cache scope")
  root = await realpath(root)
  const parent = path.resolve(root, "artifacts/buildkit-cache")
  await mkdir(parent, { recursive: true })
  if ((await lstat(parent)).isSymbolicLink() || await realpath(parent) !== parent) throw new Error("Refusing a symlinked build cache")
  const directory = path.join(parent, app), staging = path.join(parent, app + ".next")
  for (const target of [directory, staging]) {
    const stat = await exists(target)
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error("Refusing an unsafe build cache path")
  }
  // Only the exporter staging directory is transient. Restored input is read-only.
  if (await exists(staging)) await rm(staging, { recursive: true })
  const index = path.join(directory, "index.json")
  const arguments_ = ["--cache-to", `type=local,dest=${staging},mode=max`]
  const stat = await exists(index)
  if (stat && stat.isFile() && !stat.isSymbolicLink()) {
    try {
      const manifest = JSON.parse(await readFile(index, "utf8"))
      if (manifest.schemaVersion === 2 && Array.isArray(manifest.manifests) && manifest.manifests.every(item => /^sha256:[a-f0-9]{64}$/.test(item.digest))) arguments_.push("--cache-from", `type=local,src=${directory}`)
    } catch { /* Malformed cache is a miss, never accepted verification. */ }
  }
  return { arguments: arguments_, commit: async () => {
    const output = await exists(path.join(staging, "index.json"))
    if (!output?.isFile() || output.isSymbolicLink()) throw new Error("BuildKit did not produce an OCI cache index")
    if (await exists(directory)) await rm(directory, { recursive: true })
    await rename(staging, directory)
    await writeFile(path.join(directory, "siteinabox-cache.json"), JSON.stringify({ kind: "untrusted compiler input", app }) + "\n")
  } }
}
