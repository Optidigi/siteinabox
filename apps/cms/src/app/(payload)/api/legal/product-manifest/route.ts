import { getPayload } from "payload"
import config from "@/payload.config"
import { productDocumentPublication, productLegalHref } from "@/lib/legal/productLegal"

export const dynamic = "force-dynamic"
export async function GET() {
  const payload = await getPayload({ config }), documents = [], now = new Date()
  for (let page = 1; ; page += 1) {
    const result = await payload.find({ collection: "legal-documents", where: { releaseKey: { contains: "product:" } }, page, limit: 100, depth: 0, overrideAccess: true })
    for (const doc of result.docs) if (await productDocumentPublication(payload, doc, now)) documents.push({
      documentType: doc.documentType, locale: doc.locale, documentVersion: doc.documentVersion, acceptanceVersion: doc.acceptanceVersion,
      contentHash: doc.contentHash, publishedAt: doc.publishedAt, effectiveAt: doc.effectiveAt, governanceState: "active",
      permanentPath: productLegalHref(doc.documentType, doc.locale, doc.documentVersion), status: new Date(doc.effectiveAt) > now ? "scheduled" : "effective" })
    if (!result.hasNextPage) break
  }
  return Response.json({ schemaVersion: 1, documents }, { headers: { "Cache-Control": "no-store" } })
}
