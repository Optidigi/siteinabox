import { readScannerPublisherEvidence } from "./scanner-publisher-evidence.mjs"
import { readPublicPublisherJSON } from "./collect-dependency-evidence.mjs"
import { execFileSync } from "node:child_process"
import { mkdir, readFile, writeFile, access, lstat } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual } from "node:util"
import { scannerPin } from "./dependency-image-evidence.mjs"
import { sha256File } from "./image-artifact.mjs"

const binarySha256 = scannerPin.binarySha256
const exists = async (path) => { try { await access(path); return true } catch { return false } }
const preparations = new Map()

export function prepareDependencyScanner(root = fileURLToPath(new URL("..", import.meta.url))) {
  root = resolve(root)
  if (!preparations.has(root)) preparations.set(root, prepare(root))
  return preparations.get(root)
}

async function ownedDirectory(path, root, purpose) {
  const marker = { repository: resolve(root), purpose, scanner: scannerPin.version }
  const created = await mkdir(path, { recursive: true })
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Refusing an unowned scanner directory")
  const file = resolve(path, "siteinabox-owner.json")
  if (created) await writeFile(file, JSON.stringify(marker), { flag: "wx" })
  let actual
  try { actual = JSON.parse(await readFile(file, "utf8")) } catch { throw new Error("Refusing an unowned scanner directory") }
  if (!isDeepStrictEqual(actual, marker)) throw new Error("Refusing an unowned scanner directory")
}

async function prepare(root) {
  if (process.platform !== "linux" || process.arch !== "x64") throw new Error("Pinned dependency scanner currently requires Linux AMD64")
  const directory = resolve(root, "artifacts/dependency-tools/trivy-" + scannerPin.version)
  const cache = resolve(root, "artifacts/dependency-tools/trivy-" + scannerPin.version + "-cache")
  await ownedDirectory(directory, root, "verified scanner tools")
  await ownedDirectory(cache, root, "scanner advisory database")
  const release = await readScannerPublisherEvidence(root) ?? await readPublicPublisherJSON("https://api.github.com/repos/aquasecurity/trivy/releases/tags/v" + scannerPin.version)
  if (release.draft || release.prerelease || release.tag_name !== "v" + scannerPin.version ||
      !Number.isFinite(Date.parse(release.published_at)) || Date.now() - Date.parse(release.published_at) < 1440 * 60000) throw new Error("Scanner publisher release is unavailable or ineligible")
  const archiveName = "trivy_" + scannerPin.version + "_Linux-64bit.tar.gz"
  const checksumsName = "trivy_" + scannerPin.version + "_checksums.txt"
  async function download(name, expected) {
    const asset = release.assets?.find((entry) => entry.name === name)
    if (asset?.digest !== "sha256:" + expected) throw new Error("Scanner publisher digest changed")
    const path = resolve(directory, name)
    if (!(await exists(path))) {
      const url = "https://github.com/aquasecurity/trivy/releases/download/v" + scannerPin.version + "/" + name
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) })
      if (!response.ok) throw new Error("Pinned scanner download unavailable")
      const chunks = []; let size = 0
      for await (const chunk of response.body) {
        size += chunk.length
        if (size > 100 * 1024 * 1024) throw new Error("Scanner download exceeded its bound")
        chunks.push(chunk)
      }
      await writeFile(path, Buffer.concat(chunks), { flag: "wx" })
    }
    if (!(await lstat(path)).isFile() || (await lstat(path)).isSymbolicLink()) throw new Error("Scanner download must be an owned regular file")
    if (await sha256File(path) !== expected) throw new Error("Scanner bytes do not match the pinned official digest")
    return path
  }
  const env = Object.fromEntries(["PATH", "HOME", "LANG", "SSL_CERT_FILE", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"].filter((key) => process.env[key]).map((key) => [key, process.env[key]]))
  const archive = await download(archiveName, scannerPin.archiveSha256)
  const checksums = await download(checksumsName, scannerPin.checksumsSha256)
  if (!(await readFile(checksums, "utf8")).split("\n").some((line) => line.trim().split(/\s+/).join(" ") === scannerPin.archiveSha256 + " " + archiveName)) throw new Error("Scanner checksum entry differs from its pin")
  const binary = resolve(directory, "trivy")
  if (!(await exists(binary))) execFileSync("tar", ["-xzf", archive, "-C", directory, "trivy"], { env, timeout: 30000 })
  if (!(await lstat(binary)).isFile() || (await lstat(binary)).isSymbolicLink()) throw new Error("Scanner binary must be an owned regular file")
  if (await sha256File(binary) !== binarySha256) throw new Error("Extracted scanner binary differs from verified bytes")
  const config = resolve(directory, "empty.yaml")
  if (!(await exists(config))) await writeFile(config, "{}\n", { flag: "wx" })
  if ((await lstat(config)).isSymbolicLink() || await readFile(config, "utf8") !== "{}\n") throw new Error("Refusing changed or unowned scanner configuration")

  execFileSync(binary, ["image", "--config", config, "--download-db-only", "--cache-dir", cache, "--disable-telemetry", "--no-progress"], { env, timeout: 600000, stdio: "inherit" })
  const databaseFile = resolve(cache, "db/trivy.db")
  const metadataFile = resolve(cache, "db/metadata.json")
  const database = JSON.parse(await readFile(metadataFile, "utf8"))
  const version = JSON.parse(execFileSync(binary, ["--cache-dir", cache, "--version", "--format", "json"], { env, encoding: "utf8", timeout: 30000 }))
  if (version.Version !== scannerPin.version || !isDeepStrictEqual(version.VulnerabilityDB, database)) throw new Error("Scanner and database metadata are inconsistent")
  await writeFile(resolve(directory, "publisher-release.json"), JSON.stringify(release, null, 2) + "\n")
  return { binary, config, cache, env, databaseFile, metadataFile,
    evidence: { ...scannerPin, binarySha256, database, databaseSha256: await sha256File(databaseFile), metadataSha256: await sha256File(metadataFile) } }
}
