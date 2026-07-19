import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { Form, Page } from "@/payload-types"
import { relationshipId } from "@/lib/relationshipId"

export type ActivityEntry = {
  type: "page" | "media" | "settings" | "form"
  id: string
  tenantId: string
  // FN-2026-0046 — surface tenant/page slugs so ActivityFeed rows can
  // construct the tenant-scoped page editor href. The activity row
  // references a specific page or form; clicking through is the natural
  // triage action.
  tenantSlug?: string
  tenantName?: string
  pageSlug?: string
  title: string
  status?: string
  updatedAt: string
  updatedBy?: string
}

export async function getRecentActivity(opts: { tenantId?: string | number | null; limit?: number } = {}): Promise<ActivityEntry[]> {
  const payload = await getPayload({ config })
  const limit = opts.limit ?? 25
  const where = opts.tenantId != null ? { tenant: { equals: opts.tenantId } } : undefined

  const [pages, forms] = await Promise.all([
    payload.find({ collection: "pages", overrideAccess: true, where, limit, sort: "-updatedAt", depth: 1 }),
    payload.find({ collection: "forms", overrideAccess: true, where, limit, sort: "-createdAt", depth: 1 })
  ])

  const pageEntries: ActivityEntry[] = pages.docs.map((p: Page): ActivityEntry => ({
    type: "page",
    id: String(p.id),
    tenantId: String(relationshipId(p.tenant) ?? ""),
    tenantSlug: typeof p.tenant === "object" && p.tenant ? p.tenant.slug ?? undefined : undefined,
    tenantName: typeof p.tenant === "object" && p.tenant ? p.tenant.name ?? undefined : undefined,
    pageSlug: p.slug ?? undefined,
    title: p.title,
    status: p.status ?? undefined,
    updatedAt: p.updatedAt,
    updatedBy: typeof p.updatedBy === "object" && p.updatedBy ? p.updatedBy.email ?? undefined : undefined
  }))
  const formEntries: ActivityEntry[] = forms.docs.map((f: Form): ActivityEntry => ({
    type: "form",
    id: String(f.id),
    tenantId: String(relationshipId(f.tenant) ?? ""),
    tenantSlug: typeof f.tenant === "object" && f.tenant ? f.tenant.slug ?? undefined : undefined,
    tenantName: typeof f.tenant === "object" && f.tenant ? f.tenant.name ?? undefined : undefined,
    title: `Form submission from ${f.email || "unknown"}`,
    status: f.status ?? undefined,
    updatedAt: f.createdAt
  }))

  return [...pageEntries, ...formEntries]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
}

export async function getDashboardStats(tenantId: string | number | null) {
  const payload = await getPayload({ config })
  const tenantWhere = tenantId != null ? { tenant: { equals: tenantId } } : undefined

  const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString()
  const wkAgo = since(7), monthAgo = since(30)

  const [tenants, pagesPub, editsThisWeek, formsThisMonth] = await Promise.all([
    tenantId != null
      ? Promise.resolve({ totalDocs: 1 })
      : payload.count({ collection: "tenants", overrideAccess: true }),
    payload.count({
      collection: "pages",
      overrideAccess: true,
      where: { ...(tenantWhere as object), status: { equals: "published" } }
    }),
    payload.count({
      collection: "pages",
      overrideAccess: true,
      where: { ...(tenantWhere as object), updatedAt: { greater_than: wkAgo } }
    }),
    payload.count({
      collection: "forms",
      overrideAccess: true,
      where: { ...(tenantWhere as object), createdAt: { greater_than: monthAgo } }
    })
  ])

  return {
    tenants: tenants.totalDocs,
    publishedPages: pagesPub.totalDocs,
    editsThisWeek: editsThisWeek.totalDocs,
    formsThisMonth: formsThisMonth.totalDocs
  }
}

export async function getEditsTimeseries(tenantId: string | number | null, days = 7): Promise<{ date: string; count: number }[]> {
  const payload = await getPayload({ config })
  const tenantWhere = tenantId != null ? { tenant: { equals: tenantId } } : undefined
  const since = new Date(Date.now() - days * 86400000)

  const pages = await payload.find({
    collection: "pages",
    overrideAccess: true,
    where: { ...(tenantWhere as object), updatedAt: { greater_than: since.toISOString() } },
    limit: 1000,
    sort: "-updatedAt"
  })

  const buckets: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10)
    buckets[d] = 0
  }
  for (const p of pages.docs) {
    const k = p.updatedAt.slice(0, 10)
    if (buckets[k] !== undefined) buckets[k]++
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
}
