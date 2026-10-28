import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { sha256Bytes } from "./image-artifact.mjs"
import { isDeepStrictEqual } from "node:util"

/** Bind the complete producer inventory, including alternate copies/gaps, into native review. */
export async function readWorkerRuntimeEvidence(directory, evidence) {
  const runtimeBytes = await readFile(resolve(directory, "worker-runtime-inventory.json"))
  const dpkgBytes = await readFile(resolve(directory, "worker-dpkg-inventory.txt"))
  if (sha256Bytes(runtimeBytes) !== evidence.runtimeInventorySha256 || sha256Bytes(dpkgBytes) !== evidence.dpkgInventorySha256) throw new Error("Worker runtime or OS inventory bytes changed")
  const inventory = JSON.parse(runtimeBytes)
  const modules = JSON.parse(await readFile(new URL("../ops/exchange-worker/modules.json", import.meta.url), "utf8"))
  const roots = ["/opt/microsoft/powershell/7", "/usr/local/share/powershell/Modules"]
  if (inventory.schemaVersion !== 1 || inventory.releaseCleared !== false || inventory.powerShellVersion !== evidence.runtimeVersion || !isDeepStrictEqual(inventory.roots, roots) ||
      !Array.isArray(inventory.files) || !inventory.files.length || inventory.files.length > 20000 || new Set(inventory.files.map(file => file.path)).size !== inventory.files.length ||
      inventory.files.some(file => !roots.some(root => file.path?.startsWith(root + "/")) || file.path.split("/").includes("..") || !Number.isSafeInteger(file.size) || file.size < 0 ||
        (file.sha256 === null ? !file.linkTarget || !(file.fileKind === "unresolved-symbolic-link" && file.metadataGap === null || file.metadataGap === "Unresolved symbolic link; target bytes unavailable") : !/^[a-f0-9]{64}$/.test(file.sha256 ?? ""))) ||
      modules.some(module => !inventory.files.some(file => file.path === roots[1] + "/" + module.name + "/" + module.version + "/" + module.name + ".psd1")) ||
      !dpkgBytes.toString().trim() || dpkgBytes.toString().trimEnd().split("\n").some(line => line.split("\t").length !== 3)) throw new Error("Worker inventory is incomplete, malformed or differs from the runtime/module contract")
  return { inventory, runtimeInventorySha256: evidence.runtimeInventorySha256, dpkgInventorySha256: evidence.dpkgInventorySha256 }
}
