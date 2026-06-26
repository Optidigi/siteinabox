import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Page, SiteGenerationRun, Tenant } from "@/payload-types"
import { signPreviewToken } from "@/lib/preview/sign"

const SECRET = "test-secret-32-bytes-deadbeefcafe1234567890"

const mocks = vi.hoisted(() => ({
  payload: {
    findByID: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
  },
  settingsDoc: {
    id: 10,
    tenant: 1,
    siteName: "Preview Studio",
    siteUrl: "https://preview.test",
    language: "en",
    updatedAt: "2026-06-25T20:00:00.000Z",
  },
}))

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => mocks.payload),
}))

vi.mock("@/payload.config", () => ({
  default: {},
}))

vi.mock("@/lib/queries/settings", () => ({
  getOrCreateSiteSettings: vi.fn(async () => mocks.settingsDoc),
}))

vi.mock("@/lib/editor/loadTenantCss", () => ({
  loadTenantCss: vi.fn(async () => ".rt-canvas{color:var(--color-ink)}"),
}))

vi.mock("@/lib/projection/pageToJson", () => ({
  pageToJson: vi.fn((page: Page) => ({
    id: String(page.id),
    slug: page.slug,
    title: page.title,
    status: page.status,
    blocks: [],
    updatedAt: page.updatedAt,
  })),
}))

vi.mock("@/lib/projection/settingsToJson", () => ({
  settingsToJson: vi.fn((settings: typeof mocks.settingsDoc) => ({
    siteName: settings.siteName,
    siteUrl: settings.siteUrl,
    language: settings.language,
    updatedAt: settings.updatedAt,
  })),
}))

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

const createState = () => {
  const tenant = {
    id: 1,
    name: "Preview Studio",
    slug: "preview-studio",
    domain: "preview.test",
    status: "provisioning",
    siteManifest: null,
    theme: null,
    createdAt: "2026-06-25T19:00:00.000Z",
    updatedAt: "2026-06-25T19:00:00.000Z",
  } as Tenant
  const pages = [
    {
      id: 100,
      tenant: 1,
      slug: "index",
      title: "Home",
      status: "draft",
      blocks: [],
      createdAt: "2026-06-25T19:01:00.000Z",
      updatedAt: "2026-06-25T19:01:00.000Z",
    },
    {
      id: 101,
      tenant: 1,
      slug: "about",
      title: "About",
      status: "draft",
      blocks: [],
      createdAt: "2026-06-25T19:02:00.000Z",
      updatedAt: "2026-06-25T19:02:00.000Z",
    },
  ] as Page[]
  const runs = [
    {
      id: 500,
      intakeSubmission: 400,
      status: "preview_ready",
      idempotencyKey: "preview-run",
      normalizedIntake: {},
      normalizedIntakeHash: "normalized",
      provider: "mock",
      model: "fixture",
      promptVersion: "site-generation-v1",
      generationInputHash: "input",
      tenant: 1,
      pages: [100],
      createdAt: "2026-06-25T19:03:00.000Z",
      updatedAt: "2026-06-25T19:03:00.000Z",
    } as SiteGenerationRun,
  ]

  mocks.payload.findByID.mockImplementation(async ({ collection, id }: any) => {
    if (collection === "tenants" && String(id) === "1") return tenant
    throw new Error(`Missing ${collection} ${id}`)
  })
  mocks.payload.find.mockImplementation(async ({ collection, where }: any) => {
    if (collection === "pages") {
      const docs = pages.filter((page) => matchesWhere(page, where))
      return { docs, totalDocs: docs.length }
    }
    if (collection === "site-generation-runs") {
      const docs = runs.filter((run) => matchesWhere(run, where))
      return { docs, totalDocs: docs.length }
    }
    return { docs: [], totalDocs: 0 }
  })
  mocks.payload.update.mockImplementation(async ({ collection, id, data }: any) => {
    if (collection === "tenants") {
      Object.assign(tenant, data)
      return { ...tenant, id }
    }
    if (collection === "site-generation-runs") {
      const run = runs.find((entry) => String(entry.id) === String(id))
      if (!run) throw new Error(`Missing run ${id}`)
      Object.assign(run, data)
      return run
    }
    throw new Error(`Unexpected update ${collection}`)
  })

  return { tenant, pages, runs }
}

const tokenFor = (tenantId: number | string, pageId: number | string) =>
  signPreviewToken({ tenantId, pageId }, SECRET).token

describe("preview customizer service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PREVIEW_HMAC_SECRET = SECRET
    createState()
  })

  it("loads preview data with page navigation, token expiry, persisted theme, approval, and payment state", async () => {
    const { tenant, runs } = createState()
    tenant.theme = { density: "compact", palette: { accent: "#0f766e" } } as any
    runs[0]!.clientApproval = { status: "pending" } as any
    runs[0]!.payment = { status: "not_started" } as any
    const { getPreviewCustomizerData } = await import("@/lib/preview/customizer")

    const data = await getPreviewCustomizerData(tokenFor(1, 100), "about")

    expect(data.token).toEqual(expect.any(String))
    expect(data.tokenExp).toEqual(expect.any(Number))
    expect(data.pages).toEqual([
      { id: 100, slug: "index", title: "Home" },
      { id: 101, slug: "about", title: "About" },
    ])
    expect(data.currentPage.slug).toBe("about")
    expect(data.theme).toEqual({ density: "compact", palette: { accent: "#0f766e" } })
    expect(data.approval).toEqual({ status: "pending" })
    expect(data.payment).toEqual({ status: "not_started" })
  })

  it("rejects a token whose claimed persisted page is not in the tenant", async () => {
    const { getPreviewCustomizerData } = await import("@/lib/preview/customizer")

    await expect(getPreviewCustomizerData(tokenFor(1, 999))).rejects.toThrow("Preview page is not available")
  })

  it("rejects a requested page path that is not in the token tenant", async () => {
    const { getPreviewCustomizerData } = await import("@/lib/preview/customizer")

    await expect(getPreviewCustomizerData(tokenFor(1, 100), "missing")).rejects.toThrow("Preview page is not available")
  })

  it("rejects suspended or archived tenants before preview writes", async () => {
    const { tenant } = createState()
    tenant.status = "suspended"
    const { persistPreviewTheme, approvePreview } = await import("@/lib/preview/customizer")

    await expect(persistPreviewTheme(tokenFor(1, 100), { density: "compact" })).rejects.toThrow("Preview tenant is not available")
    await expect(approvePreview(tokenFor(1, 100))).rejects.toThrow("Preview tenant is not available")
    expect(mocks.payload.update).not.toHaveBeenCalled()
  })

  it("persists only schema-approved theme tokens including density and style preset", async () => {
    const { persistPreviewTheme } = await import("@/lib/preview/customizer")

    const saved = await persistPreviewTheme(tokenFor(1, 100), {
      palette: { accent: "#0f766e" },
      fonts: { title: "Inter" },
      radius: "0.5rem",
      density: "spacious",
      stylePreset: "warm-care",
    })

    expect(saved).toEqual({
      palette: { accent: "#0f766e" },
      fonts: { title: "Inter" },
      radius: "0.5rem",
      density: "spacious",
      stylePreset: "warm-care",
    })
    expect(mocks.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "tenants",
      id: 1,
      data: { theme: saved },
    }))

    mocks.payload.update.mockClear()
    await expect(persistPreviewTheme(tokenFor(1, 100), { stylePreset: "bad;}" } as any)).rejects.toThrow("Invalid theme data")
    expect(mocks.payload.update).not.toHaveBeenCalled()
  })

  it("records approval and pending payment handoff without activating or publishing", async () => {
    const { approvePreview } = await import("@/lib/preview/customizer")

    const result = await approvePreview(tokenFor(1, 100))

    expect(result.approval.status).toBe("approved")
    expect(result.payment.status).toBe("pending_provider")
    expect(mocks.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "site-generation-runs",
      id: 500,
      data: expect.objectContaining({
        clientApproval: expect.objectContaining({ status: "approved" }),
        payment: expect.objectContaining({ status: "pending_provider" }),
      }),
    }))
    expect(mocks.payload.update).not.toHaveBeenCalledWith(expect.objectContaining({
      collection: "tenants",
      data: expect.objectContaining({ status: "active" }),
    }))
  })

  it("does not downgrade an already completed payment when approval is recorded", async () => {
    const { runs } = createState()
    runs[0]!.payment = {
      status: "completed",
      provider: "invoice",
      externalReference: "ref-123",
      actor: 42,
      completedAt: "2026-06-26T10:00:00.000Z",
      waivedAt: null,
      updatedAt: "2026-06-26T10:00:00.000Z",
      note: "Paid before approval",
    } as any
    const { approvePreview } = await import("@/lib/preview/customizer")

    const result = await approvePreview(tokenFor(1, 100))

    expect(result.payment).toMatchObject({
      status: "completed",
      provider: "invoice",
      externalReference: "ref-123",
      actor: 42,
    })
    expect(mocks.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "site-generation-runs",
      id: 500,
      data: expect.objectContaining({
        payment: expect.objectContaining({ status: "completed" }),
      }),
    }))
  })

  it("does not let a token for a page outside the preview-ready run approve that run", async () => {
    const { approvePreview } = await import("@/lib/preview/customizer")

    await expect(approvePreview(tokenFor(1, 101))).rejects.toThrow("Preview generation run does not include this page")
  })
})
