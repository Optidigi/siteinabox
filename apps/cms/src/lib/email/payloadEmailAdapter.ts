import type { Address } from "nodemailer/lib/mailer"
import type { PayloadEmailAdapter, SendEmailOptions } from "payload"
import { asMailLogPayload, getPlatformMailSender, sendEmail } from "@/lib/email/sendEmail"

const DEFAULT_FROM_NAME = "Site in a Box"

function addressValue(value: Address | string): string {
  return typeof value === "string" ? value : value.address
}

function recipients(value: SendEmailOptions["to"]): string[] {
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).flatMap((entry) => {
    if (typeof entry === "string") return [entry]
    return [addressValue(entry)]
  })
}

function stringContent(value: SendEmailOptions["html"] | SendEmailOptions["text"]): string | undefined {
  if (typeof value === "string") return value
  if (Buffer.isBuffer(value)) return value.toString("utf8")
  return undefined
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Payload adapter for its built-in auth operations. Provider construction is
 * deferred until sendEmail() is called, so app boot and migrations stay free
 * of Cloudflare connectivity requirements.
 */
export const payloadEmailAdapter: PayloadEmailAdapter = ({ payload }) => ({
  name: "siab-cloudflare",
  defaultFromAddress: getPlatformMailSender(),
  defaultFromName: DEFAULT_FROM_NAME,
  async sendEmail(message) {
    const to = recipients(message.to)
    const subject = typeof message.subject === "string" ? message.subject : "Site in a Box"
    const html = stringContent(message.html)
    if (to.length === 0 || !html) {
      throw new Error("Payload email requires at least one recipient and an HTML body")
    }
    const explicitText = stringContent(message.text)
    return sendEmail({
      to: to.length === 1 ? to[0]! : to,
      subject,
      html,
      text: explicitText || htmlToPlainText(html),
      intent: "auth.password_reset",
      payload: asMailLogPayload(payload),
    })
  },
})
