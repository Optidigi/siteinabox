import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { RendererFrameRuntime } from "@/components/renderer-frame/RendererFrameRuntime"
import { previewAuth } from "@/lib/preview/betterAuth"
import { getPreviewCustomizerDataForGrant } from "@/lib/preview/customizer"
import { isPreviewHost } from "@/lib/preview/previewHost"
import { normalizePreviewClientSlug } from "@/lib/preview/previewAccess"

type RouteParams = {
  clientSlug: string
  pageSlug?: string[]
}

function requestedPageSlug(parts: string[] | undefined): string | null {
  if (!parts || parts.length === 0) return null
  const normalizedParts = parts[0] === "pages" ? parts.slice(1) : parts
  if (normalizedParts.length === 0) return null
  return normalizedParts.join("/")
}

export default async function RendererPreviewFramePage({ params }: { params: Promise<RouteParams> }) {
  if (!(await isPreviewHost())) notFound()
  const { clientSlug, pageSlug } = await params
  const normalizedClientSlug = normalizePreviewClientSlug(clientSlug)
  if (!normalizedClientSlug) notFound()

  const headerStore = await headers()
  const session = await previewAuth.api.getSession({
    headers: headerStore,
    query: { disableCookieCache: true },
  })
  const customerEmail = session?.user?.email
  if (!customerEmail) notFound()

  const data = await getPreviewCustomizerDataForGrant({
    clientSlug: normalizedClientSlug,
    customerEmail,
    requestedPage: requestedPageSlug(pageSlug),
  })

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
