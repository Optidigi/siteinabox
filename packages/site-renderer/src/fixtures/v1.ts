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
      blockType: "newsletter",
      title: inlineText("Get product updates"),
      description: blockText("Occasional notes about renderer improvements and new structured sections."),
      emailLabel: "Email address",
      emailPlaceholder: "you@example.test",
      submitLabel: "Subscribe",
      consentLabel: "I agree to receive occasional product updates.",
      benefits: [
        { title: inlineText("Release notes"), description: blockText("New renderer capabilities as they ship."), icon: "sparkles" },
        { title: inlineText("Implementation guides"), description: blockText("Short notes for editors and operators."), icon: "book-open" },
      ],
      provider: {
        provider: "siab",
        action: "/api/forms/newsletter",
        method: "POST",
        requiresConsent: true,
        analyticsEnabled: true,
      },
    },
    {
      blockType: "bentoGrid",
      title: inlineText("Operational building blocks"),
      intro: blockText("Bento data stays ordered and structured; the renderer owns the grid treatment."),
      items: [
        {
          title: inlineText("Typed slots"),
          description: blockText("Generation fills content fields, not layout instructions."),
          icon: "layout-grid",
        },
        {
          title: inlineText("Reusable media"),
          description: blockText("Images use the same media references as hero, feature, and gallery blocks."),
          image: { url: "/media/bento-media.jpg", alt: "Media preview" },
        },
        {
          title: inlineText("Clear actions"),
          description: blockText("Optional links remain structured CMS data."),
          cta: { label: "View docs", href: "/docs" },
        },
      ],
    },
    {
      blockType: "contentSection",
      eyebrow: inlineText("Deep dive"),
      title: inlineText("Media policies stay shared"),
      intro: blockText("Screenshot sections use the same media reference contract as the rest of the renderer."),
      body: blockText("Content sections reuse the existing media reference model and leave cropping, framing, and responsive behavior to the renderer or provider source."),
      features: [
        { title: inlineText("Typed media"), description: blockText("Images remain CMS media references."), icon: "image" },
        { title: inlineText("Fixed layout"), description: blockText("Provider source owns sticky positioning."), icon: "lock" },
        { title: inlineText("Snapshot safe"), description: blockText("Publishing validates the filled slots."), icon: "check" },
      ],
      secondaryTitle: inlineText("Provider framing stays static"),
      secondaryBody: blockText("Generated data cannot change spacing, breakpoints, sticky behavior, or utility classes."),
      image: { url: "/media/content-section.jpg", alt: "Content section preview" },
      cta: { label: "Read more", href: "/blog/media-policy" },
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
