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
  const intro = options.intro ? `<p style="margin:0 0 18px;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:15px;font-weight:${emailTheme.bodyWeight};line-height:1.55">${escapeEmailHtml(options.intro)}</p>` : ""
  const notice = options.notice
    ? `<div style="margin:20px 0 0;border-left:3px solid ${emailTheme.yellowStrong};padding:10px 12px;background:#fffbea;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:12px;font-weight:${emailTheme.bodyWeight};line-height:1.5">${escapeEmailHtml(options.notice)}</div>`
    : ""
  const footerCopy = options.footer === "security"
    ? "Je hebt deze beveiligingsmail ontvangen vanwege een accountactie."
    : options.footer === "legal"
      ? "Deze kennisgeving hoort bij je Site in a Box-account."
      : options.footer === "internal"
        ? "Interne operationele melding van Site in a Box."
        : "Site in a Box helpt je om professioneel online zichtbaar te zijn."

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style type="text/css">@import url('${emailTheme.fontStylesheetUrl}');${emailTheme.headingFontFace}body,table,td,p,a,div,span,pre{font-family:${emailTheme.bodyFont}}h1,h2,h3,h4,h5,h6{font-family:${emailTheme.headingFont};font-weight:${emailTheme.headingWeight}}</style></head>
<body style="margin:0;padding:0;background:${emailTheme.pageBackground};color:${emailTheme.text};font-family:${emailTheme.bodyFont};font-weight:${emailTheme.bodyWeight};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${emailTheme.pageBackground};width:100%">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px">
        <tr><td style="padding:14px 22px;background:${emailTheme.plum};border:2px solid ${emailTheme.border};border-bottom:0;color:#fff">
          <img src="${emailTheme.logoUrl}" width="116" alt="Site in a Box" style="display:block;width:116px;height:auto;border:0;outline:none;text-decoration:none">
        </td></tr>
        <tr><td style="padding:26px 24px;background:${emailTheme.surface};border:2px solid ${emailTheme.border};box-shadow:${emailTheme.shadow}">
          ${eyebrow ? `<p style="margin:0 0 8px;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${eyebrow}</p>` : ""}
          <h1 style="margin:0 0 14px;color:${emailTheme.text};font-family:${emailTheme.headingFont};font-size:26px;font-weight:${emailTheme.headingWeight};letter-spacing:-.01em;line-height:1.15">${title}</h1>
          ${intro}<div style="color:${emailTheme.text};font-family:${emailTheme.bodyFont};font-size:14px;font-weight:${emailTheme.bodyWeight};line-height:1.55">${options.body}</div>${notice}
        </td></tr>
        <tr><td style="padding:18px 8px 4px;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:11px;line-height:1.55;text-align:center">
          ${footerCopy}<br><a href="https://www.siteinabox.nl/contact" style="color:${emailTheme.text};text-decoration:underline">Hulp nodig? Neem contact op</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function renderEmailButton(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 19px;border-collapse:collapse"><tr><td colspan="2"><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate"><tr><td bgcolor="${emailTheme.yellow}" style="background:${emailTheme.yellow};border:2px solid ${emailTheme.border};border-radius:0;mso-padding-alt:10px 20px"><a class="btn-eighteen" href="${escapeEmailHtml(url)}" style="display:block;padding:10px 20px;color:${emailTheme.text};font-family:${emailTheme.buttonFont};font-size:15px;font-weight:700;line-height:18px;text-align:center;text-decoration:none;white-space:nowrap">${escapeEmailHtml(label)}</a></td></tr></table></td><td width="5" height="42" valign="bottom" style="width:5px;height:42px;vertical-align:bottom"><table role="presentation" width="5" height="37" cellspacing="0" cellpadding="0" border="0" style="width:5px;height:37px;border-collapse:collapse"><tr><td bgcolor="${emailTheme.border}" style="background:${emailTheme.border};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr><tr><td width="5" height="5" style="width:5px;height:5px;font-size:0;line-height:0">&nbsp;</td><td height="5" bgcolor="${emailTheme.border}" style="height:5px;background:${emailTheme.border};font-size:0;line-height:0">&nbsp;</td><td width="5" height="5" bgcolor="${emailTheme.border}" style="width:5px;height:5px;background:${emailTheme.border};font-size:0;line-height:0">&nbsp;</td></tr></table>`
}

export function renderEmailFallbackLink(url: string): string {
  return `<p style="margin:0;color:${emailTheme.mutedText};font-family:${emailTheme.bodyFont};font-size:11px;line-height:1.5">Werkt de knop niet? Kopieer deze link naar je browser:<br><a href="${escapeEmailHtml(url)}" style="color:${emailTheme.text};word-break:break-all">${escapeEmailHtml(url)}</a></p>`
}

export function renderEmailInfoTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:18px 0;border:2px solid ${emailTheme.border};border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="width:32%;padding:8px 10px;border-bottom:1px solid ${emailTheme.border};font-family:${emailTheme.bodyFont};font-size:12px;font-weight:700;vertical-align:top">${escapeEmailHtml(label)}</td><td style="padding:8px 10px;border-bottom:1px solid ${emailTheme.border};font-family:${emailTheme.bodyFont};font-size:13px;line-height:1.4;word-break:break-word">${escapeEmailHtml(value)}</td></tr>`).join("")}</table>`
}
