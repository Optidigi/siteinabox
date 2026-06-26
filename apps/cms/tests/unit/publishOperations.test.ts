import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  payload: {
    findByID: vi.fn(),
    find: vi.fn(),
  },
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

const matchesWhere = (doc: any, where: any): boolean => {
  if (!where) return true
  if (where.and) return where.and.every((entry: any) => matchesWhere(doc, entry))
  return Object.entries(where).every(([field, condition]) => {
    if (condition && typeof condition === "object" && "equals" in condition) {
      return String(doc[field]) === String((condition as any).equals)
    }
    if (condition && typeof condition === "object" && "in" in condition) {
      return (condition as any).in.map(String).includes(String(doc[field]))
    }
    return doc[field] === condition
  })
}

describe("publish operations lifecycle query", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("treats cross-tenant linked pages as missing for publish readiness", async () => {
    const tenant = {
      id: 1,
      status: "provisioning",
      activeSnapshot: null,
      domainVerification: { status: "verified" },
    }
    const pages = [
      { id: 100, tenant: 1, title: "Home", slug: "index", status: "published" },
      { id: 200, tenant: 2, title: "Other tenant", slug: "other", status: "published" },
    ]
    mocks.payload.findByID.mockResolvedValue(tenant)
    mocks.payload.find.mockImplementation(async ({ collection, where }: any) => {
      if (collection === "published-site-snapshots") return { docs: [] }
      if (collection === "pages") return { docs: pages.filter((page) => matchesWhere(page, where)) }
      return { docs: [] }
    })
    const { getSnapshotLifecycleForGenerationRun } = await import("@/lib/queries/publishOperations")

    const lifecycle = await getSnapshotLifecycleForGenerationRun({
      tenant: 1,
      pages: [100, 200],
      clientApproval: { status: "approved" },
      payment: { status: "completed" },
    } as any)

    expect(lifecycle.linkedPages.map((page) => page.id)).toEqual(["100"])
    expect(lifecycle.publishBlockers).toContain("All pages linked to this run must be promoted to CMS published before snapshot publish.")
  })

  it("reports a stale tenant relationship as a lifecycle blocker", async () => {
    mocks.payload.findByID.mockRejectedValue(new Error("missing tenant"))
    const { getSnapshotLifecycleForGenerationRun } = await import("@/lib/queries/publishOperations")

    const lifecycle = await getSnapshotLifecycleForGenerationRun({ tenant: 999, pages: [] } as any)

    expect(lifecycle.tenant).toBeNull()
    expect(lifecycle.publishBlockers).toEqual(["Generation run linked tenant was not found."])
    expect(lifecycle.manualBlockers).toEqual(["Generation run linked tenant was not found."])
  })
})
