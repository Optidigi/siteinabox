const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;")

export function resetPasswordTemplate(opts: { resetUrl: string }) {
  const resetUrl = escapeHtml(opts.resetUrl)
  return {
    subject: "Reset your Site in a Box password",
    html: `
      <p>A password reset was requested for your Site in a Box administrator account.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in one hour.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
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
