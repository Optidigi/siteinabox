import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  payload: {
    auth: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    find: vi.fn(),
    logger: { error: vi.fn() },
    db: {
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
    },
  },
}))

vi.mock("payload", () => ({ getPayload: vi.fn(async () => mocks.payload) }))
vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("@/lib/publish/currentState", () => ({ publishCurrentTenantState: mocks.publish }))

import { POST } from "@/app/(payload)/api/page-editor-save/route"

const request = (body: unknown) => new NextRequest("https://admin.siteinabox.nl/api/page-editor-save", {
  method: "POST",
  headers: { "content-type": "application/json", cookie: "payload-token=session" },
  body: JSON.stringify(body),
})

const body = {
  tenantId: 7,
  page: { id: 24, data: { title: "Home", slug: "index", status: "published", blocks: [] } },
  theme: { version: 3, colors: { schemeId: "red-confident" }, fonts: { schemeId: "classic-editorial" }, shape: { schemeId: "rounded" }, appearance: { mode: "light" } },
  navigation: { inHeader: true, inFooter: false },
  chrome: { header: { visible: true } },
}

describe("page editor transactional save route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin", tenants: [] } })
    mocks.payload.db.beginTransaction.mockResolvedValue("tx-1")
    mocks.payload.db.commitTransaction.mockResolvedValue(undefined)
    mocks.payload.db.rollbackTransaction.mockResolvedValue(undefined)
    mocks.payload.update.mockImplementation(async (args: any) => args.collection === "pages"
      ? { ...args.data, id: 24, tenant: { id: 7 }, slug: "index" }
      : { id: args.id, ...args.data })
    mocks.payload.find.mockResolvedValue({ docs: [{ id: 5, tenant: 7, navHeader: [], navFooter: [] }] })
    mocks.publish.mockResolvedValue({ activated: true, snapshot: { id: 134, version: 113, status: "active" } })
  })

  it("commits page, related state, and publication through one transaction request", async () => {
    const response = await POST(request(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, page: { id: 24 }, snapshot: { id: 134, status: "active" } })
    expect(mocks.payload.db.commitTransaction).toHaveBeenCalledWith("tx-1")
    expect(mocks.payload.db.rollbackTransaction).not.toHaveBeenCalled()
    const transactionRequests = mocks.payload.update.mock.calls.map(([args]) => args.req?.transactionID)
    expect(transactionRequests).toEqual(["tx-1", "tx-1", "tx-1"])
    expect(mocks.publish).toHaveBeenCalledWith(mocks.payload, expect.objectContaining({ tenantId: 7, req: expect.objectContaining({ transactionID: "tx-1" }) }))
  })

  it("rolls back every database write when publication fails", async () => {
    mocks.publish.mockRejectedValueOnce(new Error("Published snapshot failed contract validation"))

    const response = await POST(request(body))
    const result = await response.json()

    expect(response.status).toBe(422)
    expect(result).toMatchObject({ ok: false, stage: "publish", message: "Published snapshot failed contract validation" })
    expect(mocks.payload.db.rollbackTransaction).toHaveBeenCalledWith("tx-1")
    expect(mocks.payload.db.commitTransaction).not.toHaveBeenCalled()
    expect(mocks.payload.logger.error).toHaveBeenCalledWith(expect.objectContaining({ stage: "publish", tenantId: "7" }), expect.any(String))
  })

  it("rolls back the transaction when a meaningful unsupported CTA field is rejected", async () => {
    mocks.payload.update.mockRejectedValueOnce(new Error(
      'Provider variant "shadcnui-blocks.cta-03" does not expose slot "secondary".',
    ))

    const response = await POST(request({
      ...body,
      page: {
        ...body.page,
        data: {
          ...body.page.data,
          blocks: [{
            blockType: "cta",
            designVariant: "shadcnui-blocks.cta-03",
            secondary: { label: "Unsupported", href: "/unsupported" },
          }],
        },
      },
    }))

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ ok: false, stage: "page" })
    expect(mocks.payload.db.rollbackTransaction).toHaveBeenCalledWith("tx-1")
    expect(mocks.payload.db.commitTransaction).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it("does not start a transaction for an unauthenticated request", async () => {
    mocks.payload.auth.mockResolvedValueOnce({ user: null })

    const response = await POST(request(body))

    expect(response.status).toBe(403)
    expect(mocks.payload.db.beginTransaction).not.toHaveBeenCalled()
  })
})
