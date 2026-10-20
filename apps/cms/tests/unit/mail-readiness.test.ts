import { describe, expect, it, vi } from "vitest"
import { inspectMailConfiguration } from "@/lib/email/configuration"

describe("configuration-only mail readiness", () => {
  it("reports absent configuration without connecting or exposing values", () => {
    expect(inspectMailConfiguration({})).toEqual({ status: "not_ready", provider: null, issues: ["MAIL_TRANSPORT_NOT_CONFIGURED"], deliveryVerified: false })
  })

  it("selects REST before SMTP and makes no readiness message or provider request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    try {
      const result = inspectMailConfiguration({ CLOUDFLARE_ACCOUNT_ID: "fixture-account", CLOUDFLARE_EMAIL_API_TOKEN: "synthetic-api-secret", CLOUDFLARE_EMAIL_SMTP_TOKEN: "synthetic-smtp-secret", EMAIL_FROM: "Platform <sender@example.test>" })
      expect(result).toEqual({ status: "configured", provider: "cloudflare-rest", issues: [], deliveryVerified: false })
      expect(JSON.stringify(result)).not.toMatch(/synthetic|sender@example|fixture-account/)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally { fetchSpy.mockRestore() }
  })

  it("keeps SMTP fallback available when the DNS account exists without a mail API token", () => {
    expect(inspectMailConfiguration({ CLOUDFLARE_ACCOUNT_ID: "dns-account", CLOUDFLARE_EMAIL_SMTP_TOKEN: "synthetic-smtp-secret" }).provider).toBe("cloudflare-smtp")
  })

  it("returns actionable names for invalid configuration without echoing credentials", () => {
    const result = inspectMailConfiguration({ EMAIL_FROM: "bad\r\nsecret-content", CLOUDFLARE_EMAIL_API_TOKEN: "<private-placeholder>", SIAB_MAIL_SEND_TIMEOUT_MS: "invalid-secret" })
    expect(result.status).toBe("not_ready")
    expect(result.issues).toContain("EMAIL_FROM_INVALID")
    expect(result.issues).toContain("CLOUDFLARE_EMAIL_API_TOKEN_OR_ACCOUNT_ID_INVALID")
    expect(result.issues).toContain("SIAB_MAIL_SEND_TIMEOUT_MS_INVALID")
    expect(JSON.stringify(result)).not.toMatch(/secret-content|private-placeholder|invalid-secret/)
  })
})
