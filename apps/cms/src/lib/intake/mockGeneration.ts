import {
  SHADCNUI_BLOCK_VARIANTS,
  SITE_BLOCK_MANIFEST_FROM_CATALOG,
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
  ["hero-05", "features-04", "pricing-02", "faq-02", "team-03", "contact-01", "cta-05"],
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
      } as GeneratedBlockSpec

    case "featureList":
      return {
        ...base,
        blockType: "featureList",
        features: [
          { title: inline("Snel te scannen"), description: prose("Heldere hiërarchie op desktop en mobiel."), icon: "sparkles" },
          { title: inline("Tokenbewust"), description: prose("Semantische kleuren blijven leesbaar in licht en donker."), icon: "palette" },
          { title: inline("Contractgestuurd"), description: prose("Alle inhoud komt uit gevalideerde velden."), icon: "shield-check" },
          { title: inline("Responsief"), description: prose("Rasters, kaarten en tekst lopen gecontroleerd om."), icon: "panels-top-left" },
        ],
        ...optional(variant, "eyebrow", inline(`Mogelijkheden · ${label}`)),
        ...optional(variant, "title", inline("Een complete basis voor iedere landingspagina")),
        ...optional(variant, "intro", prose("Vergelijk ritme, contrast, typografie en responsief gedrag binnen dezelfde tenantscope.")),
      } as GeneratedBlockSpec

    case "testimonials":
      return {
        ...base,
        blockType: "testimonials",
        title: active(variant, "title") ? `Ervaringen met ${label}` : null,
        items: [
          { quote: "De pagina voelt rustig en blijft op ieder scherm overzichtelijk.", author: "Noor de Vries", role: "Product lead" },
          { quote: "De visuele hiërarchie maakt de belangrijkste actie direct duidelijk.", author: "Sam Jansen", role: "Ondernemer" },
          { quote: "Licht en donker sluiten zichtbaar op elkaar aan.", author: "Mila Smit", role: "Designer" },
          { quote: "Ook lange Nederlandse tekst blijft goed leesbaar.", author: "Daan Bakker", role: "Contentstrateeg" },
        ],
      }

    case "faq":
      return {
        ...base,
        blockType: "faq",
        items: [
          { question: inline("Werkt deze variant ook op mobiel?"), answer: prose("Ja. Controleer de accordeon, focusvolgorde en tekstomloop op smalle schermen.") },
          { question: inline("Kan ik licht en donker vergelijken?"), answer: prose("Ja. De fixture gebruikt de systeemmodus en de navigatie bevat de ondersteunde themaschakelaar.") },
          { question: inline("Komt alle inhoud uit het CMS?"), answer: prose("Ja. De providerweergave ontvangt uitsluitend gevalideerde gestructureerde data.") },
          { question: inline("Wat gebeurt er met onbekende varianten?"), answer: prose("Die worden afgewezen; de renderer valt nooit terug op een standaardvariant.") },
        ],
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

    case "pricing":
      return {
        ...base,
        blockType: "pricing",
        plans: [
          { title: inline("Basis"), description: prose("Voor een duidelijke start."), price: "€499", period: "eenmalig", features: [{ label: inline("Eén landingspagina"), included: true }, { label: inline("Responsief ontwerp"), included: true }, { label: inline("CMS-toegang"), included: true }], cta: { label: "Kies Basis", href: "/contact" } },
          { title: inline("Groei"), description: prose("Voor een breder verhaal."), price: "€899", period: "eenmalig", badge: "Populair", highlighted: true, features: [{ label: inline("Vijf pagina’s"), included: true }, { label: inline("Conversieblokken"), included: true }, { label: inline("SEO-basis"), included: true }], cta: { label: "Kies Groei", href: "/contact" } },
          { title: inline("Maatwerk"), description: prose("Voor aanvullende wensen."), price: "Op aanvraag", period: null, features: [{ label: inline("Persoonlijke begeleiding"), included: true }, { label: inline("Extra integraties"), included: true }, { label: inline("Uitgebreide inhoud"), included: true }], cta: { label: "Plan overleg", href: contactHref, external: true } },
        ],
        ...optional(variant, "eyebrow", inline(`Aanbod · ${label}`)),
        ...optional(variant, "title", inline("Een passend pakket voor iedere fase")),
        ...optional(variant, "intro", prose("Controleer kaarten, nadruk, badges, lange prijzen en actieknoppen.")),
      } as GeneratedBlockSpec

    case "stats":
      return {
        ...base,
        blockType: "stats",
        items: [
          { value: "148", label: "varianten", description: prose("Uit de vastgepinde publieke catalogus.") },
          { value: "132", label: "catalogusblokken", description: prose("Beschikbaar in de vastgepinde provider.") },
          { value: "16", label: "chromevarianten", description: prose("Voor banner, navigatie en footer.") },
          { value: "4×", label: "visuele modi", description: prose("Desktop en mobiel, licht en donker.") },
        ],
        ...optional(variant, "title", inline(`Meetbare dekking · ${label}`)),
        ...optional(variant, "intro", prose("Getallen met verschillende lengtes maken uitlijning en tekstomloop zichtbaar.")),
      } as GeneratedBlockSpec

    case "logoCloud":
      return {
        ...base,
        blockType: "logoCloud",
        logos: ["Acme", "Northstar", "Lumen", "Vertex", "Harbor", "Orbit", "Pioneer", "Summit"].map((name, index) => ({
          name,
          href: index % 2 === 0 ? `/partners/${name.toLowerCase()}` : null,
        })),
        ...optional(variant, "title", inline(`Partners en integraties · ${label}`)),
        ...optional(variant, "intro", prose("Controleer rasterdichtheid, marquees, randen en contrast zonder externe demo-data.")),
      } as GeneratedBlockSpec

    case "gallery":
      return {
        ...base,
        blockType: "gallery",
        images: [
          { image: null, caption: prose("Brede projectweergave 16:9"), link: { label: "Bekijk project", href: "/ervaringen" } },
          { image: null, caption: prose("Portretweergave 4:5") },
          { image: null, caption: prose("Detailweergave met langere toelichting") },
          { image: null, caption: prose("Mobiele uitsnede") },
          { image: null, caption: prose("Donkere modus") },
        ],
        ...optional(variant, "title", inline(`Projectgalerij · ${label}`)),
        ...optional(variant, "intro", prose("De lege CMS-mediareferenties houden de vaste bronverhoudingen zichtbaar zonder externe afbeeldingen te laden.")),
        ...optional(variant, "cta", { label: "Bekijk ervaringen", href: "/ervaringen" }),
      } as GeneratedBlockSpec

    case "contentSection":
      return {
        ...base,
        blockType: "contentSection",
        body: prose("Iedere stap gebruikt dezelfde semantische contracten, terwijl de letterlijke providerstructuur, bronklassen en responsieve regels behouden blijven."),
        ...optional(variant, "eyebrow", inline(`Werkwijze · ${label}`)),
        ...optional(variant, "title", inline("Van gevalideerde intake naar een controleerbare pagina")),
        ...optional(variant, "intro", prose("Deze tijdlijn controleert lange tekst, herhaalde stappen en de verticale pagina-opbouw.")),
        ...optional(variant, "features", [
          { title: inline("Intake"), description: prose("Gestructureerde bedrijfs- en inhoudsgegevens.") },
          { title: inline("Validatie"), description: prose("Alleen goedgekeurde varianten en slots.") },
          { title: inline("Voorbeeld"), description: prose("Dezelfde renderer in canvas, preview en publiek.") },
          { title: inline("Publicatie"), description: prose("Een expliciet gecontroleerde snapshot.") },
        ]),
        ...optional(variant, "bridge", prose("Eén manifest verbindt de catalogus met ieder runtime-oppervlak.")),
        ...optional(variant, "secondaryTitle", inline("Waarom dit betrouwbaar blijft")),
        ...optional(variant, "secondaryBody", prose("Onbekende varianten falen gesloten en de fixture gebruikt geen willekeurige broncode.")),
        ...optional(variant, "cta", { label: "Bekijk de werkwijze", href: "/werkwijze" }),
      } as GeneratedBlockSpec

    case "team":
      return {
        ...base,
        blockType: "team",
        members: [
          { name: "Noor de Vries", role: "Strategie", bio: prose("Brengt doelen en inhoud samen."), links: [{ label: "Profiel", href: "/team/noor" }] },
          { name: "Sam Jansen", role: "Ontwerp", bio: prose("Bewaakt ritme, contrast en toegankelijkheid."), links: [{ label: "Profiel", href: "/team/sam" }] },
          { name: "Mila Smit", role: "Content", bio: prose("Schrijft duidelijke en menselijke teksten."), links: [{ label: "Profiel", href: "/team/mila" }] },
          { name: "Daan Bakker", role: "Techniek", bio: prose("Zorgt voor betrouwbare rendering op ieder scherm."), links: [{ label: "Profiel", href: "/team/daan" }] },
        ],
        ...optional(variant, "title", inline(`Ons team · ${label}`)),
        ...optional(variant, "intro", prose("Namen, rollen en biografieën hebben bewust verschillende tekstlengtes.")),
      } as GeneratedBlockSpec

    case "blogCards":
      return {
        ...base,
        blockType: "blogCards",
        posts: [
          { title: inline("Zo bouw je een duidelijke landingspagina"), excerpt: prose("Een praktische blik op hiërarchie, ritme en conversie."), href: "/inzichten/landingspagina", date: "15 juli 2026", author: "Noor de Vries", authorRole: "Strategie", cta: { label: "Lees verder", href: "/inzichten/landingspagina" } },
          { title: inline("Donkere modus zonder verrassingen"), excerpt: prose("Waarom semantische tokens meer doen dan kleuren omkeren."), href: "/inzichten/donkere-modus", date: "8 juli 2026", author: "Sam Jansen", authorRole: "Ontwerp" },
          { title: inline("Responsief testen op inhoud"), excerpt: prose("Lange koppen en echte veldlengtes vinden andere fouten dan lorem ipsum."), href: "/inzichten/responsief", date: "1 juli 2026", author: "Mila Smit", authorRole: "Content" },
          { title: inline("Waarom varianten expliciet zijn"), excerpt: prose("Fail-closed rendering houdt gegenereerde pagina’s voorspelbaar."), href: "/inzichten/varianten", date: "24 juni 2026", author: "Daan Bakker", authorRole: "Techniek" },
        ],
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
      ogImage: null,
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
      version: 2,
      appearance: { mode: "system" },
      colors: { schemeId: "blue-professional" },
      fonts: { schemeId: "clear-modern" },
      density: { schemeId: "comfortable" },
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
          variant: "shadcnui-blocks.banner-02",
          visible: true,
          title: "Visuele testfixture",
          message: "Controleer deze pagina in licht en donker en op desktop en mobiel.",
          link: { label: "Start bij het overzicht", href: "/" },
          dismissible: true,
        },
      },
      navHeader: nav,
      navFooter: nav,
      contact: {
        phone: normalized.contact?.phone ?? null,
        social: [
          { platform: "LinkedIn", url: "https://www.linkedin.com/company/siteinabox" },
          { platform: "Instagram", url: "https://www.instagram.com/siteinabox" },
        ],
      },
      serviceArea: normalized.serviceArea.map((name) => ({ name })),
    },
    pages: smokeTestPages(normalized),
    blocks: SITE_BLOCK_MANIFEST_FROM_CATALOG,
    assets: [],
    generatedAt: new Date().toISOString(),
    generator: {
      name: "mock-site-generation",
      version: "shadcnui-blocks-five-page-smoke-v1",
      model: "fixture",
    },
  }
}
