import type { MediaRef } from "@siteinabox/contracts"
import { previewInlineText } from "../fixtures"
import type { IntegrationLogoItem } from "../integrations-fields"

const previewImage = (): MediaRef => ({
  url: "https://cdn.example.test/integration.svg",
  alt: "Integration",
})

export const integrationLogo = (
  name: string,
  description: string,
  overrides: Partial<IntegrationLogoItem> = {},
): IntegrationLogoItem => ({
  name,
  description,
  image: previewImage(),
  href: "https://example.test",
  ...overrides,
})

export const integrationsFamilyCmsLike = {
  title: previewInlineText("Our Integrations"),
  intro: previewInlineText("Connect your favorite tools and services"),
  logos: [
    integrationLogo("PostHog", "PostHog is an open-source product analytics tool.", { status: "connected" }),
    integrationLogo("Mailchimp", "Marketing platform for creating and sending emails."),
    integrationLogo("Stripe", "Payment processing for online businesses."),
  ],
}

export const integrationsFamilySparse = {
  logos: [integrationLogo("Solo", "Single integration provider.")],
}

export const integrationsFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  logos: [integrationLogo("C".repeat(100), "D".repeat(200))],
}

export const integrationsFamilyEmptyItems = {
  title: previewInlineText("Integrations"),
  intro: previewInlineText("No integrations yet"),
  logos: [] as IntegrationLogoItem[],
}

export const integrations01CmsLike = integrationsFamilyCmsLike

export const integrations02CmsLike = {
  ...integrationsFamilyCmsLike,
  intro: previewInlineText("Connect your favorite tools and services to your account and start using them in your app."),
  logos: integrationsFamilyCmsLike.logos.map((logo, index) =>
    index === 0 ? { ...logo, status: "connected" as const } : logo,
  ),
}

export const integrations03CmsLike = {
  title: previewInlineText("Connect your tools"),
  intro: previewInlineText("Connect your favorite tools and services to your account"),
  logos: integrationsFamilyCmsLike.logos,
}

export const integrations04CmsLike = {
  title: previewInlineText("Easy integrations"),
  intro: previewInlineText("Connect your favorite tools and services to your account"),
  logos: integrationsFamilyCmsLike.logos,
}

export const integrations05CmsLike = {
  title: previewInlineText("Plug into your stack"),
  intro: previewInlineText("Connect your favorite tools and services to your account"),
  logos: integrationsFamilyCmsLike.logos,
}
