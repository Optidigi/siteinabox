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
  const recipientNameText = cleanText(opts.recipientName) || "daar"
  const roleText = cleanText(opts.role)
  const roleLabel = { owner: "eigenaar", editor: "redacteur", viewer: "lezer" }[opts.role]
  return {
    subject: `Je bent uitgenodigd voor ${tenantNameText}`,
    html: renderEmailLayout({
      preheader: `Je uitnodiging voor ${tenantNameText}`,
      eyebrow: "Team & toegang",
      title: `Je bent uitgenodigd voor ${tenantNameText}`,
      intro: `Hallo ${recipientNameText}, je bent toegevoegd aan ${tenantNameText}. Site in a Box gebruikt beveiligd inloggen zonder wachtwoord.`,
      body: `<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;line-height:1.55">Je rol: <strong>${escapeEmailHtml(roleLabel)}</strong></p>${renderEmailButton("Uitnodiging accepteren", opts.inviteUrl)}${renderEmailFallbackLink(opts.inviteUrl)}`,
      notice: "Deze link is 5 minuten geldig. Verwachtte je deze uitnodiging niet? Dan kun je deze e-mail negeren.",
      footer: "security",
    }),
    text: [
      `Hallo ${recipientNameText},`,
      "",
      `Je bent uitgenodigd voor ${tenantNameText} met de rol ${roleLabel} (${roleText}).`,
      "Site in a Box gebruikt beveiligd inloggen zonder wachtwoord.",
      "",
      `Uitnodiging accepteren: ${opts.inviteUrl}`,
      "",
      "Deze link is 5 minuten geldig. Verwachtte je deze uitnodiging niet? Dan kun je deze e-mail negeren.",
    ].join("\n"),
  }
}
