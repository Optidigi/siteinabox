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
  navHeader: [{ label: "Home", href: "/" }],
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
