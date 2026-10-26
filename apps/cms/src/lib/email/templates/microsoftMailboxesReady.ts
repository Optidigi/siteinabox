import { renderEmailButton, renderEmailFallbackLink, renderEmailInfoTable, renderEmailLayout } from "@/lib/email/emailLayout"

export function microsoftMailboxesReadyTemplate(input: { mailboxes: Array<{ displayName: string; userPrincipalName: string; setupUrl: string }>; locale: "nl" | "en" }) {
  const english = input.locale === "en"
  const subject = english ? "Your mailboxes are ready" : "Je mailboxen zijn klaar"
  return { subject,
    html: renderEmailLayout({ locale: input.locale, title: subject,
      intro: english ? "Use the links below to finish signing in to your mailboxes." : "Gebruik de links hieronder om het aanmelden bij je mailboxen af te ronden.",
      body: input.mailboxes.map(mailbox => `${renderEmailInfoTable([["Mailbox", mailbox.userPrincipalName]])}${renderEmailButton(english ? "View sign-in details" : "Bekijk inloggegevens", mailbox.setupUrl)}${renderEmailFallbackLink(mailbox.setupUrl, input.locale)}`).join(""),
      notice: english ? "Each link can be opened once and expires in 48 hours." : "Elke link kan één keer worden geopend en verloopt na 48 uur.", footer: "security" }),
    text: [subject, ...input.mailboxes.map(mailbox => `${mailbox.userPrincipalName}: ${mailbox.setupUrl}`), english ? "One-time links expire in 48 hours." : "De eenmalige links verlopen na 48 uur."].join("\n\n"),
  }
}
