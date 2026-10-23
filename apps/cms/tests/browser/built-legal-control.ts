import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { hashLegalContent } from "@siteinabox/legal-content"
import { getProductLegalStatement } from "@siteinabox/legal-content/product"
import { loadCmsTestEnvironment, assertWorkerStorage, assertDatabaseOwnership, applyCmsTestEnvironment } from "../_helpers/cmsTestEnvironment.mjs"

const context = await loadCmsTestEnvironment()
await assertWorkerStorage(context.env, context.resource)
await assertDatabaseOwnership(context.env, context.resource)
applyCmsTestEnvironment(context.env, context.resource)
const action = process.argv[2]
assert(action === "review" || action === "activate", "Unknown owned legal fixture control")
const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("@/payload.config")])
const payload = await getPayload({ config })
try {
  const fixture = JSON.parse(await readFile(path.join(context.env.DATA_DIR, "browser-fixture.json"), "utf8"))
  const operator = fixture.roles.find((user: { role: string }) => user.role === "super-admin")
  assert(operator, "Owned synthetic operator required")
  const user = await payload.findByID({ collection: "users", id: operator.id, overrideAccess: true })
  assert.equal(user.role, "super-admin")
  const req = { user, context: { governedProductLegal: true } }
  const receipt = path.join(context.env.DATA_DIR, "legal-fixture.json")
  if (action === "review") {
    const publishedAt = new Date(Date.now() - 86400000).toISOString()
    const documents = []
    for (const documentType of ["platform-terms", "platform-privacy"] as const) for (const locale of ["nl", "en"] as const) {
      const content = `# Synthetic M17 ${documentType} ${locale}\nOwned disposable browser fixture only. No real legal approval.`
      const document = await payload.create({ collection: "legal-documents", req, overrideAccess: true, data: {
        releaseKey: `product:synthetic-m17-browser:${documentType}:${locale}:2026-10-23.99`, documentType, locale,
        documentVersion: "2026-10-23.99", acceptanceVersion: documentType === "platform-terms" ? "synthetic-m17-terms" : null,
        content, contentHash: hashLegalContent(content), publishedAt, effectiveAt: publishedAt, sourceCommit: "synthetic-browser-fixture",
        changeCategory: documentType === "platform-terms" ? "contract_material" : "privacy_transparency",
        customerAction: documentType === "platform-terms" ? "reaccept_on_next_transaction" : "publish_notice", consentAction: "none",
        changeSummary: "Synthetic M17 disposable legal journey", changeRationale: "Not production or actual legal approval", audience: "synthetic-owned-fixture",
      } })
      documents.push({ id: document.id, documentType, locale, documentVersion: document.documentVersion, contentHash: document.contentHash,
        acceptanceVersion: document.acceptanceVersion, statement: documentType === "platform-terms" ? getProductLegalStatement(`product-terms-acceptance-${locale}-2026-10-23.1`, locale) : null })
    }
    const metadata = { productBundleKey: "synthetic-m17-browser", bundleHash: hashLegalContent(JSON.stringify(documents)),
      approvalRef: "synthetic-owned-review-not-legal-approval", actorId: String(user.id), documents, audienceTenantIds: [], publishedAt, effectiveAt: publishedAt }
    await payload.create({ collection: "legal-publication-events", req, overrideAccess: true, data: {
      eventKey: "product:synthetic-m17-browser:reviewed", document: documents[0]!.id, eventType: "registered", occurredAt: publishedAt, metadata } })
    await writeFile(receipt, JSON.stringify(metadata), { mode: 0o600, flag: "wx" })
  } else {
    const metadata = JSON.parse(await readFile(receipt, "utf8"))
    await payload.create({ collection: "legal-publication-events", req, overrideAccess: true, data: {
      eventKey: "product:synthetic-m17-browser:activated", document: metadata.documents[0].id, eventType: "activated", occurredAt: metadata.publishedAt,
      metadata: { ...metadata, reviewRef: metadata.approvalRef, authorizationRef: "synthetic-separate-publication-not-owner-authorization" } } })
  }
  console.log("Owned synthetic legal fixture state prepared; no external publication")
} finally { await payload.destroy() }
process.exit(0)
