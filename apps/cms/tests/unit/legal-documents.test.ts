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

const release = (customerAction: string, consentAction = "none", effectiveAt = "2026-08-01T00:00:00.000Z") => ({
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
  },
} as any)

const payloadStub = () => {
  let id = 1
  const stores: Record<string, any[]> = {
    "legal-documents": [],
    "legal-publication-events": [],
  }
  const find = vi.fn(async ({ collection, where, sort }: any) => {
    let docs = [...(stores[collection] ?? [])]
    const clauses = where?.and ?? Object.entries(where ?? {}).map(([field, condition]) => ({ [field]: condition }))
    for (const clause of clauses) {
      const [field, condition] = Object.entries(clause)[0] as [string, any]
      if (condition?.equals !== undefined) docs = docs.filter((doc) => doc[field] === condition.equals)
      if (condition?.less_than_equal !== undefined) {
        docs = docs.filter((doc) => new Date(doc[field]) <= new Date(condition.less_than_equal))
      }
    }
    if (sort === "-effectiveAt") docs.sort((a, b) => new Date(b.effectiveAt).valueOf() - new Date(a.effectiveAt).valueOf())
    return { docs }
  })
  const create = vi.fn(async ({ collection, data }: any) => {
    const doc = { id: id++, ...data }
    stores[collection] ??= []
    stores[collection].push(doc)
    return doc
  })
  return { payload: { find, create } as any, stores }
}

describe("legal document synchronization", () => {
  it("imports immutable releases idempotently and records activation", async () => {
    const { payload, stores } = payloadStub()
    const now = new Date("2026-07-10T12:00:00.000Z")

    await syncLegalDocuments({ payload, now, sourceCommit: "abc1234" })
    await syncLegalDocuments({ payload, now, sourceCommit: "abc1234" })

    expect(stores["legal-documents"]!).toHaveLength(2)
    expect(stores["legal-publication-events"]!).toHaveLength(4)
    expect(stores["legal-documents"]!.find((doc) => doc.documentType === "platform-privacy")?.acceptanceVersion).toBeUndefined()
    expect(stores["legal-publication-events"]!.map((event) => event.eventType)).toEqual([
      "registered", "activated", "registered", "activated",
    ])
  })

  it("refuses a content mismatch for an existing release key", async () => {
    const { payload, stores } = payloadStub()
    await syncLegalDocuments({ payload, now: new Date("2026-07-10T12:00:00.000Z") })
    stores["legal-documents"]![0]!.content = "changed"

    await expect(syncLegalDocuments({ payload })).rejects.toThrow("Immutable legal release mismatch")
  })

  it("resolves the effective document from registered releases", async () => {
    const { payload } = payloadStub()
    await syncLegalDocuments({ payload, now: new Date("2026-07-10T12:00:00.000Z") })

    const current = await getCurrentLegalDocumentRecord(payload, "platform-terms", "nl", new Date("2026-07-10T12:00:00.000Z"))
    expect(current.documentVersion).toBe("2026-07-07.1")
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
      fetchImpl: fetchImpl as any,
    })).rejects.toThrow(/hash mismatch|missing/i)
  })

  it.each(["none", "publish_notice"])("does not create customer requirements for %s", async (action) => {
    const payload = { find: vi.fn(), create: vi.fn() } as any

    await expect(ensureLegalRequirementsForRelease(payload, { id: 10 }, release(action))).resolves.toEqual([])
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it.each([
    ["direct_notice", undefined],
    ["reaccept_on_next_transaction", "2026-08-01T00:00:00.000Z"],
    ["mandatory_reaccept", "2026-08-01T00:00:00.000Z"],
  ])("materializes %s as an actionable owner requirement", async (action, enforceAt) => {
    const created: any[] = []
    const payload = {
      find: vi.fn(async ({ collection }: any) => collection === "users"
        ? { docs: [{ id: 9, email: "owner@example.test", tenants: [{ tenant: 7 }] }], hasNextPage: false }
        : { docs: [] }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: 20, ...data }
        created.push(row)
        return row
      }),
    } as any

    await ensureLegalRequirementsForRelease(payload, { id: 10 }, release(action))

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      tenant: "7",
      subjectEmail: "owner@example.test",
      document: 10,
      action,
      status: "pending",
      enforceAt,
    })
  })

  it("renews configured analytics consent once when the scoped release becomes effective", async () => {
    const tenant = {
      id: 7,
      siteManifest: {
        version: 1,
        analyticsConsent: { enabled: true, provider: "posthog", consentVersion: "old" },
      },
    }
    const payload = {
      find: vi.fn(async () => ({ docs: [tenant], hasNextPage: false })),
      update: vi.fn(async ({ data }: any) => {
        tenant.siteManifest = data.siteManifest
        return tenant
      }),
    } as any
    const consentRelease = release("direct_notice", "renew_analytics")
    const expectedVersion = analyticsConsentVersionForRelease(consentRelease)

    await expect(ensureConsentRenewalsForRelease(payload, consentRelease, new Date("2026-08-01T00:00:00.000Z")))
      .resolves.toHaveLength(1)
    expect(tenant.siteManifest.analyticsConsent.consentVersion).toBe(expectedVersion)
    await expect(ensureConsentRenewalsForRelease(payload, consentRelease, new Date("2026-08-02T00:00:00.000Z")))
      .resolves.toEqual([])
    expect(payload.update).toHaveBeenCalledTimes(1)
  })

  it("does not renew analytics consent before effectiveness or for marketing-only renewal", async () => {
    const payload = {
      find: vi.fn(async () => ({ docs: [{ id: 7, siteManifest: { analyticsConsent: { enabled: true } } }], hasNextPage: false })),
      update: vi.fn(),
    } as any

    await expect(ensureConsentRenewalsForRelease(
      payload,
      release("direct_notice", "renew_analytics", "2026-08-02T00:00:00.000Z"),
      new Date("2026-08-01T00:00:00.000Z"),
    )).resolves.toEqual([])
    await expect(ensureConsentRenewalsForRelease(payload, release("direct_notice", "renew_marketing"), new Date("2026-08-02T00:00:00.000Z")))
      .resolves.toEqual([])
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("overlays renewed consent policy without mutating the active snapshot", () => {
    const snapshot = { settings: { siteName: "Demo", analyticsConsent: { consentVersion: "old" } } }
    const consent = { enabled: true, provider: "posthog", consentVersion: "legal:platform-privacy:nl:2026-08-01.1" }

    const served = applyTenantAnalyticsConsentPolicy(snapshot, { analyticsConsent: consent }) as any

    expect(served.settings.analyticsConsent).toEqual(consent)
    expect(snapshot.settings.analyticsConsent.consentVersion).toBe("old")
  })
})
