import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtemp, mkdir, writeFile, readFile, chmod, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const installer = new URL("../ops/native-components/Install-Esbuild.sh", import.meta.url).pathname
test("runtime installation replaces both pnpm copies and refuses unexpected occurrences", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "siab-esbuild-copies-"))
  try {
    const root = path.join(directory, "runtime"), binary = path.join(directory, "rebuilt")
    const paths = ["@esbuild+linux-x64@0.28.2/node_modules/@esbuild/linux-x64/bin/esbuild", "esbuild@0.28.2/node_modules/esbuild/bin/esbuild"].map(name => path.join(root, "node_modules/.pnpm", name))
    const original = '#!/bin/sh\necho 0.28.2\n', rebuilt = original + '# reviewed rebuild\n'
    for (const file of paths) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, original); await chmod(file, 0o755) }
    await writeFile(binary, rebuilt); await chmod(binary, 0o755)
    const run = () => spawnSync("sh", [installer, root, "0.28.2", binary], { encoding: "utf8" })
    assert.equal(run().status, 0)
    for (const file of paths) assert.equal(await readFile(file, "utf8"), rebuilt)
    await writeFile(path.join(root, "esbuild"), original); await chmod(path.join(root, "esbuild"), 0o755)
    await writeFile(paths[0], original)
    assert.notEqual(run().status, 0)
    assert.equal(await readFile(paths[0], "utf8"), original, "Unexpected copies must fail before partial replacement")
  } finally { await rm(directory, { recursive: true, force: true }) }
})
