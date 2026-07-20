import { beforeEach, describe, expect, it, vi } from "vitest"

import { asMockDoc } from "../_helpers/cast"
import { matchesWhere, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockFindByIdArgs, type MockUpdateArgs } from "../_helpers/mockPayload"

const mocks = vi.hoisted(() => ({
  payload: {
    find: vi.fn(),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

const createState = () => {
  const tenant = {
    id: 1,
    name: "Preview Studio",
    slug: "preview-studio-company",
    domain: "preview-studio.nl",
    status: "provisioning",
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
  }
  const otherTenant = {
    id: 2,
    name: "Other Tenant",
    slug: "other-tenant",
    domain: "other-tenant.nl",
    status: "provisioning",
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
  }
  const pages = [
    { id: 100, tenant: 1, slug: "index", title: "Home", createdAt: "", updatedAt: "" },
    { id: 101, tenant: 1, slug: "about", title: "About", createdAt: "", updatedAt: "" },
    { id: 200, tenant: 2, slug: "index", title: "Other Home", createdAt: "", updatedAt: "" },
  ]
  const run = {
    id: 500,
    tenant,
    pages: [100, 101],
    status: "preview_ready",
    intakeSubmission: 400,
    idempotencyKey: "preview-run",
    normalizedIntake: {},
    normalizedIntakeHash: "normalized",
    provider: "mock",
    model: "fixture",
    promptVersion: "site-generation-v1",
    generationInputHash: "input",
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
  }
  const grants: MockDoc[] = [{
    id: 900,
    customerEmail: "customer@example.com",
    tenant,
    generationRun: 500,
    clientSlug: "preview-studio",
    pages: [100],
    expiresAt: "2026-06-27T10:00:00.000Z",
    revokedAt: null,
    sentCount: 1,
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
  }]

  mocks.payload.find.mockImplementation(async ({ collection, where }: MockFindArgs) => {
    if (collection === "preview-access-grants") {
      const docs = grants.filter((grant) => matchesWhere(grant, where))
      return { docs, totalDocs: docs.length }
    }
    if (collection === "pages") {
      const docs = pages.filter((page) => matchesWhere(asMockDoc(page), where))
      return { docs, totalDocs: docs.length }
    }
    return { docs: [], totalDocs: 0 }
  })
  mocks.payload.findByID.mockImplementation(async ({ collection, id }: MockFindByIdArgs) => {
    if (collection === "site-generation-runs" && String(id) === "500") return run
    if (collection === "tenants" && String(id) === "1") return tenant
    if (collection === "tenants" && String(id) === "2") return otherTenant
    if (collection === "preview-access-grants") {
      const grant = grants.find((entry) => String(entry.id) === String(id))
      if (!grant) throw new Error(`Missing ${collection} ${id}`)
      return grant
    }
    throw new Error(`Missing ${collection} ${id}`)
  })
  mocks.payload.create.mockImplementation(async ({ data }: MockCreateArgs) => ({ id: 901, ...data }))
  mocks.payload.update.mockImplementation(async ({ id, data }: MockUpdateArgs) => {
    const grant = grants.find((entry) => String(entry.id) === String(id)) ?? grants[0]
    if (!grant) throw new Error(`Missing preview-access-grants ${id}`)
    Object.assign(grant, data)
    return { id, ...grant, ...data }
  })

  return { tenant, pages, run, grants }
}

describe("preview access grants", () => {
  const previewNow = new Date("2026-06-26T12:00:00.000Z")

  beforeEach(() => {
    vi.clearAllMocks()
    createState()
  })

  it("authorizes the correct customer for only the granted slug and pages", async () => {
    const { loadPreviewGrantContext } = await import("@/lib/preview/previewAccess")

    const context = await loadPreviewGrantContext({
      clientSlug: "preview-studio",
      email: "Customer@Example.com",
      pageSlug: "index",
      now: previewNow,
    })

    expect(context.customerEmail).toBe("customer@example.com")
    expect(context.tenant.id).toBe(1)
    expect(context.run.id).toBe(500)
    expect(context.pages.map((page) => page.id)).toEqual([100])
  })

  it("blocks wrong email, wrong slug, expired grants, revoked grants, and suspended tenants", async () => {
    const { tenant, grants } = createState()
    const { loadPreviewGrantContext } = await import("@/lib/preview/previewAccess")

    await expect(loadPreviewGrantContext({ clientSlug: "preview-studio", email: "wrong@example.com", now: previewNow }))
      .rejects.toThrow("Preview access is not available")
    await expect(loadPreviewGrantContext({ clientSlug: "other-tenant", email: "customer@example.com", now: previewNow }))
      .rejects.toThrow("Preview access is not available")

    grants[0]!.expiresAt = "2026-06-25T10:00:00.000Z"
    await expect(loadPreviewGrantContext({ clientSlug: "preview-studio", email: "customer@example.com", now: previewNow }))
      .rejects.toThrow("Preview access is not available")

    grants[0]!.expiresAt = "2026-06-27T10:00:00.000Z"
    grants[0]!.revokedAt = "2026-06-26T11:00:00.000Z"
    await expect(loadPreviewGrantContext({ clientSlug: "preview-studio", email: "customer@example.com", now: previewNow }))
      .rejects.toThrow("Preview access is not available")

    grants[0]!.revokedAt = null
    tenant.status = "suspended"
    await expect(loadPreviewGrantContext({ clientSlug: "preview-studio", email: "customer@example.com", now: previewNow }))
      .rejects.toThrow("Preview tenant is not available")
  })

  it("blocks pages outside the grant and does not expose another tenant draft", async () => {
    const { loadPreviewGrantContext } = await import("@/lib/preview/previewAccess")

    await expect(loadPreviewGrantContext({
      clientSlug: "preview-studio",
      email: "customer@example.com",
      pageSlug: "about",
      now: previewNow,
    })).rejects.toThrow("Preview page is not available")
  })

  it("creates or refreshes preview grants from preview-ready generation runs", async () => {
    const { createOrRefreshPreviewGrant } = await import("@/lib/preview/previewAccess")

    const grant = await createOrRefreshPreviewGrant({
      generationRunId: 500,
      customerEmail: "Customer@Example.com",
      sendEmail: true,
    })

    expect(grant.clientSlug).toBe("preview-studio")
    expect(grant.clientSlug).not.toBe("preview-studio-company")
    expect(mocks.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "preview-access-grants",
      data: expect.objectContaining({
        clientSlug: "preview-studio",
        pages: [100, 101],
        revokedAt: null,
        sentCount: 2,
      }),
    }))
  })
})
