import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  DEFAULT_PAGE_EDITOR_PUBLISH,
  PAGE_EDITOR_SAVE_CONFLICT_CODE,
  type PageEditorSaveRequest,
} from "@/lib/publish/pageEditorSaveContract"

import { errLike } from "../_helpers/cast"
const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  payload: {
    auth: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    find: vi.fn(),
    findByID: vi.fn(),
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

const request = (body: unknown) =>
  new NextRequest("https://admin.siteinabox.nl/api/page-editor-save", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "payload-token=session" },
    body: JSON.stringify(body),
  })

const body: PageEditorSaveRequest = {
  tenantId: 7,
  publish: true,
  page: {
    id: 24,
    expectedUpdatedAt: "2026-07-19T10:00:00.000Z",
    data: { title: "Home", slug: "index", status: "published", blocks: [] },
  },
  siteDesign: {
    theme: {
      version: 3,
      colors: { schemeId: "red-confident" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "rounded" },
      appearance: { mode: "light" },
    },
    navigation: { inHeader: true, inFooter: false },
    chrome: { header: { visible: true } },
  },
}

describe("page editor transactional save route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.payload.auth.mockResolvedValue({ user: { id: 1, role: "super-admin", tenants: [] } })
    mocks.payload.db.beginTransaction.mockResolvedValue("tx-1")
    mocks.payload.db.commitTransaction.mockResolvedValue(undefined)
    mocks.payload.db.rollbackTransaction.mockResolvedValue(undefined)
    mocks.payload.findByID.mockResolvedValue({
      id: 24,
      tenant: 7,
      updatedAt: "2026-07-19T10:00:00.000Z",
    })
    mocks.payload.update.mockImplementation(async (args: { collection: string; data?: Record<string, unknown>; id?: number }) =>
      args.collection === "pages"
        ? { ...args.data, id: 24, tenant: { id: 7 }, slug: "index" }
        : { id: args.id, ...args.data },
    )
    mocks.payload.find.mockResolvedValue({ docs: [{ id: 5, tenant: 7, navHeader: [], navFooter: [] }] })
    mocks.publish.mockResolvedValue({ activated: true, snapshot: { id: 134, version: 113, status: "active" } })
  })

  it("defaults publish to operator-compatible behavior when omitted", () => {
    expect(DEFAULT_PAGE_EDITOR_PUBLISH).toBe(true)
  })

  it("commits page, related state, and publication through one transaction request", async () => {
    const response = await POST(request(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, page: { id: 24 }, snapshot: { id: 134, status: "active" } })
    expect(mocks.payload.db.commitTransaction).toHaveBeenCalledWith("tx-1")
    expect(mocks.payload.db.rollbackTransaction).not.toHaveBeenCalled()
    const transactionRequests = mocks.payload.update.mock.calls.map(([args]) => args.req?.transactionID)
    expect(transactionRequests).toEqual(["tx-1", "tx-1", "tx-1"])
    expect(mocks.publish).toHaveBeenCalledWith(
      mocks.payload,
      expect.objectContaining({ tenantId: 7, req: expect.objectContaining({ transactionID: "tx-1" }) }),
    )
  })

  it("persists page-only changes without touching site design or publication when publish is false", async () => {
    const pageOnlyBody: PageEditorSaveRequest = {
      tenantId: 7,
      publish: false,
      page: body.page,
    }

    const response = await POST(request(pageOnlyBody))
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result).toMatchObject({ ok: true, page: { id: 24 } })
    expect(result.snapshot).toBeUndefined()
    expect(mocks.payload.update).toHaveBeenCalledTimes(1)
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.payload.db.commitTransaction).toHaveBeenCalledWith("tx-1")
  })

  it("persists site-design-only sections when page content is unchanged", async () => {
    const siteDesignOnlyBody: PageEditorSaveRequest = {
      tenantId: 7,
      publish: false,
      page: body.page,
      siteDesign: {
        theme: body.siteDesign?.theme,
      },
    }

    const response = await POST(request(siteDesignOnlyBody))

    expect(response.status).toBe(200)
    expect(mocks.payload.update).toHaveBeenCalledTimes(2)
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.payload.update.mock.calls[1]?.[0]).toMatchObject({
      collection: "tenants",
      id: "7",
      data: { theme: body.siteDesign?.theme },
    })
  })

  it("returns 409 without starting a transaction when expectedUpdatedAt is stale", async () => {
    mocks.payload.findByID.mockResolvedValueOnce({
      id: 24,
      tenant: 7,
      updatedAt: "2026-07-19T11:00:00.000Z",
    })

    const response = await POST(request(body))
    const result = await response.json()

    expect(response.status).toBe(409)
    expect(result).toMatchObject({
      ok: false,
      error: "conflict",
      code: PAGE_EDITOR_SAVE_CONFLICT_CODE,
      expectedUpdatedAt: "2026-07-19T10:00:00.000Z",
      actualUpdatedAt: "2026-07-19T11:00:00.000Z",
    })
    expect(mocks.payload.db.beginTransaction).not.toHaveBeenCalled()
    expect(mocks.payload.update).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it("rolls back every database write when publication fails", async () => {
    mocks.publish.mockRejectedValueOnce(new Error("Published snapshot failed contract validation"))

    const response = await POST(request(body))
    const result = await response.json()

    expect(response.status).toBe(422)
    expect(result).toMatchObject({ ok: false, stage: "publish", message: "Published snapshot failed contract validation" })
    expect(mocks.payload.db.rollbackTransaction).toHaveBeenCalledWith("tx-1")
    expect(mocks.payload.db.commitTransaction).not.toHaveBeenCalled()
    expect(mocks.payload.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "publish", tenantId: "7" }),
      expect.any(String),
    )
  })

  it("rolls back the transaction when a meaningful unsupported CTA field is rejected", async () => {
    mocks.payload.update.mockRejectedValueOnce(
      new Error('Provider variant "shadcnui-blocks.cta-03" does not expose slot "secondary".'),
    )

    const response = await POST(
      request({
        ...body,
        page: {
          ...body.page,
          data: {
            ...body.page.data,
            blocks: [
              {
                blockType: "cta",
                designVariant: "shadcnui-blocks.cta-03",
                secondary: { label: "Unsupported", href: "/unsupported" },
              },
            ],
          },
        },
      }),
    )

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
