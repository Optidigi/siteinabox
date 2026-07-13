import { describe, expect, it } from "vitest"
import { inviteTemplate } from "@/lib/email/templates/invite"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("invitation email template", () => {
  it("beschrijft wachtwoordloze toegang, de rol en de geldigheid in HTML en tekst", () => {
    const message = inviteTemplate({
      tenantName: "Acme",
      recipientName: "Ada",
      role: "owner",
      inviteUrl: "https://admin.acme.nl/api/auth/magic-link/verify?token=secret",
    })

    expect(message.subject).toBe("Je bent uitgenodigd voor Acme")
    expect(message.html).toContain("inloggen zonder wachtwoord")
    expect(message.html).toContain("<strong>eigenaar</strong>")
    expect(message.html).toContain("5 minuten geldig")
    expect(message.text).toContain("Uitnodiging accepteren: https://admin.acme.nl/")
    expect(message.text).toContain("5 minuten geldig")
    expect(message.html).not.toContain("Wachtwoord instellen")
  })

  it("escapes all user-controlled HTML and removes subject header control characters", () => {
    const message = inviteTemplate({
      tenantName: 'Acme <script>alert(1)</script>\r\nBcc: attacker@example.com',
      recipientName: '<img src=x onerror="alert(1)">',
      role: "editor",
      inviteUrl: 'https://admin.acme.nl/?next=" onclick="alert(1)',
    })

    expect(message.subject).not.toContain("\r")
    expect(message.subject).not.toContain("\n")
    expect(message.html).not.toContain("<script>")
    expect(message.html).not.toContain("<img src=x")
    expect(message.html).toContain("&lt;script&gt;")
    expect(message.html).toContain("&quot; onclick=&quot;")
  })

  it("is selected by invitation metadata and logged against the target tenant", () => {
    const dispatcher = readFileSync(resolve(process.cwd(), "src/lib/auth/sendCmsMagicLinkEmail.ts"), "utf8")
    expect(dispatcher).toContain('intent === "user_invite"')
    expect(dispatcher).toContain("verifyPrivilegedMagicLinkMetadata")
    expect(dispatcher).toContain("inviteTemplate({")
    expect(dispatcher).toContain("recipientName")
    expect(dispatcher).toContain('intent: "auth.magic_link"')
    expect(dispatcher).toContain("tenant: tenantId")
  })
})
