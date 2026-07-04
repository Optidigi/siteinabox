import "server-only"
import crypto from "node:crypto"
import type { Payload } from "payload"
import type { Page as ContractPage, SiteSettings } from "@siteinabox/contracts"
import type {
  PublishedSiteSnapshot,
  PublishedSnapshotManifest,
  ThemeTokenSpec,
} from "@siteinabox/contracts/generation"
import {
  formatContractValidationIssues,
  schemaForPublishedSiteSnapshot,
} from "@siteinabox/contracts/generation"
import { validateProviderBlockInstance } from "@siteinabox/site-renderer/source-blocks"
import type { Page, SiteGenerationRun, Tenant } from "@/payload-types"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { cmsThemeToRendererTheme } from "@/lib/theme/rendererTheme"
import { resolveSettingsContract } from "@/lib/settingsContract"
import { isActivationPaymentSatisfied } from "@/lib/payments/generationRunPayment"
import { hasVerifiedTenantSender } from "@/lib/tenants/emailSending"
import { refreshTenantEmailSendingFromCloudflare } from "@/lib/tenants/emailSendingRefresh"
import { sendLiveHandoffEmailAfterActivation } from "@/lib/publish/liveHandoffEmail"

const PUBLISH_SNAPSHOT_MUTATION_CONTEXT = { publishSnapshotLifecycleMutation: true } as const
const PUBLISHED_SNAPSHOT_RETENTION_LIMIT = 10

export type PublishSiteOptions = {
  tenantId: string | number
  generationRunId?: string | number | null
  includeAllPublishedPages?: boolean
  activate?: boolean
  manualActivation?: boolean
  publishedBy?: string | number | null
  activationReason?: string | null
}

export type ActivateSnapshotOptions = {
  snapshotId: string | number
  manualActivation?: boolean
  activatedBy?: string | number | null
  activationReason?: string | null
  rollback?: boolean
}

export type ResolvePublishedSnapshotResult = {
  tenant: Pick<Tenant, "id" | "slug" | "domain" | "status">
  snapshot: PublishedSiteSnapshot
  snapshotId: string | number
}

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const snapshotHash = (snapshot: PublishedSiteSnapshot): string =>
  crypto.createHash("sha256").update(stableStringify(snapshot)).digest("hex")

const snapshotThemeForTenant = (
  tenant: Pick<Tenant, "theme">,
): ThemeTokenSpec | null => {
  const theme = normalizeThemeForSave((tenant.theme as any) ?? null)
  return cmsThemeToRendererTheme(theme) as ThemeTokenSpec | null
}

const tenantAnalyticsContext = (tenant: Pick<Tenant, "id" | "slug" | "domain" | "siteManifest">) => {
  const manifest = tenant.siteManifest as Record<string, any> | null | undefined
  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug ?? null,
    siteDomain: tenant.domain ?? null,
    themeId: typeof manifest?.themeId === "string" ? manifest.themeId : null,
    siteBuildId: process.env.SIAB_SITE_BUILD_ID ?? null,
    manifestVersion: typeof manifest?.version !== "undefined" ? manifest.version : null,
    analytics: manifest?.analytics ?? null,
  }
}

export function canActivatePublishedSnapshot(
  run: SiteGenerationRun | null,
  options: {
    manualActivation?: boolean
    tenant?: Pick<Tenant, "status" | "domainVerification" | "emailSending"> | null
  } = {},
): { ok: true } | { ok: false; reason: string } {
  if (options.tenant?.status === "suspended" || options.tenant?.status === "archived") {
    return { ok: false, reason: "Cannot activate a suspended or archived tenant." }
  }

  const domainVerificationStatus = (options.tenant?.domainVerification as { status?: unknown } | null | undefined)?.status
  if (options.tenant && domainVerificationStatus !== "verified") {
    return { ok: false, reason: "Activation requires verified domain ownership." }
  }

  if (run && !hasVerifiedTenantSender(options.tenant)) {
    return { ok: false, reason: "Generated-site activation requires verified tenant email sending." }
  }

  if (options.manualActivation) return { ok: true }
  if (!run) return { ok: false, reason: "Activation requires an approved generation run or a manual activation override." }

  const approval = run.clientApproval as { status?: unknown } | null | undefined
  if (approval?.status !== "approved") {
    return { ok: false, reason: "Activation requires client approval." }
  }

  if (!isActivationPaymentSatisfied(run.payment)) {
    return { ok: false, reason: "Activation requires completed or waived payment through the payment abstraction." }
  }

  return { ok: true }
}

async function getTenant(payload: Payload, tenantId: string | number): Promise<Tenant> {
  return payload.findByID({
    collection: "tenants",
    id: tenantId as any,
    depth: 0,
    overrideAccess: true,
  }) as Promise<Tenant>
}

async function getGenerationRun(payload: Payload, generationRunId: string | number | null | undefined): Promise<SiteGenerationRun | null> {
  if (generationRunId == null) return null
  return payload.findByID({
    collection: "site-generation-runs",
    id: generationRunId as any,
    depth: 0,
    overrideAccess: true,
  }) as Promise<SiteGenerationRun>
}

async function latestApprovedRunForTenant(payload: Payload, tenantId: string | number): Promise<SiteGenerationRun | null> {
  const result = await payload.find({
    collection: "site-generation-runs",
    where: { tenant: { equals: tenantId } },
    sort: "-updatedAt",
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  return ((result.docs as SiteGenerationRun[]).find((run) => {
    const approval = run.clientApproval as { status?: unknown } | null | undefined
    return approval?.status === "approved"
  }) ?? null)
}

async function pagesForSnapshot(
  payload: Payload,
  tenantId: string | number,
  run: SiteGenerationRun | null,
  options: { includeAllPublishedPages?: boolean } = {},
): Promise<Page[]> {
  const runPageIds = Array.isArray(run?.pages)
    ? run.pages.map((page) => relationshipId(page)).filter(Boolean)
    : []
  if (runPageIds.length === 0 && !options.includeAllPublishedPages) {
    throw new Error("Cannot publish without a generation run that records published pages.")
  }

  const result = await payload.find({
    collection: "pages",
    where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: "published" } }] },
    sort: "slug",
    limit: 200,
    depth: 2,
    overrideAccess: true,
  })

  const pages = result.docs as Page[]
  if (options.includeAllPublishedPages) return pages

  const allowed = new Set(runPageIds)
  return pages.filter((page) => allowed.has(String(page.id)))
}

async function nextSnapshotVersion(payload: Payload, tenantId: string | number): Promise<number> {
  const result = await payload.find({
    collection: "published-site-snapshots" as any,
    where: { tenant: { equals: tenantId } },
    sort: "-version",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  const latest = result.docs[0] as { version?: number } | undefined
  return Number.isFinite(latest?.version) ? Number(latest!.version) + 1 : 1
}

export async function prunePublishedSnapshotsForTenant(
  payload: Payload,
  tenantId: string | number,
  options: { keepSnapshotId?: string | number | null; limit?: number } = {},
): Promise<{ deleted: number; kept: number }> {
  const limit = options.limit ?? PUBLISHED_SNAPSHOT_RETENTION_LIMIT
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`Published snapshot retention limit must be a finite integer >= 1 (got ${limit})`)
  }

  const result = await payload.find({
    collection: "published-site-snapshots" as any,
    where: { tenant: { equals: tenantId } },
    sort: "-version",
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  } as any)

  const docs = result.docs as Array<{ id: string | number; status?: string | null }>
  const keepIds = new Set<string>()
  if (options.keepSnapshotId != null) keepIds.add(String(options.keepSnapshotId))

  for (const doc of docs) {
    if (doc.status === "active") keepIds.add(String(doc.id))
  }
  for (const doc of docs) {
    if (keepIds.size >= limit) break
    keepIds.add(String(doc.id))
  }

  const toDelete = docs.filter((doc) => !keepIds.has(String(doc.id)))
  await Promise.all(toDelete.map((doc) => payload.delete({
    collection: "published-site-snapshots" as any,
    id: doc.id as any,
    depth: 0,
    overrideAccess: true,
  } as any)))

  return { deleted: toDelete.length, kept: docs.length - toDelete.length }
}

function buildManifest(
  tenantId: string,
  version: number,
  updatedAt: string,
  settings: SiteSettings,
  pages: ContractPage[],
): PublishedSnapshotManifest {
  return {
    tenantId,
    version,
    updatedAt,
    entries: [
      { type: "settings", key: "site-settings", updatedAt: settings.updatedAt ?? updatedAt },
      ...pages.map((page) => ({
        type: "page" as const,
        key: page.slug,
        updatedAt: page.updatedAt,
      })),
    ],
  }
}

function validatePublishedPageProviderBlocks(pages: ContractPage[]) {
  const errors: string[] = []
  pages.forEach((page, pageIndex) => {
    page.blocks.forEach((block, blockIndex) => {
      for (const issue of validateProviderBlockInstance(block)) {
        errors.push(`pages.${pageIndex}.blocks.${blockIndex}.${issue.path.join(".")}: ${issue.message}`)
      }
    })
  })
  if (errors.length > 0) {
    throw new Error(`Published snapshot failed provider block validation: ${errors.join("; ")}`)
  }
}

export async function buildPublishedSiteSnapshot(
  payload: Payload,
  tenantId: string | number,
  run: SiteGenerationRun | null,
  options: { includeAllPublishedPages?: boolean } = {},
): Promise<PublishedSiteSnapshot> {
  const tenant = await getTenant(payload, tenantId)
  if (tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Cannot publish an archived or suspended tenant.")
  }

  const [pages, settingsDoc, version] = await Promise.all([
    pagesForSnapshot(payload, tenant.id, run, options),
    getOrCreateSiteSettings(tenant.id),
    nextSnapshotVersion(payload, tenant.id),
  ])
  if (pages.length === 0) throw new Error("Cannot publish a site with no pages.")

  const analyticsContext = tenantAnalyticsContext(tenant)
  const publishedPages = pages.map((page) => ({
    ...(pageToJson(page, analyticsContext) as ContractPage),
    id: String(page.id),
    status: "published" as const,
    updatedAt: page.updatedAt,
  }))
  validatePublishedPageProviderBlocks(publishedPages)
  const navPages = publishedPages.map((page) => ({ id: page.id ?? page.slug, slug: page.slug, title: page.title }))
  const projectedSettings = settingsToJson(
    settingsDoc,
    navPages,
    analyticsContext,
    { settingsContract: resolveSettingsContract((tenant.siteManifest as any) ?? null) },
  ) as SiteSettings
  const settings: SiteSettings = {
    ...projectedSettings,
    language: projectedSettings.language ?? settingsDoc?.language ?? "nl",
    siteUrl: `https://${tenant.domain}`,
  }
  const rendererTheme = snapshotThemeForTenant(tenant)
  const now = new Date().toISOString()

  const snapshot = {
    schemaVersion: 1,
    tenantId: String(tenant.id),
    tenantSlug: tenant.slug,
    domain: tenant.domain,
    siteUrl: settings.siteUrl,
    manifest: buildManifest(String(tenant.id), version, now, settings, publishedPages),
    settings,
    pages: publishedPages,
    theme: rendererTheme,
    blocks: Array.isArray((tenant.siteManifest as any)?.blocks) ? (tenant.siteManifest as any).blocks : undefined,
    publishedAt: now,
  }
  const parsed = schemaForPublishedSiteSnapshot(snapshot).safeParse(snapshot)
  if (!parsed.success) {
    throw new Error(`Published site snapshot failed contract validation: ${formatContractValidationIssues(parsed.error)}`)
  }
  return parsed.data
}

export async function activatePublishedSnapshot(
  payload: Payload,
  options: ActivateSnapshotOptions,
) {
  const snapshotDoc = await payload.findByID({
    collection: "published-site-snapshots" as any,
    id: options.snapshotId as any,
    depth: 0,
    overrideAccess: true,
  } as any) as any
  const tenantId = relationshipId(snapshotDoc.tenant)
  if (!tenantId) throw new Error("Published snapshot is missing a tenant.")
  let tenant = await getTenant(payload, tenantId)
  if (normalizeRequestHost(snapshotDoc.domain) !== normalizeRequestHost(tenant.domain)) {
    throw new Error("Cannot activate a snapshot for a tenant domain that has changed.")
  }

  const runId = relationshipId(snapshotDoc.sourceGenerationRun)
  const run = await getGenerationRun(payload, runId)
  if (run && !hasVerifiedTenantSender(tenant)) {
    tenant = await refreshTenantEmailSendingFromCloudflare(payload, tenant)
  }
  const gate = canActivatePublishedSnapshot(run, { manualActivation: options.manualActivation, tenant })
  if (!gate.ok) throw new Error(gate.reason)

  const now = new Date().toISOString()
  const handoffSnapshotDoc = { ...snapshotDoc }
  const activeSnapshots = await payload.find({
    collection: "published-site-snapshots" as any,
    where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: "active" } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  } as any)

  await Promise.all((activeSnapshots.docs as any[])
    .filter((doc) => !sameRelationshipId(doc.id, snapshotDoc.id))
    .map((doc) => payload.update({
      collection: "published-site-snapshots" as any,
      id: doc.id,
      data: {
        status: options.rollback ? "rolled_back" : "superseded",
        ...(options.rollback ? {
          rolledBackAt: now,
          activationReason: options.activationReason ?? `rolled back by activating snapshot ${snapshotDoc.id}`,
        } : {}),
      },
      depth: 0,
      overrideAccess: true,
      context: PUBLISH_SNAPSHOT_MUTATION_CONTEXT,
    } as any)))

  const activatedSnapshot = await payload.update({
    collection: "published-site-snapshots" as any,
    id: snapshotDoc.id,
    data: {
      status: "active",
      activatedAt: now,
      activationReason: options.activationReason ?? (options.manualActivation ? "manual activation override" : "approval/payment activation"),
    },
    depth: 0,
    overrideAccess: true,
    context: PUBLISH_SNAPSHOT_MUTATION_CONTEXT,
  } as any)

  await payload.update({
    collection: "tenants",
    id: tenantId as any,
    data: {
      status: "active",
      activeSnapshot: snapshotDoc.id,
      activatedAt: now,
    } as any,
    depth: 0,
    overrideAccess: true,
  })

  await sendLiveHandoffEmailAfterActivation(payload, {
    tenant,
    run,
    snapshotDoc: handoffSnapshotDoc,
    rollback: options.rollback,
  })

  await prunePublishedSnapshotsForTenant(payload, tenantId, { keepSnapshotId: snapshotDoc.id })

  return activatedSnapshot as any
}

export async function publishSiteSnapshot(
  payload: Payload,
  options: PublishSiteOptions,
) {
  const explicitRun = await getGenerationRun(payload, options.generationRunId)
  const run = explicitRun ?? (options.includeAllPublishedPages ? null : await latestApprovedRunForTenant(payload, options.tenantId))
  const snapshot = await buildPublishedSiteSnapshot(payload, options.tenantId, run, {
    includeAllPublishedPages: options.includeAllPublishedPages,
  })
  const hash = snapshotHash(snapshot)
  const snapshotDoc = await payload.create({
    collection: "published-site-snapshots" as any,
    data: {
      tenant: options.tenantId,
      sourceGenerationRun: run?.id,
      snapshotKey: `${snapshot.tenantSlug}-v${snapshot.manifest.version}-${hash.slice(0, 12)}`,
      version: snapshot.manifest.version,
      status: "drafted",
      domain: snapshot.domain,
      snapshotHash: hash,
      snapshot,
      publishedAt: snapshot.publishedAt,
      publishedBy: options.publishedBy ?? undefined,
      activationReason: options.activationReason ?? undefined,
    },
    depth: 0,
    overrideAccess: true,
  } as any) as any

  if (!options.activate) {
    await prunePublishedSnapshotsForTenant(payload, options.tenantId, { keepSnapshotId: snapshotDoc.id })
    return { snapshot: snapshotDoc, activated: false }
  }

  const activated = await activatePublishedSnapshot(payload, {
    snapshotId: snapshotDoc.id,
    manualActivation: options.manualActivation,
    activatedBy: options.publishedBy,
    activationReason: options.activationReason,
  })
  return { snapshot: activated, activated: true }
}

export function normalizeRequestHost(host: string | null | undefined): string {
  return (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
}

async function tenantForHost(payload: Payload, host: string): Promise<Tenant | null> {
  const direct = await payload.find({
    collection: "tenants",
    where: { domain: { equals: host } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (direct.docs[0]) return direct.docs[0] as Tenant

  const settings = await payload.find({
    collection: "site-settings",
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const match = (settings.docs as any[]).find((doc) =>
    (doc.aliases ?? []).some((alias: any) => normalizeRequestHost(alias?.host) === host),
  )
  const tenantId = relationshipId(match?.tenant)
  return tenantId ? getTenant(payload, tenantId) : null
}

async function activeSnapshotForTenant(payload: Payload, tenant: Tenant): Promise<any | null> {
  const activeSnapshotId = relationshipId((tenant as any).activeSnapshot)
  if (activeSnapshotId) {
    return payload.findByID({
      collection: "published-site-snapshots" as any,
      id: activeSnapshotId as any,
      depth: 0,
      overrideAccess: true,
    } as any)
  }

  const result = await payload.find({
    collection: "published-site-snapshots" as any,
    where: { and: [{ tenant: { equals: tenant.id } }, { status: { equals: "active" } }] },
    sort: "-activatedAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  return result.docs[0] ?? null
}

export async function resolvePublishedSnapshotByHost(
  payload: Payload,
  rawHost: string,
): Promise<ResolvePublishedSnapshotResult | null> {
  const host = normalizeRequestHost(rawHost)
  if (!host) return null

  const tenant = await tenantForHost(payload, host)
  if (!tenant || tenant.status !== "active") return null

  const activeSnapshot = await activeSnapshotForTenant(payload, tenant)
  if (!activeSnapshot || activeSnapshot.status !== "active") return null

  const parsedSnapshot = schemaForPublishedSiteSnapshot(activeSnapshot.snapshot as PublishedSiteSnapshot).safeParse(activeSnapshot.snapshot)
  if (!parsedSnapshot.success) {
    throw new Error(`Stored published site snapshot failed contract validation: ${formatContractValidationIssues(parsedSnapshot.error)}`)
  }
  const snapshot = parsedSnapshot.data
  if (normalizeRequestHost(snapshot.domain) !== normalizeRequestHost(tenant.domain)) return null

  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      domain: tenant.domain,
      status: tenant.status,
    },
    snapshot,
    snapshotId: activeSnapshot.id,
  }
}
