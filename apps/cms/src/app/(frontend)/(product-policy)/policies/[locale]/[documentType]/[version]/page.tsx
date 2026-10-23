import { notFound } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import { renderLegalContent } from "@siteinabox/legal-content"
import { getPublishedProductLegalDocument } from "@/lib/legal/productLegal"

export const dynamic = "force-dynamic"
export default async function ProductPolicyPage({ params }: { params: Promise<{ locale: string; documentType: string; version: string }> }) {
  const { locale, documentType, version } = await params
  const payload = await getPayload({ config })
  const document = await getPublishedProductLegalDocument(payload, documentType, locale, version)
  if (!document) notFound()
  return <main lang={locale} className="mx-auto max-w-3xl space-y-4 px-4 py-8">
    <h1 className="text-2xl font-bold">{locale === "en" ? "Product legal document" : "Juridisch productdocument"}</h1>
    <p>{locale.toUpperCase()} · {document.documentVersion} · {document.contentHash}</p>
    <p>{locale === "en" ? "Effective from" : "Van kracht vanaf"}: {document.effectiveAt}</p>
    <article className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderLegalContent(document.content) }} />
  </main>
}
