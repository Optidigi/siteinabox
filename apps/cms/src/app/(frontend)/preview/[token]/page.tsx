import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { PreviewCustomizer } from "@/components/preview/PreviewCustomizer"
import { getPreviewCustomizerData } from "@/lib/preview/customizer"
import { legacyPreviewTokensEnabled } from "@/lib/preview/legacyPreview"

export const metadata: Metadata = {
  title: "Preview",
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ page?: string }>
}) {
  if (!legacyPreviewTokensEnabled()) notFound()

  const [{ token }, query, headerStore] = await Promise.all([params, searchParams, headers()])
  const nonce = headerStore.get("x-csp-nonce") ?? undefined
  let data
  try {
    data = await getPreviewCustomizerData(token, query.page)
  } catch {
    notFound()
  }

  return (
    <>
      {data.tenantCss && (
        <style
          nonce={nonce}
          suppressHydrationWarning
          data-rt-tenant-css
          dangerouslySetInnerHTML={{ __html: data.tenantCss }}
        />
      )}
      <PreviewCustomizer
        access={data.access}
        pages={data.pages}
        page={data.currentPage}
        settings={data.settings}
        manifest={data.manifest}
        theme={data.theme}
        approval={data.approval}
        payment={data.payment}
      />
    </>
  )
}
