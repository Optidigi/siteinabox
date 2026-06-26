import { describe, expect, it, vi } from "vitest"
import type { Page, SiteGenerationRun } from "@/payload-types"

const matchesWhere = (doc: any, where: any): boolean => {
  if (!where) return true
  if (where.and) return where.and.every((entry: any) => matchesWhere(doc, entry))
  return Object.entries(where).every(([field, condition]) => {
    if (condition && typeof condition === "object" && "equals" in condition) {
      return String(doc[field]) === String((condition as any).equals)
    }
    return doc[field] === condition
  })
}

const createPayloadStub = () => {
  const pages: Page[] = [
    { id: 100, tenant: 1, slug: "index", title: "Home", status: "draft", blocks: [], createdAt: "", updatedAt: "" } as Page,
    { id: 101, tenant: 1, slug: "about", title: "About", status: "draft", blocks: [], createdAt: "", updatedAt: "" } as Page,
    { id: 102, tenant: 1, slug: "stale-retained", title: "Retained", status: "draft", blocks: [], createdAt: "", updatedAt: "" } as Page,
    { id: 200, tenant: 2, slug: "other", title: "Other tenant", status: "draft", blocks: [], createdAt: "", updatedAt: "" } as Page,
  ]
  const generationRuns: SiteGenerationRun[] = [
    {
      id: 500,
      intakeSubmission: 400,
      status: "preview_ready",
      idempotencyKey: "run-500",
      normalizedIntake: {},
      normalizedIntakeHash: "normalized",
      provider: "mock",
      model: "fixture",
      promptVersion: "site-generation-v1",
      generationInputHash: "input",
      clientApproval: { status: "approved" },
      tenant: 1,
      pages: [100, 101],
      applyResult: { ok: true },
      createdAt: "",
      updatedAt: "",
    } as SiteGenerationRun,
  ]
  const payload = {
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection !== "site-generation-runs") throw new Error(`Unexpected findByID ${collection}`)
      const run = generationRuns.find((doc) => String(doc.id) === String(id))
      if (!run) throw new Error(`Missing run ${id}`)
      return run
    }),
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection !== "pages") return { docs: [], totalDocs: 0 }
      const docs = pages.filter((page) => matchesWhere(page, where))
      return { docs, totalDocs: docs.length }
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      if (collection === "pages") {
        const page = pages.find((doc) => String(doc.id) === String(id))
        if (!page) throw new Error(`Missing page ${id}`)
        Object.assign(page, data)
        return page
      }
      if (collection === "site-generation-runs") {
        const run = generationRuns.find((doc) => String(doc.id) === String(id))
        if (!run) throw new Error(`Missing run ${id}`)
        Object.assign(run, data)
        return run
      }
      throw new Error(`Unexpected update ${collection}`)
    }),
  }
  return { payload: payload as any, pages, generationRuns }
}

describe("promoteGenerationRunPages", () => {
  it("bulk promotes approved pages linked to the selected generation run", async () => {
    const { promoteGenerationRunPages } = await import("@/lib/site-generation/promoteGenerationRunPages")
    const { payload, pages, generationRuns } = createPayloadStub()

    const result = await promoteGenerationRunPages(payload, 500, { promotedBy: 7 })

    expect(result.promotedPageIds.map(String)).toEqual(["100", "101"])
    expect(pages.find((page) => page.id === 100)?.status).toBe("published")
    expect(pages.find((page) => page.id === 101)?.status).toBe("published")
    expect(pages.find((page) => page.id === 102)?.status).toBe("draft")
    expect(pages.find((page) => page.id === 200)?.status).toBe("draft")
    expect(generationRuns[0]!.applyResult).toMatchObject({
      ok: true,
      promotion: {
        status: "promoted",
        promotedBy: 7,
        promotedPageIds: ["100", "101"],
      },
    })
    const pageUpdates = payload.update.mock.calls.filter(([args]: any[]) => args.collection === "pages")
    expect(pageUpdates.every(([args]: any[]) => args.context?.skipProjection === true)).toBe(true)
  })

  it("does not promote stale pages retained after a changed generation spec", async () => {
    const { promoteGenerationRunPages } = await import("@/lib/site-generation/promoteGenerationRunPages")
    const { payload, pages, generationRuns } = createPayloadStub()
    generationRuns[0]!.pages = [100]
    pages.find((page) => page.id === 102)!.status = "published"

    const result = await promoteGenerationRunPages(payload, 500)

    expect(result.promotedPageIds.map(String)).toEqual(["100"])
    expect(pages.find((page) => page.id === 101)?.status).toBe("draft")
    expect(pages.find((page) => page.id === 102)?.status).toBe("published")
    const promotedPageUpdateIds = payload.update.mock.calls
      .filter(([args]: any[]) => args.collection === "pages")
      .map(([args]: any[]) => String(args.id))
    expect(promotedPageUpdateIds).toEqual(["100"])
  })

  it("fails when a selected run references a missing linked page", async () => {
    const { promoteGenerationRunPages } = await import("@/lib/site-generation/promoteGenerationRunPages")
    const { payload, pages, generationRuns } = createPayloadStub()
    generationRuns[0]!.pages = [100, 999]

    await expect(promoteGenerationRunPages(payload, 500)).rejects.toThrow("missing linked pages: 999")
    expect(pages.find((page) => page.id === 100)?.status).toBe("draft")
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("fails when the selected run has no linked pages", async () => {
    const { promoteGenerationRunPages } = await import("@/lib/site-generation/promoteGenerationRunPages")
    const { payload, generationRuns } = createPayloadStub()
    generationRuns[0]!.pages = []

    await expect(promoteGenerationRunPages(payload, 500)).rejects.toThrow("no linked pages")
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("requires client approval before promotion", async () => {
    const { promoteGenerationRunPages } = await import("@/lib/site-generation/promoteGenerationRunPages")
    const { payload, generationRuns } = createPayloadStub()
    generationRuns[0]!.clientApproval = { status: "pending" }

    await expect(promoteGenerationRunPages(payload, 500)).rejects.toThrow("client approval")
    expect(payload.update).not.toHaveBeenCalled()
  })
})
