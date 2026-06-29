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
      variant: "hyperUiSimple",
      behavior: "sticky",
      activeMode: "path",
      mobileMenu: "dropdown",
      cta: { label: "Contact", href: "#contact" },
    },
    footer: {
      variant: "hyperUiSimple",
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
      variant: "hyperUiSimple",
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
      analytics: { sectionVariant: "tailwind-plus-simple-centered" },
      headline: inlineText("A data-driven site"),
      subheadline: blockText("Rendered by the shared SIAB renderer."),
      cta: { label: "Contact", href: "#contact" },
    },
    {
      blockType: "featureList",
      analytics: { sectionVariant: "tailwind-plus-centered-2x2" },
      title: inlineText("Features"),
      features: [
        { title: inlineText("Shared"), description: blockText("One renderer for CMS and public runtime."), icon: "layers" },
        { title: inlineText("Typed"), description: blockText("Driven by contract data."), icon: "check-circle" },
      ],
    },
    {
      blockType: "pricing",
      analytics: { sectionVariant: "tailwind-plus-simple-pricing" },
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
      analytics: { sectionVariant: "tailwind-plus-stats-simple" },
      title: inlineText("Renderer metrics"),
      items: [
        { value: "8", label: "New block families", description: blockText("Promoted from structured contracts.") },
        { value: "0", label: "Raw code fields", description: blockText("All content remains structured.") },
        { value: "1", label: "Shared renderer", description: blockText("Used by CMS preview and public runtime.") },
      ],
    },
    {
      blockType: "logoCloud",
      analytics: { sectionVariant: "tailwind-plus-logo-cloud-simple" },
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
      analytics: { sectionVariant: "preline-gallery-square-grid" },
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
      analytics: { sectionVariant: "tailwind-plus-team-grid" },
      title: inlineText("Meet the team"),
      intro: blockText("People data maps into the provider-native team layout."),
      members: [
        { name: "Alex Example", role: "Founder", image: { url: "/media/team-1.jpg", alt: "Alex Example" } },
        { name: "Sam Example", role: "Designer", bio: blockText("Builds clear generated-site systems."), image: { url: "/media/team-2.jpg", alt: "Sam Example" } },
      ],
    },
    {
      blockType: "blogCards",
      analytics: { sectionVariant: "tailwind-plus-blog-three-column" },
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
      blockType: "processSteps",
      analytics: { sectionVariant: "mamba-process-steps" },
      title: inlineText("Process"),
      intro: blockText("A concise ordered flow for generated sites."),
      steps: [
        { title: inlineText("Intake"), description: blockText("Collect the structured business brief."), icon: "file-text" },
        { title: inlineText("Review"), description: blockText("Validate content and publishing data."), icon: "check-circle" },
        { title: inlineText("Publish"), description: blockText("Serve the tenant through the renderer."), icon: "rocket" },
      ],
    },
    {
      blockType: "comparison",
      variant: "matrix",
      title: inlineText("Compare plans"),
      intro: blockText("SIAB-owned matrix renderer for structured comparisons."),
      columns: [
        { title: inlineText("Starter"), cta: { label: "Choose starter", href: "/intake?plan=starter" } },
        { title: inlineText("Growth"), cta: { label: "Choose growth", href: "/intake?plan=growth" } },
      ],
      rows: [
        { label: "Published pages", values: ["1", "5"] },
        { label: "Custom domain", values: [true, true] },
        { label: "Priority support", values: [false, true] },
      ],
    },
    {
      blockType: "testimonials",
      analytics: { sectionVariant: "mamba-testimonial-1" },
      title: "What clients say",
      items: [{ quote: "Simple and consistent.", author: "Jane Example" }],
    },
    {
      blockType: "faq",
      analytics: { sectionVariant: "mamba-faq-1" },
      title: inlineText("Questions"),
      items: [{ question: inlineText("Is this generic?"), answer: blockText("Yes. No tenant-specific source is used.") }],
    },
    {
      blockType: "cta",
      analytics: { sectionVariant: "tailblocks-cta-a" },
      headline: inlineText("Ready to start?"),
      description: blockText("Send a message and we will respond."),
      primary: { label: "Email", href: "mailto:hello@example.test" },
    },
    {
      blockType: "richText",
      analytics: { sectionVariant: "tailblocks-content-a" },
      body: blockText("This is a rich text section."),
    },
    {
      blockType: "contactSection",
      analytics: { sectionVariant: "tailwind-plus-newsletter-details" },
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
      analytics: { sectionVariant: "hyperui-newsletter-centered" },
      title: inlineText("Join the renderer list"),
      description: blockText("Updates for data-backed generated sites, delivered occasionally."),
      formName: "hyperui-newsletter",
      submitLabel: "Sign Up",
      fields: [
        { name: "email", label: "Email", type: "email", required: true },
      ],
    },
    {
      blockType: "contactSection",
      analytics: { sectionVariant: "preline-centered-newsletter" },
      title: inlineText("Sign up to our newsletter"),
      formName: "preline-newsletter",
      submitLabel: "Subscribe",
      fields: [
        { name: "email", label: "Email", type: "email", required: true },
      ],
    },
  ],
}
