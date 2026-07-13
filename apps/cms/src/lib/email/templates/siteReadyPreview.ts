import { escapeEmailHtml } from "@/lib/email/templateUtils"

export function siteReadyPreviewTemplate({ loginUrl }: { loginUrl: string }) {
  const safeLoginUrl = escapeEmailHtml(loginUrl)
  return {
    subject: "Your Site in a Box preview is ready",
    html: `
      <p>Your Site in a Box preview is ready.</p>
      <p><a href="${safeLoginUrl}">Open your preview</a></p>
      <p>This magic link signs you in to your customer preview.</p>
    `,
    text: [
      "Your Site in a Box preview is ready.",
      `Open your preview: ${loginUrl}`,
      "This magic link signs you in to your customer preview.",
    ].join("\n"),
  }
}
