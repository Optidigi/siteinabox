import { describe, expect, it, vi } from "vitest"
import {
  acceptCustomerLegalRequirement,
  assertTenantPublicationAllowed,
  getTenantLegalRequirements,
  satisfyRequirementsFromTransaction,
} from "@/lib/legal/customerRequirements"

const createPayload = () => {
  let id = 100
  const document = {
    id: 10,
    documentType: "platform-terms",
    documentVersion: "2026-08-01.1",
    acceptanceVersion: "2026-08-01",
    contentHash: "sha256:terms",
    changeSummary: "De betalingsvoorwaarden zijn aangepast.",
    effectiveAt: "2026-08-01T00:00:00.000Z",
  }
  const requirements: any[] = [
    { id: 1, requirementKey: "owner-1", tenant: 7, subjectEmail: "owner@example.nl", document, action: "mandatory_reaccept", status: "pending", enforceAt: "2026-08-01T00:00:00.000Z" },
    { id: 2, requirementKey: "owner-2", tenant: 7, subjectEmail: "other@example.nl", document, action: "mandatory_reaccept", status: "notified", enforceAt: "2026-08-01T00:00:00.000Z" },
  ]
  const acceptances: any[] = []
  const matches = (doc: any, where: any): boolean => {
    const clauses = where?.and ?? Object.entries(where ?? {}).map(([key, value]) => ({ [key]: value }))
    return clauses.every((clause: any) => {
      const [field, condition] = Object.entries(clause)[0] as [string, any]
      const value = field === "document" && typeof doc.document === "object" ? doc.document.id : doc[field]
      if (condition.equals !== undefined) return String(value) === String(condition.equals)
      if (condition.in) return condition.in.includes(value)
      return true
    })
  }
  const find = vi.fn(async ({ collection, where }: any) => ({
    docs: (collection === "legal-requirements" ? requirements : acceptances).filter((doc) => matches(doc, where)),
  }))
  const findByID = vi.fn(async ({ id: requested }: any) => requirements.find((item) => String(item.id) === String(requested)))
  const create = vi.fn(async ({ collection, data }: any) => {
    const record = { id: id++, ...data }
    if (collection === "agreement-acceptances") acceptances.push(record)
    return record
  })
  const update = vi.fn(async ({ id: requested, data }: any) => {
    const record = requirements.find((item) => String(item.id) === String(requested))
    Object.assign(record, data)
    return record
  })
  return { payload: { find, findByID, create, update } as any, requirements, acceptances, document }
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
    expect(requirements[0].acceptance).toBe(acceptances[0].id)
    expect(acceptances[0]).toMatchObject({ tenant: 7, document: 10 })
  })

  it("preserves numeric relationship IDs when recording acceptance evidence", async () => {
    const { payload, requirements, document, acceptances } = createPayload()
    requirements[0].tenant = { id: 7 }
    requirements[0].document = { ...document, id: 10 }
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
    requirements[0].action = "reaccept_on_next_transaction"
    requirements[1].action = "reaccept_on_next_transaction"
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
})
