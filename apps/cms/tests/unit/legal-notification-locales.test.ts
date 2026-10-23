import { describe, expect, it } from "vitest"
import { legalNotificationTemplateVersion, LEGAL_REACCEPTANCE_TEMPLATE_VERSION, legalContinuedUseNoticeTemplate, legalReacceptanceTemplate } from "@/lib/email/templates/legalReacceptance"

describe("immutable legal notification locales", () => {
  it("preserves the legacy Dutch version and gives English its own frozen version", () => {
    expect(legalNotificationTemplateVersion("nl")).toBe(LEGAL_REACCEPTANCE_TEMPLATE_VERSION)
    expect(legalNotificationTemplateVersion("en")).not.toBe(LEGAL_REACCEPTANCE_TEMPLATE_VERSION)
    expect(() => legalNotificationTemplateVersion("fr")).toThrow(/Unsupported/)
    const email = legalReacceptanceTemplate({ locale: "en", tenantName: "Synthetic\r\nBcc: forbidden", changeSummary: "Synthetic policy update",
      documentVersion: "2026-10-23.99", effectiveAt: "2026-11-23T00:00:00Z", settingsUrl: "https://cms.test/settings",
      documentUrl: "https://cms.test/policies/en/platform-terms/2026-10-23.99", mandatory: true })
    expect(email.subject).not.toMatch(/[\r\n]/)
    expect(email.text).toContain("publication remains blocked")
    expect(email.text).toContain("/policies/en/platform-terms/2026-10-23.99")
    expect(email.html).toContain('lang="en"')
  })
  it("preserves full English change text and the objection deadline", () => {
    const email = legalContinuedUseNoticeTemplate({ locale: "en", tenantName: "Synthetic", changeSummary: "Notice",
      effectiveAt: "2026-11-23T00:00:00Z", objectionDeadlineAt: "2026-11-23T00:00:00Z", documentUrl: "https://cms.test/policies/en/platform-terms/2026-10-23.99",
      settingsUrl: "https://cms.test/settings", documentContent: "FULL SYNTHETIC CHANGE <not markup>" })
    expect(email.text).toContain("FULL SYNTHETIC CHANGE <not markup>")
    expect(email.text).toContain("Object before:")
    expect(email.html).toContain("&lt;not markup&gt;")
  })
})
