import path from "node:path"
import { promises as fs } from "node:fs"
import type { CollectionAfterChangeHook, Payload } from "payload"
import type { Media, Page, SiteSetting, Tenant } from "@/payload-types"
import { writeAtomic } from "@/lib/atomicWrite"
import { isSafeMediaFilename, resolveMediaPath } from "@/lib/mediaFilename"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import type { PublicAnalyticsConfigInput } from "@/lib/analytics/config"
import { asRecord } from "@/lib/record"
import { relationshipId, sameRelationshipId, type RelationshipIdRef } from "@/lib/relationshipId"
import { resolveSettingsContract } from "@/lib/settingsContract"
import {
  readManifest,
  writeManifest,
  upsertEntry,
  removeEntry,
  withManifestLock,
} from "@/lib/projection/manifest"

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

type TenantScopedDoc = { tenant?: unknown; updatedAt?: string }
type MediaRef = Media | string | number | null | undefined

const tenantIdOf = (doc: TenantScopedDoc): string | undefined =>
  relationshipId(doc.tenant as RelationshipIdRef) ?? undefined
const shouldSkipProjection = (req: { context?: Record<string, unknown> } | undefined): boolean =>
  req?.context?.skipProjection === true

const fetchPublishedPages = async (payload: Payload, tenantId: string) => {
  const res = await payload.find({
    collection: "pages",
    where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: "published" } }] },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs.map((p: Page) => ({ id: p.id, slug: p.slug, title: p.title }))
}

const populateMedia = async (payload: Payload, value: MediaRef): Promise<Media | null> => {
  if (value == null) return null
  if (typeof value === "object") return value
  try {
    return await payload.findByID({
      collection: "media",
      id: value,
      depth: 0,
      overrideAccess: true,
    })
  } catch (err: unknown) {
    const error = err as { name?: string; status?: number }
    if (error?.name !== "NotFound" && error?.status !== 404) throw err
    return null
  }
}

const mergePopulatedMedia = async (payload: Payload, fresh: MediaRef, fallback: Media | null) => {
  if (fresh == null) return null
  if (typeof fresh === "object") return fresh
  if (fallback && sameRelationshipId(fallback.id, fresh)) return fallback
  return populateMedia(payload, fresh)
}

const settingsDocForProjection = async (payload: Payload, settingsDoc: SiteSetting) => {
  const branding = {
    ...(settingsDoc.branding ?? {}),
    logo: await populateMedia(payload, settingsDoc.branding?.logo),
    favicon: await populateMedia(payload, settingsDoc.branding?.favicon),
  }
  const chrome = {
    ...(settingsDoc.chrome ?? {}),
    header: {
      ...(settingsDoc.chrome?.header ?? {}),
      logo: await mergePopulatedMedia(payload, settingsDoc.chrome?.header?.logo, branding.logo),
    },
    footer: {
      ...(settingsDoc.chrome?.footer ?? {}),
      logo: await mergePopulatedMedia(payload, settingsDoc.chrome?.footer?.logo, branding.logo),
    },
  }
  return { ...settingsDoc, branding, chrome }
}

const tenantForAnalytics = async (payload: Payload, tenantId: string): Promise<Tenant | null> => {
  try {
    return await payload.findByID({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

const analyticsContextForTenant = (tenantId: string, tenant: Tenant | null) => {
  const manifest = asRecord(tenant?.siteManifest)
  const manifestVersion = manifest?.version
  return {
    tenantId,
    tenantSlug: typeof tenant?.slug === "string" ? tenant.slug : null,
    tenantName: typeof tenant?.name === "string" ? tenant.name : null,
    siteDomain: typeof tenant?.domain === "string" ? tenant.domain : null,
    themeId: typeof manifest?.themeId === "string" ? manifest.themeId : null,
    siteBuildId: process.env.SIAB_SITE_BUILD_ID ?? null,
    manifestVersion:
      typeof manifestVersion === "string" || typeof manifestVersion === "number" ? manifestVersion : null,
    analytics: (manifest?.analytics ?? null) as PublicAnalyticsConfigInput | null,
    analyticsConsent: asRecord(manifest?.analyticsConsent),
  }
}

const writeSiteJson = async (payload: Payload, tenantId: string, settingsDoc: SiteSetting) => {
  const tenantDir = path.join(dataDir(), "tenants", tenantId)
  const pages = await fetchPublishedPages(payload, tenantId)
  const projectedSettingsDoc = await settingsDocForProjection(payload, settingsDoc)
  const tenant = await tenantForAnalytics(payload, tenantId)
  const settingsContract = resolveSettingsContract(tenant?.siteManifest ?? null)
  await writeAtomic(
    path.join(tenantDir, "site.json"),
    JSON.stringify(
      settingsToJson(
        projectedSettingsDoc,
        pages,
        analyticsContextForTenant(tenantId, tenant),
        { settingsContract },
      ),
      null,
      2,
    ),
  )
  await withManifestLock(dataDir(), tenantId, async () => {
    let m = await readManifest(dataDir(), tenantId)
    m = upsertEntry(m, { type: "settings", key: "site", updatedAt: projectedSettingsDoc.updatedAt })
    await writeManifest(dataDir(), m)
  })
}

const removeProjectedPage = async (tenantId: string, slug: string) => {
  const tenantDir = path.join(dataDir(), "tenants", tenantId)
  await fs.rm(path.join(tenantDir, "pages", `${slug}.json`), { force: true })
  await withManifestLock(dataDir(), tenantId, async () => {
    let m = await readManifest(dataDir(), tenantId)
    m = removeEntry(m, "page", slug)
    await writeManifest(dataDir(), m)
  })
}

export const projectPageToDisk: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (shouldSkipProjection(req)) return doc
  const tenantId = tenantIdOf(doc as TenantScopedDoc)
  if (!tenantId) return doc
  const tenantDir = path.join(dataDir(), "tenants", tenantId)

  const wasPublished = previousDoc?.status === "published"
  const isPublished = doc.status === "published"
  const slug = String(doc.slug)
  const oldTenantId = previousDoc ? tenantIdOf(previousDoc as TenantScopedDoc) : undefined
  const oldSlug = String(previousDoc?.slug || slug)

  if (isPublished) {
    if (wasPublished && oldTenantId && (oldTenantId !== tenantId || oldSlug !== slug)) {
      await removeProjectedPage(oldTenantId, oldSlug)
      req.payload.logger.info({ tenantId: oldTenantId, slug: oldSlug }, "[projection] old page projection removed")
    }
    const tenant = await tenantForAnalytics(req.payload, tenantId)
    const json = pageToJson(doc as Page, analyticsContextForTenant(tenantId, tenant))
    await writeAtomic(path.join(tenantDir, "pages", `${slug}.json`), JSON.stringify(json, null, 2))
    await withManifestLock(dataDir(), tenantId, async () => {
      let m = await readManifest(dataDir(), tenantId)
      m = upsertEntry(m, { type: "page", key: slug, updatedAt: String(doc.updatedAt) })
      await writeManifest(dataDir(), m)
    })
    req.payload.logger.info({ tenantId, slug }, "[projection] page published to disk")
  } else if (wasPublished) {
    const removeTenantId = oldTenantId || tenantId
    await removeProjectedPage(removeTenantId, oldSlug)
    req.payload.logger.info({ tenantId: removeTenantId, slug: oldSlug }, "[projection] page unpublished — file removed")
  }

  if (isPublished || wasPublished) {
    const settings = await req.payload.find({
      collection: "site-settings",
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (settings.docs[0]) {
      await writeSiteJson(req.payload, tenantId, settings.docs[0])
      req.payload.logger.info({ tenantId, slug }, "[projection] site.json re-projected (nav may reference this page)")
    }
  }

  return doc
}

export const projectSettingsToDisk: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (shouldSkipProjection(req)) return doc
  const tenantId = tenantIdOf(doc as TenantScopedDoc)
  if (!tenantId) return doc
  await writeSiteJson(req.payload, tenantId, doc as SiteSetting)
  req.payload.logger.info({ tenantId }, "[projection] site settings projected")
  return doc
}

export const projectMediaToDisk: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (shouldSkipProjection(req)) return doc
  const tenantId = tenantIdOf(doc as TenantScopedDoc)
  if (!tenantId || doc.filename == null) return doc
  if (!isSafeMediaFilename(doc.filename)) {
    req.payload.logger.warn({ tenantId, filename: doc.filename }, "[projection] unsafe media filename skipped")
    return doc
  }

  const filename = doc.filename

  const tenantMediaDir = path.join(dataDir(), "tenants", tenantId, "media")
  await fs.mkdir(tenantMediaDir, { recursive: true })

  const staging = resolveMediaPath(path.join(dataDir(), "_uploads-tmp"), filename)
  const final = resolveMediaPath(tenantMediaDir, filename)
  if (operation === "create" || operation === "update") {
    try {
      const uploadedFile = req.file as { data?: Buffer; tempFilePath?: string } | undefined
      if (uploadedFile?.data && uploadedFile.data.length > 0) {
        await fs.writeFile(final, uploadedFile.data)
      } else if (uploadedFile?.tempFilePath) {
        await fs.copyFile(uploadedFile.tempFilePath, final)
      } else {
        await fs.access(staging)
        await fs.copyFile(staging, final)
      }
      await fs.rm(staging, { force: true })
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (error?.code !== "ENOENT") {
        req.payload.logger.warn({ err, tenantId, filename }, "[projection] media copy failed")
      }
    }
  }

  await withManifestLock(dataDir(), tenantId, async () => {
    let m = await readManifest(dataDir(), tenantId)
    m = upsertEntry(m, { type: "media", key: filename, updatedAt: String(doc.updatedAt) })
    await writeManifest(dataDir(), m)
  })
  return doc
}
