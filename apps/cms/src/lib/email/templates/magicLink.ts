import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"

export function magicLinkTemplate(opts: { loginUrl: string; locale?: "nl" | "en" }) {
  const locale = opts.locale ?? "nl"
  const copy = locale === "en" ? {
    title: "Sign in to Site in a Box", preheader: "Your secure Site in a Box sign-in link",
    eyebrow: "Security", intro: "Use the secure link below to continue to your account.",
    button: "Sign in", notice: "This link expires shortly. If you did not request it, you can ignore this email.",
  } : {
    title: "Log in bij Site in a Box", preheader: "Je beveiligde inloglink voor Site in a Box",
    eyebrow: "Beveiliging", intro: "Gebruik de beveiligde link hieronder om verder te gaan naar je account.",
    button: "Inloggen", notice: "Deze link verloopt binnenkort. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.",
  }
  return {
    subject: copy.title,
    html: renderEmailLayout({ locale, preheader: copy.preheader, eyebrow: copy.eyebrow,
      title: copy.title, intro: copy.intro,
      body: `${renderEmailButton(copy.button, opts.loginUrl)}${renderEmailFallbackLink(opts.loginUrl, locale)}`,
      notice: copy.notice, footer: "security",
    }),
    text: [copy.title + ":", opts.loginUrl, "", copy.notice].join("\n"),
  }
}
