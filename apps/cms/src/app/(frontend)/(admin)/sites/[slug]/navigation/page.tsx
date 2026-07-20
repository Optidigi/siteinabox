import { requireOwnerSelectedSite } from "@/lib/routePolicy"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { listPages } from "@/lib/queries/pages"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { NavigationManager } from "@/components/navigation/NavigationManager"
import type { Page, SiteSetting } from "@/payload-types"
import { isRecord } from "@/lib/record"
import type { NavEntry, NavPageOption, NavZone } from "@/components/navigation/navTypes"
import { getAdminTranslations } from "@/i18n/admin"

// OBS-20 — navigation management. Owner + super-admin only, matching
// SiteSettings.access.update (canUpdateSettings). AppSidebar gates the link
// the same way; requireRole here blocks direct-URL access for editor/viewer.

const idOf = (ref: unknown): number | null => {
  if (ref == null) return null
  if (typeof ref === "object" && "id" in (ref as object)) {
    const v = (ref as { id: unknown }).id
    return typeof v === "number" ? v : Number(v)
  }
  return typeof ref === "number" ? ref : Number(ref)
}

type NavRow = NonNullable<SiteSetting["navHeader"]>[number]

// Normalise a stored nav row (Payload may populate `page` to an object at
// the query's depth) into the flat shape the client component consumes.
const normaliseEntry = (row: NavRow | null | undefined): NavEntry => ({
  type: row?.type ?? "custom",
  page: idOf(row?.page),
  anchor: typeof row?.anchor === "string" ? row.anchor : null,
  url: typeof row?.url === "string" ? row.url : null,
  label: typeof row?.label === "string" ? row.label : null,
  external: !!row?.external,
  description: typeof row?.description === "string" ? row.description : null,
  children: Array.isArray(row?.children) ? row.children.map((child) => ({
    label: typeof child?.label === "string" ? child.label : "",
    href: typeof child?.href === "string" ? child.href : "",
    description: typeof child?.description === "string" ? child.description : null,
    icon: typeof child?.icon === "string" ? child.icon : null,
    external: !!child?.external,
  })) : [],
})

export default async function NavigationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ zone?: string | string[] }>
}) {
  const { slug } = await params
  const { user, ctx, tenant } = await requireOwnerSelectedSite(slug)
  const t = await getAdminTranslations(user, "navigation")
  const sp = (await searchParams) ?? {}
  const zoneParam = Array.isArray(sp.zone) ? sp.zone[0] : sp.zone
  const initialZone: NavZone = zoneParam === "footer" ? "footer" : "header"

  const settings = await getOrCreateSiteSettings(tenant.id)
  const pages = await listPages(tenant.id)

  // Page options for the picker — plus each page's block anchors so a
  // "section link" can offer an auto-enumerated anchor list.
  const pageOptions: NavPageOption[] = pages.map((p: Page) => ({
    id: Number(p.id),
    title: p.title,
    slug: p.slug,
    status: p.status,
    anchors: Array.isArray(p.blocks)
      ? p.blocks
          .map((b) => (isRecord(b) && typeof b.anchor === "string" ? b.anchor.trim() : ""))
          .filter((a) => a.length > 0)
      : [],
  }))

  const navHeader = (settings?.navHeader ?? []).map(normaliseEntry)
  const navFooter = (settings?.navFooter ?? []).map(normaliseEntry)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} href={ctx.mode === "tenant" ? "/" : undefined} />}
      />
      <NavigationManager
        tenantId={tenant.id}
        initialNavHeader={navHeader}
        initialNavFooter={navFooter}
        pages={pageOptions}
        initialZone={initialZone}
      />
    </div>
  )
}
