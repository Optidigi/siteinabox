import { renderEmailButton, renderEmailFallbackLink, renderEmailInfoTable, renderEmailLayout } from "@/lib/email/emailLayout"

export function microsoftMailboxReadyTemplate(input: {
  displayName: string
  userPrincipalName: string
  setupUrl: string
  locale?: "nl" | "en"
}) {
  const english = input.locale === "en"
  const subject = english ? "Your Microsoft mailbox is ready" : "Je Microsoft-mailbox is klaar"
  const title = english ? "Your mailbox is ready" : "Je mailbox is klaar"
  const intro = english
    ? `${input.displayName}, your Microsoft 365 mailbox is ready. Use the one-time link below to view your sign-in details.`
    : `${input.displayName}, je Microsoft 365-mailbox is klaar. Gebruik de eenmalige link hieronder om je inloggegevens te bekijken.`
  const button = renderEmailButton(english ? "View sign-in details" : "Bekijk inloggegevens", input.setupUrl)
  const mailboxLabel = english ? "Mailbox" : "Mailbox"
  const notice = english
    ? "This one-time link expires in 48 hours and can be opened once. Siteinabox will never email your temporary password directly."
    : "Deze eenmalige link verloopt na 48 uur en kan één keer worden geopend. Siteinabox mailt je tijdelijke wachtwoord niet rechtstreeks."
  return {
    subject,
    html: renderEmailLayout({
      locale: input.locale,
      preheader: subject,
      eyebrow: "Microsoft 365",
      title,
      intro,
      body: `${renderEmailInfoTable([[mailboxLabel, input.userPrincipalName]])}${button}${renderEmailFallbackLink(input.setupUrl, input.locale)}`,
      notice,
      footer: "security",
    }),
    text: [intro, "", `${mailboxLabel}: ${input.userPrincipalName}`, "", `${english ? "View sign-in details" : "Bekijk inloggegevens"}: ${input.setupUrl}`, "", english ? "One-time link expires in 48 hours." : "De eenmalige link verloopt na 48 uur."].join("\n"),
  }
}
