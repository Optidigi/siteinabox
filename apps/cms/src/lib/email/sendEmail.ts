import { createTransport } from "nodemailer"

export type SendEmailOptions = {
  to: string
  subject: string
  html: string
}

const DEFAULT_FROM = "noreply@siteinabox.nl"
const CLOUDFLARE_SMTP_HOST = "smtp.mx.cloudflare.net"
const CLOUDFLARE_SMTP_PORT = 465

export function getCloudflareEmailSmtpToken() {
  const token = process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN?.trim()
  if (!token || (token.startsWith("<") && token.endsWith(">"))) {
    return null
  }
  return token
}

export async function sendEmail(opts: SendEmailOptions) {
  const token = getCloudflareEmailSmtpToken()
  if (!token) {
    throw new Error("CLOUDFLARE_EMAIL_SMTP_TOKEN missing or invalid - cannot send email")
  }

  const transport = createTransport({
    host: CLOUDFLARE_SMTP_HOST,
    port: CLOUDFLARE_SMTP_PORT,
    secure: true,
    auth: {
      user: "api_token",
      pass: token,
    },
  })

  return transport.sendMail({
    from: process.env.EMAIL_FROM || DEFAULT_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
}
