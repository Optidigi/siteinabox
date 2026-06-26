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
      behavior: "sticky",
      activeMode: "path",
      mobileMenu: "dropdown",
      cta: { label: "Contact", href: "#contact" },
    },
    footer: {
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
      blockType: "mediaHero",
      headline: inlineText("Media-backed hero"),
      subheadline: blockText("A generic hero using structured media, overlay, and action data."),
      cta: { label: "View services", href: "#services" },
      secondary: { label: "Contact", href: "#contact" },
      backgroundImage: { url: "/media/hero.jpg", alt: "Workshop" },
      overlay: { color: "#111827", opacity: 0.44 },
      minHeight: "standard",
      contentAlign: "left",
      shapeDividers: { bottom: "mountains" },
      priority: true,
    },
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
      blockType: "infoCardList",
      title: inlineText("Quick facts"),
      layout: "grid",
      iconPosition: "left",
      items: [
        { title: inlineText("Open"), description: blockText("Monday to Friday by appointment."), icon: "clock" },
        { title: inlineText("Local"), description: blockText("Serving nearby customers with clear contact paths."), icon: "map-pin" },
      ],
    },
    {
      blockType: "serviceCarousel",
      anchor: "services",
      title: inlineText("Services"),
      layout: "carousel",
      carousel: { slidesPerView: 3, slidesPerViewTablet: 2, slidesPerViewMobile: 1, pagination: "bullets" },
      items: [
        { title: inlineText("Planning"), description: blockText("Structured service content with optional media."), image: "/media/service-1.jpg" },
        { title: inlineText("Execution"), description: blockText("Cards degrade to a readable horizontal list without client runtime."), image: "/media/service-2.jpg" },
        { title: inlineText("Support"), description: blockText("Actions remain data-driven."), cta: { label: "Ask a question", href: "#contact" } },
      ],
    },
    {
      blockType: "beforeAfterGallery",
      title: inlineText("Before and after"),
      pairs: [
        {
          before: "/media/before.jpg",
          after: "/media/after.jpg",
          beforeLabel: "Before",
          afterLabel: "After",
          caption: blockText("Static comparison layout for parity fixture coverage."),
        },
      ],
    },
    {
      blockType: "contactDetails",
      title: inlineText("Contact details"),
      layout: "cards",
      items: [
        { kind: "email", label: "Email", value: inlineText("hello@example.test"), href: "mailto:hello@example.test" },
        { kind: "phone", label: "Phone", value: inlineText("+31 00 000 0000"), href: "tel:+31000000000" },
      ],
      legal: { kvkNumber: "00000000", btwId: "NL000000000B00" },
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
