import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { RendererFrameRuntime } from "@/components/renderer-frame/RendererFrameRuntime"
import { getVerifiedPreviewCustomer } from "@/lib/auth/verifiedPreviewSession"
import { getPreviewCustomizerDataForGrant } from "@/lib/preview/customizer"
import { getPreviewFixtureData, isPreviewFixtureRoute } from "@/lib/preview/previewFixture"
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
  const { clientSlug, pageSlug } = await params

  if (isPreviewFixtureRoute(clientSlug)) {
    const fixtureData = getPreviewFixtureData(requestedPageSlug(pageSlug), clientSlug)
    if (!fixtureData) notFound()
    return (
      <RendererFrameRuntime
        page={fixtureData.currentPage}
        settings={fixtureData.settings}
        theme={fixtureData.rendererTheme}
        consentAvailable={fixtureData.consentAvailable}
        tenantId={fixtureData.tenant.id}
        tenantSlug={fixtureData.tenant.slug}
        domain={fixtureData.tenant.domain}
      />
    )
  }

  if (!(await isPreviewHost())) notFound()

  const normalizedClientSlug = normalizePreviewClientSlug(clientSlug)
  if (!normalizedClientSlug) notFound()

  const headerStore = await headers()
  const customer = await getVerifiedPreviewCustomer(headerStore).catch(() => null)
  const customerEmail = customer?.account.email
  if (!customerEmail) notFound()

  const data = await getPreviewCustomizerDataForGrant({
    clientSlug: normalizedClientSlug,
    customerEmail,
    requestedPage: requestedPageSlug(pageSlug),
    customerAuthority: customer!.authority,
  }).catch(() => notFound())

  return (
    <RendererFrameRuntime
      page={data.currentPage}
      settings={data.settings}
      theme={data.rendererTheme}
      consentAvailable={data.consentAvailable}
      tenantId={data.tenant.id}
      tenantSlug={data.tenant.slug}
      domain={data.tenant.domain}
    />
  )
}
