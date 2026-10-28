import { execFileSync, spawnSync } from "node:child_process"
import { lstatSync } from "node:fs"
import { isDeepStrictEqual } from "node:util"
import { sha256Bytes } from "./image-artifact.mjs"

const digestPattern = /^sha256:[a-f0-9]{64}$/
const memberPattern = /^(?:blobs\/sha256\/[a-f0-9]{64}|[a-f0-9]{64}\.json|[a-f0-9]{64}\/layer\.tar)$/

/** Read bounded metadata and hash layer bytes through pipes; never extract or execute. */
export function readImageArchiveIdentity({ archive, tag, reference, sourceSHA, registryProof, readRegistryManifest }) {
  const vendor = sourceSHA === null && /^[\w./:-]+@sha256:[a-f0-9]{64}$/.test(reference ?? "")
  if ((!vendor && !/^[a-f0-9]{40}$/.test(sourceSHA ?? "")) || (!vendor && !/^[\w./:-]+$/.test(tag ?? ""))) throw new Error("Explicit archive source and tag required")
  const env = { PATH: process.env.PATH, LANG: "C" }
  const stat = lstatSync(archive)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 ** 3) throw new Error("Archive is not a bounded regular file")
  const bytes = (member) => execFileSync("tar", ["--extract", "--to-stdout", "--file", archive, "--", member], { env, maxBuffer: 8 * 1024 * 1024, timeout: 60000, stdio: ["ignore", "pipe", "pipe"] })
  const manifests = JSON.parse(bytes("manifest.json"))
  const selected = vendor ? manifests : manifests.filter(row => row.RepoTags?.includes(tag))
  if (selected.length !== 1) throw new Error("Archive tag is missing or ambiguous")
  const entry = selected[0]
  if (!memberPattern.test(entry.Config) || !Array.isArray(entry.Layers) || !entry.Layers.length || entry.Layers.length > 128 || entry.Layers.some(layer => !memberPattern.test(layer))) throw new Error("Archive member identity is unsupported")
  const configBytes = bytes(entry.Config), configDigest = "sha256:" + sha256Bytes(configBytes)
  if (entry.Config !== configDigest.slice(7) + ".json" && entry.Config !== "blobs/sha256/" + configDigest.slice(7)) throw new Error("Archive config bytes differ from their identity")
  const config = JSON.parse(configBytes)
  if (config.os !== "linux" || config.architecture !== "amd64" || (!vendor && config.config?.Labels?.["org.opencontainers.image.revision"] !== sourceSHA) || config.rootfs?.type !== "layers" || !Array.isArray(config.rootfs.diff_ids) || config.rootfs.diff_ids.length !== entry.Layers.length || config.rootfs.diff_ids.some(id => !digestPattern.test(id))) throw new Error("Archive config differs from source, platform or rootfs")
  let manifestDigest = null, layerDigests = config.rootfs.diff_ids, indexDigests = [], verifiedRegistryProof, registryDigests
  if (entry.Config.startsWith("blobs/")) {
    const index = JSON.parse(bytes("index.json"))
    const matches = []
    const visited = new Set()
    const visit = (descriptor, ancestors = []) => {
      if (!digestPattern.test(descriptor.digest) || visited.has(descriptor.digest) || ancestors.length > 4 || visited.size >= 128) throw new Error("Archive manifest descriptor is malformed or ambiguous")
      visited.add(descriptor.digest)
      if (descriptor.platform && (descriptor.platform.os !== "linux" || descriptor.platform.architecture !== "amd64")) return
      const raw = bytes("blobs/sha256/" + descriptor.digest.slice(7))
      if ("sha256:" + sha256Bytes(raw) !== descriptor.digest) throw new Error("Archive manifest bytes changed")
      const manifest = JSON.parse(raw)
      if (Array.isArray(manifest.manifests)) {
        for (const child of manifest.manifests) visit(child, [...ancestors, descriptor.digest])
      } else if (manifest.config?.digest === configDigest) matches.push({ manifest, digest: descriptor.digest, ancestors })
    }
    const pinned = vendor ? index.manifests?.filter(item => item.digest === reference.split("@")[1]) : null
    const descriptors = pinned?.length ? pinned : index.manifests
    if (!Array.isArray(descriptors) || !descriptors.length) throw new Error("Archive index is missing")
    for (const descriptor of descriptors) visit(descriptor)
    if (matches.length !== 1) throw new Error("Archive config has no unique manifest")
    manifestDigest = matches[0].digest
    indexDigests = matches[0].ancestors
    if (vendor && !pinned?.length) {
      // Some Docker exporters retain only the platform manifest, or synthesize
      // it with uncompressed layers. Bind its config to immutable registry
      // bytes; the engine's observed RepoDigest alone is not archive proof.
      const rootRaw = registryProof?.root ?? readRegistryManifest?.(reference)
      const pinnedDigest = reference.split("@")[1]
      if (typeof rootRaw !== "string" || Buffer.byteLength(rootRaw) > 8 * 1024 * 1024 || "sha256:" + sha256Bytes(rootRaw) !== pinnedDigest) throw new Error("Pinned registry manifest proof is missing or changed")
      const root = JSON.parse(rootRaw)
      const platforms = root.manifests?.filter(item => item.platform?.os === "linux" && item.platform.architecture === "amd64")
      if (root.manifests && platforms?.length !== 1) throw new Error("Pinned registry platform is ambiguous")
      const platformDigest = platforms ? platforms[0].digest : pinnedDigest
      if (!digestPattern.test(platformDigest)) throw new Error("Pinned registry platform digest is malformed")
      const repository = reference.split("@")[0].replace(/:[^/]+$/, "")
      const platformRaw = platforms ? registryProof?.platform ?? readRegistryManifest?.(repository + "@" + platformDigest) : rootRaw
      if (typeof platformRaw !== "string" || Buffer.byteLength(platformRaw) > 8 * 1024 * 1024 || "sha256:" + sha256Bytes(platformRaw) !== platformDigest || JSON.parse(platformRaw).config?.digest !== configDigest) throw new Error("Registry platform proof differs from the archive config")
      const exportedLayers = matches[0].manifest.layers?.map(layer => layer.digest)
      const registryLayers = JSON.parse(platformRaw).layers?.map(layer => layer.digest)
      if (!Array.isArray(registryLayers) || registryLayers.length !== config.rootfs.diff_ids.length || registryLayers.some(id => !digestPattern.test(id))) throw new Error("Registry layer descriptors are malformed")
      if (!isDeepStrictEqual(exportedLayers, registryLayers) && !isDeepStrictEqual(exportedLayers, config.rootfs.diff_ids)) throw new Error("Exported layers lack registry or uncompressed-rootfs proof")
      verifiedRegistryProof = { root: rootRaw, platform: platformRaw }
      registryDigests = [...new Set([pinnedDigest, platformDigest])]
    }
    layerDigests = matches[0].manifest.layers?.map(layer => layer.digest)
    if (!Array.isArray(layerDigests) || !isDeepStrictEqual(layerDigests.map(id => digestPattern.test(id) ? "blobs/sha256/" + id.slice(7) : null), entry.Layers)) throw new Error("Archive layer linkage differs from manifest")
  }
  for (let index = 0; index < entry.Layers.length; index++) {
    // sha256sum streams potentially large layers without a Node buffer or shell.
    const hashed = spawnSync("tar", ["--extract", "--to-command", "sha256sum", "--file", archive, "--", entry.Layers[index]], { env, encoding: "utf8", timeout: 120000, maxBuffer: 65536 })
    if (hashed.status !== 0 || !new RegExp("^" + layerDigests[index].slice(7) + "  -\\n$").test(hashed.stdout)) throw new Error("Archive layer bytes differ from their identity")
  }
  return { configDigest, manifestDigest, ...(indexDigests.length ? { indexDigests } : {}), ...(verifiedRegistryProof ? { registryProof: verifiedRegistryProof, registryDigests } : {}), tag: vendor ? reference : tag, sourceSHA, os: config.os, architecture: config.architecture, rootfsDiffIds: config.rootfs.diff_ids }
}

export function assertLoadedImageIdentity(identity, inspected) {
  const vendor = identity.sourceSHA === null
  const repoDigest = vendor ? identity.tag.replace(/:[^/@]+(?=@)/, "").replace(/^docker\.io\//, "") : null
  const referenceMatches = vendor ? inspected?.RepoDigests?.some(value => value.replace(/^docker\.io\//, "") === repoDigest) : inspected?.RepoTags?.includes(identity.tag)
  if (![identity.configDigest, identity.manifestDigest, ...(identity.indexDigests ?? []), ...(identity.registryDigests ?? [])].filter(Boolean).includes(inspected?.Id) || inspected.Os !== identity.os || inspected.Architecture !== identity.architecture || !referenceMatches || (!vendor && inspected.Config?.Labels?.["org.opencontainers.image.revision"] !== identity.sourceSHA) || !isDeepStrictEqual(inspected.RootFS?.Layers, identity.rootfsDiffIds)) throw new Error("Loaded image identity, source, platform or rootfs differs from archive")
}
