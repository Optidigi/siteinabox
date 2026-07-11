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
  const version = escapeHtml(input.documentVersion)
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
    html: [
      `<p>Hallo,</p>`,
      `<p>De algemene voorwaarden van Site in a Box zijn bijgewerkt voor <strong>${tenantName}</strong>.</p>`,
      `<p>${summary}</p>`,
      `<p><strong>Versie:</strong> ${version}<br><strong>Van kracht vanaf:</strong> ${date(input.effectiveAt)}${deadline ? `<br><strong>Accepteren voor:</strong> ${deadline}` : ""}</p>`,
      `<p>${escapeHtml(restriction)}</p>`,
      `<p><a href="${settingsUrl}">Bekijk en accepteer in Site in a Box</a></p>`,
      `<p><a href="${documentUrl}">Bekijk de exacte versie van de voorwaarden</a></p>`,
      `<p>Vragen? Neem contact op via <a href="mailto:info@siteinabox.nl">info@siteinabox.nl</a>.</p>`,
      `<p>Site in a Box</p>`,
    ].join("\n"),
    text: [
      "Hallo,",
      "",
      `De algemene voorwaarden van Site in a Box zijn bijgewerkt voor ${input.tenantName}.`,
      input.changeSummary,
      `Versie: ${input.documentVersion}`,
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
    html: [
      "<p>Hallo,</p>",
      `<p>We informeren je over een juridische wijziging voor <strong>${tenantName}</strong>.</p>`,
      `<p>${escapeHtml(input.changeSummary)}</p>`,
      `<p><strong>Versie:</strong> ${escapeHtml(input.documentVersion)}<br><strong>Van kracht vanaf:</strong> ${effectiveAt}</p>`,
      `<p><a href="${documentUrl}">Bekijk de exacte documentversie</a></p>`,
      `<p>Vragen? Neem contact op via <a href="mailto:info@siteinabox.nl">info@siteinabox.nl</a>.</p>`,
      "<p>Site in a Box</p>",
    ].join("\n"),
    text: [
      "Hallo,",
      "",
      `We informeren je over een juridische wijziging voor ${input.tenantName}.`,
      input.changeSummary,
      `Versie: ${input.documentVersion}`,
      `Van kracht vanaf: ${effectiveAt}`,
      `Exacte documentversie: ${input.documentUrl}`,
      "Vragen: info@siteinabox.nl",
      "",
      "Site in a Box",
    ].join("\n"),
  }
}
