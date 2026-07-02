import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { PreviewCustomizer } from "@/components/preview/PreviewCustomizer"
import { getPreviewCustomizerData } from "@/lib/preview/customizer"
import { legacyPreviewTokensEnabled } from "@/lib/preview/legacyPreview"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("preview")
  return { title: t("metadataTitle") }
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ page?: string }>
}) {
  if (!legacyPreviewTokensEnabled()) notFound()

  const [{ token }, query] = await Promise.all([params, searchParams])
  let data
  try {
    data = await getPreviewCustomizerData(token, query.page)
  } catch {
    notFound()
  }

  return (
    <PreviewCustomizer
      access={data.access}
      pages={data.pages}
      page={data.currentPage}
      settings={data.settings}
      manifest={data.manifest}
      theme={data.theme}
      approval={data.approval}
      payment={data.payment}
      tenantId={data.tenant.id}
      tenantSlug={data.tenant.slug}
      domain={data.tenant.domain}
    />
  )
}
