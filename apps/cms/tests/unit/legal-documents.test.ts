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
import { asPayload, matchesWhere, type MockCreateArgs, type MockDoc, type MockFindArgs } from "../_helpers/mockPayload"
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
  const stores: Record<string, MockDoc[]> = {
    "legal-documents": [],
    "legal-publication-events": [],
  }
  const find = vi.fn(async ({ collection, where, sort }: MockFindArgs & { sort?: string }) => {
    let docs = [...(stores[collection] ?? [])]
    const whereRecord = (where ?? {}) as Record<string, unknown>
    const clauses = Array.isArray(whereRecord.and)
      ? whereRecord.and as Record<string, unknown>[]
      : Object.entries(whereRecord).map(([field, condition]) => ({ [field]: condition }))
    for (const clause of clauses) {
      const [field, condition] = Object.entries(clause)[0] as [string, Record<string, unknown>]
      if (condition.equals !== undefined) docs = docs.filter((doc) => doc[field] === condition.equals)
      if (condition.less_than_equal !== undefined) {
        docs = docs.filter((doc) => new Date(String(doc[field])) <= new Date(String(condition.less_than_equal)))
      }
    }
    if (sort === "-effectiveAt") docs.sort((a, b) => new Date(String(b.effectiveAt)).valueOf() - new Date(String(a.effectiveAt)).valueOf())
    return { docs }
  })
  const create = vi.fn(async ({ collection, data }: MockCreateArgs) => {
    const doc = { id: id++, ...data }
    stores[collection] ??= []
    stores[collection].push(doc)
    return doc
  })
  return { payload: asPayload({ find, create }), stores }
}

describe("legal document synchronization", () => {
  it("imports immutable releases idempotently and records activation", async () => {
    const { payload, stores } = payloadStub()
    const now = new Date("2026-07-10T12:00:00.000Z")

    await syncLegalDocuments({ payload: asPayload(payload), now, sourceCommit: "abc1234" })
    await syncLegalDocuments({ payload: asPayload(payload), now, sourceCommit: "abc1234" })

    expect(stores["legal-documents"]!).toHaveLength(3)
    expect(stores["legal-publication-events"]!).toHaveLength(6)
    expect(stores["legal-documents"]!.find((doc) => doc.documentType === "platform-privacy")?.acceptanceVersion).toBeUndefined()
    expect(stores["legal-publication-events"]!.map((event) => event.eventType)).toEqual([
      "registered", "activated", "registered", "activated", "registered", "scheduled",
    ])
  })

  it("refuses a content mismatch for an existing release key", async () => {
    const { payload, stores } = payloadStub()
    await syncLegalDocuments({ payload: asPayload(payload), now: new Date("2026-07-10T12:00:00.000Z") })
    stores["legal-documents"]![0]!.content = "changed"

    await expect(syncLegalDocuments({ payload: asPayload(payload) })).rejects.toThrow("Immutable legal release mismatch")
  })

  it("resolves the effective document from registered releases", async () => {
    const { payload } = payloadStub()
    await syncLegalDocuments({ payload: asPayload(payload), now: new Date("2026-07-10T12:00:00.000Z") })

    const current = await getCurrentLegalDocumentRecord(asPayload(payload), "platform-terms", "nl", new Date("2026-07-10T12:00:00.000Z"))
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
    const payload = asPayload({ find: vi.fn(), create: vi.fn() })

    await expect(ensureLegalRequirementsForRelease(payload, asLegalDocumentDoc({ id: 10 }), asLegalRelease(release(action)))).resolves.toEqual([])
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it.each([
    ["direct_notice", undefined],
    ["reaccept_on_next_transaction", "2026-08-01T00:00:00.000Z"],
    ["mandatory_reaccept", "2026-08-01T00:00:00.000Z"],
  ] as const)("materializes %s as an actionable owner requirement", async (action, enforceAt) => {
    const created: MockDoc[] = []
    const payload = asPayload({
      find: vi.fn(async ({ collection }: MockFindArgs) => collection === "users"
        ? { docs: [{ id: 9, email: "owner@example.test", tenants: [{ tenant: 7 }] }], hasNextPage: false }
        : { docs: [] }),
      create: vi.fn(async ({ data }: MockCreateArgs) => {
        const row: MockDoc = { id: 20, ...data }
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
    const created: MockDoc[] = []
    const payload = asPayload({
      find: vi.fn(async ({ collection }: MockFindArgs) => collection === "users"
        ? { docs: [{ id: 9, email: "owner@example.test", tenants: [{ tenant: 7 }] }], hasNextPage: false }
        : { docs: [] }),
      create: vi.fn(async ({ data }: MockCreateArgs) => {
        const row: MockDoc = { id: 20, ...data }
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
    const tenant: MockDoc = {
      id: 7,
      siteManifest: {
        version: 1,
        analyticsConsent: { enabled: true, provider: "posthog", consentVersion: "old" },
      },
    }
    const payload = asPayload({
      find: vi.fn(async () => ({ docs: [tenant], hasNextPage: false })),
      update: vi.fn(async ({ data }: MockCreateArgs) => {
        tenant.siteManifest = data.siteManifest
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
    const payload = asPayload({
      find: vi.fn(async () => ({ docs: [{ id: 7, siteManifest: { analyticsConsent: { enabled: true } } }], hasNextPage: false })),
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
    const payload = asPayload({ find: vi.fn(), update: vi.fn() })
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

  it("overlays renewed consent policy without mutating the active snapshot", () => {
    const snapshot: MockDoc = { settings: { siteName: "Demo", analyticsConsent: { consentVersion: "old" }, chrome: { banner: { variant: "shadcnui-blocks.banner-01", visible: true, message: "Cookies" } } } }
    const consent = { enabled: true, provider: "posthog", consentVersion: "legal:platform-privacy:nl:2026-08-01.1" }

    const served = asMockDoc(applyTenantAnalyticsConsentPolicy(snapshot, { analyticsConsent: consent }))

    expect(asMockDoc(served.settings).analyticsConsent).toEqual(consent)
    expect(asMockDoc(asMockDoc(served.settings).chrome).banner).toMatchObject({
      variant: "shadcnui-blocks.banner-03",
      title: "Cookies",
      message: "Wij en onze partners gebruiken cookies en vergelijkbare technologieën om uw ervaring te verbeteren en te analyseren hoe deze website wordt gebruikt.",
    })
    expect((snapshot.settings as MockDoc).analyticsConsent).toMatchObject({ consentVersion: "old" })
    expect((((snapshot.settings as MockDoc).chrome as MockDoc).banner as MockDoc).variant).toBe("shadcnui-blocks.banner-01")
  })

  it("materializes the approved consent banner when consent is enabled without chrome content", () => {
    const snapshot: MockDoc = { settings: { siteName: "Demo" } }
    const consent = { enabled: true, provider: "posthog", consentVersion: "v2" }

    const served = asMockDoc(applyTenantAnalyticsConsentPolicy(snapshot, { analyticsConsent: consent }))

    expect(asMockDoc(asMockDoc(served.settings).chrome).banner).toMatchObject({
      variant: "shadcnui-blocks.banner-03",
      visible: true,
      dismissible: false,
    })
    expect(asMockDoc(asMockDoc(asMockDoc(served.settings).chrome).banner).message).toMatch(/cookies en vergelijkbare technologieën/)
    expect(snapshot).toEqual({ settings: { siteName: "Demo" } })
  })
})
