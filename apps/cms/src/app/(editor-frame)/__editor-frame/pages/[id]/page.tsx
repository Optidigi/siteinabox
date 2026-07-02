import { notFound } from "next/navigation"
import type { Page as ContractPage, SiteSettings as ContractSiteSettings } from "@siteinabox/contracts"
import { EditorFrameRuntime } from "@/components/editor-frame/EditorFrameRuntime"
import { RtManifestProvider } from "@/components/editor/RtManifestContext"
import { requireAuth } from "@/lib/authGate"
import { createEditorFrameNewPagePlaceholder } from "@/lib/editor/editorFramePlaceholderPage"
import { loadTenantCss } from "@/lib/editor/loadTenantCss"
import { getPageById, listPages } from "@/lib/queries/pages"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { sameRelationshipId } from "@/lib/relationshipId"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { cmsThemeToRendererTheme } from "@/lib/theme/rendererTheme"
import type { Tenant } from "@/payload-types"

type RouteParams = {
  id: string
}

type RouteSearchParams = {
  tenantSlug?: string
}

async function resolveEditorFrameTenant(
  ctx: Awaited<ReturnType<typeof requireAuth>>["ctx"],
  tenantSlugParam: string | undefined,
): Promise<Tenant> {
  if (ctx.mode === "tenant") return ctx.tenant

  if (ctx.mode !== "super-admin" || !tenantSlugParam) notFound()

  const tenant = await getTenantBySlug(tenantSlugParam)
  if (!tenant) notFound()
  return tenant
}

export default async function EditorFramePage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<RouteSearchParams>
}) {
  const { ctx } = await requireAuth()
  const { tenantSlug: tenantSlugParam } = await searchParams
  const tenant = await resolveEditorFrameTenant(ctx, tenantSlugParam)

  const { id } = await params
  const isNewPage = id === "new"
  const pageId = isNewPage ? null : Number(id)
  if (!isNewPage && !Number.isFinite(pageId)) notFound()

  const [page, settingsDoc, allPages, manifest, tenantCss] = await Promise.all([
    isNewPage ? Promise.resolve(null) : getPageById(pageId!).catch(() => null),
    getOrCreateSiteSettings(tenant.id),
    listPages(tenant.id),
    loadTenantManifest(tenant.id),
    loadTenantCss(tenant.id),
  ])

  if (!isNewPage) {
    if (!page) notFound()
    if (!sameRelationshipId(page.tenant, tenant.id)) notFound()
  }
  if (!settingsDoc) notFound()

  const analyticsContext = {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    siteDomain: tenant.domain,
  }
  const navPages = (allPages as Array<{ id: number | string; slug: string; title: string }>).map((entry) => ({
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
  }))

  const framePage: ContractPage = isNewPage
    ? createEditorFrameNewPagePlaceholder()
    : pageToJson(page!, analyticsContext, { preserveBlockIds: true }) as ContractPage

  return (
    <RtManifestProvider manifest={manifest}>
      <EditorFrameRuntime
        page={framePage}
        settings={settingsToJson(settingsDoc, navPages, analyticsContext) as ContractSiteSettings}
        theme={cmsThemeToRendererTheme(tenant.theme as ThemeTokens | null | undefined)}
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        domain={tenant.domain}
        manifest={manifest}
        tenantCss={tenantCss}
      />
    </RtManifestProvider>
  )
}
