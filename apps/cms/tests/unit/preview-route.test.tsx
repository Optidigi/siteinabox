import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: new Headers({
    host: "preview.siteinabox.nl",
    "x-forwarded-proto": "https",
  }),
  getSession: vi.fn(),
  getPreviewCustomizerDataForGrant: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mocks.headers),
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found")
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

  it("shows the request magic-link screen for unauthenticated direct visits", async () => {
    const { renderPreviewRoute } = await import("@/lib/preview/renderPreviewRoute")

    const element = await renderPreviewRoute({ clientSlug: "preview-studio" })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Preview login")
    expect(html).toContain("Enter the email address from your preview invitation.")
    expect(html).toContain("Send magic link")
    expect(mocks.getPreviewCustomizerDataForGrant).not.toHaveBeenCalled()
  })
})
