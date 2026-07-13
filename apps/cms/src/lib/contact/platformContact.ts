import type { Payload } from "payload"
import { getPlatformMailSender, sendEmail } from "@/lib/email/sendEmail"
import { renderEmailInfoTable, renderEmailLayout } from "@/lib/email/emailLayout"
import { cleanEmailHeaderText } from "@/lib/email/templateUtils"

export const PLATFORM_CONTACT_RECIPIENT = "admin@siteinabox.nl"
const MAX_CONTACT_MESSAGE_BYTES = 16 * 1024

type PlatformContactInput = {
  name?: unknown
  email?: unknown
  phone?: unknown
  subjectTopic?: unknown
  message?: unknown
  source?: unknown
}

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const safeEmail = (value: unknown): string | null => {
  const email = cleanText(value)?.toLowerCase()
  if (!email || email.includes("\n") || email.includes("\r")) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const nl2br = (value: string) => escapeHtml(value).replace(/\n/g, "<br />")

export type PlatformContactResult =
  | { ok: true }
  | { ok: false; status: number; message: string }

export function validatePlatformContact(input: PlatformContactInput): PlatformContactResult {
  const name = cleanText(input.name)
  const email = safeEmail(input.email)
  const message = cleanText(input.message)
  if (!name) return { ok: false, status: 400, message: "Name is required." }
  if (!email) return { ok: false, status: 400, message: "A valid email address is required." }
  if (!message) return { ok: false, status: 400, message: "Message is required." }
  if (Buffer.byteLength(message, "utf8") > MAX_CONTACT_MESSAGE_BYTES) {
    return { ok: false, status: 413, message: "Message is too large." }
  }
  return { ok: true }
}

function platformContactTemplate(input: Required<Pick<PlatformContactInput, "name" | "email" | "message">> & PlatformContactInput) {
  const name = cleanText(input.name) ?? "-"
  const email = safeEmail(input.email) ?? "-"
  const phone = cleanText(input.phone) ?? "-"
  const subjectTopic = cleanText(input.subjectTopic) ?? "-"
  const source = cleanText(input.source) ?? "siteinabox.nl/contact"
  const message = cleanText(input.message) ?? "-"
  const subject = `Nieuw contact via siteinabox.nl: ${cleanEmailHeaderText(name) || "Onbekend"}`
  const rows: Array<[string, string]> = [
    ["Naam", name],
    ["E-mail", email],
    ["Telefoon", phone],
    ["Onderwerp", subjectTopic],
    ["Bron", source],
  ]
  const body = `${renderEmailInfoTable(rows)}<p style="margin:18px 0 6px;font-weight:700">Bericht</p><p style="margin:0">${nl2br(message)}</p>`
  return {
    subject,
    html: renderEmailLayout({ eyebrow: "Interne melding", title: "Nieuw contactbericht", intro: "Er is een contactformulier ingevuld op siteinabox.nl.", body, footer: "internal" }),
    text: [
      subject,
      `Naam: ${name}`,
      `E-mail: ${email}`,
      `Telefoon: ${phone}`,
      `Onderwerp: ${subjectTopic}`,
      `Bron: ${source}`,
      "",
      "Bericht:",
      message,
    ].join("\n"),
  }
}

export async function sendPlatformContactEmail(payload: Payload, input: PlatformContactInput): Promise<PlatformContactResult> {
  const validation = validatePlatformContact(input)
  if (!validation.ok) return validation

  const message = platformContactTemplate({
    name: input.name,
    email: input.email,
    message: input.message,
    phone: input.phone,
    subjectTopic: input.subjectTopic,
    source: input.source,
  } as Required<Pick<PlatformContactInput, "name" | "email" | "message">> & PlatformContactInput)

  await sendEmail({
    to: PLATFORM_CONTACT_RECIPIENT,
    from: getPlatformMailSender(),
    replyTo: safeEmail(input.email) ?? undefined,
    subject: message.subject,
    html: message.html,
    text: message.text,
    intent: "platform.operational",
    payload: payload as Parameters<typeof sendEmail>[0]["payload"],
  })
  return { ok: true }
}
