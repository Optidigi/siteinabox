import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"

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

export const v1FixtureTheme: ThemeTokenSpec = {
  colors: {
    accent: "#0f766e",
    bg: "#ffffff",
    ink: "#111827",
    muted: "#6b7280",
  },
  fonts: {
    title: "serif",
    heading: "serif",
    text: "sans-serif",
  },
  radius: "0.5rem",
  mode: "light",
}

export const v1FixtureSettings: SiteSettings = {
  siteName: "Example Site",
  siteUrl: "https://example.test",
  language: "en",
  description: "Example renderer fixture",
  branding: {
    logo: { url: "/media/example-logo.svg", alt: "Example Site" },
  },
  chrome: {
    header: {
      variant: "default",
      behavior: "sticky",
      activeMode: "path",
      mobileMenu: "dropdown",
      cta: { label: "Contact", href: "#contact" },
    },
    footer: {
      variant: "default",
      tagline: "Typed fixture data for the shared renderer.",
      copyright: "Copyright 2026 Example Site",
      legalLinks: [{ label: "Privacy", href: "/privacy" }],
      columns: [
        {
          id: "contact",
          items: [
            {
              id: "contact-links",
              type: "contact",
              label: "Contact",
              links: [
                { label: "Email", href: "mailto:hello@example.test" },
                { label: "Call", href: "tel:+31000000000" },
              ],
            },
          ],
        },
      ],
    },
    banner: {
      variant: "default",
      title: "New",
      message: "Reusable chrome variants are available for generated sites.",
      link: { label: "View catalog", href: "#catalog" },
      dismissible: true,
      visible: true,
    },
  },
  navHeader: [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
  ],
  navFooter: [{ label: "Contact", href: "#contact" }],
}

export const v1FixturePage: Page = {
  slug: "index",
  title: "Home",
  status: "published",
  updatedAt: "2026-01-01T00:00:00.000Z",
  blocks: [
    {
      blockType: "hero",
      headline: inlineText("A data-driven site"),
      subheadline: blockText("Rendered by the shared SIAB renderer."),
      cta: { label: "Contact", href: "#contact" },
    },
    {
      blockType: "featureList",
      title: inlineText("Features"),
      features: [
        { title: inlineText("Shared"), description: blockText("One renderer for CMS and public runtime."), icon: "layers" },
        { title: inlineText("Typed"), description: blockText("Driven by contract data."), icon: "check-circle" },
      ],
    },
    {
      blockType: "pricing",
      title: inlineText("Choose the right plan"),
      intro: blockText("Structured pricing plans rendered without generated source code."),
      plans: [
        {
          title: inlineText("Starter"),
          description: blockText("For a focused one-page presence."),
          price: "EUR 499",
          period: "once",
          features: [
            { label: inlineText("One published page"), included: true },
            { label: inlineText("Basic SEO setup"), included: true },
          ],
          cta: { label: "Start intake", href: "/intake" },
        },
        {
          title: inlineText("Growth"),
          description: blockText("For a multi-page marketing site."),
          price: "EUR 999",
          period: "once",
          features: [
            { label: inlineText("Five published pages"), included: true },
            { label: inlineText("Content migration"), included: true },
            { label: inlineText("Priority support"), included: true },
          ],
          cta: { label: "Choose growth", href: "/intake" },
          badge: "Popular",
          highlighted: true,
        },
      ],
    },
    {
      blockType: "stats",
      title: inlineText("Renderer metrics"),
      items: [
        { value: "8", label: "New block families", description: blockText("Promoted from structured contracts.") },
        { value: "0", label: "Raw code fields", description: blockText("All content remains structured.") },
        { value: "1", label: "Shared renderer", description: blockText("Used by CMS preview and public runtime.") },
      ],
    },
    {
      blockType: "logoCloud",
      title: inlineText("Trusted integrations"),
      logos: [
        { name: "Payload", image: { url: "/media/logo-payload.svg", alt: "Payload" }, href: "https://payloadcms.com" },
        { name: "Astro", image: { url: "/media/logo-astro.svg", alt: "Astro" } },
        { name: "Postgres", image: { url: "/media/logo-postgres.svg", alt: "Postgres" } },
        { name: "Cloudflare", image: { url: "/media/logo-cloudflare.svg", alt: "Cloudflare" } },
      ],
    },
    {
      blockType: "gallery",
      title: inlineText("Gallery"),
      images: [
        { image: { url: "/media/gallery-1.jpg", alt: "Gallery item one" }, caption: blockText("Structured media item.") },
        { image: { url: "/media/gallery-2.jpg", alt: "Gallery item two" } },
        { image: { url: "/media/gallery-3.jpg", alt: "Gallery item three" } },
        { image: { url: "/media/gallery-4.jpg", alt: "Gallery item four" } },
      ],
      cta: { label: "View work", href: "/work" },
    },
    {
      blockType: "team",
      title: inlineText("Meet the team"),
      intro: blockText("People data maps into the provider-native team layout."),
      members: [
        { name: "Alex Example", role: "Founder", image: { url: "/media/team-1.jpg", alt: "Alex Example" } },
        { name: "Sam Example", role: "Designer", bio: blockText("Builds clear generated-site systems."), image: { url: "/media/team-2.jpg", alt: "Sam Example" } },
      ],
    },
    {
      blockType: "blogCards",
      title: inlineText("From the blog"),
      intro: blockText("Article cards can point at CMS or static routes."),
      posts: [
        {
          title: inlineText("Building with blocks"),
          excerpt: blockText("How structured data feeds the renderer."),
          href: "/blog/building-with-blocks",
          date: "2026-01-01",
          author: "SIAB",
        },
        {
          title: inlineText("Renderer variants"),
          excerpt: blockText("Provider-native styling without code generation."),
          href: "/blog/renderer-variants",
          date: "2026-01-02",
          author: "SIAB",
        },
      ],
    },
    {
      blockType: "testimonials",
      title: "What clients say",
      items: [{ quote: "Simple and consistent.", author: "Jane Example" }],
    },
    {
      blockType: "faq",
      title: inlineText("Questions"),
      items: [{ question: inlineText("Is this generic?"), answer: blockText("Yes. No tenant-specific source is used.") }],
    },
    {
      blockType: "cta",
      headline: inlineText("Ready to start?"),
      description: blockText("Send a message and we will respond."),
      primary: { label: "Email", href: "mailto:hello@example.test" },
    },
    {
      blockType: "richText",
      body: blockText("This is a rich text section."),
    },
    {
      blockType: "contactSection",
      anchor: "contact",
      title: inlineText("Get updates"),
      description: blockText("Product news and renderer updates, delivered occasionally."),
      formName: "newsletter",
      submitLabel: "Notify me",
      fields: [
        { name: "email", label: "Email", type: "email", required: true },
      ],
    },
    {
      blockType: "contactSection",
      title: inlineText("Sign up to our newsletter"),
      formName: "preline-newsletter",
      submitLabel: "Subscribe",
      fields: [
        { name: "email", label: "Email", type: "email", required: true },
      ],
    },
  ],
}
