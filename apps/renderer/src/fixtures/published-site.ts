import type { Page } from "@siteinabox/contracts"
import type { PublishedSiteSnapshot, ThemeTokenSpec } from "@siteinabox/contracts/generation"

const inlineText = (text: string) => ({
  t: "root" as const,
  variant: "inline" as const,
  children: [{ t: "text" as const, v: text }],
})

const blockText = (text: string) => ({
  t: "root" as const,
  variant: "block" as const,
  children: [{ t: "paragraph" as const, children: [{ t: "text" as const, v: text }] }],
})

const fixtureTheme: ThemeTokenSpec = {
  colors: {
    accent: "#0f766e",
    bg: "#f8fafc",
    ink: "#111827",
    muted: "#64748b",
    card: "#ffffff",
    secondary: "#e2e8f0",
    rule: "rgba(15, 23, 42, 0.14)",
  },
  fonts: {
    title: "Georgia, 'Times New Roman', serif",
    heading: "Inter, system-ui, sans-serif",
    text: "Inter, system-ui, sans-serif",
  },
  radius: "0.5rem",
  density: "comfortable",
  borderStyle: "solid",
  mode: "light",
}

const pages: Page[] = [
  {
    id: "home",
    slug: "index",
    title: "Home",
    status: "published",
    updatedAt: "2026-06-01T00:00:00.000Z",
    seo: {
      title: "Fixture Studio | Data-rendered Sites",
      description: "A fixture site rendered by the shared Site in a Box renderer.",
    },
    blocks: [
      {
        blockType: "hero",
        eyebrow: inlineText("Renderer MVP"),
        headline: inlineText("A published snapshot rendered at the edge"),
        subheadline: blockText("This page is contract data, resolved by pathname, and rendered through the shared SIAB site renderer."),
        pills: [
          { label: "No tenant source branches" },
          { label: "SEO-ready HTML" },
          { label: "Theme tokens applied" },
        ],
        cta: { label: "View services", href: "/services" },
      },
      {
        blockType: "featureList",
        title: inlineText("Runtime shape"),
        intro: blockText("The renderer stays generic while snapshot data supplies the content, theme, navigation, and metadata."),
        features: [
          {
            title: inlineText("Path resolver"),
            description: blockText("The request pathname resolves to a published page slug."),
            icon: "route",
          },
          {
            title: inlineText("Shared rendering"),
            description: blockText("Blocks are rendered by packages/site-renderer, not app-local tenant components."),
            icon: "layers",
          },
          {
            title: inlineText("Snapshot-ready"),
            description: blockText("The fixture loader is isolated so real published snapshots can replace it later."),
            icon: "database",
          },
        ],
      },
      {
        blockType: "cta",
        headline: inlineText("Fixture data today, published snapshots next"),
        description: blockText("Host resolution and latest-published snapshot loading are intentionally mocked for this phase."),
        primary: { label: "Read about this MVP", href: "/about" },
      },
    ],
  },
  {
    id: "services",
    slug: "services",
    title: "Services",
    status: "published",
    updatedAt: "2026-06-01T00:00:00.000Z",
    seo: {
      title: "Renderer Fixture Services",
      description: "Multiple fixture pages prove path resolution through the shared renderer.",
    },
    blocks: [
      {
        blockType: "hero",
        headline: inlineText("Services from contract data"),
        subheadline: blockText("This second page proves the renderer can build and serve multiple published paths from one snapshot."),
        cta: { label: "Back home", href: "/" },
      },
      {
        blockType: "richText",
        body: blockText("The services page uses the same fixture snapshot, the same theme tokens, and the same shared block renderers."),
      },
      {
        blockType: "faq",
        title: inlineText("Runtime questions"),
        items: [
          {
            question: inlineText("Does this app know about a specific tenant?"),
            answer: blockText("No. Tenant lookup is mocked and all content comes from a generic published snapshot fixture."),
          },
          {
            question: inlineText("Does this mutate CMS data?"),
            answer: blockText("No. The renderer is read-only and does not implement intake, AI, payment, or CMS writes."),
          },
        ],
      },
    ],
  },
  {
    id: "about",
    slug: "about",
    title: "About",
    status: "published",
    updatedAt: "2026-06-01T00:00:00.000Z",
    seo: {
      description: "A small fixture about page rendered from a published snapshot.",
    },
    blocks: [
      {
        blockType: "hero",
        headline: inlineText("About this renderer"),
        subheadline: blockText("The MVP keeps app code generic and lets shared contracts define the published site shape."),
      },
      {
        blockType: "testimonials",
        title: "Fixture signal",
        items: [
          {
            quote: "The page output comes from structured snapshot data.",
            author: "SIAB Renderer",
            role: "MVP fixture",
          },
        ],
      },
    ],
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
    branding: {
      primaryColor: "#0f766e",
    },
    navHeader: [
      { label: "Home", href: "/" },
      { label: "Services", href: "/services" },
      { label: "About", href: "/about" },
    ],
    navFooter: [
      { label: "Home", href: "/" },
      { label: "Services", href: "/services" },
      { label: "About", href: "/about" },
    ],
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  pages,
  manifest: {
    tenantId: "fixture-tenant",
    version: 1,
    updatedAt: "2026-06-01T00:00:00.000Z",
    entries: [
      { type: "settings", key: "site-settings", updatedAt: "2026-06-01T00:00:00.000Z" },
      ...pages.map((page) => ({
        type: "page" as const,
        key: page.slug,
        updatedAt: page.updatedAt,
      })),
    ],
  },
  publishedAt: "2026-06-01T00:00:00.000Z",
}
