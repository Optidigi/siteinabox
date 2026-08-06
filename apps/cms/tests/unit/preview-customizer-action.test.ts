import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"

const mocks = vi.hoisted(() => ({
  headers: new Headers({ host: "preview.siteinabox.nl" }),
  getSession: vi.fn(),
  loadPreviewGrantContext: vi.fn(),
  createMollieCheckoutForGenerationRun: vi.fn(),
  persistPreviewThemeForGrant: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = { previewLoginRequired: "Preview login required" }
    return messages[key] ?? key
  }),
}))

vi.mock("@/lib/preview/betterAuth", () => ({
  previewAuth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

vi.mock("@/lib/preview/previewAccess", () => ({
  loadPreviewGrantContext: mocks.loadPreviewGrantContext,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("@/lib/preview/customizer", () => ({
  persistPreviewThemeForGrant: mocks.persistPreviewThemeForGrant,
}))

vi.mock("@/lib/payments/molliePayments", () => ({
  createMollieCheckoutForGenerationRun: mocks.createMollieCheckoutForGenerationRun,
}))

describe("preview customizer actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { email: "Customer@Example.com" } })
    mocks.loadPreviewGrantContext.mockResolvedValue({
      payload: { id: "payload" },
      run: { id: 500 },
      clientSlug: "preview-studio",
    })
    mocks.createMollieCheckoutForGenerationRun.mockResolvedValue({
      checkoutUrl: "https://www.mollie.com/checkout/test",
      payment: { status: "pending_provider", provider: "mollie" },
      reused: false,
    })
    mocks.persistPreviewThemeForGrant.mockResolvedValue({
      version: 3,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })
  })

  it("persists preview theme without revalidating the preview layout", async () => {
    const { setPreviewTheme } = await import("@/lib/actions/previewCustomizer")
    const theme = {
      version: 3,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    } as const

    const saved = await setPreviewTheme({ type: "grant", clientSlug: "preview-studio" }, theme)

    expect(saved).toEqual(theme)
    expect(mocks.persistPreviewThemeForGrant).toHaveBeenCalledWith({
      clientSlug: "preview-studio",
      customerEmail: "Customer@Example.com",
      theme,
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("keeps preview theme saves free of layout revalidation in source", () => {
    const source = readFileSync("src/lib/actions/previewCustomizer.ts", "utf8")
    const setPreviewThemeBody = source.split("export async function setPreviewTheme")[1]?.split("export async function approvePreviewSite")[0] ?? ""

    expect(setPreviewThemeBody).not.toContain("revalidatePath")
  })

  it("starts Mollie checkout from an approved grant preview using the logged-in customer", async () => {
    const { createPreviewMollieCheckout } = await import("@/lib/actions/previewCustomizer")

    const result = await createPreviewMollieCheckout({ type: "grant", clientSlug: "preview-studio" })

    expect(result).toEqual({
      checkoutUrl: "https://www.mollie.com/checkout/test",
      payment: { status: "pending_provider", provider: "mollie" },
      reused: false,
    })
    expect(mocks.loadPreviewGrantContext).toHaveBeenCalledWith({
      clientSlug: "preview-studio",
      email: "Customer@Example.com",
    })
    expect(mocks.createMollieCheckoutForGenerationRun).toHaveBeenCalledWith(
      { id: "payload" },
      {
        runId: 500,
        customerEmail: "Customer@Example.com",
        clientSlug: "preview-studio",
        actor: "Customer@Example.com",
      },
    )
  })
})
