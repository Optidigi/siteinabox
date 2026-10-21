import type { SiteGenerationSpec } from "@siteinabox/contracts/generation"

export const fixtureSpec = (): SiteGenerationSpec => ({
  schemaVersion: 1,
  intake: {
    businessName: "Fixture Care",
    tenantSlug: "fixture-care",
    primaryDomain: "fixture-care.test",
    siteUrl: "https://fixture-care.test",
    language: "en",
    serviceArea: ["Amsterdam"],
    goals: ["contact"],
    requestedPages: [{ slug: "index", title: "Home", purpose: "Introduce the service" }],
  },
  tenant: { name: "Fixture Care", slug: "fixture-care", domain: "fixture-care.test", status: "provisioning" },
  theme: {
    version: 3,
    appearance: { mode: "light" },
    colors: { schemeId: "blue-professional" },
    fonts: { schemeId: "clear-modern" },
    shape: { schemeId: "soft" },
  },
  settings: {
    siteName: "Fixture Care",
    siteUrl: "https://fixture-care.test",
    description: "A reliable local service.",
    language: "en",
    navigation: {
      primary: [{ label: "Contact", href: "/#contact" }],
      footer: [{ label: "Contact", href: "/#contact" }],
    },
    contactEmail: "hello@fixture-care.test",
    serviceArea: [{ name: "Amsterdam" }],
    chrome: {
      navbar: { variant: "navbar-02", placement: "sticky", activeMode: "anchor", mobileMenu: "dropdown" },
      footer: { variant: "footer-01", copyright: "© Fixture Care" },
      announcement: { visible: false, message: "Announcement" },
    },
  },
  pages: [{
    slug: "index",
    title: "Home",
    status: "draft",
    blocks: [
      {
        blockType: "hero",
        variant: "hero-01",
        heading: "Practical help for busy homes",
        body: "Book a clear first step with Fixture Care.",
        primaryAction: { label: "Get in touch", href: "#contact" },
      },
      {
        blockType: "contact",
        anchor: "contact",
        heading: "Contact",
        form: { formName: "contact", submitLabel: "Send", fields: [{ name: "name", label: "Name", type: "text", required: true }] },
        body: "Tell us what you need.",
        contactMethods: [{ kind: "email", label: "Email", value: "hello@fixture-care.test", href: "mailto:hello@fixture-care.test" }],
      },
    ],
  }],
  blocks: [{ slug: "hero", label: "Hero" }, { slug: "contact", label: "Contact" }],
  generatedAt: "2026-08-13T00:00:00.000Z",
  generator: { name: "sitegen-owned", version: "1" },
})
