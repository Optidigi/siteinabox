import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"

export function magicLinkTemplate(opts: { loginUrl: string }) {
  const text = [
    "Log in bij Site in a Box:",
    opts.loginUrl,
    "",
    "Deze link verloopt binnenkort. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.",
  ].join("\n")
  return {
    subject: "Log in bij Site in a Box",
    html: renderEmailLayout({
      preheader: "Je beveiligde inloglink voor Site in a Box",
      eyebrow: "Beveiliging",
      title: "Log in bij Site in a Box",
      intro: "Gebruik de beveiligde link hieronder om verder te gaan naar je account.",
      body: `${renderEmailButton("Inloggen", opts.loginUrl)}${renderEmailFallbackLink(opts.loginUrl)}`,
      notice: "Deze link verloopt binnenkort. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.",
      footer: "security",
    }),
    text,
  }
}
