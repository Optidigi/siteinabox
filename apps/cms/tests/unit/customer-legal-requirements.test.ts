import { describe, expect, it, vi } from "vitest"
import {
  acceptCustomerLegalRequirement,
  assertTenantPublicationAllowed,
  getTenantLegalRequirements,
  objectToNoticeAndContinuedUse,
  recordQualifyingContinuedUse,
  resolveNoticeAndContinuedUseRequirements,
  satisfyRequirementsFromTransaction,
} from "@/lib/legal/customerRequirements"

import { asMockDoc, asRequirementDoc } from "../_helpers/cast"
import type { AgreementAcceptance, LegalRequirement } from "@/payload-types"
import { createPayloadFixture, type PayloadFixtureMethod } from "../_helpers/payloadFixture"
import { payloadUpdateFixture } from "../_helpers/payloadUpdateFixture"
import { asDocRecord } from "../_helpers/payloadApi"
import { matchesWhere, type MockDoc } from "../_helpers/mockPayload"
import { agreementAcceptanceFixture, legalDocumentFixture, legalRequirementFixture, paginatedFixture, tenantFixture } from "../_helpers/generatedDocs"
const createPayload = () => {
  let id = 100
  const document = legalDocumentFixture({ id: 10, documentType: "platform-terms", documentVersion: "2026-08-01.1", acceptanceVersion: "2026-08-01", contentHash: "sha256:terms", changeSummary: "De betalingsvoorwaarden zijn aangepast.", effectiveAt: "2026-08-01T00:00:00.000Z" })
  const requirements: LegalRequirement[] = [
    legalRequirementFixture({ id: 1, requirementKey: "owner-1", tenant: 7, subjectEmail: "owner@example.nl", document, action: "mandatory_reaccept", status: "pending", enforceAt: "2026-08-01T00:00:00.000Z" }),
    legalRequirementFixture({ id: 2, requirementKey: "owner-2", tenant: 7, subjectEmail: "other@example.nl", document, action: "mandatory_reaccept", status: "notified", enforceAt: "2026-08-01T00:00:00.000Z" }),
  ]
  const acceptances: AgreementAcceptance[] = []
  const requirementRecord = (doc: LegalRequirement) => ({ ...asDocRecord(doc), document: typeof doc.document === "object" ? doc.document.id : doc.document })
  const payload = createPayloadFixture({
    find: vi.fn<PayloadFixtureMethod<"find">>(async ({ collection, where }) => {
      if (collection === "legal-requirements") return paginatedFixture(requirements.filter(doc => matchesWhere(requirementRecord(doc), where)))
      if (collection === "legal-notification-deliveries") return paginatedFixture([])
      if (collection === "agreement-acceptances") return paginatedFixture(acceptances.filter(doc => matchesWhere(asDocRecord(doc), where)))
      throw new Error("Unexpected collection " + collection)
    }),
    findByID: vi.fn<PayloadFixtureMethod<"findByID">>(async ({ id: requested }) => {
      const record = requirements.find(item => String(item.id) === String(requested))
      if (!record) throw new Error("Missing requirement " + requested)
      return record
    }),
    create: vi.fn<PayloadFixtureMethod<"create">>(async ({ collection, data }) => {
      if (collection !== "agreement-acceptances") throw new Error("Unexpected collection " + collection)
      const record = agreementAcceptanceFixture({ id: id++ })
      Object.assign(record, data)
      acceptances.push(record)
      return record
    }),
    update: payloadUpdateFixture(async args => {
      if ("where" in args) throw new Error("Expected ID update")
      const record = requirements.find(item => String(item.id) === String(args.id))
      if (!record) throw new Error("Missing requirement " + args.id)
      Object.assign(record, args.data)
      return record
    }),
  })
  return { payload, requirements, acceptances, document }
}

describe("customer legal requirements", () => {
  it("projects duplicate owner requirements as one tenant action", async () => {
    const { payload } = createPayload()
    const result = await getTenantLegalRequirements(payload, 7, new Date("2026-08-02T00:00:00.000Z"))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ requiresAcceptance: true, overdue: true, documentVersion: "2026-08-01.1" })
  })

  it("records one idempotent acceptance and satisfies every matching owner requirement", async () => {
    const { payload, requirements, acceptances } = createPayload()
    const input = { payload, requirementId: 1, tenantId: 7, actorUserId: 20, actorEmail: "owner@example.nl", now: new Date("2026-08-02T12:00:00.000Z") }
    await acceptCustomerLegalRequirement(input)
    await acceptCustomerLegalRequirement(input)
    expect(acceptances).toHaveLength(1)
    expect(requirements.map((item) => item.status)).toEqual(["satisfied", "satisfied"])
    expect(requirements[0]!.acceptance).toBe(acceptances[0]!.id)
    expect(acceptances[0]).toMatchObject({ tenant: 7, document: 10 })
  })

  it("preserves numeric relationship IDs when recording acceptance evidence", async () => {
    const { payload, requirements, document, acceptances } = createPayload()
    requirements[0]!.tenant = tenantFixture({ id: 7 })
    requirements[0]!.document = { ...document, id: 10 }
    await acceptCustomerLegalRequirement({
      payload,
      requirementId: 1,
      tenantId: "7",
      actorUserId: 20,
      actorEmail: "owner@example.nl",
    })
    expect(acceptances[0]).toMatchObject({ tenant: 7, document: 10 })
  })

  it("rejects cross-tenant acceptance", async () => {
    const { payload } = createPayload()
    await expect(acceptCustomerLegalRequirement({ payload, requirementId: 1, tenantId: 8, actorUserId: 20, actorEmail: "owner@example.nl" }))
      .rejects.toThrow("does not belong")
  })

  it("blocks publication only when mandatory acceptance is overdue", async () => {
    const { payload } = createPayload()
    await expect(assertTenantPublicationAllowed(payload, 7, new Date("2026-07-31T00:00:00.000Z"))).resolves.toBeUndefined()
    await expect(assertTenantPublicationAllowed(payload, 7, new Date("2026-08-02T00:00:00.000Z"))).rejects.toThrow("Legal acceptance required")
  })

  it("satisfies next-transaction requirements with checkout acceptance evidence", async () => {
    const { payload, requirements, document } = createPayload()
    requirements[0]!.action = "reaccept_on_next_transaction"
    requirements[1]!.action = "reaccept_on_next_transaction"
    await satisfyRequirementsFromTransaction({
      payload,
      tenantId: 7,
      actorEmail: "owner@example.nl",
      documentId: document.id,
      acceptanceId: 88,
      acceptedAt: "2026-08-02T00:00:00.000Z",
    })
    expect(requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "satisfied", acceptance: 88 }),
      expect.objectContaining({ status: "satisfied", acceptance: 88 }),
    ]))
  })

  it("keeps notice-and-continued-use visible but never overdue or publication-blocking", async () => {
    const { payload, requirements } = createPayload()
    requirements.splice(1)
    Object.assign(requirements[0]!, {
      action: "notice_and_continued_use",
      status: "notified",
      enforceAt: null,
      objectionDeadlineAt: "2026-08-01T00:00:00.000Z",
      noticeDeliveredAt: "2026-07-01T00:00:00.000Z",
    })

    const projected = await getTenantLegalRequirements(payload, 7, new Date("2026-08-02T00:00:00.000Z"))
    expect(projected).toEqual([expect.objectContaining({
      action: "notice_and_continued_use",
      requiresAcceptance: false,
      overdue: false,
      canObject: true,
      objectionDeadlineAt: "2026-08-01T00:00:00.000Z",
    })])
    await expect(assertTenantPublicationAllowed(payload, 7, new Date("2026-08-02T00:00:00.000Z")))
      .resolves.toBeUndefined()
  })

  it("records qualifying use without satisfying before the objection deadline", async () => {
    const requirement = legalRequirementFixture({
      id: 30,
      tenant: 7,
      action: "notice_and_continued_use",
      status: "notified",
      noticeDeliveredAt: "2026-07-01T00:00:00.000Z",
      objectionDeadlineAt: "2026-08-01T00:00:00.000Z",
    })
    const payload = createPayloadFixture({
      find: vi.fn<PayloadFixtureMethod<"find">>(async () => (paginatedFixture([requirement]))),
      update: payloadUpdateFixture(async ({ data }) => Object.assign(requirement, data)),
    })

    await recordQualifyingContinuedUse({
      payload,
      tenantId: 7,
      occurredAt: new Date("2026-07-15T00:00:00.000Z"),
      evidenceType: "authenticated_publish",
      evidenceId: "publish-88",
    })

    expect(requirement).toMatchObject({
      status: "notified",
      qualifyingUseAt: "2026-07-15T00:00:00.000Z",
      resolutionEvidence: { qualifyingUse: { type: "authenticated_publish", id: "publish-88" } },
    })
  })

  it("allows early explicit acceptance on the deemed track with normal evidence", async () => {
    const { payload, requirements, acceptances } = createPayload()
    requirements.splice(1)
    requirements[0]!.action = "notice_and_continued_use"
    requirements[0]!.status = "notified"
    requirements[0]!.noticeDeliveredAt = "2026-07-01T00:00:00.000Z"

    await acceptCustomerLegalRequirement({
      payload,
      requirementId: 1,
      tenantId: 7,
      actorUserId: 20,
      actorEmail: "owner@example.nl",
      requestId: "accept-1",
      now: new Date("2026-07-15T00:00:00.000Z"),
    })

    expect(acceptances).toHaveLength(1)
    expect(requirements[0]).toMatchObject({
      status: "satisfied",
      resolutionBasis: "explicit_acceptance",
      resolutionEvidence: { acceptanceId: acceptances[0]!.id },
    })
  })

  it("resolves only delivered, unobjectioned qualifying use after the deadline", async () => {
    const eligible = legalRequirementFixture({
      id: 30,
      action: "notice_and_continued_use",
      status: "notified",
      noticeDeliveredAt: "2026-07-01T00:00:00.000Z",
      qualifyingUseAt: "2026-07-15T00:00:00.000Z",
      objectionDeadlineAt: "2026-08-01T00:00:00.000Z",
    })
    const failedDelivery = { ...eligible, id: 31, noticeDeliveredAt: null }
    const objected = { ...eligible, id: 32, objectedAt: "2026-07-20T00:00:00.000Z" }
    const updated: Array<string | number> = []
    const payload = createPayloadFixture({
      find: vi.fn<PayloadFixtureMethod<"find">>(async () => (paginatedFixture([eligible, failedDelivery, objected]))),
      update: payloadUpdateFixture(async ({ id, data }) => {
        if (id === undefined) throw new Error("Expected ID update")
        updated.push(id)
        const row = [eligible, failedDelivery, objected].find((item) => item.id === id)
        return Object.assign(row!, data)
      }),
    })

    await resolveNoticeAndContinuedUseRequirements({ payload, now: new Date("2026-08-02T00:00:00.000Z") })

    expect(updated).toEqual([30])
    expect(eligible).toMatchObject({
      status: "satisfied",
      deemedAcceptedAt: "2026-08-02T00:00:00.000Z",
      resolutionBasis: "qualifying_continued_use",
    })
  })

  it("records an objection as terminal evidence", async () => {
    const requirement = legalRequirementFixture({ id: 30, tenant: 7, action: "notice_and_continued_use", status: "notified" })
    const payload = createPayloadFixture({
      findByID: vi.fn<PayloadFixtureMethod<"findByID">>(async () => requirement),
      update: payloadUpdateFixture(async ({ data }) => Object.assign(requirement, data)),
    })

    await objectToNoticeAndContinuedUse({
      payload,
      requirementId: 30,
      tenantId: 7,
      actorUserId: 9,
      actorEmail: "owner@example.nl",
      reason: "Niet akkoord",
      requestId: "req-1",
      now: new Date("2026-07-20T00:00:00.000Z"),
    })

    expect(requirement).toMatchObject({
      status: "objected",
      objectedAt: "2026-07-20T00:00:00.000Z",
      resolutionBasis: "objection",
      resolutionEvidence: { actorUserId: 9, actorEmail: "owner@example.nl", reason: "Niet akkoord", requestId: "req-1" },
    })
  })
})
