import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"

export function siteReadyPreviewTemplate({ loginUrl }: { loginUrl: string }) {
  return {
    subject: "Your Site in a Box preview is ready",
    html: renderEmailLayout({
      preheader: "Your Site in a Box preview is ready",
      eyebrow: "Je website",
      title: "Your preview is ready",
      intro: "Your Site in a Box preview is ready to review.",
      body: `${renderEmailButton("Open preview", loginUrl)}${renderEmailFallbackLink(loginUrl)}`,
      notice: "This magic link signs you in to your customer preview.",
    }),
    text: [
      "Your Site in a Box preview is ready.",
      `Open your preview: ${loginUrl}`,
      "This magic link signs you in to your customer preview.",
    ].join("\n"),
  }
}
