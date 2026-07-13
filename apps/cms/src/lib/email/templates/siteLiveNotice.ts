import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"
import { escapeEmailHtml } from "@/lib/email/templateUtils"

export function siteLiveNoticeTemplate(opts: { siteUrl: string; adminUrl: string; magicLoginUrl?: string | null }) {
  const magicLoginUrl = opts.magicLoginUrl
  return {
    subject: "Je Site in a Box-website staat live",
    html: renderEmailLayout({
      preheader: "Je Site in a Box-website staat live",
      eyebrow: "Je website",
      title: "Je website staat live",
      intro: "Je Site in a Box-website is gepubliceerd en bereikbaar voor bezoekers.",
      body: `${renderEmailButton("Website bekijken", opts.siteUrl)}${renderEmailFallbackLink(opts.siteUrl)}<p style="margin:18px 0 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.55"><strong>Beheeromgeving:</strong> <a href="${escapeEmailHtml(opts.adminUrl)}" style="color:#000">Open je beheeromgeving</a></p>${magicLoginUrl ? `<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.55"><strong>Direct inloggen:</strong> <a href="${escapeEmailHtml(magicLoginUrl)}" style="color:#000">Log in zonder wachtwoord</a></p>` : "<p style=\"margin:18px 0 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.55\">Je persoonlijke inloglink is naar dit e-mailadres verzonden.</p>"}`,
    }),
    text: [
      "Je Site in a Box-website staat live.",
      `Website: ${opts.siteUrl}`,
      `Beheeromgeving: ${opts.adminUrl}`,
      opts.magicLoginUrl
        ? `Direct inloggen: ${opts.magicLoginUrl}`
        : "Je persoonlijke inloglink is naar dit e-mailadres verzonden.",
    ].join("\n"),
  }
}
