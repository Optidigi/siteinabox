import { notFound } from "next/navigation"
import type { Page as ContractPage, SiteSettings as ContractSiteSettings } from "@siteinabox/contracts"
import { EditorFrameRuntime } from "@/components/editor-frame/EditorFrameRuntime"
import type { PageEditorFrameView } from "@/components/editor/iframe/PageEditorFrameHost"
import type { IframeEditorMobileMode } from "@siteinabox/contracts/iframe-editor"
import { RtManifestProvider } from "@/components/editor/RtManifestContext"
import { requireAuth } from "@/lib/authGate"
import { createEditorFrameNewPagePlaceholder } from "@/lib/editor/editorFramePlaceholderPage"
import { loadCanvasTenantCss } from "@/lib/editor/loadTenantCss"
import { getPageById, listPages } from "@/lib/queries/pages"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { getTenantById, getTenantBySlug } from "@/lib/queries/tenants"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import type { Tenant } from "@/payload-types"

type RouteParams = {
  id: string
}

type RouteSearchParams = {
  tenantSlug?: string
  view?: string
  mobileMode?: string
  focusedBlockId?: string
  focusedBlockIndex?: string
  showChrome?: string
  showGutters?: string
  allowInlineEditing?: string
}

function parseBooleanParam(value: string | undefined): boolean | undefined {
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

function parseInitialView(value: string | undefined): PageEditorFrameView | null {
  return value === "canvas" || value === "sidebar" ? value : null
}

function parseInitialMobileMode(searchParams: RouteSearchParams): IframeEditorMobileMode | null {
  if (searchParams.mobileMode !== "fullPage" && searchParams.mobileMode !== "focusedSection") return null
  const focusedBlockIndex = searchParams.focusedBlockIndex != null
    ? Number.parseInt(searchParams.focusedBlockIndex, 10)
    : undefined
  const hasFocusedBlockIndex = focusedBlockIndex != null && Number.isInteger(focusedBlockIndex) && focusedBlockIndex >= 0
  return {
    mode: searchParams.mobileMode,
    ...(searchParams.focusedBlockId ? { focusedBlockId: searchParams.focusedBlockId } : {}),
    ...(hasFocusedBlockIndex ? { focusedBlockIndex } : {}),
    ...(parseBooleanParam(searchParams.showChrome) != null ? { showChrome: parseBooleanParam(searchParams.showChrome) } : {}),
    ...(parseBooleanParam(searchParams.showGutters) != null ? { showGutters: parseBooleanParam(searchParams.showGutters) } : {}),
    ...(parseBooleanParam(searchParams.allowInlineEditing) != null ? { allowInlineEditing: parseBooleanParam(searchParams.allowInlineEditing) } : {}),
  }
}

async function resolveEditorFrameTenant(
  ctx: Awaited<ReturnType<typeof requireAuth>>["ctx"],
  tenantSlugParam: string | undefined,
  page: Awaited<ReturnType<typeof getPageById>> | null,
): Promise<Tenant> {
  if (ctx.mode === "tenant") return ctx.tenant

  if (ctx.mode !== "super-admin") notFound()

  if (!tenantSlugParam && page) {
    const tenantId = relationshipId(page.tenant)
    if (!tenantId) notFound()
    const tenant = await getTenantById(tenantId).catch(() => null)
    if (!tenant) notFound()
    return tenant
  }

  if (!tenantSlugParam) notFound()

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
  const resolvedSearchParams = await searchParams
  const { tenantSlug: tenantSlugParam } = resolvedSearchParams
  const initialView = parseInitialView(resolvedSearchParams.view)
  const initialMobileMode = parseInitialMobileMode(resolvedSearchParams)

  const { id } = await params
  const isNewPage = id === "new"
  const pageId = isNewPage ? null : Number(id)
  if (!isNewPage && !Number.isFinite(pageId)) notFound()

  const page = isNewPage ? null : await getPageById(pageId!).catch(() => null)
  if (!isNewPage && !page) notFound()

  const tenant = await resolveEditorFrameTenant(ctx, tenantSlugParam, page)

  const [settingsDoc, allPages, manifest, tenantCss] = await Promise.all([
    getOrCreateSiteSettings(tenant.id),
    listPages(tenant.id),
    loadTenantManifest(tenant.id),
    loadCanvasTenantCss(tenant),
  ])

  if (!isNewPage && !sameRelationshipId(page!.tenant, tenant.id)) notFound()
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
        theme={normalizeThemeForSave(tenant.theme as ThemeTokens | null | undefined)}
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        domain={tenant.domain}
        manifest={manifest}
        tenantCss={tenantCss}
        initialView={initialView}
        initialMobileMode={initialMobileMode}
      />
    </RtManifestProvider>
  )
}
