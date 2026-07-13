import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"
import { escapeEmailHtml } from "@/lib/email/templateUtils"

const cleanText = (value: string) => value.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim()

export function inviteTemplate(opts: {
  tenantName: string
  inviteUrl: string
  recipientName: string
  role: "owner" | "editor" | "viewer"
}) {
  const tenantNameText = cleanText(opts.tenantName) || "Site in a Box"
  const recipientNameText = cleanText(opts.recipientName) || "there"
  const roleText = cleanText(opts.role)
  return {
    subject: `You've been invited to ${tenantNameText}`,
    html: renderEmailLayout({
      preheader: `Invitation to ${tenantNameText}`,
      eyebrow: "Team & toegang",
      title: `You're invited to ${tenantNameText}`,
      intro: `Hi ${recipientNameText}, you've been invited with the ${roleText} role. Site in a Box uses secure passwordless login.`,
      body: `<p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6">Your access role: <strong>${escapeEmailHtml(roleText)}</strong></p>${renderEmailButton("Accept invitation", opts.inviteUrl)}${renderEmailFallbackLink(opts.inviteUrl)}`,
      notice: "This link expires in 5 minutes. If you weren't expecting this invitation, you can ignore this email.",
      footer: "security",
    }),
    text: [
      `Hi ${recipientNameText},`,
      "",
      `You've been invited to ${tenantNameText} with the ${roleText} role.`,
      "Site in a Box uses secure passwordless login.",
      "",
      `Accept invitation: ${opts.inviteUrl}`,
      "",
      "This link expires in 5 minutes. If you weren't expecting this invitation, you can ignore this email.",
    ].join("\n"),
  }
}
