import type { GeneratedBlockSpec, NormalizedIntake, SiteBlockManifestItem, SiteGenerationSpec } from "@siteinabox/contracts/generation"
import type { SiteGenerationBlockSlug } from "@siteinabox/contracts/site"
import type { RtBlockRoot, RtInlineRoot } from "@siteinabox/contracts/rich-text"

export type MockGenerationFixture = "generic" | "invalid"
const inline = (value: string): RtInlineRoot => ({ t: "root", variant: "inline", children: [{ t: "text", v: value }] })
const prose = (value: string): RtBlockRoot => ({ t: "root", variant: "block", children: [{ t: "paragraph", children: [{ t: "text", v: value }] }] })

function blocksFor(name: string, summary: string, contactHref: string): GeneratedBlockSpec[] {
  return [
    { blockType: "hero", designVariant: "shadcnui-blocks.hero-01", anchor: "top", headline: inline(name), subheadline: prose(summary), cta: { label: "Contact", href: contactHref } },
    { blockType: "logoCloud", designVariant: "shadcnui-blocks.logo-cloud-01", anchor: "partners", title: inline("Partners"), logos: [{ name: "Partner" }] },
    { blockType: "featureList", designVariant: "shadcnui-blocks.features-01", anchor: "diensten", title: inline("Wat we doen"), features: [{ title: inline("Persoonlijk"), description: prose("Een aanpak die past bij uw organisatie.") }, { title: inline("Duidelijk"), description: prose("Heldere stappen en afspraken.") }] },
    { blockType: "stats", designVariant: "shadcnui-blocks.stats-01", anchor: "resultaten", title: inline("Resultaten"), items: [{ value: "100%", label: "aandacht" }, { value: "24/7", label: "online" }] },
    { blockType: "testimonials", designVariant: "shadcnui-blocks.testimonials-01", anchor: "ervaringen", title: "Ervaringen", items: [{ quote: "Prettige samenwerking en een helder resultaat.", author: "Klant" }] },
    { blockType: "pricing", designVariant: "shadcnui-blocks.pricing-01", anchor: "aanbod", title: inline("Ons aanbod"), plans: [{ title: inline("Kennismaking"), price: "Op aanvraag", features: [{ label: inline("Persoonlijk advies"), included: true }], cta: { label: "Neem contact op", href: contactHref } }] },
    { blockType: "team", designVariant: "shadcnui-blocks.team-01", anchor: "team", title: inline("Ons team"), members: [{ name, role: "Specialist" }] },
    { blockType: "blogCards", designVariant: "shadcnui-blocks.blog-01", anchor: "nieuws", title: inline("Nieuws"), posts: [{ title: inline("Welkom"), excerpt: prose(summary), href: "/" }] },
    { blockType: "faq", designVariant: "shadcnui-blocks.faq-01", anchor: "vragen", title: inline("Veelgestelde vragen"), items: [{ question: inline("Hoe starten we?"), answer: prose("Neem contact op voor een vrijblijvende kennismaking.") }] },
    { blockType: "contentSection", designVariant: "shadcnui-blocks.timeline-01", anchor: "werkwijze", title: inline("Werkwijze"), body: prose("Kennismaken, afstemmen en samen aan de slag.") },
    { blockType: "cta", designVariant: "shadcnui-blocks.cta-01", anchor: "actie", headline: inline("Klaar om te beginnen?"), description: prose(summary), primary: { label: "Contact", href: contactHref } },
    { blockType: "contactSection", designVariant: "shadcnui-blocks.contact-01", anchor: "contact", title: inline("Contact"), formName: "contact", submitLabel: "Versturen", fields: [{ name: "name", label: "Naam", type: "text", required: true }, { name: "email", label: "E-mail", type: "email", required: true }], provider: { provider: "siab", action: "/api/forms", method: "POST" } },
  ]
}

export function loadMockSiteGenerationSpec(normalized: NormalizedIntake, fixture: MockGenerationFixture = "generic"): SiteGenerationSpec {
  const contactEmail = normalized.contact?.email ?? "hello@example.com"
  const contactHref = `mailto:${contactEmail}`
  const summary = normalized.goals.length ? normalized.goals.join(". ") : `Een heldere website voor ${normalized.businessName}.`
  const blocks = blocksFor(normalized.businessName, summary, contactHref)
  const manifest: SiteBlockManifestItem[] = [...new Map(blocks.map((block) => [block.blockType, { slug: block.blockType as SiteGenerationBlockSlug, label: block.blockType, defaultAnchor: block.anchor ?? undefined }])).values()]
  return {
    schemaVersion: 1, intake: normalized,
    tenant: { name: normalized.businessName, slug: fixture === "invalid" ? "Invalid Slug" : normalized.tenantSlug, domain: normalized.primaryDomain, status: "provisioning" },
    theme: { version: 2, appearance: { mode: "light" }, colors: { schemeId: "blue-professional" }, fonts: { schemeId: "clear-modern" }, shape: { schemeId: "soft" }, density: { schemeId: "comfortable" } },
    settings: {
      siteName: normalized.businessName, siteUrl: normalized.siteUrl, description: summary, language: normalized.language, contactEmail,
      chrome: {
        header: { variant: "shadcnui-blocks.navbar-01", behavior: "sticky", activeMode: "path", mobileMenu: "drawer", cta: { label: "Contact", href: contactHref } },
        footer: { variant: "shadcnui-blocks.footer-01", tagline: summary, copyright: `(c) ${normalized.businessName}`, legalLinks: [{ label: "Privacy", href: "/privacy" }] },
      },
      navHeader: [{ label: "Home", href: "/" }, { label: "Diensten", href: "/#diensten" }, { label: "Contact", href: "/#contact" }],
      navFooter: [{ label: "Home", href: "/" }, { label: "Contact", href: contactHref, external: true }], contact: { phone: normalized.contact?.phone ?? null, social: [] }, serviceArea: normalized.serviceArea.map((name) => ({ name })),
    },
    pages: [{ slug: "index", title: normalized.requestedPages[0]?.title ?? "Home", status: "draft", seo: { title: normalized.businessName, description: summary, ogImage: null }, blocks }],
    blocks: manifest, assets: [], generatedAt: new Date().toISOString(), generator: { name: "mock-site-generation", version: "shadcnui-blocks-v1", model: "fixture" },
  }
}
