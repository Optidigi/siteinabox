import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import type { Page, SiteGenerationRun, Tenant } from "@/payload-types"

const mocks = vi.hoisted(() => ({
  loadPreviewGrantContext: vi.fn(),
  payload: { update: vi.fn() },
  settingsDoc: {
    id: 10,
    tenant: 1,
    siteName: "Preview Studio",
    siteUrl: "https://preview.test",
    language: "en",
    updatedAt: "2026-06-25T20:00:00.000Z",
  },
}))

vi.mock("@/lib/preview/previewAccess", () => ({
  loadPreviewGrantContext: mocks.loadPreviewGrantContext,
}))

vi.mock("@/lib/queries/settings", () => ({
  getOrCreateSiteSettings: vi.fn(async () => mocks.settingsDoc),
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
  const run = {
    id: 500,
    status: "preview_ready",
    tenant: 1,
    pages: [100, 101],
    clientApproval: { status: "pending" },
    payment: { status: "not_started" },
  } as unknown as SiteGenerationRun

  mocks.payload.update.mockImplementation(async ({ id, data }: any) => ({ id, ...data }))
  mocks.loadPreviewGrantContext.mockResolvedValue({
    clientSlug: "preview-studio",
    customerEmail: "customer@example.com",
    payload: mocks.payload,
    tenant,
    run,
    pages,
  })

  return { tenant, pages, run }
}

describe("grant preview customizer service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createState()
  })

  it("loads preview data with grant-scoped page navigation, theme, approval, and payment state", async () => {
    const { tenant, run } = createState()
    tenant.theme = DEFAULT_THEME_TOKEN_SPEC as any
    run.clientApproval = { status: "pending" } as any
    run.payment = { status: "not_started" } as any
    const { getPreviewCustomizerDataForGrant } = await import("@/lib/preview/customizer")

    const data = await getPreviewCustomizerDataForGrant({
      clientSlug: "preview-studio",
      customerEmail: "customer@example.com",
      requestedPage: "about",
    })

    expect(data.access).toEqual({ type: "grant", clientSlug: "preview-studio" })
    expect(data.pages).toEqual([
      { id: 100, slug: "index", title: "Home" },
      { id: 101, slug: "about", title: "About" },
    ])
    expect(data.currentPage.slug).toBe("about")
    expect(data.theme).toEqual(DEFAULT_THEME_TOKEN_SPEC)
    expect(data.approval).toEqual({ status: "pending" })
    expect(data.payment).toEqual({ status: "not_started" })
  })

  it("persists only schema-approved theme tokens through the grant context", async () => {
    const { persistPreviewThemeForGrant } = await import("@/lib/preview/customizer")
    const theme = {
      version: 3,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    } as const

    const saved = await persistPreviewThemeForGrant({
      clientSlug: "preview-studio",
      customerEmail: "customer@example.com",
      theme,
    })

    expect(saved).toEqual(theme)
    expect(mocks.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "tenants",
      id: 1,
      data: { theme },
    }))

    mocks.payload.update.mockClear()
    await expect(persistPreviewThemeForGrant({
      clientSlug: "preview-studio",
      customerEmail: "customer@example.com",
      theme: { stylePreset: "bad;}" } as any,
    })).rejects.toThrow("Invalid theme data")
    expect(mocks.payload.update).not.toHaveBeenCalled()
  })

  it("records approval and pending payment without activating or publishing", async () => {
    const { approvePreviewForGrant } = await import("@/lib/preview/customizer")

    const result = await approvePreviewForGrant({
      clientSlug: "preview-studio",
      customerEmail: "customer@example.com",
    })

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
    const { run } = createState()
    run.payment = {
      status: "completed",
      provider: "invoice",
      externalReference: "ref-123",
      actor: 42,
      completedAt: "2026-06-26T10:00:00.000Z",
      waivedAt: null,
      updatedAt: "2026-06-26T10:00:00.000Z",
      note: "Paid before approval",
    } as any
    const { approvePreviewForGrant } = await import("@/lib/preview/customizer")

    const result = await approvePreviewForGrant({
      clientSlug: "preview-studio",
      customerEmail: "customer@example.com",
    })

    expect(result.payment).toMatchObject({
      status: "completed",
      provider: "invoice",
      externalReference: "ref-123",
      actor: 42,
    })
  })
})
