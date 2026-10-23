import { notFound } from "next/navigation"
import { getProductLegalRelease } from "@siteinabox/legal-content/product"
import { requireRole } from "@/lib/authGate"
import { getPayload } from "payload"
import config from "@/payload.config"
import { productLegalGovernance } from "@/lib/legal/productLegal"
import { reviewProductPolicyAction, activateProductPolicyAction } from "../actions"
import { Input } from "@siteinabox/ui/components/input"
import { Button } from "@siteinabox/ui/components/button"

export const dynamic = "force-dynamic"
export default async function ProductDraftPage({ params }: { params: Promise<{ key: string }> }) {
  await requireRole(["super-admin"])
  const { key } = await params
  let release
  try { release = getProductLegalRelease(key) } catch { notFound() }
  const { state } = await productLegalGovernance(await getPayload({ config }), key)
  const blocked = release.draftBlockers.length > 0
  return <main className="space-y-6">
    <h1 className="text-2xl font-bold">Product legal review · {state}</h1>
    <p>{release.releaseKey} · {release.bundleHash}</p>
    <p role="status">Owner review and separate activation required. Current state: {state}. Source merge is not publication.</p>
    <ul>{release.draftBlockers.map(item => <li key={item}>{item}</li>)}</ul>
    <nav aria-label="Document languages" className="flex flex-wrap gap-4">{release.documents.map(doc =>
      <a key={doc.documentType + doc.locale} href={`#${doc.documentType}-${doc.locale}`}>{doc.locale.toUpperCase()} · {doc.title}</a>)}</nav>
    {release.documents.map(doc => <section id={`${doc.documentType}-${doc.locale}`} key={doc.documentType + doc.locale} lang={doc.locale} className="space-y-2">
      <h2 className="text-xl font-bold">{doc.title} · {doc.locale.toUpperCase()} · {doc.documentVersion}</h2>
      <p>{doc.contentHash}</p>
      <article className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: doc.html }} />
    </section>)}
    <form action={reviewProductPolicyAction} className="space-y-3">
      <h2 className="text-xl font-bold">Owner review / Beoordeling</h2>
      <input type="hidden" name="releaseKey" value={key} />
      <label className="block">Owner approval reference<Input name="ownerReviewRef" required disabled={blocked} /></label>
      <label className="block">Publication date (ISO 8601 with timezone)<Input name="publishedAt" placeholder="2026-11-01T09:00:00+01:00" required disabled={blocked} /></label>
      <label className="block">Effective date (ISO 8601 with timezone)<Input name="effectiveAt" placeholder="2026-12-01T09:00:00+01:00" required disabled={blocked} /></label>
      <label className="block">Existing audience tenant IDs (empty = new customers only)<Input name="audienceTenantIds" disabled={blocked} /></label>
      <Button type="submit" disabled={blocked || state !== "draft"}>Record review / Beoordeling vastleggen</Button>
    </form>
    <form action={activateProductPolicyAction} className="space-y-3">
      <h2 className="text-xl font-bold">Separate publication / Afzonderlijke publicatie</h2>
      <input type="hidden" name="releaseKey" value={key} /><input type="hidden" name="bundleHash" value={release.bundleHash} />
      <label className="block">Publication authorization reference<Input name="publicationAuthorizationRef" required disabled={blocked || state !== "reviewed"} /></label>
      <Button type="submit" disabled={blocked || state !== "reviewed"}>Activate / Activeren</Button>
    </form>
  </main>
}
