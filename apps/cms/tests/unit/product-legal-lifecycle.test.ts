import { describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"
import type { LegalDocument, LegalPublicationEvent, User } from "@/payload-types"
import { hashLegalContent } from "@siteinabox/legal-content"
import { getProductLegalRelease } from "@siteinabox/legal-content/product"
import { activateProductLegalRelease, equivalentProductDocumentIds, productDocumentPublication, reviewProductLegalRelease } from "@/lib/legal/productLegal"
import { checkoutLegalDocuments } from "@/lib/legal/checkoutLegal"

// Only this unit test substitutes a reviewable source. The real source draft
// and its unresolved owner/legal facts remain unchanged and unactivatable.
vi.mock("@siteinabox/legal-content/product", async importOriginal => {
  const original = await importOriginal<typeof import("@siteinabox/legal-content/product")>()
  const { hashLegalContent } = await import("@siteinabox/legal-content")
  return { ...original, getProductLegalRelease: (key: string) => {
    if (key !== "synthetic-lifecycle") return original.getProductLegalRelease(key)
    const source = original.getProductLegalRelease(original.productLegalReleases[0]!.releaseKey)
    const documents = source.documents.map(doc => {
      const markdown = `# Synthetic ${doc.documentType} ${doc.locale}\nUnit fixture only.`
      return { ...doc, markdown, contentHash: hashLegalContent(markdown) }
    })
    return { ...source, releaseKey: key, draftBlockers: [], documents,
      bundleHash: hashLegalContent(JSON.stringify(documents)) }
  } }
})

const actor = { id: 10, role: "super-admin", email: "operator@test.invalid" } as User
const now = new Date("2026-10-24T00:00:00.000Z")
function fixture() {
  const documents: LegalDocument[] = [], events: LegalPublicationEvent[] = []
  const find = vi.fn(async (args: { collection: string; where?: unknown }) => {
    const filter = JSON.stringify(args.where)
    if (args.collection === "legal-publication-events") return { docs: events.filter(event => filter.includes(event.eventKey)) }
    return { docs: documents.filter(doc => !filter.includes('"releaseKey"') || filter.includes(doc.releaseKey)).filter(doc =>
      !filter.includes('"locale"') || filter.includes(`"${doc.locale}"`)).filter(doc =>
      !filter.includes('"documentType"') || filter.includes(`"${doc.documentType}"`)) }
  })
  const create = vi.fn(async (args: { collection: string; data: object }) => {
    if (args.collection === "legal-documents") {
      const doc = { ...args.data, id: documents.length + 1 } as LegalDocument
      documents.push(doc); return doc
    }
    const event = { ...args.data, id: events.length + 1 } as LegalPublicationEvent
    events.push(event); return event
  })
  const findByID = vi.fn(async (args: { collection: string; id: number }) => args.collection === "users" ? actor : documents.find(doc => doc.id === args.id))
  const payload = { find, create, findByID } as unknown as Payload
  const review = () => reviewProductLegalRelease({ payload, actor, releaseKey: "synthetic-lifecycle", approvalRef: "synthetic-owner-review",
    publishedAt: "2026-09-01T00:00:00.000Z", effectiveAt: "2026-10-01T00:00:00.000Z", audienceTenantIds: [5], sourceCommit: "a".repeat(40) })
  const activate = () => activateProductLegalRelease({ payload, actor, releaseKey: "synthetic-lifecycle", now,
    authorizationRef: "synthetic-separate-publication", expectedBundleHash: getProductLegalRelease("synthetic-lifecycle").bundleHash })
  return { payload, documents, events, review, activate, create, findByID }
}

describe("product legal lifecycle and consumers", () => {
  it("keeps review separate from publication and converges on retries", async () => {
    const f = fixture()
    await f.review()
    const doc = f.documents[0]!
    expect(await productDocumentPublication(f.payload, doc, now)).toBeNull()
    await expect(f.activate()).resolves.toMatchObject({ eventType: "activated" })
    await f.review(); await f.activate()
    expect(f.documents).toHaveLength(4); expect(f.events).toHaveLength(2)
    expect(await productDocumentPublication(f.payload, doc, now)).not.toBeNull()
    await expect(reviewProductLegalRelease({ payload: f.payload, actor, releaseKey: "synthetic-lifecycle", approvalRef: "different-review",
      publishedAt: doc.publishedAt, effectiveAt: doc.effectiveAt, audienceTenantIds: [5], sourceCommit: "a".repeat(40) })).rejects.toThrow(/immutable/)
  })
  it("requires a matching bundle, notice period and unchanged stored bytes", async () => {
    const f = fixture()
    await expect(f.activate()).rejects.toThrow(/owner review/)
    await expect(reviewProductLegalRelease({ payload: f.payload, actor, releaseKey: "synthetic-lifecycle", approvalRef: "synthetic-review",
      publishedAt: "2026-10-01T00:00:00Z", effectiveAt: "2026-10-02T00:00:00Z", audienceTenantIds: [], sourceCommit: "a".repeat(40) })).rejects.toThrow(/notice period/)
    await f.review()
    f.documents[0]!.content = "corrupted fixture"
    await expect(f.activate()).rejects.toThrow(/bytes changed/)
    expect(f.events).toHaveLength(1)
  })
  it("serves exact NL/EN checkout statements and only explicitly approved equivalent terms", async () => {
    const f = fixture(); await f.review(); await f.activate()
    for (const locale of ["nl", "en"] as const) {
      const selection = await checkoutLegalDocuments(f.payload, locale, now)
      expect(selection?.product).toBe(true)
      expect(selection?.terms.locale).toBe(locale)
      expect(selection?.statement.version).toBe(`product-terms-acceptance-${locale}-2026-10-23.1`)
      expect(selection?.termsHref).toContain(`/policies/${locale}/platform-terms/`)
      expect(selection?.privacyHref).toContain(`/policies/${locale}/platform-privacy/`)
      const doc = f.documents.find(doc => doc.locale === locale && doc.documentType === "platform-terms")!
      expect(await equivalentProductDocumentIds(f.payload, doc, now)).toEqual([f.documents[0]!.id, f.documents[1]!.id])
      expect(hashLegalContent(doc.content)).toBe(doc.contentHash)
    }
  })
})
