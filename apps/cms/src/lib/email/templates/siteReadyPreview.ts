export function siteReadyPreviewTemplate({ loginUrl }: { loginUrl: string }) {
  return {
    subject: "Your Site in a Box preview is ready",
    html: `
      <p>Your Site in a Box preview is ready.</p>
      <p><a href="${loginUrl}">Open your preview</a></p>
      <p>This magic link signs you in to your customer preview.</p>
    `,
  }
}
