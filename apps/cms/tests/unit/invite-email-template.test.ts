import { describe, expect, it } from "vitest"
import { inviteTemplate } from "@/lib/email/templates/invite"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("invitation email template", () => {
  it("describes passwordless access, role, and the actual five-minute expiry in HTML and text", () => {
    const message = inviteTemplate({
      tenantName: "Acme",
      recipientName: "Ada",
      role: "owner",
      inviteUrl: "https://admin.acme.nl/api/auth/magic-link/verify?token=secret",
    })

    expect(message.subject).toBe("You've been invited to Acme")
    expect(message.html).toContain("passwordless login")
    expect(message.html).toContain("<strong>owner</strong>")
    expect(message.html).toContain("expires in 5 minutes")
    expect(message.text).toContain("Accept invitation: https://admin.acme.nl/")
    expect(message.text).toContain("expires in 5 minutes")
    expect(message.html).not.toContain("Set password")
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
    expect(message.html).not.toContain("<img")
    expect(message.html).toContain("&lt;script&gt;")
    expect(message.html).toContain("&quot; onclick=&quot;")
  })

  it("is selected by invitation metadata and logged against the target tenant", () => {
    const auth = readFileSync(resolve(process.cwd(), "src/lib/betterAuth.ts"), "utf8")
    expect(auth).toContain('intent === "user_invite"')
    expect(auth).toContain("inviteTemplate({")
    expect(auth).toContain("recipientName")
    expect(auth).toContain('intent: "auth.magic_link"')
    expect(auth).toContain("tenant: tenantId")
  })
})
