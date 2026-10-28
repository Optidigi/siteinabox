import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { readWorkerRuntimeEvidence } from "./worker-runtime-evidence.mjs"
import { sha256Bytes } from "./image-artifact.mjs"

test("worker evidence binds full module copies and dpkg bytes and rejects omitted modules or changed inventories", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "siab-worker-evidence-"))
  try {
    const modules = JSON.parse(await readFile(new URL("../ops/exchange-worker/modules.json", import.meta.url)))
    const roots = ["/opt/microsoft/powershell/7", "/usr/local/share/powershell/Modules"]
    const inventory = { schemaVersion: 1, releaseCleared: false, powerShellVersion: "7.6.9", roots,
      files: modules.map(module => ({ path: roots[1] + "/" + module.name + "/" + module.version + "/" + module.name + ".psd1", sha256: "a".repeat(64), size: 1 })) }
    const save = async (value, os = "libc\t1.0\tamd64\n") => {
      const bytes = JSON.stringify(value)
      await writeFile(path.join(directory, "worker-runtime-inventory.json"), bytes)
      await writeFile(path.join(directory, "worker-dpkg-inventory.txt"), os)
      return { runtimeVersion: "7.6.9", runtimeInventorySha256: sha256Bytes(bytes), dpkgInventorySha256: sha256Bytes(os) }
    }
    const evidence = await save(inventory)
    assert.deepEqual((await readWorkerRuntimeEvidence(directory, evidence)).inventory, inventory)
    await writeFile(path.join(directory, "worker-dpkg-inventory.txt"), "changed")
    await assert.rejects(readWorkerRuntimeEvidence(directory, evidence), /bytes changed/)
    for (const mutate of [x => x.files.pop(), x => x.files.push(x.files[0]), x => { x.files[0].path += "/../other" }, x => { x.files[0].sha256 = null }, x => { x.releaseCleared = true }]) {
      const bad = structuredClone(inventory); mutate(bad)
      await assert.rejects(readWorkerRuntimeEvidence(directory, await save(bad)), /incomplete/)
    }
    await assert.rejects(readWorkerRuntimeEvidence(directory, await save(inventory, "libc\\t1.0\\tamd64\\n")), /incomplete/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
