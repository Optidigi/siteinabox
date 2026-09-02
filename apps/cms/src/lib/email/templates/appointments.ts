import { renderEmailButton, renderEmailInfoTable, renderEmailLayout } from "@/lib/email/emailLayout"
import { cleanEmailHeaderText, escapeEmailHtml } from "@/lib/email/templateUtils"

export const APPOINTMENT_NOTIFICATION_TEMPLATE_VERSION = "appointments-2026-09-01.1"

export type AppointmentNotificationKind = "confirmation" | "cancelled" | "rescheduled"

type AppointmentTemplateInput = {
  kind: AppointmentNotificationKind
  visitorName: string
  visitorEmail: string
  startAt: string
  endAt: string
  timezone: string
  tenantName: string
  siteUrl: string
  managementToken?: string
  note?: string | null
}

const safe = (value: string | null | undefined, fallback: string): string => {
  const normalized = value?.trim()
  return normalized || fallback
}

const formatTime = (startAt: string, endAt: string, timezone: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat("nl-NL", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone,
    })
    const start = formatter.format(new Date(startAt))
    const end = new Intl.DateTimeFormat("nl-NL", { timeStyle: "short", timeZone: timezone }).format(new Date(endAt))
    return `${start}–${end}`
  } catch {
    return `${startAt}–${endAt}`
  }
}

const copyFor = (kind: AppointmentNotificationKind, visitorName: string): { subject: string; title: string; intro: string; message: string } => {
  if (kind === "cancelled") {
    return {
      subject: "Je afspraak is geannuleerd",
      title: "Afspraak geannuleerd",
      intro: `De afspraak voor ${visitorName} is geannuleerd.`,
      message: "Neem contact op als je een nieuw moment wilt afspreken.",
    }
  }
  if (kind === "rescheduled") {
    return {
      subject: "Je afspraak is verzet",
      title: "Afspraak verzet",
      intro: `De afspraak voor ${visitorName} is naar een nieuw moment verplaatst.`,
      message: "De bijgewerkte afspraakgegevens staan hieronder.",
    }
  }
  return {
    subject: "Je afspraak is bevestigd",
    title: "Afspraak bevestigd",
    intro: `Bedankt ${visitorName}. Je afspraak is bevestigd.`,
    message: "Bewaar deze e-mail voor de afspraakgegevens.",
  }
}

const appointmentRows = (input: AppointmentTemplateInput): Array<[string, string]> => [
  ["Naam", safe(input.visitorName, "Bezoeker")],
  ["Moment", formatTime(input.startAt, input.endAt, input.timezone)],
  ["Tijdzone", safe(input.timezone, "Lokale tijd")],
]

const managementUrl = (siteUrl: string, token: string): string => {
  const url = new URL(siteUrl)
  url.searchParams.set("appointmentToken", token)
  url.hash = "appointments"
  return url.toString()
}

export function visitorAppointmentNotificationTemplate(input: AppointmentTemplateInput) {
  const copy = copyFor(input.kind, safe(input.visitorName, "bezoeker"))
  const rows = appointmentRows(input)
  const manageUrl = input.managementToken ? managementUrl(input.siteUrl, input.managementToken) : null
  const body = [
    `<p style="margin:0 0 14px">${escapeEmailHtml(copy.message)}</p>`,
    renderEmailInfoTable(rows),
    ...(input.note ? [`<p style="margin:18px 0 0"><strong>Opmerking</strong><br>${escapeEmailHtml(input.note)}</p>`] : []),
    ...(manageUrl ? [renderEmailButton("Afspraak beheren", manageUrl)] : []),
  ].join("")
  const text = [
    copy.title,
    "",
    copy.message,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(input.note ? ["", `Opmerking: ${input.note}`] : []),
    ...(manageUrl ? ["", `Afspraak beheren: ${manageUrl}`] : []),
  ].join("\n")
  return {
    subject: cleanEmailHeaderText(copy.subject),
    html: renderEmailLayout({ eyebrow: "Afspraak", title: copy.title, intro: copy.intro, body }),
    text,
  }
}

export function tenantAppointmentNotificationTemplate(input: AppointmentTemplateInput) {
  const copy = input.kind === "cancelled"
    ? { subject: "Afspraak geannuleerd", title: "Afspraak geannuleerd", intro: `${safe(input.visitorName, "Een bezoeker")} heeft een afspraak geannuleerd.` }
    : input.kind === "rescheduled"
      ? { subject: "Afspraak verzet", title: "Afspraak verzet", intro: `${safe(input.visitorName, "Een bezoeker")} heeft een afspraak verzet.` }
      : { subject: "Nieuwe afspraak", title: "Nieuwe afspraak", intro: `${safe(input.visitorName, "Een bezoeker")} heeft een afspraak gemaakt.` }
  const rows = appointmentRows(input)
  const body = `${renderEmailInfoTable(rows)}${input.note ? `<p style="margin:18px 0 0"><strong>Opmerking</strong><br>${escapeEmailHtml(input.note)}</p>` : ""}`
  const text = [copy.title, "", ...rows.map(([label, value]) => `${label}: ${value}`), ...(input.note ? ["", `Opmerking: ${input.note}`] : [])].join("\n")
  return {
    subject: cleanEmailHeaderText(`${copy.subject}: ${input.visitorName}`),
    html: renderEmailLayout({ eyebrow: "Afspraak", title: copy.title, intro: copy.intro, body, footer: "internal" }),
    text,
  }
}
