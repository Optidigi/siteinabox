const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const cleanText = (value: string) => value.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim()

export function inviteTemplate(opts: {
  tenantName: string
  inviteUrl: string
  recipientName: string
  role: "owner" | "editor" | "viewer"
}) {
  const tenantNameText = cleanText(opts.tenantName) || "Site in a Box"
  const recipientNameText = cleanText(opts.recipientName) || "there"
  const roleText = cleanText(opts.role)
  const tenantName = escapeHtml(tenantNameText)
  const recipientName = escapeHtml(recipientNameText)
  const role = escapeHtml(roleText)
  const inviteUrl = escapeHtml(opts.inviteUrl)

  return {
    subject: `You've been invited to ${tenantNameText}`,
    html: `
      <p>Hi ${recipientName},</p>
      <p>You've been invited to <strong>${tenantName}</strong> with the <strong>${role}</strong> role.</p>
      <p>Site in a Box uses secure passwordless login. Use this one-time link to accept the invitation and sign in:</p>
      <p><a href="${inviteUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Accept invitation</a></p>
      <p style="color:#666;font-size:12px">This link expires in 5 minutes. If you weren't expecting this invitation, you can ignore this email.</p>
    `,
    text: [
      `Hi ${recipientNameText},`,
      "",
      `You've been invited to ${tenantNameText} with the ${roleText} role.`,
      "Site in a Box uses secure passwordless login.",
      "",
      `Accept invitation: ${opts.inviteUrl}`,
      "",
      "This link expires in 5 minutes. If you weren't expecting this invitation, you can ignore this email.",
    ].join("\n"),
  }
}
