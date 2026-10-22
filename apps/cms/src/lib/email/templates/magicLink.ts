import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"

export function magicLinkTemplate(opts: { loginUrl: string; locale?: "nl" | "en" }) {
  const english = opts.locale === "en"
  const title = english ? "Sign in to Site in a Box" : "Log in bij Site in a Box"
  const notice = english ? "This link expires after five minutes. Repeated requests keep an active link. If you did not request it, ignore this email."
    : "Deze link verloopt na vijf minuten. Herhaalde aanvragen behouden een actieve link. Heb je dit niet aangevraagd? Negeer deze e-mail."
  const text = [
    title + ":",
    opts.loginUrl,
    "",
    notice,
  ].join("\n")
  return {
    subject: title,
    html: renderEmailLayout({
      locale: opts.locale,
      preheader: title,
      eyebrow: english ? "Security" : "Beveiliging",
      title,
      intro: english ? "Use the secure link below to continue to your account." : "Gebruik de beveiligde link hieronder om verder te gaan naar je account.",
      body: `${renderEmailButton(english ? "Sign in" : "Inloggen", opts.loginUrl)}${renderEmailFallbackLink(opts.loginUrl, opts.locale)}`,
      notice,
      footer: "security",
    }),
    text,
  }
}
