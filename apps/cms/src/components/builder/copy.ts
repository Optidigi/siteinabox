import type { Locale } from "@/i18n/config"

export const builderCopy = {
  nl: {
    headline: "Wat gaan we bouwen?", placeholder: "Bijv: Ik ben kapper in Tilburg, ik doe knippen, kleur en baard.",
    signOut: "Uitloggen", preview: "Bekijk je site", chat: "Toon chat", phone: "Telefoon", goLive: "Ga live", frame: "Websitevoorbeeld",
    retry: "Probeer dezelfde aanvraag opnieuw", pending: "Deze aanvraag wordt nog verwerkt. Je kunt de status opnieuw opvragen.",
    failed: "De aanvraag is niet voltooid. Probeer dezelfde aanvraag opnieuw.", exhausted: "Je hebt je 12 bouwbeurten gebruikt. Je voorbeeld en checkout blijven beschikbaar.",
    unavailable: "Bouwen is nu niet beschikbaar. Je bestaande voorbeeld en checkout blijven beschikbaar.",
    remaining: "Bouwbeurten over", leest: "Leest…", schrijft: "Schrijft…", bouwt: "Bouwt de homepage…",
    ready: "Preview staat klaar", first: "Klaar voor je eerste site", you: "Jij", send: "Verzenden", newline: "Nieuwe regel",
  },
  en: {
    headline: "What shall we build?", placeholder: "For example: I am a hairdresser in Tilburg, offering cuts, colour and beard trims.",
    signOut: "Sign out", preview: "View your site", chat: "Show chat", phone: "Phone", goLive: "Go live", frame: "Website preview",
    retry: "Retry the same request", pending: "This request is still running. You can check its status again.",
    failed: "The request has not completed. Retry the same request.", exhausted: "You have used your 12 builder turns. Your preview and checkout remain available.",
    unavailable: "Building is currently unavailable. Your existing preview and checkout remain available.",
    remaining: "Builder turns remaining", leest: "Reading…", schrijft: "Writing…", bouwt: "Building the homepage…",
    ready: "Preview is ready", first: "Ready for your first site", you: "You", send: "Send", newline: "New line",
  },
} satisfies Record<Locale, Record<string, string>>
