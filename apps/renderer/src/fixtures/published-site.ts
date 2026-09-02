import type { GeneratedPageSpec, PublishedSiteSnapshot } from "@siteinabox/contracts/generation"
import { v1FixturePage, v1FixtureTheme } from "@siteinabox/site-renderer"

const fixtureTheme = v1FixtureTheme

const reviewBlocks = v1FixturePage.blocks.filter((block) => block.blockType !== "appointments").map((block) => {
  const anchor = block.blockType

  if (block.blockType === "hero") {
    return { ...block, anchor }
  }

  if (block.blockType === "work") {
    return {
      ...block,
      projects: block.projects.map((project, index) => ({
        ...project,
        media: [`/fixture-media/${index === 0 ? "project-kitchen" : "project-office"}.webp`],
      })),
      anchor,
    }
  }

  return { ...block, anchor }
})

const appointmentBlocks = v1FixturePage.blocks
  .filter((block) => block.blockType === "appointments")
  .map((block) => ({ ...block, anchor: "appointments" as const }))

const pages: GeneratedPageSpec[] = [
  {
    id: "home",
    slug: "index",
    title: "Home",
    status: "published",
    updatedAt: "2026-06-01T00:00:00.000Z",
    seo: { title: "Fixture Studio", description: "A fixture site rendered by the shared Site in a Box renderer." },
    blocks: reviewBlocks,
  },
  {
    id: "services",
    slug: "services",
    title: "Services",
    status: "published",
    updatedAt: "2026-06-01T00:00:00.000Z",
    seo: { title: "Renderer Fixture Services", description: "A second fixture page." },
    blocks: [
      { blockType: "hero", variant: "hero-01", heading: "Services from contract data", body: "This page proves multiple published paths use one renderer.", primaryAction: { label: "Back home", href: "/" }, anchor: "hero" },
      { blockType: "process", heading: "Published snapshot", intro: "The services page uses the same fixture snapshot.", steps: [{ title: "Resolve", body: "Resolve pathname to page." }, { title: "Render", body: "Render the canonical block union." }], anchor: "process" },
      { blockType: "faq", heading: "Runtime questions", intro: null, items: [{ question: "Does the app know a tenant?", answer: "Tenant lookup is mocked and content comes from a snapshot." }, { question: "Does this mutate CMS data?", answer: "No. The renderer is read-only." }], anchor: "faq" },
      { blockType: "contact", heading: "Contact", body: null, contactMethods: [{ kind: "email", label: "Email", value: "hello@renderer.example.test", href: "mailto:hello@renderer.example.test" }], serviceArea: [], openingHours: null, bookingAction: null, form: null, image: null, anchor: "contact" },
    ],
  },
  {
    id: "about",
    slug: "about",
    title: "About",
    status: "published",
    updatedAt: "2026-06-01T00:00:00.000Z",
    seo: { description: "A small fixture about page." },
    blocks: [
      { blockType: "hero", variant: "hero-01", heading: "About this renderer", body: "Shared contracts define the published site shape.", primaryAction: { label: "Back home", href: "/" }, anchor: "hero" },
      { blockType: "reviews", heading: "Fixture signal", intro: null, reviewSourceIds: ["fixture-review"], items: [{ sourceId: "fixture-review", quote: "The page output comes from structured snapshot data.", name: "SIAB Renderer", context: "Fixture" }], anchor: "reviews" },
      { blockType: "contact", heading: "Contact", body: null, contactMethods: [{ kind: "email", label: "Email", value: "hello@renderer.example.test", href: "mailto:hello@renderer.example.test" }], serviceArea: [], openingHours: null, bookingAction: null, form: null, image: null, anchor: "contact" },
    ],
  },
  {
    id: "appointments",
    slug: "appointments",
    title: "Appointments",
    status: "published",
    updatedAt: "2026-06-01T00:00:00.000Z",
    seo: { title: "Renderer Fixture Appointments", description: "The appointment module fixture uses the public shared renderer." },
    blocks: appointmentBlocks,
  },
]

export const fixturePublishedSiteSnapshot: PublishedSiteSnapshot = {
  schemaVersion: 1,
  tenantId: "fixture-tenant",
  tenantSlug: "fixture-studio",
  domain: "renderer.example.test",
  siteUrl: "https://renderer.example.test",
  theme: fixtureTheme,
  settings: {
    siteName: "Fixture Studio",
    siteUrl: "https://renderer.example.test",
    description: "A fixture site rendered by the SIAB public runtime.",
    language: "en",
    contactEmail: "hello@renderer.example.test",
    branding: { primaryColor: "#0f766e" },
    analyticsConsent: { enabled: true, provider: "posthog", consentStorageKey: "siab_cookie_consent_v1", consentVersion: "2026-08-13.1", captureSections: true, captureActions: true, captureForms: false },
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  pages,
  manifest: {
    tenantId: "fixture-tenant",
    version: 1,
    updatedAt: "2026-06-01T00:00:00.000Z",
    entries: [{ type: "settings", key: "site-settings", updatedAt: "2026-06-01T00:00:00.000Z" }, ...pages.map((page) => ({ type: "page" as const, key: page.slug, updatedAt: page.updatedAt! }))],
  },
  publishedAt: "2026-06-01T00:00:00.000Z",
}
