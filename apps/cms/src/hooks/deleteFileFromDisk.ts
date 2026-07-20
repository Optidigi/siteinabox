import path from "node:path"
import { promises as fs } from "node:fs"
import type { CollectionAfterDeleteHook } from "payload"
import { isSafeMediaFilename, resolveMediaPath } from "@/lib/mediaFilename"
import {
  readManifest,
  writeManifest,
  removeEntry,
  withManifestLock,
} from "@/lib/projection/manifest"

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

const tenantIdOf = (doc: { tenant?: unknown }): string | undefined => {
  const t = doc.tenant
  if (t == null) return undefined
  if (typeof t === "object" && t !== null && "id" in t) return String((t as { id: unknown }).id)
  return String(t)
}

export const deletePageFile: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId) return
  const slug = doc.slug as string
  if (!slug) return
  const file = path.join(dataDir(), "tenants", tenantId, "pages", `${slug}.json`)
  await fs.rm(file, { force: true })
  await withManifestLock(dataDir(), tenantId, async () => {
    let m = await readManifest(dataDir(), tenantId)
    m = removeEntry(m, "page", slug)
    await writeManifest(dataDir(), m)
  })
  req.payload.logger.info({ tenantId, slug }, "[projection] page deleted from disk")
}

export const deleteMediaFile: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId || doc.filename == null) return
  if (!isSafeMediaFilename(doc.filename)) {
    req.payload.logger.warn({ tenantId, filename: doc.filename }, "[projection] unsafe media filename skipped")
    return
  }

  const filename = doc.filename
  // Remove the canonical per-tenant projection. The staging path is best-effort
  // cleanup only; shared staging is no longer used for serving.
  const tenantFile = resolveMediaPath(path.join(dataDir(), "tenants", tenantId, "media"), filename)
  const stagingFile = resolveMediaPath(path.join(dataDir(), "_uploads-tmp"), filename)
  await Promise.all([
    fs.rm(tenantFile, { force: true }),
    fs.rm(stagingFile, { force: true }),
  ])
  await withManifestLock(dataDir(), tenantId, async () => {
    let m = await readManifest(dataDir(), tenantId)
    m = removeEntry(m, "media", filename)
    await writeManifest(dataDir(), m)
  })
  req.payload.logger.info({ tenantId, filename }, "[projection] media deleted from disk")
}
