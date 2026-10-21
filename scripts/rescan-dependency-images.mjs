import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { scanImageDependencies } from "./scan-image-dependencies.mjs"
import { sha256Bytes } from "./image-artifact.mjs"
import { infrastructure } from "./infrastructure-images.mjs"

/** Re-evaluate retained verified archives; never rebuild, start or publish images. */
export async function rescanDependencyImages({ root, directory, archiveDirectory, sourceSHA }) {
  const output = resolve(root, "artifacts/dependency-rescan-" + randomUUID())
  await mkdir(output, { recursive: true })
  for (const app of ["cms", "renderer", "site"]) {
    const original = JSON.parse(await readFile(resolve(directory, "image-" + app + ".json"), "utf8"))
    if (original.application !== app || original.sourceSHA !== sourceSHA || original.packagedSmoke !== "passed" || original.published !== false ||
        original.dependencyInventory?.imageId !== original.imageId || original.dependencyInventory.archiveSha256 !== original.archiveSha256) {
      throw new Error("Rescanning requires the exact-source previously verified image and archive identity")
    }
    const records = [original.dependencyInventory, ...(app === "cms" ? original.infrastructureDependencies ?? [] : [])]
    const rescanned = []
    for (const record of records) {
      if (![app, "cms-postgres", "cms-cloudflared"].includes(record.application) || record.candidateSourceSHA !== sourceSHA ||
          (record.application === app && record.sourceSHA !== sourceSHA) ||
          sha256Bytes(JSON.stringify(record.nativeInventory)) !== record.nativeInventorySha256 ||
          (record.application.startsWith("cms-") && record.reference !== infrastructure.images[record.application.slice(4)]?.reference)) {
        throw new Error("Rescan metadata differs from the candidate or immutable infrastructure inventory")
      }
      rescanned.push(await scanImageDependencies({ root,
        archive: resolve(archiveDirectory, "image-" + record.application + ".tar"),
        image: { application: record.application, sourceSHA: record.sourceSHA ?? undefined,
          candidateSourceSHA: sourceSHA, imageId: record.imageId, archiveSha256: record.archiveSha256,
          runtimePlatform: record.runtimePlatform, reference: record.reference },
        nativeInventory: record.nativeInventory, outputPrefix: resolve(output, "image-" + record.application),
        requiredTypes: record.application === "cms-cloudflared" ? ["gobinary"] :
          ["cms", "renderer"].includes(record.application) ? ["alpine", "node-pkg"] : ["alpine"] }))
    }
    const evidence = { ...original, dependencyInventory: rescanned[0], infrastructureDependencies: app === "cms" ? rescanned.slice(1) : [] }
    await writeFile(resolve(output, "image-" + app + ".json"), JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" })
  }
  return output
}
