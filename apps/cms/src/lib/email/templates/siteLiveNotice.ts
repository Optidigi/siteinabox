import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"
import { escapeEmailHtml } from "@/lib/email/templateUtils"

export function siteLiveNoticeTemplate(opts: { siteUrl: string; adminUrl: string; magicLoginUrl?: string | null }) {
  const magicLoginUrl = opts.magicLoginUrl
  return {
    subject: "Your Site in a Box site is live",
    html: renderEmailLayout({
      preheader: "Your Site in a Box site is live",
      eyebrow: "Je website",
      title: "Your site is live",
      intro: "Your Site in a Box website is now live.",
      body: `${renderEmailButton("Visit live site", opts.siteUrl)}${renderEmailFallbackLink(opts.siteUrl)}<p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6"><strong>CMS admin:</strong> <a href="${escapeEmailHtml(opts.adminUrl)}" style="color:#000">Open your admin</a></p>${magicLoginUrl ? `<p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6"><strong>Magic login:</strong> <a href="${escapeEmailHtml(magicLoginUrl)}" style="color:#000">Sign in without a password</a></p>` : "<p style=\"margin:24px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6\">Your magic login link has been sent to this email address.</p>"}`,
    }),
    text: [
      "Your Site in a Box site is live.",
      `Live site: ${opts.siteUrl}`,
      `CMS admin: ${opts.adminUrl}`,
      opts.magicLoginUrl
        ? `Magic login: ${opts.magicLoginUrl}`
        : "Your magic login link has been sent to this email address. Use it to open the CMS admin without a password.",
    ].join("\n"),
  }
}
