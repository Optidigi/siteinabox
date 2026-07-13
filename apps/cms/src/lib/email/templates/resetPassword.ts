import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"

export function resetPasswordTemplate(opts: { resetUrl: string }) {
  return {
    subject: "Stel je wachtwoord voor Site in a Box opnieuw in",
    html: renderEmailLayout({
      preheader: "Stel je wachtwoord voor Site in a Box opnieuw in",
      eyebrow: "Beveiliging",
      title: "Wachtwoord opnieuw instellen",
      intro: "Er is een nieuw wachtwoord aangevraagd voor je Site in a Box-beheerdersaccount.",
      body: `${renderEmailButton("Wachtwoord instellen", opts.resetUrl)}${renderEmailFallbackLink(opts.resetUrl)}`,
      notice: "Deze link is één uur geldig. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.",
      footer: "security",
    }),
    text: [
      "Er is een nieuw wachtwoord aangevraagd voor je Site in a Box-beheerdersaccount.",
      "",
      `Wachtwoord opnieuw instellen: ${opts.resetUrl}`,
      "",
      "Deze link is één uur geldig.",
      "Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.",
    ].join("\n"),
  }
}
