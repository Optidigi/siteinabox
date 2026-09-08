import { notFound, redirect } from "next/navigation"
import type { SiteSettings } from "@siteinabox/contracts"
import { createRendererMediaResolver, resolveMedia } from "@siteinabox/site-renderer"
import { PreviewCustomizer } from "@/components/preview/PreviewCustomizer"
import { getPreviewCustomizerDataForGrant } from "@/lib/preview/customizer"
import { getPreviewFixtureData, isPreviewFixtureRoute } from "@/lib/preview/previewFixture"
import { isPreviewHost } from "@/lib/preview/previewHost"

export async function renderPreviewRoute({
  clientSlug,
  pageSlug,
}: {
  clientSlug: string
  pageSlug?: string | null
}) {
  if (isPreviewFixtureRoute(clientSlug)) {
    const fixtureData = getPreviewFixtureData(pageSlug, clientSlug)
    if (!fixtureData) notFound()
    return renderPreviewCustomizer(fixtureData)
  }

  if (!(await isPreviewHost())) notFound()
  redirect(`/builder/${encodeURIComponent(clientSlug)}`)
}

function renderPreviewCustomizer(data: Awaited<ReturnType<typeof getPreviewCustomizerDataForGrant>>) {
  return (
    <PreviewCustomizer
      access={data.access}
      pages={data.pages}
      page={data.currentPage}
      settings={data.settings}
      manifest={data.manifest}
      theme={data.theme}
      faviconHref={previewFaviconHref(data.settings, data.tenant.id)}
      consentAvailable={data.consentAvailable}
      approval={data.approval}
      payment={data.payment}
      tenantId={data.tenant.id}
      tenantSlug={data.tenant.slug}
      domain={data.tenant.domain}
    />
  )
}

function previewFaviconHref(settings: SiteSettings, tenantId: string | number): string {
  const favicon = settings.branding?.favicon
  if (!favicon) return "/logos/favicon.svg"
  const media = resolveMedia(favicon, createRendererMediaResolver(String(tenantId)))
  return media?.src ?? "/logos/favicon.svg"
}
