import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { sha256Bytes } from "./image-artifact.mjs"
import { readImageArchiveIdentity, assertLoadedImageIdentity } from "./image-archive-identity.mjs"

test("archive admission reconciles config and manifest Docker identities without substituting either", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "siab-archive-test-"))
  try {
    const sha = "a".repeat(40), tag = "siab-verify-deadbeef-" + sha + ":postgres"
    const layer = Buffer.from("synthetic layer bytes")
    const layerHash = sha256Bytes(layer)
    const config = JSON.stringify({ os: "linux", architecture: "amd64", config: { Labels: { "org.opencontainers.image.revision": sha } }, rootfs: { type: "layers", diff_ids: ["sha256:" + layerHash] } })
    const configHash = sha256Bytes(config)
    mkdirSync(path.join(dir, "blobs/sha256"), { recursive: true })
    writeFileSync(path.join(dir, "blobs/sha256/" + configHash), config)
    writeFileSync(path.join(dir, "blobs/sha256/" + layerHash), layer)
    const manifest = JSON.stringify({ schemaVersion: 2, config: { digest: "sha256:" + configHash }, layers: [{ digest: "sha256:" + layerHash }] })
    const manifestHash = sha256Bytes(manifest)
    writeFileSync(path.join(dir, "blobs/sha256/" + manifestHash), manifest)
    writeFileSync(path.join(dir, "index.json"), JSON.stringify({ manifests: [{ digest: "sha256:" + manifestHash }] }))
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify([{ Config: "blobs/sha256/" + configHash, RepoTags: [tag], Layers: ["blobs/sha256/" + layerHash] }]))
    const archive = path.join(dir, "image.tar")
    const pack = () => execFileSync("tar", ["-cf", archive, "-C", dir, "manifest.json", "index.json", "blobs"])
    pack()
    const previous = process.env.TAR_OPTIONS
    process.env.TAR_OPTIONS = "--exclude=manifest.json"
    let identity
    try { identity = readImageArchiveIdentity({ archive, tag, sourceSHA: sha }) }
    finally { if (previous === undefined) delete process.env.TAR_OPTIONS; else process.env.TAR_OPTIONS = previous }
    assert.equal(identity.configDigest, "sha256:" + configHash)
    assert.equal(identity.manifestDigest, "sha256:" + manifestHash)
    const inspected = { Id: identity.manifestDigest, Os: "linux", Architecture: "amd64", RepoTags: [tag], Config: { Labels: { "org.opencontainers.image.revision": sha } }, RootFS: { Layers: identity.rootfsDiffIds } }
    assertLoadedImageIdentity(identity, inspected)
    assertLoadedImageIdentity(identity, { ...inspected, Id: identity.configDigest })
    for (const change of [{ Id: "sha256:" + "b".repeat(64) }, { Architecture: "arm64" }, { RootFS: { Layers: [] } }, { Config: { Labels: {} } }, { RepoTags: [] }]) assert.throws(() => assertLoadedImageIdentity(identity, { ...inspected, ...change }))
    assert.throws(() => readImageArchiveIdentity({ archive, tag: "other", sourceSHA: sha }))
    assert.throws(() => readImageArchiveIdentity({ archive, tag, sourceSHA: "b".repeat(40) }))
    writeFileSync(path.join(dir, "blobs/sha256/" + layerHash), "changed bytes")
    pack()
    assert.throws(() => readImageArchiveIdentity({ archive, tag, sourceSHA: sha }))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("classic Docker archives retain config identity and reject altered config bytes", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "siab-classic-test-"))
  try {
    const sha = "a".repeat(40), tag = "siab-verify-deadbeef-" + sha + ":cms"
    const layer = Buffer.from("classic layer"), layerHash = sha256Bytes(layer)
    const config = JSON.stringify({ os: "linux", architecture: "amd64", config: { Labels: { "org.opencontainers.image.revision": sha } }, rootfs: { type: "layers", diff_ids: ["sha256:" + layerHash] } })
    const configHash = sha256Bytes(config), layerName = layerHash + "/layer.tar"
    mkdirSync(path.join(dir, layerHash))
    writeFileSync(path.join(dir, layerName), layer)
    writeFileSync(path.join(dir, configHash + ".json"), config)
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify([{ Config: configHash + ".json", RepoTags: [tag], Layers: [layerName] }]))
    const archive = path.join(dir, "image.tar")
    const pack = () => execFileSync("tar", ["-cf", archive, "-C", dir, "manifest.json", configHash + ".json", layerHash])
    pack()
    const identity = readImageArchiveIdentity({ archive, tag, sourceSHA: sha })
    assert.equal(identity.manifestDigest, null)
    assert.equal(identity.configDigest, "sha256:" + configHash)
    writeFileSync(path.join(dir, configHash + ".json"), config + " ")
    pack()
    assert.throws(() => readImageArchiveIdentity({ archive, tag, sourceSHA: sha }), /config bytes/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
