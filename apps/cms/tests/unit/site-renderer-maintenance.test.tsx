import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { LegalDocumentPage, SitePageRenderer, v1FixturePage, v1FixtureSettings } from "@siteinabox/site-renderer"
import type { SiteSettings, TenantPrivacyDisclosure } from "@siteinabox/contracts"

const legalDocument: TenantPrivacyDisclosure = {
  enabled: true,
  mode: "custom",
  title: "Privacy- en cookieverklaring",
  body: { t: "root", variant: "block", children: [{ t: "paragraph", children: [{ t: "text", v: "Eigen document." }] }] },
  version: "test-1",
  effectiveAt: "2026-08-25T00:00:00.000Z",
  controller: { legalName: "Voorbeeld B.V.", email: "privacy@example.test" },
}

describe("first-party site renderer shell", () => {
  it("renders the configured navbar and first-party footer", () => {
    const html = renderToStaticMarkup(
      <SitePageRenderer page={{ ...v1FixturePage, blocks: [] }} settings={v1FixtureSettings} />,
    )
    expect(html).toContain("data-siab-site-renderer")
    expect(html).toContain("data-siab-navbar-frame")
    expect(html).toContain('data-siab-footer="true"')
    expect(html).toContain('data-footer-variant="footer-01"')
    expect(html).toContain("Footer navigation")
    expect(html).not.toContain("data-siab-cookie-consent")
    expect(html).not.toContain("data-system-template")
  })

  it("renders the settings-owned legal document separately from page blocks", () => {
    const settings: SiteSettings = {
      ...v1FixtureSettings,
      privacyDisclosure: legalDocument,
    }
    const html = renderToStaticMarkup(
      <LegalDocumentPage document={settings.privacyDisclosure!} />,
    )
    expect(html).toContain("data-siab-legal-document")
    expect(html).toContain("Privacy- en cookieverklaring")
    expect(html).toContain("Eigen document.")
    expect(html).not.toContain('data-block-type="richText"')
  })
})
