import { escapeEmailHtml } from "@/lib/email/templateUtils"

export function magicLinkTemplate(opts: { loginUrl: string }) {
  const loginUrl = escapeEmailHtml(opts.loginUrl)
  return {
    subject: "Sign in to SiteInABox",
    html: `
      <p>Click to sign in to SiteInABox:</p>
      <p><a href="${loginUrl}">${loginUrl}</a></p>
      <p style="color:#666;font-size:12px">This link expires soon. If you didn't request this, ignore this email.</p>
    `,
    text: [
      "Click to sign in to SiteInABox:",
      opts.loginUrl,
      "",
      "This link expires soon. If you didn't request this, ignore this email.",
    ].join("\n"),
  }
}
