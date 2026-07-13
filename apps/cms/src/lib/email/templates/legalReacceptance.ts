import { renderEmailLayout } from "@/lib/email/emailLayout"

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;")

export const LEGAL_REACCEPTANCE_TEMPLATE_VERSION = "legal-reacceptance-2026-07-11.1"
const headerText = (value: string) => value.replace(/[\r\n]+/g, " ").trim()

export function legalReacceptanceTemplate(input: {
  tenantName: string
  changeSummary: string
  documentVersion: string
  effectiveAt: string
  enforceAt?: string | null
  settingsUrl: string
  documentUrl: string
  mandatory: boolean
  kind?: "initial" | "reminder" | "enforcement"
}) {
  const date = (value: string) => new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "Europe/Amsterdam" }).format(new Date(value))
  const tenantName = escapeHtml(input.tenantName)
  const summary = escapeHtml(input.changeSummary)
  const settingsUrl = escapeHtml(input.settingsUrl)
  const documentUrl = escapeHtml(input.documentUrl)
  const deadline = input.enforceAt ? date(input.enforceAt) : null
  const restriction = input.mandatory
    ? "Na de ingangsdatum kun je wijzigingen blijven bekijken en bewerken, maar publicatie blijft geblokkeerd totdat een eigenaar accepteert."
    : "De bijgewerkte voorwaarden worden uiterlijk bij je volgende contractuele handeling opnieuw ter acceptatie aangeboden."
  const subjectPrefix = input.kind === "enforcement"
    ? "Nu vereist"
    : input.kind === "reminder" ? "Herinnering" : "Actie vereist"

  return {
    subject: `${subjectPrefix}: accepteer de bijgewerkte voorwaarden voor ${headerText(input.tenantName)}`,
    html: renderEmailLayout({
      eyebrow: "Juridische kennisgeving",
      title: subjectPrefix,
      body: [
      `<p>Hallo,</p>`,
      `<p>De algemene voorwaarden van Site in a Box zijn bijgewerkt voor <strong>${tenantName}</strong>.</p>`,
      `<p>${summary}</p>`,
      `<p><strong>Van kracht vanaf:</strong> ${date(input.effectiveAt)}${deadline ? `<br><strong>Accepteren voor:</strong> ${deadline}` : ""}</p>`,
      `<p>${escapeHtml(restriction)}</p>`,
      `<p><a href="${settingsUrl}">Bekijk en accepteer in Site in a Box</a></p>`,
      `<p><a href="${documentUrl}">Bekijk de exacte versie van de voorwaarden</a></p>`,
      `<p>Vragen? Neem contact op via <a href="mailto:info@siteinabox.nl">info@siteinabox.nl</a>.</p>`,
      `<p>Site in a Box</p>`,
      ].join("\n"),
      footer: "legal",
    }),
    text: [
      "Hallo,",
      "",
      `De algemene voorwaarden van Site in a Box zijn bijgewerkt voor ${input.tenantName}.`,
      input.changeSummary,
      `Van kracht vanaf: ${date(input.effectiveAt)}`,
      ...(deadline ? [`Accepteren voor: ${deadline}`] : []),
      "",
      restriction,
      `Bekijk en accepteer: ${input.settingsUrl}`,
      `Exacte documentversie: ${input.documentUrl}`,
      "Vragen: info@siteinabox.nl",
      "",
      "Site in a Box",
    ].join("\n"),
  }
}

export function legalDirectNoticeTemplate(input: {
  tenantName: string
  changeSummary: string
  documentVersion: string
  effectiveAt: string
  documentUrl: string
}) {
  const tenantName = escapeHtml(input.tenantName)
  const documentUrl = escapeHtml(input.documentUrl)
  const effectiveAt = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "Europe/Amsterdam" }).format(new Date(input.effectiveAt))
  return {
    subject: `Juridische kennisgeving voor ${headerText(input.tenantName)}`,
    html: renderEmailLayout({
      eyebrow: "Juridische kennisgeving",
      title: "Juridische kennisgeving",
      body: [
      "<p>Hallo,</p>",
      `<p>We informeren je over een juridische wijziging voor <strong>${tenantName}</strong>.</p>`,
      `<p>${escapeHtml(input.changeSummary)}</p>`,
      `<p><strong>Van kracht vanaf:</strong> ${effectiveAt}</p>`,
      `<p><a href="${documentUrl}">Bekijk de exacte documentversie</a></p>`,
      `<p>Vragen? Neem contact op via <a href="mailto:info@siteinabox.nl">info@siteinabox.nl</a>.</p>`,
      "<p>Site in a Box</p>",
      ].join("\n"),
      footer: "legal",
    }),
    text: [
      "Hallo,",
      "",
      `We informeren je over een juridische wijziging voor ${input.tenantName}.`,
      input.changeSummary,
      `Van kracht vanaf: ${effectiveAt}`,
      `Exacte documentversie: ${input.documentUrl}`,
      "Vragen: info@siteinabox.nl",
      "",
      "Site in a Box",
    ].join("\n"),
  }
}

export function legalContinuedUseNoticeTemplate(input: {
  tenantName: string
  changeSummary: string
  effectiveAt: string
  objectionDeadlineAt: string
  settingsUrl: string
  documentUrl: string
  documentContent: string
  kind?: "initial" | "reminder"
}) {
  const date = (value: string) => new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "Europe/Amsterdam" }).format(new Date(value))
  const tenantName = escapeHtml(input.tenantName)
  const settingsUrl = escapeHtml(input.settingsUrl)
  const documentUrl = escapeHtml(input.documentUrl)
  const contentHtml = escapeHtml(input.documentContent).replace(/\n/g, "<br>")
  const subjectPrefix = input.kind === "reminder" ? "Herinnering" : "Onze algemene voorwaarden worden bijgewerkt"
  return {
    subject: `${subjectPrefix} voor ${headerText(input.tenantName)}`,
    html: renderEmailLayout({
      eyebrow: "Juridische kennisgeving",
      title: subjectPrefix,
      body: [
      "<p>Hallo,</p>",
      `<p>De algemene voorwaarden van Site in a Box voor <strong>${tenantName}</strong> worden bijgewerkt.</p>`,
      `<p>${escapeHtml(input.changeSummary)}</p>`,
      `<p><strong>Van kracht vanaf:</strong> ${date(input.effectiveAt)}<br><strong>Bezwaar mogelijk tot:</strong> ${date(input.objectionDeadlineAt)}</p>`,
      "<p>Als je Site in a Box na de ingangsdatum blijft gebruiken zonder voor het einde van de reactietermijn bezwaar te maken, gelden de bijgewerkte voorwaarden voor je overeenkomst.</p>",
      `<p><a href="${settingsUrl}">Bekijk de kennisgeving, ga akkoord of registreer bezwaar</a></p>`,
      `<p><a href="${documentUrl}">Bekijk de voorwaarden online</a></p>`,
      "<p><strong>Volledige bijgewerkte voorwaarden</strong></p>",
      `<div style="white-space:normal">${contentHtml}</div>`,
      `<p>Vragen of bezwaar maken kan ook via <a href="mailto:info@siteinabox.nl">info@siteinabox.nl</a>.</p>`,
      "<p>Site in a Box</p>",
      ].join("\n"),
      footer: "legal",
    }),
    text: [
      "Hallo,", "",
      `De algemene voorwaarden van Site in a Box voor ${input.tenantName} worden bijgewerkt.`,
      input.changeSummary,
      `Van kracht vanaf: ${date(input.effectiveAt)}`,
      `Bezwaar mogelijk tot: ${date(input.objectionDeadlineAt)}`, "",
      "Als je Site in a Box na de ingangsdatum blijft gebruiken zonder voor het einde van de reactietermijn bezwaar te maken, gelden de bijgewerkte voorwaarden voor je overeenkomst.",
      `Bekijken, akkoord gaan of bezwaar registreren: ${input.settingsUrl}`,
      `Voorwaarden online: ${input.documentUrl}`, "",
      "VOLLEDIGE BIJGEWERKTE VOORWAARDEN", "",
      input.documentContent, "",
      "Vragen of bezwaar: info@siteinabox.nl", "", "Site in a Box",
    ].join("\n"),
  }
}
