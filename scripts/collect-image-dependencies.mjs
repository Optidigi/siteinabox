import { readImageArchiveIdentity, assertLoadedImageIdentity } from "./image-archive-identity.mjs"
import { mkdir, unlink, access } from "node:fs/promises"
import { resolve } from "node:path"
import { inventoryImageNative } from "./inventory-image-native.mjs"
import { scanImageDependencies } from "./scan-image-dependencies.mjs"
import { sha256File } from "./image-artifact.mjs"
import { parseOsRelease } from "./image-platform.mjs"

/** A never-started, labelled container exposes only the verified image filesystem. */
export async function collectImageDependencies({ docker, root, archive, image, artifactDir, prefix, resourceId, requiredTypes, workerRuntime }) {
  if (image.sourceSHA || image.reference) {
    image.archiveIdentity = readImageArchiveIdentity({ archive, tag: image.tag, reference: image.reference, sourceSHA: image.sourceSHA ?? null,
      readRegistryManifest: reference => docker(["buildx", "imagetools", "inspect", "--raw", reference], true) })
    assertLoadedImageIdentity(image.archiveIdentity, JSON.parse(docker(["image", "inspect", image.tag ?? image.reference], true))[0])
  }
  const name = prefix + "-native-" + image.application
  const flattened = resolve(artifactDir, "image-" + image.application + ".rootfs.tar")
  let ownsContainer = false
  let ownsArchive = false
  try {
    try { await access(flattened); throw new Error("Refusing to overwrite an existing native inventory archive") }
    catch (error) { if (error.code !== "ENOENT") throw error }
    await mkdir(artifactDir, { recursive: true })
    const created = docker(["create", "--name", name, "--network", "none", "--label", "siteinabox.verification=" + resourceId, image.imageId], true).trim()
    if (!/^[a-f0-9]{64}$/.test(created)) throw new Error("Native inventory container creation did not return an owned identity")
    ownsContainer = true
    if (docker(["inspect", "--format", "{{.Image}}", name], true).trim() !== image.imageId) throw new Error("Native inventory container differs from the verified image")
    docker(["export", "--output", flattened, name])
    ownsArchive = true
    const nativeInventory = { ...inventoryImageNative(flattened), ...(workerRuntime ? { workerRuntime } : {}), flattenedArchiveSha256: await sha256File(flattened) }
    if (!image.runtimePlatform.os) {
      for (const file of ["etc/os-release", "usr/lib/os-release"]) {
        try {
          const { execFileSync } = await import("node:child_process")
          const os = parseOsRelease(execFileSync("tar", ["--extract", "--to-stdout", "--file", flattened, file], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] }))
          if (os.os === "debian") {
            try {
              const version = execFileSync("tar", ["--extract", "--to-stdout", "--file", flattened, "etc/debian_version"], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] }).trim()
              if (/^\d+(?:\.\d+)*$/.test(version)) os.version = version
            } catch { /* Compare the available publisher OS version; no invented patch version. */ }
          }
          if (os.os && os.version) { image.runtimePlatform = { ...image.runtimePlatform, ...os }; break }
        } catch { /* Static images can lack an OS release; required Go coverage still applies. */ }
      }
    }
    const evidence = await scanImageDependencies({ root, archive, image, nativeInventory,
      outputPrefix: resolve(artifactDir, "image-" + image.application), requiredTypes })
    return evidence
  } finally {
    if (ownsArchive) await unlink(flattened).catch(() => {})
    if (ownsContainer) {
      try {
        if (docker(["inspect", "--format", '{{ index .Config.Labels "siteinabox.verification" }}', name], true).trim() === resourceId) {
          docker(["rm", "--force", "--volumes", name], true)
        }
      } catch { /* Never expand cleanup beyond this labelled probe. */ }
    }
  }
}
