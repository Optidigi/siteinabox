import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { inventoryImageNative } from "./inventory-image-native.mjs"

test("flattened archive inventory hashes native bytes without extracting or following links", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-native-tar-"))
  try {
    const content = join(root, "rootfs"); await mkdir(join(content, "app", "dist-runtime"), { recursive: true })
    await writeFile(join(content, "app", "esbuild"), Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from("\xff Go buildinf:fixture", "latin1")]), { mode: 0o755 })
    await writeFile(join(content, "app", "addon.node"), "fixture native bytes")
    await writeFile(join(content, "app", "dist-runtime", "migrate.mjs"), "fixture bundle")
    await symlink("/", join(content, "unrelated-root"))
    const archive = join(root, "rootfs.tar")
    execFileSync("tar", ["-cf", archive, "-C", content, "."])
    const previousOptions = process.env.TAR_OPTIONS
    let result
    try {
      process.env.TAR_OPTIONS = "--exclude=./app/esbuild"
      result = inventoryImageNative(archive)
    } finally {
      if (previousOptions === undefined) delete process.env.TAR_OPTIONS
      else process.env.TAR_OPTIONS = previousOptions
    }
    assert.equal(result.files.length, 2); assert.deepEqual(result.goTargets, ["app/esbuild"])
    assert.equal(result.bundledScripts.length, 1)
    assert(result.files.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("native archive inventory rejects implicit filesystem targets", () => {
  assert.throws(() => inventoryImageNative("."), /absolute owned archive/)
})
