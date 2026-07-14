import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { emailTheme } from "@/lib/email/emailTheme"
import { cleanEmailHeaderText } from "@/lib/email/templateUtils"
import { magicLinkTemplate } from "@/lib/email/templates/magicLink"
import { siteReadyPreviewTemplate } from "@/lib/email/templates/siteReadyPreview"

describe("shared email template safety", () => {
  it("uses the real SIAB logo and keeps customer-facing shell copy in Dutch", () => {
    const message = magicLinkTemplate({ loginUrl: "https://admin.example.nl/login" })

    expect(message.html).toContain('src="https://admin.siteinabox.nl/logos/email-logo.png"')
    expect(message.html).toContain('alt="Site in a Box"')
    expect(message.html).toContain("Log in bij Site in a Box")
    expect(message.html).not.toContain("Sign in")
  })

  it("matches the public Site in a Box typography and primary CTA styling", () => {
    const message = magicLinkTemplate({ loginUrl: "https://admin.example.nl/login" })

    expect(message.html).toContain("family=Chivo:wght@400;500;600;700;900")
    expect(message.html).toContain("family=Familjen+Grotesk:wght@400;500;600;700")
    expect(emailTheme.bodyFont).toBe("Chivo,system-ui,-apple-system,sans-serif")
    expect(emailTheme.headingFont).toBe("'Familjen Grotesk Email','Familjen Grotesk',system-ui,-apple-system,sans-serif")
    expect(emailTheme.headingWeight).toBe(700)
    expect(emailTheme.buttonFont).toBe("Chivo,sans-serif")
    expect(message.html).toContain("font-family:'Familjen Grotesk Email','Familjen Grotesk',system-ui,-apple-system,sans-serif;font-size:26px;font-weight:700;letter-spacing:-.01em")
    expect(message.html).toContain("font-family:'Familjen Grotesk Email';font-style:normal;font-weight:700")
    expect(message.html).toContain("Qw3LZR9ZHiDnImG6-NEMQ41wby8WRnYsfkunR_eGfMFubhzqeVk.woff2")
    expect(message.html).toContain("font-family:Chivo,system-ui,-apple-system,sans-serif")
    expect(message.html).toContain('class="btn-eighteen"')
    expect(message.html).toContain('width="5" height="42" valign="bottom"')
    expect(message.html).toContain('width="5" height="37"')
    expect(message.html).toContain('width="5" height="5"')
    expect(message.html).toContain("mso-padding-alt:10px 20px")
    expect(message.html).toContain("padding:10px 20px")
    expect(message.html).toContain("font-family:Chivo,sans-serif")
    expect(message.html).toContain("font-size:15px;font-weight:700;line-height:18px")
  })

  it("keeps every outbound email source on the public-site font families", () => {
    const templateDir = resolve(process.cwd(), "src/lib/email/templates")
    const templateFiles = readdirSync(templateDir, { encoding: "utf8", recursive: true })
      .filter((file) => file.endsWith(".ts"))
      .map((file) => `src/lib/email/templates/${file}`)
    const sources = [
      "src/lib/email/emailLayout.ts",
      ...templateFiles,
      "src/lib/privacy/userDataExport.ts",
      "src/lib/contact/platformContact.ts",
      "src/lib/intake/storeIntakeSubmission.ts",
      "src/collections/Forms.ts",
    ].map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n")

    expect(sources).not.toMatch(/font-family:(?:Arial|monospace|Inter|Gordita|Playfair)/i)
  })

  it("escapes magic-link URLs in HTML and keeps the original URL in plain text", () => {
    const url = 'https://admin.example.nl/verify?a=1&next="unsafe"'
    const message = magicLinkTemplate({ loginUrl: url })

    expect(message.html).toContain("a=1&amp;next=&quot;unsafe&quot;")
    expect(message.html).not.toContain('next="unsafe"')
    expect(message.text).toContain(url)
  })

  it("provides escaped HTML and plain text for preview-ready links", () => {
    const url = "https://preview.siteinabox.nl/client?a=1&b=2"
    const message = siteReadyPreviewTemplate({ loginUrl: url })

    expect(message.html).toContain("a=1&amp;b=2")
    expect(message.text).toContain(url)
  })

  it("removes header control characters from dynamic subject fragments", () => {
    expect(cleanEmailHeaderText("Acme\r\nBcc: attacker@example.nl\u0000"))
      .toBe("Acme Bcc: attacker@example.nl")
  })
})
