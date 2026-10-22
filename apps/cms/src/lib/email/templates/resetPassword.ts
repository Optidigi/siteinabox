import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"

export function resetPasswordTemplate(opts: { resetUrl: string; locale?: "nl" | "en" }) {
  const english = opts.locale === "en"
  const subject = english ? "Reset your Site in a Box password" : "Stel je wachtwoord voor Site in a Box opnieuw in"
  const title = english ? "Reset your password" : "Wachtwoord opnieuw instellen"
  const intro = english ? "A password reset was requested for your Site in a Box account."
    : "Er is een nieuw wachtwoord aangevraagd voor je Site in a Box-beheerdersaccount."
  const notice = english ? "This link is valid for one hour. Repeated requests do not replace an active link. If you did not request it, ignore this email."
    : "Deze link is één uur geldig. Herhaalde aanvragen vervangen een actieve link niet. Heb je dit niet aangevraagd? Negeer deze e-mail."
  return {
    subject,
    html: renderEmailLayout({
      locale: opts.locale,
      preheader: subject,
      eyebrow: english ? "Security" : "Beveiliging",
      title,
      intro,
      body: `${renderEmailButton(title, opts.resetUrl)}${renderEmailFallbackLink(opts.resetUrl, opts.locale)}`,
      notice,
      footer: "security",
    }),
    text: [
      intro,
      "",
      `${title}: ${opts.resetUrl}`,
      "",
      notice,
    ].join("\n"),
  }
}
