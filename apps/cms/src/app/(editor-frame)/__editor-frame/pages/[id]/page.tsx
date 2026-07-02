import { notFound } from "next/navigation"
import type { Page as ContractPage, SiteSettings as ContractSiteSettings } from "@siteinabox/contracts"
import { EditorFrameRuntime } from "@/components/editor-frame/EditorFrameRuntime"
import { RtManifestProvider } from "@/components/editor/RtManifestContext"
import { requireAuth } from "@/lib/authGate"
import { createEditorFrameNewPagePlaceholder } from "@/lib/editor/editorFramePlaceholderPage"
import { loadTenantCss } from "@/lib/editor/loadTenantCss"
import { getPageById, listPages } from "@/lib/queries/pages"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { sameRelationshipId } from "@/lib/relationshipId"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { cmsThemeToRendererTheme } from "@/lib/theme/rendererTheme"

type RouteParams = {
  id: string
}

export default async function EditorFramePage({ params }: { params: Promise<RouteParams> }) {
  const { ctx } = await requireAuth()
  if (ctx.mode !== "tenant") notFound()

  const { id } = await params
  const isNewPage = id === "new"
  const pageId = isNewPage ? null : Number(id)
  if (!isNewPage && !Number.isFinite(pageId)) notFound()

  const [page, settingsDoc, allPages, manifest, tenantCss] = await Promise.all([
    isNewPage ? Promise.resolve(null) : getPageById(pageId!).catch(() => null),
    getOrCreateSiteSettings(ctx.tenant.id),
    listPages(ctx.tenant.id),
    loadTenantManifest(ctx.tenant.id),
    loadTenantCss(ctx.tenant.id),
  ])

  if (!isNewPage) {
    if (!page) notFound()
    if (!sameRelationshipId(page.tenant, ctx.tenant.id)) notFound()
  }
  if (!settingsDoc) notFound()

  const analyticsContext = {
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    siteDomain: ctx.tenant.domain,
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
        theme={cmsThemeToRendererTheme(ctx.tenant.theme as ThemeTokens | null | undefined)}
        tenantId={ctx.tenant.id}
        tenantSlug={ctx.tenant.slug}
        domain={ctx.tenant.domain}
        manifest={manifest}
        tenantCss={tenantCss}
      />
    </RtManifestProvider>
  )
}
