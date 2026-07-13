import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"

export function resetPasswordTemplate(opts: { resetUrl: string }) {
  return {
    subject: "Reset your Site in a Box password",
    html: renderEmailLayout({
      preheader: "Reset your Site in a Box password",
      eyebrow: "Beveiliging",
      title: "Reset your password",
      intro: "A password reset was requested for your Site in a Box administrator account.",
      body: `${renderEmailButton("Reset password", opts.resetUrl)}${renderEmailFallbackLink(opts.resetUrl)}`,
      notice: "This link expires in one hour. If you did not request this, you can safely ignore this email.",
      footer: "security",
    }),
    text: [
      "A password reset was requested for your Site in a Box administrator account.",
      "",
      `Reset your password: ${opts.resetUrl}`,
      "",
      "This link expires in one hour.",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
  }
}
