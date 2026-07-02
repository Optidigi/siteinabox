import { notFound } from "next/navigation"
import { RendererFrameRuntime } from "@/components/renderer-frame/RendererFrameRuntime"
import { getPreviewCustomizerData } from "@/lib/preview/customizer"
import { legacyPreviewTokensEnabled } from "@/lib/preview/legacyPreview"
import { isPreviewHost } from "@/lib/preview/previewHost"

type RouteParams = {
  token: string
  pageSlug?: string[]
}

function requestedPageSlug(parts: string[] | undefined): string | null {
  if (!parts || parts.length === 0) return null
  const normalizedParts = parts[0] === "pages" ? parts.slice(1) : parts
  if (normalizedParts.length === 0) return null
  return normalizedParts.join("/")
}

export default async function RendererPreviewTokenFramePage({ params }: { params: Promise<RouteParams> }) {
  if (!legacyPreviewTokensEnabled()) notFound()
  if (!(await isPreviewHost())) notFound()
  const { token, pageSlug } = await params

  let data
  try {
    data = await getPreviewCustomizerData(token, requestedPageSlug(pageSlug))
  } catch {
    notFound()
  }

  return (
    <RendererFrameRuntime
      page={data.currentPage}
      settings={data.settings}
      theme={data.rendererTheme}
      tenantId={data.tenant.id}
      tenantSlug={data.tenant.slug}
      domain={data.tenant.domain}
    />
  )
}
