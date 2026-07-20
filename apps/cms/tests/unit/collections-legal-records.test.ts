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

import { accessArgs } from "../_helpers/accessArgs"
import { hookArgsFor } from "../_helpers/hookFixtures"

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
      expect(collection.access?.update?.(accessArgs({ req: {} })), collection.slug).toBe(false)
      expect(collection.access?.delete?.(accessArgs({ req: {} })), collection.slug).toBe(false)
      expect(() => rejectRecordMutation(hookArgsFor(rejectRecordMutation, { operation: "update", data: {}, req: {}, collection: {}, context: {} })), collection.slug).toThrow("immutable")
    }
  })

  it("only permits trusted payment lifecycle changes to frozen orders", () => {
    expect(() => protectFrozenOrder(hookArgsFor(protectFrozenOrder, { operation: "update", data: { paymentStatus: "paid" }, req: { context: {} }, collection: {}, context: {} }))).toThrow("frozen")
    expect(protectFrozenOrder(hookArgsFor(protectFrozenOrder, {
      operation: "update",
      data: { paymentStatus: "paid", paidAt: "2026-07-10T12:00:00.000Z" },
      req: { context: { legalOrderLifecycleMutation: true } },
      collection: {},
      context: { legalOrderLifecycleMutation: true },
    }))).toEqual({ paymentStatus: "paid", paidAt: "2026-07-10T12:00:00.000Z" })
    expect(() => protectFrozenOrder(hookArgsFor(protectFrozenOrder, {
      operation: "update",
      data: { totalGross: 1 },
      req: { context: { legalOrderLifecycleMutation: true } },
      collection: {},
      context: { legalOrderLifecycleMutation: true },
    }))).toThrow('field "totalGross" is immutable')
  })

  it("does not permit evidence deletion or frozen order deletion", () => {
    expect(Orders.access?.delete?.(accessArgs({ req: {} }))).toBe(false)
    expect(CommunicationPreferences.access?.delete?.(accessArgs({ req: {} }))).toBe(false)
    expect(LegalRequirements.access?.delete?.(accessArgs({ req: {} }))).toBe(false)
    expect(LegalRequirements.access?.update?.(accessArgs({ req: {} }))).toBe(false)
  })
})
