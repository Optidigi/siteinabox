import { execFileSync, spawnSync } from "node:child_process"
import { lstatSync } from "node:fs"
import { isDeepStrictEqual } from "node:util"
import { sha256Bytes } from "./image-artifact.mjs"

const digestPattern = /^sha256:[a-f0-9]{64}$/
const memberPattern = /^(?:blobs\/sha256\/[a-f0-9]{64}|[a-f0-9]{64}\.json|[a-f0-9]{64}\/layer\.tar)$/

/** Read bounded metadata and hash layer bytes through pipes; never extract or execute. */
export function readImageArchiveIdentity({ archive, tag, sourceSHA }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSHA ?? "") || !/^[\w./:-]+$/.test(tag ?? "")) throw new Error("Explicit archive source and tag required")
  const env = { PATH: process.env.PATH, LANG: "C" }
  const stat = lstatSync(archive)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 ** 3) throw new Error("Archive is not a bounded regular file")
  const bytes = (member) => execFileSync("tar", ["--extract", "--to-stdout", "--file", archive, "--", member], { env, maxBuffer: 8 * 1024 * 1024, timeout: 60000, stdio: ["ignore", "pipe", "pipe"] })
  const manifests = JSON.parse(bytes("manifest.json"))
  const selected = manifests.filter(row => row.RepoTags?.includes(tag))
  if (selected.length !== 1) throw new Error("Archive tag is missing or ambiguous")
  const entry = selected[0]
  if (!memberPattern.test(entry.Config) || !Array.isArray(entry.Layers) || !entry.Layers.length || entry.Layers.length > 128 || entry.Layers.some(layer => !memberPattern.test(layer))) throw new Error("Archive member identity is unsupported")
  const configBytes = bytes(entry.Config), configDigest = "sha256:" + sha256Bytes(configBytes)
  if (entry.Config !== configDigest.slice(7) + ".json" && entry.Config !== "blobs/sha256/" + configDigest.slice(7)) throw new Error("Archive config bytes differ from their identity")
  const config = JSON.parse(configBytes)
  if (config.os !== "linux" || config.architecture !== "amd64" || config.config?.Labels?.["org.opencontainers.image.revision"] !== sourceSHA || config.rootfs?.type !== "layers" || !Array.isArray(config.rootfs.diff_ids) || config.rootfs.diff_ids.length !== entry.Layers.length || config.rootfs.diff_ids.some(id => !digestPattern.test(id))) throw new Error("Archive config differs from source, platform or rootfs")
  let manifestDigest = null, layerDigests = config.rootfs.diff_ids
  if (entry.Config.startsWith("blobs/")) {
    const index = JSON.parse(bytes("index.json"))
    const matches = []
    for (const descriptor of index.manifests ?? []) {
      if (!digestPattern.test(descriptor.digest)) throw new Error("Archive manifest descriptor is malformed")
      const raw = bytes("blobs/sha256/" + descriptor.digest.slice(7))
      if ("sha256:" + sha256Bytes(raw) !== descriptor.digest) throw new Error("Archive manifest bytes changed")
      const manifest = JSON.parse(raw)
      if (manifest.config?.digest === configDigest) matches.push({ manifest, digest: descriptor.digest })
    }
    if (matches.length !== 1) throw new Error("Archive config has no unique manifest")
    manifestDigest = matches[0].digest
    layerDigests = matches[0].manifest.layers?.map(layer => layer.digest)
    if (!Array.isArray(layerDigests) || !isDeepStrictEqual(layerDigests.map(id => digestPattern.test(id) ? "blobs/sha256/" + id.slice(7) : null), entry.Layers)) throw new Error("Archive layer linkage differs from manifest")
  }
  for (let index = 0; index < entry.Layers.length; index++) {
    // sha256sum streams potentially large layers without a Node buffer or shell.
    const hashed = spawnSync("tar", ["--extract", "--to-command", "sha256sum", "--file", archive, "--", entry.Layers[index]], { env, encoding: "utf8", timeout: 120000, maxBuffer: 65536 })
    if (hashed.status !== 0 || !new RegExp("^" + layerDigests[index].slice(7) + "  -\\n$").test(hashed.stdout)) throw new Error("Archive layer bytes differ from their identity")
  }
  return { configDigest, manifestDigest, tag, sourceSHA, os: config.os, architecture: config.architecture, rootfsDiffIds: config.rootfs.diff_ids }
}

export function assertLoadedImageIdentity(identity, inspected) {
  if (![identity.configDigest, identity.manifestDigest].filter(Boolean).includes(inspected?.Id) || inspected.Os !== identity.os || inspected.Architecture !== identity.architecture || !inspected.RepoTags?.includes(identity.tag) || inspected.Config?.Labels?.["org.opencontainers.image.revision"] !== identity.sourceSHA || !isDeepStrictEqual(inspected.RootFS?.Layers, identity.rootfsDiffIds)) throw new Error("Loaded image identity, source, platform or rootfs differs from archive")
}
