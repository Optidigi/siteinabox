import { renderEmailLayout } from "@/lib/email/emailLayout"
import { escapeEmailHtml } from "@/lib/email/templateUtils"

export function englishLegalNotice(input: { tenantName: string; changeSummary: string; documentVersion?: string; effectiveAt: string;
  documentUrl: string; settingsUrl?: string; enforceAt?: string | null; objectionDeadlineAt?: string;
  documentContent?: string; mandatory?: boolean; kind?: string; mode: "reaccept" | "direct" | "continued" }) {
  const date = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/Amsterdam" }).format(new Date(value))
  const heading = input.mode === "direct" ? "Legal notice" : input.kind === "enforcement" ? "Action required now" : input.kind === "reminder" ? "Reminder" : "Updated legal terms"
  const explanation = input.mode === "direct" ? "Our legal information has changed. This disclosure does not request optional consent." :
    input.mode === "continued" ? "Using Site in a Box after the effective date without objecting before the response deadline applies the updated terms to your agreement." :
      input.mandatory ? "You can continue viewing and editing, but publication remains blocked until an owner accepts." : "The updated terms will be offered for acceptance at your next contractual transaction."
  const lines = ["Hello,", "", `${heading} for ${input.tenantName}.`, input.changeSummary,
    ...(input.documentVersion ? [`Document version: ${input.documentVersion}`] : []), `Effective from: ${date(input.effectiveAt)}`,
    ...(input.enforceAt ? [`Accept before: ${date(input.enforceAt)}`] : []),
    ...(input.objectionDeadlineAt ? [`Object before: ${date(input.objectionDeadlineAt)}`] : []), explanation,
    ...(input.settingsUrl ? [`Review, accept or object in your account: ${input.settingsUrl}`] : []),
    `Exact document version: ${input.documentUrl}`,
    ...(input.documentContent ? ["", "FULL UPDATED TERMS", input.documentContent] : []), "", "Site in a Box"]
  return { subject: `${heading}: ${input.tenantName.replace(/[\r\n]+/g, " ").trim()}`,
    text: lines.join("\n"), html: renderEmailLayout({ locale: "en", eyebrow: "Legal notice", title: heading,
      body: lines.filter(Boolean).map(line => `<p>${escapeEmailHtml(line).replace(/\n/g, "<br>")}</p>`).join("\n") +
        `<p><a href="${escapeEmailHtml(input.documentUrl)}">Read the exact document version</a></p>`, footer: "legal" }) }
}
