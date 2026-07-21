import {
  SHADCNUI_BLOCK_VARIANTS,
  type GeneratedBlockSpec,
  type NormalizedIntake,
  type RtBlockRoot,
  type RtInlineRoot,
  type SiteGenerationSpec,
} from "@siteinabox/contracts"

export type MockGenerationFixture = "generic" | "invalid"

type ProviderBlockVariant = (typeof SHADCNUI_BLOCK_VARIANTS)[number]

const LANDING_PAGES = [
  { slug: "index", title: "Overzicht", purpose: "Provider-overzicht" },
  { slug: "diensten", title: "Diensten", purpose: "Diensten en voordelen" },
  { slug: "werkwijze", title: "Werkwijze", purpose: "Proces en resultaten" },
  { slug: "ervaringen", title: "Ervaringen", purpose: "Team en klantverhalen" },
  { slug: "contact", title: "Contact", purpose: "Aanbod en conversie" },
] as const

const PAGE_SECTION_VARIANTS = [
  ["hero-01", "logo-cloud-01", "features-01", "stats-01", "testimonials-01", "blog-01", "cta-01"],
  ["hero-02", "features-02", "pricing-01", "timeline-01", "stats-02", "faq-01", "cta-02"],
  ["hero-03", "features-03", "timeline-02", "stats-03", "team-01", "testimonials-02", "cta-03"],
  ["hero-04", "logo-cloud-02", "carousel-block-01", "testimonials-03", "team-02", "blog-02", "cta-04"],
  ["hero-05", "features-04", "pricing-02", "faq-02", "team-03", "contact-02", "cta-05"],
] as const

const SMOKE_GALLERY_MEDIA = [
  { url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&h=1000&q=80", filename: "smoke-office-interior.jpg", alt: "Lichte kantoorruimte met glazen wanden", width: 1600, height: 1000 },
  { url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&h=1000&q=80", filename: "smoke-team-collaboration.jpg", alt: "Team aan het werk rond een tafel", width: 1600, height: 1000 },
  { url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&h=1000&q=80", filename: "smoke-portrait-professional.jpg", alt: "Portret van een professional", width: 800, height: 1000 },
  { url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&h=900&q=80", filename: "smoke-analytics-desk.jpg", alt: "Laptop met analyticsdashboard", width: 1600, height: 900 },
  { url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&h=900&q=80", filename: "smoke-workshop-session.jpg", alt: "Workshop met sticky notes op glas", width: 1600, height: 900 },
  { url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&h=800&q=80", filename: "smoke-portrait-a.jpg", alt: "Portret teamlid A", width: 800, height: 800 },
  { url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&h=800&q=80", filename: "smoke-portrait-b.jpg", alt: "Portret teamlid B", width: 800, height: 800 },
  { url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=800&h=800&q=80", filename: "smoke-portrait-c.jpg", alt: "Portret teamlid C", width: 800, height: 800 },
  { url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=800&h=800&q=80", filename: "smoke-portrait-d.jpg", alt: "Portret teamlid D", width: 800, height: 800 },
] as const

/** Full brand logos (symbol + wordmark) via Devicon; readable on light, forced white in dark via logo-cloud invert. */
const SMOKE_LOGO_MEDIA = [
  { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original-wordmark.svg", filename: "smoke-logo-react.svg", alt: "React", width: 200, height: 80 },
  { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original-wordmark.svg", filename: "smoke-logo-github.svg", alt: "GitHub", width: 200, height: 80 },
  { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original-wordmark.svg", filename: "smoke-logo-nextjs.svg", alt: "Next.js", width: 200, height: 80 },
  { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vercel/vercel-original-wordmark.svg", filename: "smoke-logo-vercel.svg", alt: "Vercel", width: 200, height: 80 },
  { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original-wordmark.svg", filename: "smoke-logo-nodejs.svg", alt: "Node.js", width: 200, height: 80 },
  { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original-wordmark.svg", filename: "smoke-logo-docker.svg", alt: "Docker", width: 200, height: 80 },
  { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg", filename: "smoke-logo-aws.svg", alt: "AWS", width: 200, height: 80 },
  { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/slack/slack-original-wordmark.svg", filename: "smoke-logo-slack.svg", alt: "Slack", width: 200, height: 80 },
] as const


const inline = (value: string): RtInlineRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: value }],
})

const prose = (value: string): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: value }] }],
})

const active = (variant: ProviderBlockVariant, field: string) =>
  (variant.slots as Record<string, { status: "required" | "optional" | "inactive" }>)[field]?.status !== "inactive"

const optional = <T>(variant: ProviderBlockVariant, field: string, value: T) =>
  active(variant, field) ? { [field]: value } : {}

const fitRepeated = <T>(variant: ProviderBlockVariant, field: string, values: T[]) => {
  const slot = (variant.slots as Record<string, { minItems?: number; maxItems?: number }>)[field]
  const fitted = values.slice(0, slot?.maxItems ?? values.length)
  if (fitted.length < (slot?.minItems ?? 0)) throw new Error(`${variant.id} requires more ${field} fixture items.`)
  return fitted
}

/** Preferred smoke counts: full last row at laptop+ column count, then clipped by catalog max. */
const SMOKE_REPEATER_PREFER: Record<string, number> = {
  "shadcnui-blocks.features-01": 3,
  "shadcnui-blocks.features-02": 3,
  "shadcnui-blocks.features-03": 2,
  "shadcnui-blocks.features-04": 4,
  "shadcnui-blocks.stats-01": 3,
  "shadcnui-blocks.stats-02": 4,
  "shadcnui-blocks.stats-03": 3,
  "shadcnui-blocks.testimonials-01": 3,
  "shadcnui-blocks.testimonials-02": 3,
  "shadcnui-blocks.testimonials-03": 3,
  "shadcnui-blocks.blog-01": 3,
  "shadcnui-blocks.blog-02": 3,
  "shadcnui-blocks.pricing-01": 3,
  "shadcnui-blocks.pricing-02": 3,
  "shadcnui-blocks.team-01": 4,
  "shadcnui-blocks.team-02": 4,
  "shadcnui-blocks.team-03": 3,
  "shadcnui-blocks.logo-cloud-01": 4,
  "shadcnui-blocks.logo-cloud-02": 8,
  "shadcnui-blocks.carousel-block-01": 5,
  "shadcnui-blocks.timeline-01": 4,
  "shadcnui-blocks.timeline-02": 4,
  "shadcnui-blocks.faq-01": 4,
  "shadcnui-blocks.faq-02": 4,
}

const fitPreferred = <T>(variant: ProviderBlockVariant, field: string, values: T[]) => {
  const prefer = SMOKE_REPEATER_PREFER[variant.id]
  return fitRepeated(variant, field, prefer == null ? values : values.slice(0, prefer))
}

const smokeAsset = (index: number, alt?: string) => {
  const asset = SMOKE_GALLERY_MEDIA[index % SMOKE_GALLERY_MEDIA.length]!
  return alt ? { ...asset, alt } : { ...asset }
}

const smokeLogo = (index: number, name: string) => {
  const asset = SMOKE_LOGO_MEDIA[index % SMOKE_LOGO_MEDIA.length]!
  return { ...asset, alt: `${name} logo` }
}

const smokePortrait = (index: number, alt: string) => smokeAsset(5 + (index % 4), alt)


const variantLabel = (variant: ProviderBlockVariant) => variant.id.replace("shadcnui-blocks.", "")
const pageHref = (pageIndex: number) => pageIndex === 0 ? "/" : `/${LANDING_PAGES[pageIndex]!.slug}`

function blockForVariant(
  variant: ProviderBlockVariant,
  normalized: NormalizedIntake,
  pageIndex: number,
): GeneratedBlockSpec {
  const label = variantLabel(variant)
  const page = LANDING_PAGES[pageIndex]!
  const contactHref = `mailto:${normalized.contact?.email ?? "hello@example.com"}`
  const summary = normalized.goals.length
    ? normalized.goals.join(". ")
    : `Een heldere website voor ${normalized.businessName}.`
  const base = {
    designVariant: variant.id,
    anchor: label,
    source: "import" as const,
  }

  switch (variant.blockType) {
    case "hero":
      return {
        ...base,
        blockType: "hero",
        headline: inline(`${page.title}: ${normalized.businessName}`),
        ...optional(variant, "eyebrow", inline(`Smoketest · ${label}`)),
        ...optional(variant, "subheadline", prose(`${summary} Deze sectie controleert ${label} in de volledige pagina-opbouw.`)),
        ...optional(variant, "pills", [{ label: "Radix" }, { label: "Licht/donker" }, { label: "Responsive" }]),
        ...optional(variant, "links", LANDING_PAGES.slice(0, 4).map((entry, index) => ({ label: entry.title, href: pageHref(index) }))),
        ...optional(variant, "cta", { label: "Bekijk diensten", href: "/diensten" }),
        ...optional(variant, "secondary", { label: "Neem contact op", href: contactHref, external: true }),
        ...optional(variant, "stats", [
          { value: "148", label: "publieke varianten" },
          { value: "5", label: "landingspagina’s" },
          { value: "4", label: "viewportmodi" },
          { value: "100%", label: "expliciet" },
        ]),
        ...optional(variant, "image", smokeAsset(0, `${page.title} hero`)),
      } as GeneratedBlockSpec

    case "featureList":
      return {
        ...base,
        blockType: "featureList",
        features: fitPreferred(variant, "features", [
          { title: inline("Snel te scannen"), description: prose("Heldere hiërarchie op desktop en mobiel."), icon: "sparkles", image: smokeAsset(0, "Snel te scannen") },
          { title: inline("Tokenbewust"), description: prose("Semantische kleuren blijven leesbaar in licht en donker."), icon: "palette", image: smokeAsset(1, "Tokenbewust") },
          { title: inline("Contractgestuurd"), description: prose("Alle inhoud komt uit gevalideerde velden."), icon: "shield-check", image: smokeAsset(3, "Contractgestuurd") },
          { title: inline("Responsief"), description: prose("Rasters, kaarten en tekst lopen gecontroleerd om."), icon: "panels-top-left", image: smokeAsset(4, "Responsief") },
        ]),
        ...optional(variant, "eyebrow", inline(`Mogelijkheden · ${label}`)),
        ...optional(variant, "title", inline("Een complete basis voor iedere landingspagina")),
        ...optional(variant, "intro", prose("Vergelijk ritme, contrast, typografie en responsief gedrag binnen dezelfde tenantscope.")),
      } as GeneratedBlockSpec

    case "testimonials":
      return {
        ...base,
        blockType: "testimonials",
        title: active(variant, "title") ? `Ervaringen met ${label}` : null,
        items: fitPreferred(variant, "items", [
          { quote: "De pagina voelt rustig en blijft op ieder scherm overzichtelijk.", author: "Noor de Vries", role: "Product lead", avatar: smokePortrait(0, "Noor de Vries") },
          { quote: "De visuele hiërarchie maakt de belangrijkste actie direct duidelijk.", author: "Sam Jansen", role: "Ondernemer", avatar: smokePortrait(1, "Sam Jansen") },
          { quote: "Licht en donker sluiten zichtbaar op elkaar aan.", author: "Mila Smit", role: "Designer", avatar: smokePortrait(2, "Mila Smit") },
          { quote: "Ook lange Nederlandse tekst blijft goed leesbaar.", author: "Daan Bakker", role: "Contentstrateeg", avatar: smokePortrait(3, "Daan Bakker") },
        ]),
      }

    case "faq":
      return {
        ...base,
        blockType: "faq",
        items: fitPreferred(variant, "items", [
          { question: inline("Werkt deze variant ook op mobiel?"), answer: prose("Ja. Controleer de accordeon, focusvolgorde en tekstomloop op smalle schermen.") },
          { question: inline("Kan ik licht en donker vergelijken?"), answer: prose("Ja. De fixture gebruikt de systeemmodus en de navigatie bevat de ondersteunde themaschakelaar.") },
          { question: inline("Komt alle inhoud uit het CMS?"), answer: prose("Ja. De providerweergave ontvangt uitsluitend gevalideerde gestructureerde data.") },
          { question: inline("Wat gebeurt er met onbekende varianten?"), answer: prose("Die worden afgewezen; de renderer valt nooit terug op een standaardvariant.") },
        ]),
        ...optional(variant, "title", inline(`Veelgestelde vragen · ${label}`)),
      } as GeneratedBlockSpec

    case "cta":
      return {
        ...base,
        blockType: "cta",
        headline: inline(`Klaar om ${label} te beoordelen?`),
        ...optional(variant, "eyebrow", inline("Volgende stap")),
        ...optional(variant, "description", prose("Bekijk dezelfde sectie op desktop en mobiel, in licht en donker, en controleer daarna de focus- en hoverstatussen.")),
        ...optional(variant, "primary", { label: "Naar contact", href: "/contact" }),
        ...optional(variant, "secondary", { label: "Terug naar overzicht", href: "/" }),
        ...optional(variant, "backgroundImage", smokeAsset(
          variant.id === "shadcnui-blocks.cta-03" || variant.id === "shadcnui-blocks.cta-04" ? 2 : 0,
          `${label} achtergrond`,
        )),
      } as GeneratedBlockSpec

    case "contactSection":
      return {
        ...base,
        blockType: "contactSection",
        formName: `smoke-test-${label}`,
        fields: [
          { name: "first-name", label: "Voornaam", type: "text", required: true, placeholder: "Voornaam", maxLength: 80 },
          { name: "last-name", label: "Achternaam", type: "text", required: true, placeholder: "Achternaam", maxLength: 80 },
          { name: "company", label: "Bedrijf", type: "text", placeholder: "Bedrijfsnaam", maxLength: 120 },
          { name: "email", label: "E-mailadres", type: "email", required: true, placeholder: "naam@bedrijf.nl", maxLength: 254 },
          { name: "phone-number", label: "Telefoonnummer", type: "tel", placeholder: "06 12 34 56 78", maxLength: 32 },
          { name: "message", label: "Waar kunnen we mee helpen?", type: "textarea", required: true, placeholder: "Vertel kort over je vraag", maxLength: 2_000 },
        ],
        ...optional(variant, "title", inline(`Neem contact op · ${label}`)),
        ...optional(variant, "description", prose("Dit formulier controleert labels, invoervelden, foutvrije hydratatie en toetsenbordbediening.")),
        ...optional(variant, "submitLabel", "Versturen"),
        ...optional(variant, "provider", { provider: "siab", action: "/api/forms", method: "POST" as const }),
      } as GeneratedBlockSpec

    case "contactDetails":
      return {
        ...base,
        blockType: "contactDetails",
        items: [
          { title: "E-mail", description: "Reactie binnen één werkdag", value: normalized.contact?.email ?? "hello@example.com", href: contactHref, icon: "mail" },
          { title: "Telefoon", description: "Bereikbaar tijdens kantooruren", value: normalized.contact?.phone ?? "+31 20 000 0000", href: normalized.contact?.phone ? `tel:${normalized.contact.phone}` : null, icon: "phone" },
          { title: "Werkgebied", description: "Op locatie en op afstand", value: normalized.serviceArea.join(", ") || "Nederland", icon: "map-pin" },
        ],
        ...optional(variant, "title", inline(`Contactmogelijkheden · ${label}`)),
        ...optional(variant, "description", prose("Alle contactgegevens komen uit de normale tenantinstellingen en gevalideerde blokinhoud.")),
      } as GeneratedBlockSpec

    case "pricing":
      return {
        ...base,
        blockType: "pricing",
        plans: fitPreferred(variant, "plans", [
          { title: inline("Basis"), description: prose("Voor een duidelijke start."), price: "€499", period: "eenmalig", features: [{ label: inline("Eén landingspagina"), included: true }, { label: inline("Responsief ontwerp"), included: true }, { label: inline("CMS-toegang"), included: true }], cta: { label: "Kies Basis", href: "/contact" } },
          { title: inline("Groei"), description: prose("Voor een breder verhaal."), price: "€899", period: "eenmalig", badge: "Populair", highlighted: true, features: [{ label: inline("Vijf pagina’s"), included: true }, { label: inline("Conversieblokken"), included: true }, { label: inline("SEO-basis"), included: true }], cta: { label: "Kies Groei", href: "/contact" } },
          { title: inline("Maatwerk"), description: prose("Voor aanvullende wensen."), price: "Op aanvraag", period: null, features: [{ label: inline("Persoonlijke begeleiding"), included: true }, { label: inline("Extra integraties"), included: true }, { label: inline("Uitgebreide inhoud"), included: true }], cta: { label: "Plan overleg", href: contactHref, external: true } },
        ]),
        ...optional(variant, "eyebrow", inline(`Aanbod · ${label}`)),
        ...optional(variant, "title", inline("Een passend pakket voor iedere fase")),
        ...optional(variant, "intro", prose("Controleer kaarten, nadruk, badges, lange prijzen en actieknoppen.")),
      } as GeneratedBlockSpec

    case "stats":
      return {
        ...base,
        blockType: "stats",
        items: fitPreferred(variant, "items", [
          { value: "148", label: "varianten", description: prose("Uit de vastgepinde publieke catalogus.") },
          { value: "132", label: "catalogusblokken", description: prose("Beschikbaar in de vastgepinde provider.") },
          { value: "16", label: "chromevarianten", description: prose("Voor banner, navigatie en footer.") },
          { value: "4×", label: "visuele modi", description: prose("Desktop en mobiel, licht en donker.") },
        ]),
        ...optional(variant, "title", inline(`Meetbare dekking · ${label}`)),
        ...optional(variant, "intro", prose("Getallen met verschillende lengtes maken uitlijning en tekstomloop zichtbaar.")),
      } as GeneratedBlockSpec

    case "logoCloud":
      return {
        ...base,
        blockType: "logoCloud",
        logos: fitPreferred(variant, "logos", ["Acme", "Northstar", "Lumen", "Vertex", "Harbor", "Orbit", "Pioneer", "Summit"].map((name, index) => ({
          name,
          image: smokeLogo(index, name),
          href: index % 2 === 0 ? `/partners/${name.toLowerCase()}` : null,
        }))),
        ...optional(variant, "title", inline(`Partners en integraties · ${label}`)),
        ...optional(variant, "intro", prose("Controleer rasterdichtheid, marquees, randen en contrast zonder externe demo-data.")),
      } as GeneratedBlockSpec

    case "gallery":
      return {
        ...base,
        blockType: "gallery",
        images: fitPreferred(variant, "images", [
          { image: smokeAsset(0), caption: prose("Kantoorinterieur voor brede projectweergave"), link: { label: "Bekijk project", href: "/ervaringen" } },
          { image: smokeAsset(2), caption: prose("Portretweergave voor mobiele controle") },
          { image: smokeAsset(1), caption: prose("Teamsamenwerking in context") },
          { image: smokeAsset(3), caption: prose("Product- en analyticsweergave") },
          { image: smokeAsset(4), caption: prose("Workshop- en procesweergave") },
        ]),
        ...optional(variant, "title", inline(`Projectgalerij · ${label}`)),
        ...optional(variant, "intro", prose("SIAB-eigen testassets worden door de normale importer als tenantmedia opgeslagen en behouden hun bronafmetingen.")),
        ...optional(variant, "cta", { label: "Bekijk ervaringen", href: "/ervaringen" }),
      } as GeneratedBlockSpec

    case "timeline":
      return {
        ...base,
        blockType: "timeline",
        items: fitPreferred(variant, "items", [
          { title: "Intake", description: "Gestructureerde bedrijfs- en inhoudsgegevens.", label: "Stap 1", date: "Dag 1", tags: [{ value: "Content" }] },
          { title: "Validatie", description: "Alleen goedgekeurde varianten en actieve slots.", label: "Stap 2", date: "Dag 2", tags: [{ value: "Contract" }] },
          { title: "Voorbeeld", description: "Dezelfde renderer in canvas, preview en publiek.", label: "Stap 3", date: "Dag 3", tags: [{ value: "UI" }] },
          { title: "Publicatie", description: "Een expliciet gecontroleerde snapshot.", label: "Stap 4", date: "Dag 4", tags: [{ value: "Live" }] },
        ]),
        ...optional(variant, "title", inline(`Werkwijze · ${label}`)),
        ...optional(variant, "intro", prose("Deze tijdlijn controleert lange tekst, herhaalde stappen en de verticale pagina-opbouw.")),
      } as GeneratedBlockSpec

    case "team":
      return {
        ...base,
        blockType: "team",
        members: fitPreferred(variant, "members", [
          { name: "Noor de Vries", role: "Strategie", bio: prose("Brengt doelen en inhoud samen."), image: smokePortrait(0, "Noor de Vries"), links: [{ label: "Profiel", href: "/team/noor" }] },
          { name: "Sam Jansen", role: "Ontwerp", bio: prose("Bewaakt ritme, contrast en toegankelijkheid."), image: smokePortrait(1, "Sam Jansen"), links: [{ label: "Profiel", href: "/team/sam" }] },
          { name: "Mila Smit", role: "Content", bio: prose("Schrijft duidelijke en menselijke teksten."), image: smokePortrait(2, "Mila Smit"), links: [{ label: "Profiel", href: "/team/mila" }] },
          { name: "Daan Bakker", role: "Techniek", bio: prose("Zorgt voor betrouwbare rendering op ieder scherm."), image: smokePortrait(3, "Daan Bakker"), links: [{ label: "Profiel", href: "/team/daan" }] },
        ]),
        ...optional(variant, "title", inline(`Ons team · ${label}`)),
        ...optional(variant, "intro", prose("Namen, rollen en biografieën hebben bewust verschillende tekstlengtes.")),
      } as GeneratedBlockSpec

    case "blogCards":
      return {
        ...base,
        blockType: "blogCards",
        posts: fitPreferred(variant, "posts", [
          { title: inline("Zo bouw je een duidelijke landingspagina"), excerpt: prose("Een praktische blik op hiërarchie, ritme en conversie."), image: smokeAsset(0, "Landingspagina artikel"), href: "/inzichten/landingspagina", date: "15 juli 2026", author: "Noor de Vries", authorRole: "Strategie", cta: { label: "Lees verder", href: "/inzichten/landingspagina" } },
          { title: inline("Donkere modus zonder verrassingen"), excerpt: prose("Waarom semantische tokens meer doen dan kleuren omkeren."), image: smokeAsset(3, "Donkere modus artikel"), href: "/inzichten/donkere-modus", date: "8 juli 2026", author: "Sam Jansen", authorRole: "Ontwerp" },
          { title: inline("Responsief testen op inhoud"), excerpt: prose("Lange koppen en echte veldlengtes vinden andere fouten dan lorem ipsum."), image: smokeAsset(1, "Responsief artikel"), href: "/inzichten/responsief", date: "1 juli 2026", author: "Mila Smit", authorRole: "Content" },
          { title: inline("Waarom varianten expliciet zijn"), excerpt: prose("Fail-closed rendering houdt gegenereerde pagina’s voorspelbaar."), image: smokeAsset(4, "Varianten artikel"), href: "/inzichten/varianten", date: "24 juni 2026", author: "Daan Bakker", authorRole: "Techniek" },
        ]),
        ...optional(variant, "title", inline(`Inzichten · ${label}`)),
        ...optional(variant, "intro", prose("Controleer kaarten met uiteenlopende titels, metadata, links en tekstlengtes.")),
      } as GeneratedBlockSpec
  }
}

function smokeTestPages(normalized: NormalizedIntake): SiteGenerationSpec["pages"] {
  return LANDING_PAGES.map((page, pageIndex) => ({
    slug: page.slug,
    title: page.title,
    status: "draft" as const,
    seo: {
      title: `${page.title} | ${normalized.businessName}`,
      description: `${page.purpose} voor de shadcnui-blocks smoketest.`,
      ogImage: smokeAsset(3, `${page.title} social preview`),
    },
    blocks: PAGE_SECTION_VARIANTS[pageIndex]!.map((name) => {
      const id = `shadcnui-blocks.${name}`
      const variant = SHADCNUI_BLOCK_VARIANTS.find((candidate) => candidate.id === id)
      if (!variant) throw new Error(`Mock site references unknown provider variant: ${id}`)
      return blockForVariant(variant, normalized, pageIndex)
    }),
  }))
}

export function loadMockSiteGenerationSpec(
  normalized: NormalizedIntake,
  fixture: MockGenerationFixture = "generic",
): SiteGenerationSpec {
  const contactEmail = normalized.contact?.email ?? "hello@example.com"
  const summary = normalized.goals.length
    ? normalized.goals.join(". ")
    : `Een heldere website voor ${normalized.businessName}.`
  const nav = LANDING_PAGES.map((page, index) => ({ label: page.title, href: pageHref(index) }))
  const pages = smokeTestPages(normalized)
  const blocks = [...new Set(pages.flatMap((page) => page.blocks.map((block) => block.blockType)))].map((slug) => ({ slug, label: slug }))

  return {
    schemaVersion: 1,
    intake: normalized,
    tenant: {
      name: normalized.businessName,
      slug: fixture === "invalid" ? "Invalid Slug" : normalized.tenantSlug,
      domain: normalized.primaryDomain,
      status: "provisioning",
    },
    theme: {
      version: 3,
      appearance: { mode: "system" },
      colors: { schemeId: "monochrome" },
      fonts: { schemeId: "clear-modern" },
      shape: { schemeId: "soft" },
    },
    settings: {
      siteName: normalized.businessName,
      siteUrl: normalized.siteUrl,
      description: summary,
      language: normalized.language,
      contactEmail,
      chrome: {
        header: {
          variant: "shadcnui-blocks.navbar-02",
          behavior: "sticky",
          activeMode: "path",
          mobileMenu: "drawer",
          secondaryAction: { label: "Over ons", href: "/werkwijze" },
          cta: { label: "Contact", href: "/contact" },
        },
        footer: {
          variant: "shadcnui-blocks.footer-03",
          tagline: "Vijf geïntegreerde landingspagina’s voor visuele providercontrole.",
          copyright: `(c) ${normalized.businessName}`,
          legalLinks: [{ label: "Privacy", href: "/privacy-en-cookieverklaring" }],
          columns: [
            { id: "pages", items: [{ id: "pages-links", type: "navigation", label: "Pagina’s", links: nav.slice(0, 3) }] },
            { id: "more", items: [{ id: "more-links", type: "links", label: "Meer", links: nav.slice(3) }] },
            { id: "contact", items: [{ id: "contact-details", type: "contact", label: "Contact", text: contactEmail, links: [{ label: "E-mail", href: `mailto:${contactEmail}`, external: true }] }] },
          ],
          newsletter: {
            title: "Ontvang provider-updates",
            placeholder: "naam@bedrijf.nl",
            submitLabel: "Aanmelden",
            action: "/api/forms",
            method: "POST",
          },
        },
        banner: {
          variant: "shadcnui-blocks.banner-01",
          visible: true,
          title: "Visuele testfixture",
          message: "Controleer deze pagina in licht en donker en op desktop en mobiel.",
          link: { label: "Start bij het overzicht", href: "/" },
          dismissible: true,
        },
      },
      systemTemplates: { notFound: { variant: "shadcnui-blocks.not-found-08" } },
      navHeader: nav,
      navFooter: nav,
      contact: {
        phone: normalized.contact?.phone ?? null,
        address: normalized.contact?.address ?? "Stationsplein 1, Amsterdam",
        social: [
          { platform: "LinkedIn", url: "https://www.linkedin.com/company/siteinabox" },
          { platform: "Instagram", url: "https://www.instagram.com/siteinabox" },
        ],
      },
      serviceArea: normalized.serviceArea.map((name) => ({ name })),
    },
    pages,
    blocks,
    assets: [...SMOKE_GALLERY_MEDIA, ...SMOKE_LOGO_MEDIA],
    generatedAt: new Date().toISOString(),
    generator: {
      name: "mock-site-generation",
      version: "shadcnui-blocks-five-page-smoke-v1",
      model: "fixture",
    },
  }
}
