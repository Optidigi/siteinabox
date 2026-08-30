import type { Page, ServicesBlock, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"

export const v1FixtureTheme: ThemeTokenSpec = {
  version: 3,
  appearance: { mode: "light", backgroundMode: "animation" },
  colors: { schemeId: "blue-professional" },
  fonts: { schemeId: "clear-modern" },
  shape: { schemeId: "soft" },
}

export const v1FixtureSettings: SiteSettings = {
  siteName: "Atelier Noord",
  siteUrl: "https://atelier-noord.example",
  description: "Een rustige, praktische service voor woningen en kleine bedrijven.",
  language: "nl",
  contactEmail: "hallo@atelier-noord.example",
  contact: { phone: "+31 6 12345678", address: "Utrecht en omgeving", social: [] },
  serviceArea: [{ name: "Utrecht" }, { name: "De Bilt" }],
  updatedAt: "2026-08-13T00:00:00.000Z",
  chrome: {
    navbar: {
      variant: "navbar-01",
      placement: "hero-overlay",
      activeMode: "anchor",
      mobileMenu: "dropdown",
      showThemeToggle: true,
      cta: { label: "Neem contact op", href: "#contact" },
    },
    footer: {
      variant: "footer-01",
      copyright: "© Atelier Noord",
    },
  },
  navigation: {
    primary: [
      { label: "Diensten", href: "#services" },
      { label: "Over mij", href: "#about" },
      { label: "Werkwijze", href: "#process" },
      {
        label: "Meer",
        description: "Bekijk werk, ervaringen en veelgestelde vragen.",
        children: [
          { label: "Recent werk", href: "#work", icon: "package" },
          { label: "Ervaringen", href: "#reviews", icon: "smile" },
          { label: "Veelgestelde vragen", href: "#faq", icon: "map-pin" },
        ],
      },
    ],
    footer: [
      { label: "Diensten", href: "#services" },
      { label: "Over mij", href: "#about" },
      { label: "Werkwijze", href: "#process" },
      { label: "Recent werk", href: "#work" },
      { label: "Ervaringen", href: "#reviews" },
      { label: "Contact", href: "#contact" },
    ],
  },
}

const service: ServicesBlock = {
  blockType: "services",
  variant: "services-01",
  heading: "Waarmee ik help",
  intro: "Duidelijke afspraken voor klussen die aandacht verdienen.",
  items: [
    { title: "Onderhoud", body: "Regelmatig onderhoud dat problemen voorkomt.", icon: "wrench" },
    { title: "Kleine reparaties", body: "Snel opgelost, met uitleg over wat er is gedaan.", icon: "check-circle" },
    { title: "Oplevering", body: "Een woning of werkruimte netjes achterlaten.", icon: "house" },
  ],
}

export const v1FixturePage: Page = {
  id: "atelier-noord-home",
  slug: "home",
  title: "Atelier Noord",
  status: "published",
  updatedAt: "2026-08-13T00:00:00.000Z",
  blocks: [
    { blockType: "hero", variant: "hero-01", heading: "Een verzorgd huis zonder gedoe", body: "Praktische hulp voor onderhoud, kleine reparaties en een nette oplevering.", primaryAction: { label: "Plan een kennismaking", href: "#contact" }, secondaryAction: { label: "Bekijk diensten", href: "#services" }, image: { url: "/fixture-media/project-kitchen.webp", alt: "Lichte keuken met verzorgde afwerking", width: 1448, height: 1086 }, highlights: [{ title: "Heldere afspraken", body: "Je weet vooraf wat er gebeurt en wanneer." }, { title: "Netjes gewerkt", body: "We laten de ruimte verzorgd en bruikbaar achter." }, { title: "Eén aanspreekpunt", body: "Je schakelt direct met degene die het werk uitvoert." }] },
    { blockType: "hero", variant: "hero-02", heading: "Van vraag naar een concrete aanpak", body: "Een paar duidelijke routes om snel te zien waarmee ik kan helpen.", primaryAction: { label: "Plan een kennismaking", href: "#contact" }, image: { url: "/fixture-media/location.webp", alt: "Rustige woonstraat met verzorgde woningen", width: 1672, height: 941 }, serviceHighlights: [{ title: "Voor woningen", body: "Praktische hulp voor onderhoud en kleine verbeteringen.", heroHeading: "Van vraag naar een concrete aanpak", heroBody: "Een paar duidelijke routes om snel te zien waarmee ik kan helpen.", primaryAction: { label: "Plan een kennismaking", href: "#contact" }, image: { url: "/fixture-media/location.webp", alt: "Rustige woonstraat met verzorgde woningen", width: 1672, height: 941 } }, { title: "Voor werkplekken", body: "Een nette, bruikbare ruimte voor dagelijks werk.", heroHeading: "Een werkplek die prettig blijft werken", heroBody: "Van kleine aanpassing tot zorgvuldig onderhoud: kies de aanpak die bij de ruimte past.", primaryAction: { label: "Bespreek je werkplek", href: "#contact" }, image: { url: "/fixture-media/workspace.webp", alt: "Rustige werkplek met materialen en gereedschap", width: 1402, height: 1122 } }, { title: "Voor kleine bedrijven", body: "Duidelijke afspraken en een verzorgd resultaat.", heroHeading: "Praktische hulp voor je bedrijf", heroBody: "Duidelijke afspraken en een resultaat waar je iedere dag op kunt bouwen.", primaryAction: { label: "Plan een kennismaking", href: "#contact" }, image: { url: "/fixture-media/project-office.webp", alt: "Lichte kantoorruimte met glazen wanden en werkplekken", width: 1402, height: 1122 } }, { title: "Onderhoud en herstel", body: "Gerichte hulp voor wat aandacht nodig heeft.", heroHeading: "Geef een ruimte weer de aandacht die ze nodig heeft", heroBody: "Gericht herstel en nette afwerking voor onderdelen die dagelijks verschil maken.", primaryAction: { label: "Bespreek je klus", href: "#contact" }, image: { url: "/fixture-media/project-kitchen.webp", alt: "Lichte keuken met verzorgde afwerking", width: 1448, height: 1086 } }] },
    { blockType: "hero", variant: "hero-03", heading: "Ruimte die weer prettig werkt", body: "Praktische verbetering met oog voor de details die je dagelijks merkt.", primaryAction: { label: "Plan een kennismaking", href: "#contact" }, image: { url: "/fixture-media/project-office.webp", alt: "Lichte kantoorruimte met glazen wanden en werkplekken", width: 1402, height: 1122 } },
    { blockType: "hero", variant: "hero-04", heading: "Zorgvuldig werk, duidelijk uitgelegd", body: "Een realistisch beeld van de kwaliteit en aandacht die je kunt verwachten.", primaryAction: { label: "Bekijk de mogelijkheden", href: "#services" }, image: { url: "/fixture-media/project-kitchen.webp", alt: "Lichte woonkamer met houten vloer en grote ramen", width: 1448, height: 1086 } },
    { blockType: "hero", variant: "hero-05", heading: "Een duidelijk plan voor jouw volgende stap", body: "Een heldere eerste stap met een realistisch beeld van het werk.", primaryAction: { label: "Bespreek je vraag", href: "#contact" }, secondaryAction: { label: "Bekijk diensten", href: "#services" }, image: { url: "/fixture-media/project-kitchen.webp", alt: "Lichte keuken met verzorgde afwerking", width: 1448, height: 1086 } },
    service,
    { blockType: "about", heading: "Persoonlijk en praktisch", body: "Je hebt één aanspreekpunt en weet vooraf waar je aan toe bent.", highlights: [{ title: "Heldere afspraken", text: "Een concreet voorstel voordat we starten." }, { title: "Zorgvuldig werk", text: "Aandacht voor details en een nette werkplek." }] },
    { blockType: "process", heading: "Zo werkt het", steps: [{ title: "Kennismaken", body: "We bespreken de vraag en de gewenste planning." }, { title: "Voorstel", body: "Je ontvangt een duidelijk voorstel met de volgende stap." }, { title: "Uitvoeren", body: "We voeren het werk zorgvuldig uit en ronden samen af." }] },
    { blockType: "work", heading: "Recent werk", projects: [{ sourceId: "project-kitchen", title: "Keuken opgefrist", summary: "Kleine herstelwerkzaamheden en een nette afwerking.", media: ["/fixture-media/project-kitchen.webp"] }, { sourceId: "project-office", title: "Kantoorruimte", summary: "Onderhoud en montage voor een kleine werkplek.", media: ["/fixture-media/project-office.webp"] }] },
    { blockType: "reviews", heading: "Ervaringen", reviewSourceIds: ["review-1", "review-2"], items: [{ sourceId: "review-1", quote: "Afspraken waren duidelijk en het werk is netjes gedaan.", name: "Sanne", context: "Utrecht" }, { sourceId: "review-2", quote: "Fijn contact en snel geholpen met een lastige klus.", name: "Mark", context: "De Bilt" }] },
    { blockType: "pricing", heading: "Veelgekozen opties", pricingSourceIds: ["price-1", "price-2"], offers: [{ sourceId: "price-1", title: "Kennismaking", description: "Bespreek je vraag en ontvang advies.", price: "€ 0", features: ["30 minuten", "Duidelijk vervolgadvies"] }, { sourceId: "price-2", title: "Werk op locatie", description: "Voor kleine onderhouds- en herstelklussen.", price: "Op aanvraag", features: ["Afspraak op locatie", "Voorstel vooraf"] }] },
    { blockType: "faq", heading: "Veelgestelde vragen", items: [{ question: "Werk je in mijn omgeving?", answer: "Ik werk in Utrecht en omliggende plaatsen. Stuur je postcode mee, dan laat ik weten of ik kan helpen." }, { question: "Kan ik eerst overleggen?", answer: "Ja, een korte kennismaking is de beste manier om de vraag en planning helder te krijgen." }] },
    { blockType: "cta", variant: "cta-01", heading: "Een klus op de planning?", body: "Vertel kort wat er moet gebeuren. Je krijgt snel een duidelijke reactie.", primaryAction: { label: "Neem contact op", href: "#contact" }, image: { url: "/fixture-media/project-office.webp", alt: "Lichte kantoorruimte met glazen wanden en werkplekken", width: 1402, height: 1122 } },
    { blockType: "contact", heading: "Neem contact op", body: "Beschrijf de klus en geef aan wanneer je beschikbaar bent.", contactMethods: [{ kind: "email", label: "E-mail", value: "hallo@atelier-noord.example", href: "mailto:hallo@atelier-noord.example" }, { kind: "phone", label: "Telefoon", value: "+31 6 12345678", href: "tel:+31612345678" }], form: { formName: "contact", submitLabel: "Verstuur bericht", fields: [{ name: "name", label: "Naam", type: "text", required: true }, { name: "email", label: "E-mail", type: "email", required: true }, { name: "message", label: "Waar kan ik mee helpen?", type: "textarea", required: true }] } },
  ],
}
