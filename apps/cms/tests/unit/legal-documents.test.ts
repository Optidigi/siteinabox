import { describe, expect, it, vi } from "vitest"
import {
  analyticsConsentVersionForRelease,
  ensureConsentRenewalsForRelease,
  ensureLegalRequirementsForRelease,
  getCurrentLegalDocumentRecord,
  syncLegalDocuments,
  verifyPublicLegalManifest,
} from "@/lib/legal/legalDocuments"
import { applyTenantAnalyticsConsentPolicy } from "@/lib/publish/siteSnapshots"

import { asLegalDocumentDoc, asLegalRelease, asMockDoc, cast } from "../_helpers/cast"
import type { LegalDocument as StoredLegalDocument, LegalPublicationEvent, LegalRequirement } from "@/payload-types"
import { createPayloadFixture, type PayloadFixtureMethod } from "../_helpers/payloadFixture"
import { payloadUpdateFixture } from "../_helpers/payloadUpdateFixture"
import { asDocRecord } from "../_helpers/payloadApi"
import { matchesWhere, type MockDoc } from "../_helpers/mockPayload"
import { legalDocumentFixture, legalPublicationEventFixture, legalRequirementFixture, paginatedFixture, tenantFixture, userFixture } from "../_helpers/generatedDocs"
import type { LegalCustomerAction, LegalDocument } from "@siteinabox/legal-content"
const release = (customerAction: LegalCustomerAction, consentAction = "none", effectiveAt = "2026-08-01T00:00:00.000Z"): LegalDocument =>
  cast<LegalDocument>({
  documentType: "platform-terms",
  locale: "nl",
  documentVersion: "2026-08-01.1",
  acceptanceVersion: customerAction.includes("reaccept") ? "2026-08-01.1" : "2026-07-07.1",
  publishedAt: "2026-07-11T00:00:00.000Z",
  effectiveAt,
  contentHash: `sha256:${"a".repeat(64)}`,
  sourceCommit: "abc1234",
  markdown: "# Voorwaarden",
  change: {
    category: customerAction.includes("reaccept") ? "contract_material" : "administrative",
    summary: "Samenvatting",
    rationale: "Motivatie",
    customerAction,
    consentAction,
    audience: "tenant_owners",
  },
})

const payloadStub = () => {
  let id = 1
  const stores: { "legal-documents": StoredLegalDocument[]; "legal-publication-events": LegalPublicationEvent[] } = { "legal-documents": [], "legal-publication-events": [] }
  const payload = createPayloadFixture({
    find: vi.fn<PayloadFixtureMethod<"find">>(async ({ collection, where, sort }) => {
      const filter = (doc: StoredLegalDocument | LegalPublicationEvent) => matchesWhere(asDocRecord(doc), where)
      if (collection === "legal-documents") {
        const docs = stores[collection].filter(filter)
        if (sort === "-effectiveAt") docs.sort((a,b) => new Date(b.effectiveAt).valueOf() - new Date(a.effectiveAt).valueOf())
        return paginatedFixture(docs)
      }
      if (collection === "legal-publication-events") return paginatedFixture(stores[collection].filter(filter))
      throw new Error("Unexpected collection " + collection)
    }),
    create: vi.fn<PayloadFixtureMethod<"create">>(async ({ collection, data }) => {
      if (collection === "legal-documents") { const doc = legalDocumentFixture({ id: id++ }); Object.assign(doc, data); stores[collection].push(doc); return doc }
      if (collection === "legal-publication-events") { const doc = legalPublicationEventFixture({ id: id++ }); Object.assign(doc, data); stores[collection].push(doc); return doc }
      throw new Error("Unexpected collection " + collection)
    }),
  })
  return { payload, stores }
}

describe("legal document synchronization", () => {
  it("imports immutable releases idempotently and records activation", async () => {
    const { payload, stores } = payloadStub()
    const now = new Date("2026-07-10T12:00:00.000Z")

    await syncLegalDocuments({ payload: payload, now, sourceCommit: "abc1234" })
    await syncLegalDocuments({ payload: payload, now, sourceCommit: "abc1234" })

    expect(stores["legal-documents"]!).toHaveLength(3)
    expect(stores["legal-publication-events"]!).toHaveLength(6)
    expect(stores["legal-documents"]!.find((doc) => doc.documentType === "platform-privacy")?.acceptanceVersion).toBeUndefined()
    expect(stores["legal-publication-events"]!.map((event) => event.eventType)).toEqual([
      "registered", "activated", "registered", "activated", "registered", "scheduled",
    ])
  })

  it("refuses a content mismatch for an existing release key", async () => {
    const { payload, stores } = payloadStub()
    await syncLegalDocuments({ payload: payload, now: new Date("2026-07-10T12:00:00.000Z") })
    stores["legal-documents"]![0]!.content = "changed"

    await expect(syncLegalDocuments({ payload: payload })).rejects.toThrow("Immutable legal release mismatch")
  })

  it("resolves the effective document from registered releases", async () => {
    const { payload } = payloadStub()
    await syncLegalDocuments({ payload: payload, now: new Date("2026-07-10T12:00:00.000Z") })

    const current = await getCurrentLegalDocumentRecord(payload, "platform-terms", "nl", new Date("2026-07-10T12:00:00.000Z"))
    expect(current?.documentVersion).toBe("2026-07-07.1")
  })

  it("rejects a public manifest with a different content hash", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      schemaVersion: 1,
      documents: [{
        documentType: "platform-terms",
        locale: "nl",
        documentVersion: "2026-07-07.1",
        contentHash: "sha256:wrong",
      }],
    }), { status: 200 }))

    await expect(verifyPublicLegalManifest({
      manifestUrl: "https://example.test/legal.json",
      fetchImpl: fetchImpl,
    })).rejects.toThrow(/hash mismatch|missing/i)
  })

  it.each(["none", "publish_notice"] as const)("does not create customer requirements for %s", async (action) => {
    const payload = createPayloadFixture({ find: vi.fn(), create: vi.fn() })

    await expect(ensureLegalRequirementsForRelease(payload, asLegalDocumentDoc({ id: 10 }), asLegalRelease(release(action)))).resolves.toEqual([])
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it.each([
    ["direct_notice", undefined],
    ["reaccept_on_next_transaction", "2026-08-01T00:00:00.000Z"],
    ["mandatory_reaccept", "2026-08-01T00:00:00.000Z"],
  ] as const)("materializes %s as an actionable owner requirement", async (action, enforceAt) => {
    const created: LegalRequirement[] = []
    const payload = createPayloadFixture({
      find: vi.fn<PayloadFixtureMethod<"find">>(async ({ collection }) => collection === "users"
        ? paginatedFixture([userFixture({ id: 9, email: "owner@example.test", tenants: [{ tenant: 7 }] })])
        : paginatedFixture([])),
      create: vi.fn<PayloadFixtureMethod<"create">>(async ({ data }) => {
        const row = legalRequirementFixture({ id: 20 })
        Object.assign(row, data)
        created.push(row)
        return row
      }),
    })

    await ensureLegalRequirementsForRelease(payload, asLegalDocumentDoc({ id: 10 }), asLegalRelease(release(action)))

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      tenant: 7,
      subjectEmail: "owner@example.test",
      document: 10,
      action,
      status: "pending",
      enforceAt,
    })
  })

  it("materializes deemed acceptance with an objection deadline but no enforcement deadline", async () => {
    const created: LegalRequirement[] = []
    const payload = createPayloadFixture({
      find: vi.fn<PayloadFixtureMethod<"find">>(async ({ collection }) => collection === "users"
        ? paginatedFixture([userFixture({ id: 9, email: "owner@example.test", tenants: [{ tenant: 7 }] })])
        : paginatedFixture([])),
      create: vi.fn<PayloadFixtureMethod<"create">>(async ({ data }) => {
        const row = legalRequirementFixture({ id: 20 })
        Object.assign(row, data)
        created.push(row)
        return row
      }),
    })

    await ensureLegalRequirementsForRelease(payload, asLegalDocumentDoc({ id: 10 }), asLegalRelease(release("notice_and_continued_use")))

    expect(created[0]).toMatchObject({
      action: "notice_and_continued_use",
      enforceAt: undefined,
      objectionDeadlineAt: "2026-08-01T00:00:00.000Z",
    })
  })

  it("renews configured analytics consent once when the scoped release becomes effective", async () => {
    const tenant = tenantFixture({
      id: 7,
      siteManifest: {
        version: 1,
        analyticsConsent: { enabled: true, provider: "posthog", consentVersion: "old" },
      },
    })
    const payload = createPayloadFixture({
      find: vi.fn<PayloadFixtureMethod<"find">>(async () => (paginatedFixture([tenant]))),
      update: payloadUpdateFixture(async ({ data }) => {
        Object.assign(tenant, data)
        return tenant
      }),
    })
    const consentRelease = asLegalRelease(release("direct_notice", "renew_analytics"))
    const expectedVersion = analyticsConsentVersionForRelease(consentRelease)

    await expect(ensureConsentRenewalsForRelease(payload, consentRelease, new Date("2026-08-01T00:00:00.000Z")))
      .resolves.toHaveLength(1)
    expect((tenant.siteManifest as MockDoc).analyticsConsent).toMatchObject({ consentVersion: expectedVersion })
    await expect(ensureConsentRenewalsForRelease(payload, consentRelease, new Date("2026-08-02T00:00:00.000Z")))
      .resolves.toEqual([])
    expect(payload.update).toHaveBeenCalledTimes(1)
  })

  it("does not renew analytics consent before effectiveness or for marketing-only renewal", async () => {
    const payload = createPayloadFixture({
      find: vi.fn<PayloadFixtureMethod<"find">>(async () => (paginatedFixture([tenantFixture({ id: 7, siteManifest: { analyticsConsent: { enabled: true } } })]))),
      update: vi.fn(),
    })

    await expect(ensureConsentRenewalsForRelease(
      payload,
      asLegalRelease(release("direct_notice", "renew_analytics", "2026-08-02T00:00:00.000Z")),
      new Date("2026-08-01T00:00:00.000Z"),
    )).resolves.toEqual([])
    await expect(ensureConsentRenewalsForRelease(payload, asLegalRelease(release("direct_notice", "renew_marketing")), new Date("2026-08-02T00:00:00.000Z")))
      .resolves.toEqual([])
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("keeps landing-only analytics renewal out of tenant manifests", async () => {
    const payload = createPayloadFixture({ find: vi.fn(), update: vi.fn() })
    const landingRelease = asLegalRelease(release("publish_notice", "renew_analytics"))
    ;(landingRelease.change as MockDoc).audience = "siteinabox_visitors"

    await expect(ensureConsentRenewalsForRelease(
      payload,
      landingRelease,
      new Date("2026-08-02T00:00:00.000Z"),
    )).resolves.toEqual([])
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("overlays renewed consent policy while preserving the settings-owned consent presentation", () => {
    const snapshot: MockDoc = { settings: { siteName: "Demo", analyticsConsent: { consentVersion: "old" }, consent: { visible: true, message: "Cookies" } } }
    const consent = { enabled: true, provider: "posthog", consentVersion: "legal:platform-privacy:nl:2026-08-01.1" }

    const served = asMockDoc(applyTenantAnalyticsConsentPolicy(snapshot, { analyticsConsent: consent }))

    expect(asMockDoc(served.settings).analyticsConsent).toEqual(consent)
    expect(asMockDoc(served.settings).consent).toMatchObject({ visible: true, message: "Cookies" })
    expect((snapshot.settings as MockDoc).analyticsConsent).toMatchObject({ consentVersion: "old" })
    expect((snapshot.settings as MockDoc).consent).toMatchObject({ visible: true, message: "Cookies" })
  })

  it("does not invent a consent presentation when settings have none", () => {
    const snapshot: MockDoc = { settings: { siteName: "Demo" } }
    const consent = { enabled: true, provider: "posthog", consentVersion: "v2" }

    const served = asMockDoc(applyTenantAnalyticsConsentPolicy(snapshot, { analyticsConsent: consent }))

    expect(asMockDoc(served.settings).consent).toBeUndefined()
    expect(snapshot).toEqual({ settings: { siteName: "Demo" } })
  })
})
