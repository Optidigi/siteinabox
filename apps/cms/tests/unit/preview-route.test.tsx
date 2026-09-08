import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: new Headers({
    host: "admin.siteinabox.nl",
    "x-forwarded-proto": "https",
  }),
  getSession: vi.fn(),
  getPreviewCustomizerDataForGrant: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      loginTitle: "Preview login",
      loginDescription: "Enter the email address from your preview invitation.",
      sendMagicLink: "Send magic link",
    }
    return messages[key] ?? key
  }),
}))

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const messages: Record<string, string> = {
      accessUnavailable: "Access unavailable",
      email: "Email",
      emailSent: "Email sent",
      sendMagicLink: "Send magic link",
    }
    return messages[key] ?? key
  }),
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found")
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`)
  }),
}))

vi.mock("@/lib/preview/betterAuth", () => ({
  previewAuth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

vi.mock("@/lib/preview/customizer", () => ({
  getPreviewCustomizerDataForGrant: mocks.getPreviewCustomizerDataForGrant,
}))

describe("preview host route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue(null)
  })

  it("redirects unauthenticated customer preview visits to the login-first builder", async () => {
    const { renderPreviewRoute } = await import("@/lib/preview/renderPreviewRoute")

    await expect(renderPreviewRoute({ clientSlug: "preview-studio" })).rejects.toThrow(
      "redirect:/builder/preview-studio",
    )
    expect(mocks.getPreviewCustomizerDataForGrant).not.toHaveBeenCalled()
  })
})
