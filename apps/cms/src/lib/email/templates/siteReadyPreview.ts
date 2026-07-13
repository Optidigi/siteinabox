import { renderEmailButton, renderEmailFallbackLink, renderEmailLayout } from "@/lib/email/emailLayout"

export function siteReadyPreviewTemplate({ loginUrl }: { loginUrl: string }) {
  return {
    subject: "Je Site in a Box-voorbeeld is klaar",
    html: renderEmailLayout({
      preheader: "Je Site in a Box-voorbeeld is klaar om te bekijken",
      eyebrow: "Je website",
      title: "Je voorbeeld is klaar",
      intro: "Je website staat klaar om te bekijken en te beoordelen.",
      body: `${renderEmailButton("Voorbeeld bekijken", loginUrl)}${renderEmailFallbackLink(loginUrl)}`,
      notice: "Met deze persoonlijke link word je direct ingelogd in je websitevoorbeeld.",
    }),
    text: [
      "Je Site in a Box-voorbeeld is klaar.",
      `Voorbeeld bekijken: ${loginUrl}`,
      "Met deze persoonlijke link word je direct ingelogd in je websitevoorbeeld.",
    ].join("\n"),
  }
}
