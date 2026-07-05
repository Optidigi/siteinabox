import type { NormalizedIntake, SiteGenerationSpec } from "@siteinabox/contracts/generation"
import type { RtBlockRoot, RtInlineRoot } from "@siteinabox/contracts/rich-text"

export type MockGenerationFixture = "generic" | "invalid"

const cloneSpec = (spec: SiteGenerationSpec): SiteGenerationSpec =>
  JSON.parse(JSON.stringify(spec)) as SiteGenerationSpec

const inlineText = (text: string): RtInlineRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const blockText = (text: string): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

const genericSiteGenerationSpec: SiteGenerationSpec = {
  schemaVersion: 1,
  intake: {
    businessName: "Generated Business",
    tenantSlug: "generated-business",
    primaryDomain: "generated-business.test",
    siteUrl: "https://generated-business.test",
    language: "nl",
    serviceArea: [],
    goals: [],
    requestedPages: [{ slug: "index", title: "Home", purpose: "Generated homepage" }],
  },
  tenant: {
    name: "Generated Business",
    slug: "generated-business",
    domain: "generated-business.test",
    status: "provisioning",
  },
  theme: {
    colors: {
      accent: "#2563eb",
      bg: "#ffffff",
      ink: "#111827",
      muted: "#4b5563",
      card: "#f8fafc",
      secondary: "#059669",
      rule: "#e5e7eb",
    },
    fonts: {
      title: "Inter",
      heading: "Inter",
      text: "Inter",
    },
    radius: "8px",
    density: "comfortable",
    borderStyle: "solid",
    mode: "light",
    stylePreset: "catalog-clean",
  },
  settings: {
    siteName: "Generated Business",
    siteUrl: "https://generated-business.test",
    description: "A generated draft website based on reusable catalog blocks.",
    language: "nl",
    contactEmail: "hello@example.com",
    branding: { primaryColor: "#2563eb" },
    chrome: {
      header: {
        variant: "tailwindplus.marketing.header.with-stacked-flyout-menu",
        behavior: "sticky",
        activeMode: "path",
        mobileMenu: "drawer",
        cta: { label: "Contact", href: "/#contact" },
      },
      footer: {
        variant: "default",
        tagline: "Generated with reusable catalog blocks.",
        copyright: "(c) Generated Business",
        legalLinks: [],
        columns: [
          {
            id: "main",
            items: [
              {
                id: "brand",
                type: "brand",
                label: "Generated Business",
                text: "Reusable catalog draft.",
                links: [],
              },
            ],
          },
          {
            id: "contact",
            items: [
              {
                id: "email",
                type: "contact",
                label: "Contact",
                text: null,
                links: [{ label: "hello@example.com", href: "mailto:hello@example.com" }],
              },
            ],
          },
        ],
      },
      banner: {
        variant: "tailwindplus.marketing.banner.with-button",
        visible: true,
        title: "Nieuwe draft",
        message: "Preview draft ready.",
        link: { label: "Contact", href: "/#contact" },
        dismissible: true,
      },
    },
    contact: { phone: null, address: null, social: [] },
    navHeader: [
      { label: "Home", href: "/" },
      { label: "Services", href: "/#services" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Team", href: "/#team" },
      { label: "Blog", href: "/#blog" },
      { label: "Contact", href: "/#contact" },
    ],
    navFooter: [
      { label: "Home", href: "/" },
      { label: "Contact", href: "mailto:hello@example.com", external: true },
    ],
    serviceArea: [],
  },
  pages: [
    {
      slug: "index",
      title: "Home",
      status: "draft",
      seo: {
        title: "Generated Business",
        description: "Generated draft site.",
        ogImage: null,
      },
      blocks: [
        {
          blockType: "hero",
          designVariant: "tailwindplus.marketing.hero.simple-centered",
          anchor: "top",
          eyebrow: inlineText("Nieuwe website"),
          headline: inlineText("Generated Business"),
          subheadline: blockText("Een compacte draft op basis van herbruikbare catalogusblokken."),
          cta: { label: "Neem contact op", href: "/#contact" },
          secondary: { label: "Meer informatie", href: "/" },
        },
        {
          blockType: "logoCloud",
          designVariant: "tailwindplus.marketing.logo-cloud.simple-with-heading",
          anchor: "partners",
          title: inlineText("Vertrouwd door teams die snel willen publiceren"),
          logos: [
            {
              name: "Transistor",
              href: "https://example.com/transistor",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/transistor-logo-gray-900.svg", alt: "Transistor", width: 158, height: 48 },
            },
            {
              name: "Reform",
              href: "https://example.com/reform",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/reform-logo-gray-900.svg", alt: "Reform", width: 158, height: 48 },
            },
            {
              name: "Tuple",
              href: "https://example.com/tuple",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/tuple-logo-gray-900.svg", alt: "Tuple", width: 158, height: 48 },
            },
            {
              name: "SavvyCal",
              href: "https://example.com/savvycal",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/savvycal-logo-gray-900.svg", alt: "SavvyCal", width: 158, height: 48 },
            },
            {
              name: "Statamic",
              href: "https://example.com/statamic",
              image: { url: "https://tailwindcss.com/plus-assets/img/logos/158x48/statamic-logo-gray-900.svg", alt: "Statamic", width: 158, height: 48 },
            },
          ],
        },
        {
          blockType: "featureList",
          designVariant: "tailwindplus.marketing.feature.with-product-screenshot",
          anchor: "services",
          eyebrow: inlineText("Sneller live"),
          title: inlineText("Een website die direct bewerkbaar blijft"),
          intro: blockText("SiaB vult goedgekeurde providerblokken met gestructureerde CMS-data."),
          image: {
            url: "https://tailwindcss.com/plus-assets/img/component-images/project-app-screenshot.png",
            alt: "CMS preview screenshot",
            width: 2432,
            height: 1442,
          },
          features: [
            { title: inlineText("Gevalideerde content"), description: blockText("Alle tekst, links en media blijven CMS-velden."), icon: "cloud-arrow-up" },
            { title: inlineText("Geen client source"), description: blockText("Nieuwe sites gebruiken platformdata, geen per-klant code."), icon: "lock-closed" },
            { title: inlineText("Zelfde renderer"), description: blockText("Canvas, preview en public runtime gebruiken dezelfde component."), icon: "server" },
          ],
        },
        {
          blockType: "featureList",
          designVariant: "tailwindplus.marketing.feature.centered-2x2-grid",
          anchor: "platform",
          title: inlineText("Wat de draft standaard regelt"),
          intro: blockText("Vier vaste featureposities houden de bronlayout intact."),
          features: [
            { title: inlineText("CMS slots"), description: blockText("Alle betekenisvolle velden zijn bewerkbaar."), icon: "cloud-arrow-up" },
            { title: inlineText("Veilige varianten"), description: blockText("Alleen actieve provider-ID's zijn toegestaan."), icon: "lock-closed" },
            { title: inlineText("Thema tokens"), description: blockText("Kleur, fonts en radius komen uit het thema."), icon: "arrow-path" },
            { title: inlineText("Public runtime"), description: blockText("Public snapshots worden vooraf gevalideerd."), icon: "finger-print" },
          ],
        },
        {
          blockType: "stats",
          designVariant: "tailwindplus.marketing.stats.simple",
          anchor: "stats",
          items: [
            { value: "24", label: "Projecten opgeleverd" },
            { value: "7 dagen", label: "Gemiddelde drafttijd" },
            { value: "100%", label: "CMS bewerkbaar" },
          ],
        },
        {
          blockType: "contentSection",
          designVariant: "tailwindplus.marketing.content.sticky-product-screenshot",
          anchor: "workflow",
          eyebrow: inlineText("Workflow"),
          title: inlineText("Content en screenshot blijven gestructureerd"),
          intro: blockText("De sticky contentsectie gebruikt vaste Tailwind Plus layout en vult alleen goedgekeurde CMS-slots."),
          body: blockText("SiaB bewaart de tekst, screenshot en drie feature-rijen als data. De providerbron bepaalt de sticky positie, spacing, achtergrond en responsive framing."),
          image: {
            url: "https://tailwindcss.com/plus-assets/img/component-images/dark-project-app-screenshot.png",
            alt: "Preview workflow screenshot",
            width: 1824,
            height: 1080,
          },
          features: [
            { title: inlineText("Publiceerbare snapshots."), description: blockText("Preview en live runtime lezen dezelfde gevalideerde publicatievorm.") },
            { title: inlineText("Veilige infrastructuur."), description: blockText("Domeinen, certificaten en hosting blijven platformverantwoordelijkheid.") },
            { title: inlineText("Herstelbare content."), description: blockText("CMS-data blijft de bron, niet gegenereerde clientcode.") },
          ],
          secondaryTitle: inlineText("Geen tenant source nodig"),
          secondaryBody: blockText("Nieuwe websites worden samengesteld uit gevalideerde tenantdata en actieve providercomponenten."),
        },
        {
          blockType: "bentoGrid",
          designVariant: "tailwindplus.marketing.bento.three-column-bento-grid",
          anchor: "platform-grid",
          title: inlineText("Platformbouwstenen"),
          intro: blockText("Vier vaste bento-posities tonen hoe providergeometrie vast blijft terwijl content bewerkbaar is."),
          items: [
            {
              title: inlineText("Mobiel vriendelijk"),
              description: blockText("De linker kaart gebruikt de vaste mobile-preview positie uit de bronlayout."),
              image: {
                url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-mobile-friendly.png",
                alt: "Mobiele preview",
                width: 720,
                height: 1280,
              },
            },
            {
              title: inlineText("Snel geladen"),
              description: blockText("De public runtime rendert snapshots zonder per-tenant buildstappen."),
              image: {
                url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-performance.png",
                alt: "Performance preview",
                width: 1024,
                height: 768,
              },
            },
            {
              title: inlineText("Fail-closed"),
              description: blockText("Onbekende provider-ID's vallen niet stil terug naar generieke layout."),
              image: {
                url: "https://tailwindcss.com/plus-assets/img/component-images/bento-03-security.png",
                alt: "Security preview",
                width: 1024,
                height: 512,
              },
            },
            {
              title: inlineText("Platform API's"),
              description: blockText("CMS, preview, publicatie en renderer blijven platformgrenzen."),
              image: null,
            },
          ],
        },
        {
          blockType: "testimonials",
          designVariant: "tailwindplus.marketing.testimonial.simple-centered",
          anchor: "review",
          logo: {
            url: "https://tailwindcss.com/plus-assets/img/logos/workcation-logo-indigo-600.svg",
            alt: "Workcation",
            width: 158,
            height: 48,
          },
          items: [
            {
              quote: "De preview was direct herkenbaar, snel aanpasbaar en klaar voor publicatie.",
              author: "Sam Intake",
              role: "Founder, Generated Business",
              avatar: {
                url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                alt: "Sam Intake",
                width: 256,
                height: 256,
              },
            },
          ],
        },
        {
          blockType: "pricing",
          designVariant: "tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier",
          anchor: "pricing",
          title: inlineText("Kies het pakket dat bij je lancering past"),
          intro: blockText("Twee duidelijke opties houden de Tailwind Plus bronlayout intact en blijven volledig bewerkbaar in het CMS."),
          plans: [
            {
              title: inlineText("Start"),
              description: blockText("Voor ondernemers die snel een compacte, publiceerbare site nodig hebben."),
              price: "€499",
              period: "eenmalig",
              features: [
                { label: inlineText("One-page website"), included: true },
                { label: inlineText("CMS preview"), included: true },
                { label: inlineText("Contactformulier"), included: true },
                { label: inlineText("Basis SEO velden"), included: true },
              ],
              cta: { label: "Start intake", href: "/#contact" },
              highlighted: false,
            },
            {
              title: inlineText("Growth"),
              description: blockText("Voor teams die meer content, betere structuur en begeleiding willen."),
              price: "€899",
              period: "eenmalig",
              features: [
                { label: inlineText("Meerdere secties"), included: true },
                { label: inlineText("Team en blogkaarten"), included: true },
                { label: inlineText("Publicatiebegeleiding"), included: true },
                { label: inlineText("Thema tokens"), included: true },
                { label: inlineText("Analytics voorbereiding"), included: true },
                { label: inlineText("Lancering checklist"), included: true },
              ],
              cta: { label: "Plan lancering", href: "/#contact" },
              highlighted: true,
            },
          ],
        },
        {
          blockType: "team",
          designVariant: "tailwindplus.marketing.team.with-small-images",
          anchor: "team",
          title: inlineText("Het team achter je draft"),
          intro: blockText("Een klein multidisciplinair team houdt content, ontwerp en publicatie op elkaar afgestemd."),
          members: [
            {
              name: "Sanne de Vries",
              role: "Content strategist",
              image: {
                url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                alt: "Sanne de Vries",
                width: 256,
                height: 256,
              },
            },
            {
              name: "Milan Bakker",
              role: "Frontend engineer",
              image: {
                url: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                alt: "Milan Bakker",
                width: 256,
                height: 256,
              },
            },
            {
              name: "Nora Jansen",
              role: "CMS editor",
              image: {
                url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                alt: "Nora Jansen",
                width: 256,
                height: 256,
              },
            },
          ],
        },
        {
          blockType: "blogCards",
          designVariant: "tailwindplus.marketing.blog.three-column",
          anchor: "blog",
          title: inlineText("Laatste inzichten"),
          intro: blockText("Gebruik blogkaarten voor updates, cases of kennisartikelen zonder vrije layoutvelden toe te voegen."),
          posts: [
            {
              title: inlineText("Zo blijft een gegenereerde site bewerkbaar"),
              excerpt: blockText("Providerblokken leveren de layout; SiaB bewaart alleen gevalideerde contentslots."),
              href: "/blog/bewerkbare-providerblokken",
              date: "Jul 5, 2026",
              author: "Sanne de Vries",
              cta: { label: "CMS", href: "/blog" },
              image: {
                url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                alt: "Sanne de Vries",
                width: 256,
                height: 256,
              },
            },
            {
              title: inlineText("Waarom canonical provider-ID's belangrijk zijn"),
              excerpt: blockText("Nieuwe generatie gebruikt stabiele Tailwind Plus ID's en laat legacy aliassen alleen voor opgeslagen data bestaan."),
              href: "/blog/canonical-provider-ids",
              date: "Jul 5, 2026",
              author: "Milan Bakker",
              cta: { label: "Runtime", href: "/blog" },
              image: {
                url: "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                alt: "Milan Bakker",
                width: 256,
                height: 256,
              },
            },
            {
              title: inlineText("Van intake naar publiceerbare preview"),
              excerpt: blockText("Mockgeneratie oefent dezelfde actieve provideroppervlakken als de self-serve flow."),
              href: "/blog/intake-preview",
              date: "Jul 5, 2026",
              author: "Nora Jansen",
              cta: { label: "Intake", href: "/blog" },
              image: {
                url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
                alt: "Nora Jansen",
                width: 256,
                height: 256,
              },
            },
          ],
        },
        {
          blockType: "newsletter",
          designVariant: "tailwindplus.marketing.newsletter.side-by-side-with-details",
          anchor: "newsletter",
          title: inlineText("Ontvang updates over je lancering"),
          description: blockText("De nieuwsbriefsectie gebruikt een eigen section contract en houdt formulier- en consentgedrag buiten vrije layoutvelden."),
          emailLabel: "E-mailadres",
          emailPlaceholder: "jij@example.com",
          submitLabel: "Aanmelden",
          benefits: [
            {
              title: inlineText("Lanceringstips"),
              description: blockText("Korte praktische updates over content, publicatie en vervolgacties."),
              icon: "calendar-days",
            },
            {
              title: inlineText("Geen vrije code"),
              description: blockText("Alle nieuwsbriefdata blijft gestructureerd en CMS-bewerkbaar."),
              icon: "hand-raised",
            },
          ],
          provider: {
            provider: "siab",
            action: "/api/newsletter",
            method: "POST",
            requiresConsent: true,
            analyticsEnabled: true,
          },
        },
        {
          blockType: "cta",
          designVariant: "tailwindplus.marketing.cta.dark-panel-with-app-screenshot",
          anchor: "demo",
          headline: inlineText("Bekijk de preview en pas content aan"),
          description: blockText("De broncomponent blijft intact terwijl je labels, links en media beheert."),
          primary: { label: "Open contact", href: "/#contact" },
          secondary: { label: "Naar boven", href: "/#top" },
          backgroundImage: {
            url: "https://tailwindcss.com/plus-assets/img/component-images/dark-project-app-screenshot.png",
            alt: "Preview screenshot",
            width: 1824,
            height: 1080,
          },
        },
        {
          blockType: "contactSection",
          designVariant: "tailwindplus.marketing.contact.centered",
          anchor: "contact",
          title: inlineText("Neem contact op"),
          description: blockText("Vertel kort wat je nodig hebt; de CMS-formulierbinding handelt de inzending af."),
          formName: "Contact form",
          submitLabel: "Verstuur bericht",
          fields: [
            { name: "first-name", label: "Voornaam", type: "text", required: true, placeholder: "Sam" },
            { name: "last-name", label: "Achternaam", type: "text", required: true, placeholder: "Intake" },
            { name: "email", label: "E-mail", type: "email", required: true, placeholder: "sam@example.com" },
            { name: "phone", label: "Telefoon", type: "tel", required: false, placeholder: "+31 6 12345678" },
            { name: "message", label: "Bericht", type: "textarea", required: true, placeholder: "Waar kunnen we mee helpen?", maxLength: 1000 },
          ],
          provider: {
            provider: "siab",
            action: "/api/forms",
            method: "POST",
            requiresConsent: true,
            analyticsEnabled: true,
          },
        },
      ],
    },
  ],
  blocks: [
    {
      slug: "hero",
      label: "Hero",
      defaultAnchor: "top",
      fields: [
        { name: "eyebrow", label: "Eyebrow", kind: "richtext", variant: "inline", role: "script" },
        { name: "headline", label: "Headline", kind: "richtext", variant: "inline", role: "title" },
        { name: "subheadline", label: "Subheadline", kind: "richtext", variant: "block", role: "text" },
        { name: "cta", label: "Primary action", kind: "cta" },
        { name: "secondary", label: "Secondary action", kind: "cta" },
      ],
    },
    {
      slug: "featureList",
      label: "Feature list",
      defaultAnchor: "services",
      fields: [
        { name: "eyebrow", label: "Eyebrow", kind: "richtext", variant: "inline", role: "script" },
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "title" },
        { name: "intro", label: "Intro", kind: "richtext", variant: "block", role: "text" },
        { name: "image", label: "Image", kind: "image" },
        {
          name: "features",
          label: "Features",
          kind: "array",
          itemLabel: "Feature",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
          ],
        },
      ],
    },
    {
      slug: "cta",
      label: "CTA",
      defaultAnchor: "demo",
      fields: [
        { name: "headline", label: "Headline", kind: "richtext", variant: "inline", role: "title" },
        { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
        { name: "primary", label: "Primary action", kind: "cta" },
        { name: "secondary", label: "Secondary action", kind: "cta" },
        { name: "backgroundImage", label: "Background image", kind: "image" },
      ],
    },
    {
      slug: "testimonials",
      label: "Testimonials",
      defaultAnchor: "review",
      fields: [
        { name: "logo", label: "Logo", kind: "image" },
        {
          name: "items",
          label: "Testimonials",
          kind: "array",
          itemLabel: "Testimonial",
          itemFields: [
            { name: "quote", label: "Quote", kind: "text" },
            { name: "author", label: "Author", kind: "text" },
            { name: "role", label: "Role", kind: "text" },
            { name: "avatar", label: "Avatar", kind: "image" },
          ],
        },
      ],
    },
    {
      slug: "stats",
      label: "Stats",
      defaultAnchor: "stats",
      fields: [
        {
          name: "items",
          label: "Stats",
          kind: "array",
          itemLabel: "Stat",
          itemFields: [
            { name: "value", label: "Value", kind: "text" },
            { name: "label", label: "Label", kind: "text" },
          ],
        },
      ],
    },
    {
      slug: "logoCloud",
      label: "Logo cloud",
      defaultAnchor: "partners",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        {
          name: "logos",
          label: "Logos",
          kind: "array",
          itemLabel: "Logo",
          itemFields: [
            { name: "name", label: "Name", kind: "text" },
            { name: "image", label: "Logo image", kind: "image" },
            { name: "href", label: "Href", kind: "text" },
          ],
        },
      ],
    },
    {
      slug: "pricing",
      label: "Pricing",
      defaultAnchor: "pricing",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "intro", label: "Intro", kind: "richtext", variant: "block", role: "text" },
        {
          name: "plans",
          label: "Plans",
          kind: "array",
          itemLabel: "Plan",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
            { name: "price", label: "Price", kind: "text" },
            { name: "period", label: "Period", kind: "text" },
            { name: "cta", label: "Action", kind: "cta" },
            { name: "highlighted", label: "Highlighted", kind: "checkbox" },
            {
              name: "features",
              label: "Features",
              kind: "array",
              itemLabel: "Feature",
              itemFields: [
                { name: "label", label: "Label", kind: "richtext", variant: "inline", role: "text" },
                { name: "included", label: "Included", kind: "checkbox" },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "team",
      label: "Team",
      defaultAnchor: "team",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "intro", label: "Intro", kind: "richtext", variant: "block", role: "text" },
        {
          name: "members",
          label: "Members",
          kind: "array",
          itemLabel: "Member",
          itemFields: [
            { name: "name", label: "Name", kind: "text" },
            { name: "role", label: "Role", kind: "text" },
            { name: "image", label: "Image", kind: "image" },
          ],
        },
      ],
    },
    {
      slug: "blogCards",
      label: "Blog cards",
      defaultAnchor: "blog",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "intro", label: "Intro", kind: "richtext", variant: "block", role: "text" },
        {
          name: "posts",
          label: "Posts",
          kind: "array",
          itemLabel: "Post",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "excerpt", label: "Excerpt", kind: "richtext", variant: "block", role: "text" },
            { name: "href", label: "Href", kind: "text" },
            { name: "date", label: "Date", kind: "text" },
            { name: "author", label: "Author", kind: "text" },
            { name: "cta", label: "Category", kind: "cta" },
            { name: "image", label: "Author image", kind: "image" },
          ],
        },
      ],
    },
    {
      slug: "bentoGrid",
      label: "Bento grid",
      defaultAnchor: "platform-grid",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "intro", label: "Intro", kind: "richtext", variant: "block", role: "text" },
        {
          name: "items",
          label: "Items",
          kind: "array",
          itemLabel: "Item",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
            { name: "image", label: "Image", kind: "image" },
          ],
        },
      ],
    },
    {
      slug: "contentSection",
      label: "Content section",
      defaultAnchor: "workflow",
      fields: [
        { name: "eyebrow", label: "Eyebrow", kind: "richtext", variant: "inline", role: "script" },
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "intro", label: "Intro", kind: "richtext", variant: "block", role: "text" },
        { name: "body", label: "Body", kind: "richtext", variant: "block", role: "text" },
        { name: "image", label: "Image", kind: "image" },
        {
          name: "features",
          label: "Features",
          kind: "array",
          itemLabel: "Feature",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
            { name: "icon", label: "Icon", kind: "text" },
          ],
        },
        { name: "secondaryTitle", label: "Secondary title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "secondaryBody", label: "Secondary body", kind: "richtext", variant: "block", role: "text" },
      ],
    },
    {
      slug: "newsletter",
      label: "Newsletter",
      defaultAnchor: "newsletter",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
        { name: "emailLabel", label: "Email label", kind: "text" },
        { name: "emailPlaceholder", label: "Email placeholder", kind: "text" },
        { name: "submitLabel", label: "Submit label", kind: "text" },
        {
          name: "benefits",
          label: "Benefits",
          kind: "array",
          itemLabel: "Benefit",
          itemFields: [
            { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
            { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
            { name: "icon", label: "Icon", kind: "text" },
          ],
        },
      ],
    },
    {
      slug: "contactSection",
      label: "Contact",
      defaultAnchor: "contact",
      fields: [
        { name: "title", label: "Title", kind: "richtext", variant: "inline", role: "heading" },
        { name: "description", label: "Description", kind: "richtext", variant: "block", role: "text" },
        { name: "formName", label: "Form name", kind: "text" },
        { name: "submitLabel", label: "Submit label", kind: "text" },
        {
          name: "fields",
          label: "Fields",
          kind: "array",
          itemLabel: "Field",
          itemFields: [
            { name: "name", label: "Name", kind: "text" },
            { name: "label", label: "Label", kind: "text" },
            { name: "type", label: "Type", kind: "text" },
            { name: "required", label: "Required", kind: "checkbox" },
            { name: "placeholder", label: "Placeholder", kind: "text" },
          ],
        },
      ],
    },
  ],
  assets: [],
  generatedAt: "2026-06-25T00:00:00.000Z",
  generator: {
    name: "mock-site-generation",
    version: "phase-6",
    model: "fixture",
  },
}

export const loadMockSiteGenerationSpec = (
  normalized: NormalizedIntake,
  fixture: MockGenerationFixture = "generic",
): SiteGenerationSpec => {
  const spec = cloneSpec(genericSiteGenerationSpec)
  const generatedAt = new Date().toISOString()
  const contactEmail = normalized.contact?.email ?? spec.settings.contactEmail
  const contactHref = contactEmail ? `mailto:${contactEmail}` : "/#contact"
  const requestedPages = normalized.requestedPages.length > 0
    ? normalized.requestedPages
    : [{ slug: "index", title: "Home", purpose: "Generated homepage" }]

  const rewritten: SiteGenerationSpec = {
    ...spec,
    intake: normalized,
    tenant: {
      name: normalized.businessName,
      slug: normalized.tenantSlug,
      domain: normalized.primaryDomain,
      status: "provisioning",
    },
    settings: {
      ...spec.settings,
      siteName: normalized.businessName,
      siteUrl: normalized.siteUrl,
      language: normalized.language,
      contactEmail,
      contact: {
        ...spec.settings.contact,
        phone: normalized.contact?.phone ?? spec.settings.contact?.phone,
      },
      serviceArea: normalized.serviceArea.map((name) => ({ name })),
      navHeader: [
        { label: "Home", href: "/" },
        { label: "Services", href: "/#services" },
        { label: "Pricing", href: "/#pricing" },
        { label: "Team", href: "/#team" },
        { label: "Blog", href: "/#blog" },
        { label: "Contact", href: "/#contact" },
      ],
      navFooter: [
        { label: "Home", href: "/" },
        { label: "Contact", href: contactHref, external: contactHref.startsWith("mailto:") },
      ],
      chrome: {
        ...spec.settings.chrome,
        header: {
          ...spec.settings.chrome?.header,
          cta: { label: "Contact", href: contactHref },
        },
        footer: {
          ...spec.settings.chrome?.footer,
          copyright: `(c) ${normalized.businessName}`,
          columns: spec.settings.chrome?.footer?.columns?.map((column) => ({
            ...column,
            items: column.items?.map((item) => ({
              ...item,
              label: item.type === "brand" ? normalized.businessName : item.label,
              links: item.type === "contact" ? [{ label: contactEmail ?? "Contact", href: contactHref }] : item.links,
            })),
          })),
        },
      },
    },
    pages: spec.pages.map((page, index) => ({
      ...page,
      title: requestedPages[index]?.title ?? page.title,
      seo: {
        ...page.seo,
        title: normalized.businessName,
        description: `${normalized.businessName} - generated preview draft.`,
      },
      blocks: page.blocks.map((block) => {
        if (block.blockType === "hero") {
          return {
            ...block,
            headline: inlineText(normalized.businessName),
            subheadline: blockText(
              normalized.goals.length > 0
                ? normalized.goals.join(". ")
                : `Een bewerkbare preview voor ${normalized.businessName}.`,
            ),
            cta: { ...block.cta, href: contactHref },
            secondary: { ...block.secondary, href: "/" },
          }
        }
        return block
      }),
    })),
    generatedAt,
    generator: {
      name: "mock-site-generation",
      version: "phase-6",
      model: "fixture",
    },
  }

  if (fixture === "invalid") {
    return {
      ...rewritten,
      tenant: {
        ...rewritten.tenant,
        slug: "Invalid Slug",
      },
    }
  }

  return rewritten
}
