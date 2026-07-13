import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"

export function magicLinkTemplate(opts: { loginUrl: string }) {
  const text = [
    "Click to sign in to SiteInABox:",
    opts.loginUrl,
    "",
    "This link expires soon. If you didn't request this, ignore this email.",
  ].join("\n")
  return {
    subject: "Sign in to SiteInABox",
    html: renderEmailLayout({
      preheader: "Secure sign-in link for Site in a Box",
      eyebrow: "Beveiliging",
      title: "Sign in to Site in a Box",
      intro: "Use the secure link below to continue to your account.",
      body: `${renderEmailButton("Sign in", opts.loginUrl)}${renderEmailFallbackLink(opts.loginUrl)}`,
      notice: "This link expires soon. If you didn't request this, ignore this email.",
      footer: "security",
    }),
    text,
  }
}
