import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resolveBaseURL } from "better-auth"

vi.mock("@/lib/email/sendEmail", () => ({
  sendEmail: vi.fn(),
}))

vi.mock("@/lib/preview/previewAccess", () => ({
  hasActivePreviewGrant: vi.fn(),
}))

describe("preview Better Auth host configuration", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URI: "postgres://payload:payload@localhost:5432/payload",
      PAYLOAD_SECRET: "test-secret",
      NODE_ENV: "production",
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllEnvs()
  })

  it("uses only the public preview host in production", async () => {
    const { getPreviewBetterAuthBaseURL, getPreviewTrustedOrigins } = await import("@/lib/preview/betterAuth")

    expect(getPreviewBetterAuthBaseURL()).toEqual({
      allowedHosts: ["preview.siteinabox.nl"],
      protocol: "https",
      fallback: "https://preview.siteinabox.nl",
    })
    expect(getPreviewTrustedOrigins()).toEqual(["https://preview.siteinabox.nl"])
    const headers = new Headers({
      host: "preview.siteinabox.nl",
      "x-forwarded-host": "preview.siteinabox.nl",
      "x-forwarded-proto": "https",
    })
    expect(resolveBaseURL(getPreviewBetterAuthBaseURL(), "/api/preview-auth", headers, false, true)).toBe(
      "https://preview.siteinabox.nl/api/preview-auth",
    )
  })

  it("adds loopback preview hosts only in development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { getPreviewBetterAuthBaseURL, getPreviewTrustedOrigins } = await import("@/lib/preview/betterAuth")

    expect(getPreviewBetterAuthBaseURL()).toEqual({
      allowedHosts: [
        "preview.siteinabox.nl",
        "localhost:*",
        "127.0.0.1:*",
        "*.localhost:*",
        "*.lvh.me:*",
        "*.localtest.me:*",
      ],
      protocol: "http",
      fallback: "https://preview.siteinabox.nl",
    })
    expect(getPreviewTrustedOrigins()).toEqual([
      "https://preview.siteinabox.nl",
      "http://localhost:*",
      "https://localhost:*",
      "http://127.0.0.1:*",
      "https://127.0.0.1:*",
      "http://*.localhost:*",
      "https://*.localhost:*",
      "http://*.lvh.me:*",
      "https://*.lvh.me:*",
      "http://*.localtest.me:*",
      "https://*.localtest.me:*",
    ])
  })
})
