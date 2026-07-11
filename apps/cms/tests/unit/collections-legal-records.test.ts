import { describe, expect, it } from "vitest"
import {
  AgreementAcceptances,
  CommunicationPreferenceEvents,
  CommunicationPreferences,
  LegalDocuments,
  LegalPublicationEvents,
  LegalRequirements,
  Orders,
  protectFrozenOrder,
  rejectRecordMutation,
  SiteApprovals,
  SiteReviewRevisions,
} from "@/collections/LegalRecords"

const appendOnly = [
  LegalDocuments,
  LegalPublicationEvents,
  AgreementAcceptances,
  SiteReviewRevisions,
  SiteApprovals,
  CommunicationPreferenceEvents,
]

describe("legal record collections", () => {
  it("registers stable collection slugs", () => {
    expect([
      LegalDocuments,
      LegalPublicationEvents,
      AgreementAcceptances,
      SiteReviewRevisions,
      SiteApprovals,
      Orders,
      CommunicationPreferences,
      CommunicationPreferenceEvents,
      LegalRequirements,
    ].map((collection) => collection.slug)).toEqual([
      "legal-documents",
      "legal-publication-events",
      "agreement-acceptances",
      "site-review-revisions",
      "site-approvals",
      "orders",
      "communication-preferences",
      "communication-preference-events",
      "legal-requirements",
    ])
  })

  it("makes legal evidence append-only", () => {
    for (const collection of appendOnly) {
      expect(collection.access?.update?.({} as any), collection.slug).toBe(false)
      expect(collection.access?.delete?.({} as any), collection.slug).toBe(false)
      expect(() => rejectRecordMutation({ operation: "update", data: {} } as any), collection.slug).toThrow("immutable")
    }
  })

  it("only permits trusted payment lifecycle changes to frozen orders", () => {
    expect(() => protectFrozenOrder({ operation: "update", data: { paymentStatus: "paid" }, req: { context: {} } } as any)).toThrow("frozen")
    expect(protectFrozenOrder({
      operation: "update",
      data: { paymentStatus: "paid", paidAt: "2026-07-10T12:00:00.000Z" },
      req: { context: { legalOrderLifecycleMutation: true } },
    } as any)).toEqual({ paymentStatus: "paid", paidAt: "2026-07-10T12:00:00.000Z" })
    expect(() => protectFrozenOrder({
      operation: "update",
      data: { totalGross: 1 },
      req: { context: { legalOrderLifecycleMutation: true } },
    } as any)).toThrow('field "totalGross" is immutable')
  })

  it("does not permit evidence deletion or frozen order deletion", () => {
    expect(Orders.access?.delete?.({} as any)).toBe(false)
    expect(CommunicationPreferences.access?.delete?.({} as any)).toBe(false)
    expect(LegalRequirements.access?.delete?.({} as any)).toBe(false)
    expect(LegalRequirements.access?.update?.({} as any)).toBe(false)
  })
})
