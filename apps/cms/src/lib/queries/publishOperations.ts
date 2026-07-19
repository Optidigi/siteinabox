import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { Page, PublishedSiteSnapshot, SiteGenerationRun, Tenant } from "@/payload-types"
import { canActivatePublishedSnapshot } from "@/lib/publish/siteSnapshots"
import { relationId } from "@/lib/queries/generationOperations"

export type SnapshotLifecycleState = {
  tenant: Tenant | null
  snapshots: PublishedSiteSnapshot[]
  linkedPages: Array<{ id: string; title: string; slug: string | null; status: string | null }>
  blockers: string[]
  manualBlockers: string[]
  publishBlockers: string[]
  activeSnapshotId: string | null
}

const pageLabel = (page: Page): string => page.title || page.slug || `Page ${page.id}`

const domainVerificationStatus = (tenant: Tenant | null): string | null => {
  const value = tenant?.domainVerification
  return value && typeof value === "object" && !Array.isArray(value)
    ? String((value as { status?: unknown }).status ?? "")
    : null
}

export async function getSnapshotLifecycleForGenerationRun(run: SiteGenerationRun): Promise<SnapshotLifecycleState> {
  const payload = await getPayload({ config })
  const tenantId = relationId(run.tenant)
  if (!tenantId) {
    return {
      tenant: null,
      snapshots: [],
      linkedPages: [],
      blockers: ["Generation run is missing a linked tenant."],
      manualBlockers: ["Generation run is missing a linked tenant."],
      publishBlockers: ["Generation run is missing a linked tenant."],
      activeSnapshotId: null,
    }
  }

  let tenant: Tenant | null = null
  try {
    tenant = await payload.findByID({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    }) as Tenant
  } catch {
    tenant = null
  }
  if (!tenant) {
    return {
      tenant: null,
      snapshots: [],
      linkedPages: [],
      blockers: ["Generation run linked tenant was not found."],
      manualBlockers: ["Generation run linked tenant was not found."],
      publishBlockers: ["Generation run linked tenant was not found."],
      activeSnapshotId: null,
    }
  }

  const pageIds = Array.isArray(run.pages)
    ? run.pages.map((page) => relationId(page)).filter((id): id is string => Boolean(id))
    : []

  const [snapshotResult, pageResult] = await Promise.all([
    payload.find({
      collection: "published-site-snapshots",
      where: { tenant: { equals: tenantId } },
      sort: "-version",
      limit: 50,
      depth: 1,
      overrideAccess: true,
    }),
    pageIds.length > 0
      ? payload.find({
        collection: "pages",
        where: { and: [{ id: { in: pageIds } }, { tenant: { equals: tenantId } }] },
        sort: "slug",
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })
      : Promise.resolve({ docs: [] }),
  ])

  const pageDocs = pageResult.docs as Page[]
  const linkedPages = pageDocs.map((page) => ({
    id: String(page.id),
    title: pageLabel(page),
    slug: page.slug ?? null,
    status: typeof page.status === "string" ? page.status : null,
  }))
  const publishedPageIds = new Set(pageDocs.filter((page) => page.status === "published").map((page) => String(page.id)))
  const missingPublishedPages = pageIds.filter((id) => !publishedPageIds.has(id))
  const snapshots = snapshotResult.docs as PublishedSiteSnapshot[]
  const activeSnapshotId = relationId(tenant.activeSnapshot)
    ?? snapshots.find((snapshot) => snapshot.status === "active")?.id?.toString()
    ?? null

  const gate = canActivatePublishedSnapshot(run, { tenant })
  const manualGate = canActivatePublishedSnapshot(run, { tenant, manualActivation: true })
  const publishBlockers: string[] = []
  if (tenant.status === "suspended" || tenant.status === "archived") {
    publishBlockers.push("Cannot publish an archived or suspended tenant.")
  }
  if (pageIds.length === 0) {
    publishBlockers.push("Generation run has no linked pages to publish.")
  } else if (missingPublishedPages.length > 0) {
    publishBlockers.push("All pages linked to this run must be promoted to CMS published before snapshot publish.")
  }

  const blockers = gate.ok ? [] : [gate.reason]
  const manualBlockers = manualGate.ok ? [] : [manualGate.reason]
  if (domainVerificationStatus(tenant) !== "verified" && !manualBlockers.includes("Activation requires verified domain ownership.")) {
    manualBlockers.push("Activation requires verified domain ownership.")
  }

  return {
    tenant,
    snapshots,
    linkedPages,
    blockers,
    manualBlockers,
    publishBlockers,
    activeSnapshotId,
  }
}
