import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: new Headers({ host: "preview.siteinabox.nl" }),
  getSession: vi.fn(),
  loadPreviewGrantContext: vi.fn(),
  createMollieCheckoutForGenerationRun: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      checkoutRequiresPreviewAccess: "Customer checkout requires Better Auth preview access.",
      previewLoginRequired: "Preview login required",
    }
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

  it("does not offer customer checkout for legacy token previews", async () => {
    const { createPreviewMollieCheckout } = await import("@/lib/actions/previewCustomizer")

    await expect(createPreviewMollieCheckout({ type: "legacy-token", token: "preview-token", exp: 1 }))
      .rejects.toThrow("Customer checkout requires Better Auth preview access.")

    expect(mocks.loadPreviewGrantContext).not.toHaveBeenCalled()
    expect(mocks.createMollieCheckoutForGenerationRun).not.toHaveBeenCalled()
  })
})
