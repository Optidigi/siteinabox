import { beforeEach, describe, expect, it, vi } from "vitest"
import { createTestPayload } from "../_helpers/testPayload"
import { tenantFixture, pageFixture, generationRunFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { getPayload } from "payload"

vi.mock("payload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("payload")>()
  return { ...actual, getPayload: vi.fn() }
})

vi.mock("@/payload.config", () => ({
  default: {},
}))

describe("publish operations lifecycle query", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("treats cross-tenant linked pages as missing for publish readiness", async () => {
    const payload = createTestPayload()
    vi.mocked(getPayload).mockResolvedValue(payload)
    const tenant = tenantFixture({
      id: 1,
      status: "provisioning",
      activeSnapshot: null,
      domainVerification: { status: "verified" },
    })
    const page = pageFixture({ id: 100, tenant: 1, title: "Home", slug: "index", status: "published" })
    vi.spyOn(payload, "findByID").mockResolvedValue(tenant)
    const find = vi.spyOn(payload, "find")
      .mockResolvedValueOnce(paginatedFixture([]))
      .mockResolvedValueOnce(paginatedFixture([page]))
    const { getSnapshotLifecycleForGenerationRun } = await import("@/lib/queries/publishOperations")

    const lifecycle = await getSnapshotLifecycleForGenerationRun(generationRunFixture({
      tenant: 1,
      pages: [100, 200],
      clientApproval: { status: "approved" },
      payment: { status: "completed" },
    }))

    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "pages", where: { and: [{ id: { in: ["100", "200"] } }, { tenant: { equals: "1" } }] },
    }))
    expect(lifecycle.linkedPages.map((page) => page.id)).toEqual(["100"])
    expect(lifecycle.publishBlockers).toContain("All pages linked to this run must be promoted to CMS published before snapshot publish.")
  })

  it("reports a stale tenant relationship as a lifecycle blocker", async () => {
    const payload = createTestPayload()
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.spyOn(payload, "findByID").mockRejectedValue(new Error("missing tenant"))
    const { getSnapshotLifecycleForGenerationRun } = await import("@/lib/queries/publishOperations")

    const lifecycle = await getSnapshotLifecycleForGenerationRun(generationRunFixture({ tenant: 999, pages: [] }))

    expect(lifecycle.tenant).toBeNull()
    expect(lifecycle.publishBlockers).toEqual(["Generation run linked tenant was not found."])
    expect(lifecycle.manualBlockers).toEqual(["Generation run linked tenant was not found."])
  })
})
