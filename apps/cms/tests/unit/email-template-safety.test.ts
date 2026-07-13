import { describe, expect, it } from "vitest"
import { cleanEmailHeaderText } from "@/lib/email/templateUtils"
import { magicLinkTemplate } from "@/lib/email/templates/magicLink"
import { siteReadyPreviewTemplate } from "@/lib/email/templates/siteReadyPreview"

describe("shared email template safety", () => {
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
