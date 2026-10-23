import { describe, it, expect, vi } from "vitest"
import type { Payload } from "payload"
import type { LegalDocument, User } from "@/payload-types"
import { hashLegalContent } from "@siteinabox/legal-content"
import { productLegalReleases } from "@siteinabox/legal-content/product"
import { reviewProductLegalRelease, activateProductLegalRelease, productDocumentPublication, legalAcceptanceStatement } from "@/lib/legal/productLegal"
import { listLegalReleases } from "@/lib/queries/legalOperations"

const content = "# Synthetic approved terms\nControlled legal fixture, not actual legal approval."
const doc = { id: 1, releaseKey: "product:synthetic:platform-terms:en:2026-10-23.99", documentType: "platform-terms", locale: "en",
  documentVersion: "2026-10-23.99", acceptanceVersion: "synthetic-terms", content, contentHash: hashLegalContent(content),
  publishedAt: "2026-10-01T00:00:00Z", effectiveAt: "2026-10-01T00:00:00Z" } as LegalDocument
const documents = [
  { id: 1, documentType: "platform-terms", locale: "en", documentVersion: doc.documentVersion, contentHash: doc.contentHash, statement: { locale: "en", version: "synthetic-en", text: "I accept these synthetic terms." } },
  { id: 2, documentType: "platform-terms", locale: "nl", documentVersion: doc.documentVersion, contentHash: doc.contentHash },
  { id: 3, documentType: "platform-privacy", locale: "en", documentVersion: doc.documentVersion, contentHash: doc.contentHash },
  { id: 4, documentType: "platform-privacy", locale: "nl", documentVersion: doc.documentVersion, contentHash: doc.contentHash },
]
const review = { productBundleKey: "synthetic", bundleHash: "sha256:" + "a".repeat(64), approvalRef: "owner-synthetic-review", actorId: "10", documents, audienceTenantIds: [5] }
const active = { ...review, reviewRef: review.approvalRef, authorizationRef: "separate-synthetic-publication" }
function storage(reviewed: unknown = review, activated: unknown = active) {
  const find = vi.fn(async (args: { where?: { eventKey?: { equals?: string } } }) => {
    const key = args.where?.eventKey?.equals ?? ""
    const metadata = key.endsWith(":reviewed") ? reviewed : activated
    return { docs: metadata ? [{ id: 1, occurredAt: "2026-10-01T00:00:00Z", metadata }] : [] }
  })
  const create = vi.fn(), findByID = vi.fn(async () => ({ id: 10, email: "operator@test.invalid", role: "super-admin" }))
  return { payload: { find, create, findByID } as unknown as Payload, create, find }
}

describe("governed product legal publication", () => {
  it("dates and a reviewed record never activate an unapproved publication", async () => {
    expect(await productDocumentPublication(storage(null, null).payload, doc, new Date("2099-01-01"))).toBeNull()
    expect(await productDocumentPublication(storage(review, null).payload, doc, new Date("2099-01-01"))).toBeNull()
  })
  it("binds published locale/version/hash and exact statement to separate review/activation", async () => {
    const { payload } = storage()
    expect((await productDocumentPublication(payload, doc, new Date("2026-10-24")))?.entry.locale).toBe("en")
    expect(await legalAcceptanceStatement(payload, doc)).toEqual({ version: "synthetic-en", text: "I accept these synthetic terms." })
    expect(await productDocumentPublication(payload, { ...doc, content: "Changed" })).toBeNull()
    expect(await productDocumentPublication(payload, { ...doc, locale: "nl" })).toBeNull()
    expect(await productDocumentPublication(storage(review, { ...active, authorizationRef: "" }).payload, doc)).toBeNull()
    expect(await productDocumentPublication(storage(review, { ...active, documents: [documents[0], documents[0], documents[0], documents[0]] }).payload, doc)).toBeNull()
  })
  it("rejects unresolved current drafts even for a genuine platform operator", async () => {
    const { payload, create } = storage()
    const actor = { id: 10, role: "super-admin", email: "operator@test.invalid" } as User
    const releaseKey = productLegalReleases[0]!.releaseKey
    await expect(reviewProductLegalRelease({ payload, actor, releaseKey, approvalRef: "synthetic",
      publishedAt: "2026-10-23", effectiveAt: "2026-11-23", audienceTenantIds: [], sourceCommit: "a".repeat(40) })).rejects.toThrow(/Unresolved/)
    await expect(activateProductLegalRelease({ payload, actor, releaseKey, authorizationRef: "synthetic", expectedBundleHash: "a" })).rejects.toThrow(/Unresolved/)
    expect(create).not.toHaveBeenCalled()
  })
  it("does not trust an owner role, forged actor or stale platform authority", async () => {
    const { payload, create } = storage()
    await expect(activateProductLegalRelease({ payload, actor: { id: 10, role: "owner" } as User,
      releaseKey: "unknown", authorizationRef: "fake", expectedBundleHash: "fake" })).rejects.toThrow(/operator/)
    expect(create).not.toHaveBeenCalled()
  })
  it("does not label old-dated source drafts active in the operator list", async () => {
    const draft = { ...doc, releaseKey: `product:${productLegalReleases[0]!.releaseKey}:platform-terms:en:2026-10-23.1` }
    const find = vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === "legal-documents" ? [draft] : [], totalDocs: 1, limit: 20, totalPages: 1, page: 1 }))
    const rows = await listLegalReleases({}, { find } as unknown as Payload)
    expect(rows.docs[0]?.state).toBe("draft")
  })
})
