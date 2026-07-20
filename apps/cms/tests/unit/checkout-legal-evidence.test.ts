import { describe, expect, it, vi } from "vitest"
import {
  createOrderAndAcceptanceEvidence,
  createSiteApprovalEvidence,
  verifyCheckoutEvidence,
} from "@/lib/legal/checkoutEvidence"

import { asGenerationRun, asTenant, cast } from "../_helpers/cast"
import { asPayload, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockWhere } from "../_helpers/mockPayload"
const createPayload = () => {
  let id = 100
  const stores: Record<string, Array<Record<string, unknown>>> = {
    "site-settings": [{ id: 1, tenant: 10, siteName: "Demo", updatedAt: "2026-07-10T10:00:00.000Z" }],
    "site-review-revisions": [],
    "site-approvals": [],
    orders: [],
    "agreement-acceptances": [],
    "legal-documents": [
      {
        id: 20,
        documentType: "platform-terms",
        locale: "nl",
        documentVersion: "2026-07-07.1",
        acceptanceVersion: "platform-terms-2026-07-07",
        contentHash: "sha256:terms",
        publishedAt: "2026-07-07T00:00:00.000Z",
        effectiveAt: "2026-07-07T00:00:00.000Z",
      },
      {
        id: 21,
        documentType: "platform-privacy",
        locale: "nl",
        documentVersion: "2026-07-07.1",
        acceptanceVersion: null,
        contentHash: "sha256:privacy",
        publishedAt: "2026-07-07T00:00:00.000Z",
        effectiveAt: "2026-07-07T00:00:00.000Z",
      },
    ],
  }
  const matches = (doc: MockDoc, where: MockWhere | undefined): boolean => {
    const clauses = where?.and ?? Object.entries(where ?? {}).map(([key, value]) => ({ [key]: value }))
    return clauses.every((clause: MockDoc) => {
      const [field, condition] = Object.entries(clause)[0] as [string, Record<string, unknown>]
      if (condition?.equals !== undefined) return String(doc[field]) === String(condition.equals)
      if (condition?.less_than_equal !== undefined) return new Date(String(doc[field])) <= new Date(String(condition.less_than_equal))
      return true
    })
  }
  const find = vi.fn(async ({ collection, where, sort }: MockFindArgs & { sort?: string }) => {
    let docs = (stores[collection] ?? []).filter((doc) => matches(doc, where))
    if (sort === "-effectiveAt") docs = docs.sort((a, b) => new Date(String(b.effectiveAt)).valueOf() - new Date(String(a.effectiveAt)).valueOf())
    return { docs }
  })
  const create = vi.fn(async ({ collection, data }: MockCreateArgs) => {
    const doc = { id: id++, ...data }
    stores[collection] ??= []
    stores[collection].push(doc)
    return doc
  })
  const findByID = vi.fn(async ({ collection, id: requestedId }: MockFindArgs & { id: number | string }) =>
    (stores[collection] ?? []).find((doc) => String(doc.id) === String(requestedId)))
  return { payload: asPayload({ find, create, findByID }), stores }
}

describe("checkout legal evidence", () => {
  it("freezes review, approval, order, documents, and terms acceptance idempotently", async () => {
    const { payload, stores } = createPayload()
    const run = asGenerationRun({ id: 30, specHash: "spec", updatedAt: "2026-07-10T10:00:00.000Z" })
    const tenant = asTenant({ id: 10, name: "Demo", theme: { primary: "#000" }, siteManifest: { version: 1 } })
    const pages = cast<Parameters<typeof createSiteApprovalEvidence>[0]["pages"]>([
      { id: 40, slug: "index", title: "Home", status: "published", blocks: [{ blockType: "hero" }] },
    ])

    const approval = await createSiteApprovalEvidence({
      payload, run, tenant, pages, domain: "demo.nl", actorEmail: "Client@Example.com", requestId: "req-1",
    })
    const first = await createOrderAndAcceptanceEvidence({
      payload,
      run,
      tenant,
      approval: approval.approval,
      customerEmail: "Client@Example.com",
      customerName: "Client Name",
      companyName: "Demo",
      billingAddress: { city: "Roermond" },
      domainRegistrant: { email: "client@example.com" },
      domain: "demo.nl",
      totalAmount: "499.00",
      currency: "EUR",
      requestId: "req-1",
      now: new Date("2026-07-10T12:00:00.000Z"),
    })
    const second = await createOrderAndAcceptanceEvidence({
      payload,
      run,
      tenant,
      approval: approval.approval,
      customerEmail: "client@example.com",
      customerName: "Client Name",
      companyName: "Demo",
      billingAddress: { city: "Roermond" },
      domainRegistrant: { email: "client@example.com" },
      domain: "demo.nl",
      totalAmount: "499.00",
      currency: "EUR",
      requestId: "req-2",
      now: new Date("2026-07-10T12:00:00.000Z"),
    })

    expect(stores["site-review-revisions"]).toHaveLength(1)
    expect(stores["site-approvals"]).toHaveLength(1)
    expect(stores.orders).toHaveLength(1)
    expect(stores["agreement-acceptances"]).toHaveLength(1)
    expect(first.order.id).toBe(second.order.id)
    expect(first.order.legalDocuments).toEqual([20, 21])
    expect(first.acceptance).toMatchObject({
      documentVersion: "2026-07-07.1",
      acceptanceVersion: "platform-terms-2026-07-07",
      contentHash: "sha256:terms",
      statementVersion: "platform-terms-acceptance-2026-07-07.1",
    })
    await expect(verifyCheckoutEvidence(payload, {
      runId: 30,
      orderId: first.order.id,
      customerEmail: "client@example.com",
    })).resolves.toMatchObject({ order: { domain: "demo.nl" } })
  })
})

