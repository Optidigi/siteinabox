import { escapeEmailHtml } from "@/lib/email/templateUtils"
import { emailTheme } from "@/lib/email/emailTheme"

type EmailLayoutOptions = {
  preheader?: string
  eyebrow?: string
  title: string
  intro?: string
  body: string
  notice?: string
  footer?: "standard" | "security" | "legal" | "internal"
}

export function renderEmailLayout(options: EmailLayoutOptions): string {
  const preheader = options.preheader ? escapeEmailHtml(options.preheader) : ""
  const eyebrow = options.eyebrow ? escapeEmailHtml(options.eyebrow) : ""
  const title = escapeEmailHtml(options.title)
  const intro = options.intro ? `<p style="margin:0 0 24px;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:16px;line-height:1.6">${escapeEmailHtml(options.intro)}</p>` : ""
  const notice = options.notice
    ? `<div style="margin:28px 0 0;border-left:4px solid ${emailTheme.yellowStrong};padding:12px 16px;background:#fffbea;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:13px;line-height:1.55">${escapeEmailHtml(options.notice)}</div>`
    : ""
  const footerCopy = options.footer === "security"
    ? "Je hebt deze beveiligingsmail ontvangen vanwege een accountactie."
    : options.footer === "legal"
      ? "Deze kennisgeving hoort bij je Site in a Box-account."
      : options.footer === "internal"
        ? "Interne operationele melding van Site in a Box."
        : "Site in a Box helpt je om professioneel online zichtbaar te zijn."

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${emailTheme.pageBackground};color:${emailTheme.text};font-family:${emailTheme.bodyFont};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${emailTheme.pageBackground};width:100%">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px">
        <tr><td style="padding:22px 28px;background:${emailTheme.plum};border:2px solid ${emailTheme.border};border-bottom:0;color:#fff">
          <div style="font-family:${emailTheme.headingFont};font-size:22px;font-weight:700;letter-spacing:-.02em">Site <span style="color:${emailTheme.yellow}">in a Box</span></div>
        </td></tr>
        <tr><td style="padding:36px 32px;background:${emailTheme.surface};border:2px solid ${emailTheme.border};box-shadow:${emailTheme.shadow}">
          ${eyebrow ? `<p style="margin:0 0 12px;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${eyebrow}</p>` : ""}
          <h1 style="margin:0 0 18px;color:${emailTheme.text};font-family:${emailTheme.headingFont};font-size:32px;font-weight:700;letter-spacing:-.03em;line-height:1.12">${title}</h1>
          ${intro}${options.body}${notice}
        </td></tr>
        <tr><td style="padding:24px 8px 8px;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:12px;line-height:1.6;text-align:center">
          <strong style="color:${emailTheme.text}">Site in a Box</strong><br>${footerCopy}<br><a href="https://www.siteinabox.nl/contact" style="color:${emailTheme.text};text-decoration:underline">Hulp nodig? Neem contact op</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function renderEmailButton(label: string, url: string): string {
  return `<p style="margin:28px 0 18px"><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:14px 20px;background:${emailTheme.yellow};border:2px solid ${emailTheme.border};box-shadow:${emailTheme.shadow};color:${emailTheme.text};font-family:${emailTheme.bodyFont};font-size:15px;font-weight:700;line-height:1.2;text-decoration:none">${escapeEmailHtml(label)}</a></p>`
}

export function renderEmailFallbackLink(url: string): string {
  return `<p style="margin:0;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:12px;line-height:1.55">Werkt de knop niet? Kopieer deze link naar je browser:<br><a href="${escapeEmailHtml(url)}" style="color:${emailTheme.text};word-break:break-all">${escapeEmailHtml(url)}</a></p>`
}

export function renderEmailInfoTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:24px 0;border:2px solid ${emailTheme.border};border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="width:34%;padding:10px 12px;border-bottom:1px solid ${emailTheme.border};font-family:${emailTheme.bodyFont};font-size:13px;font-weight:700;vertical-align:top">${escapeEmailHtml(label)}</td><td style="padding:10px 12px;border-bottom:1px solid ${emailTheme.border};font-family:${emailTheme.bodyFont};font-size:14px;line-height:1.45;word-break:break-word">${escapeEmailHtml(value)}</td></tr>`).join("")}</table>`
}
