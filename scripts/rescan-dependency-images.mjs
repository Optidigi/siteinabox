import { isDeepStrictEqual } from "node:util"
import { imageApplications } from "./image-evidence.mjs"
import { readImageArchiveIdentity } from "./image-archive-identity.mjs"
import { requiredImageAnalysisTypes } from "./dependency-image-evidence.mjs"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises"
import { resolve } from "node:path"
import { scanImageDependencies } from "./scan-image-dependencies.mjs"
import { sha256Bytes } from "./image-artifact.mjs"

/** Re-evaluate retained verified archives; never rebuild, start or publish images. */
export async function rescanDependencyImages({ root, directory, archiveDirectory, sourceSHA }) {
  const output = resolve(root, "artifacts/dependency-rescan-" + randomUUID())
  await mkdir(output, { recursive: true })
  for (const app of imageApplications) {
    const original = JSON.parse(await readFile(resolve(directory, "image-" + app + ".json"), "utf8"))
    if (original.application !== app || original.sourceSHA !== sourceSHA || original.packagedSmoke !== "passed" || original.published !== false ||
        original.dependencyInventory?.imageId !== original.imageId || original.dependencyInventory.archiveSha256 !== original.archiveSha256) {
      throw new Error("Rescanning requires the exact-source previously verified image and archive identity")
    }
    const records = [original.dependencyInventory]
    const rescanned = []
    for (const record of records) {
      if (record.application !== app || record.candidateSourceSHA !== sourceSHA || record.sourceSHA !== sourceSHA ||
          sha256Bytes(JSON.stringify(record.nativeInventory)) !== record.nativeInventorySha256) {
        throw new Error("Rescan metadata differs from the candidate or immutable infrastructure inventory")
      }
      if (record.sourceSHA || record.reference) {
        const identity = readImageArchiveIdentity({ archive: resolve(archiveDirectory, "image-" + record.application + ".tar"), tag: record.sourceSHA ? original.tag : undefined, reference: record.reference ?? undefined, sourceSHA: record.sourceSHA ?? null, registryProof: record.archiveIdentity?.registryProof })
        if ((record.sourceSHA && !isDeepStrictEqual(identity, original.archiveIdentity)) || !isDeepStrictEqual(identity, record.archiveIdentity)) throw new Error("Rescan archive identity changed")
      }
      rescanned.push(await scanImageDependencies({ root,
        archive: resolve(archiveDirectory, "image-" + record.application + ".tar"),
        image: { application: record.application, sourceSHA: record.sourceSHA ?? undefined,
          candidateSourceSHA: sourceSHA, imageId: record.imageId, archiveSha256: record.archiveSha256,
          runtimePlatform: record.runtimePlatform, archiveIdentity: record.archiveIdentity, reference: record.reference },
        nativeInventory: record.nativeInventory, outputPrefix: resolve(output, "image-" + record.application),
        requiredTypes: requiredImageAnalysisTypes(record.application) }))
    }
    if (app === "exchange-worker") {
      for (const file of ["worker-runtime-inventory.json", "worker-dpkg-inventory.txt"]) await copyFile(resolve(directory, file), resolve(output, file))
    }
    const evidence = { ...original, dependencyInventory: rescanned[0] }
    await writeFile(resolve(output, "image-" + app + ".json"), JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" })
  }
  return output
}
