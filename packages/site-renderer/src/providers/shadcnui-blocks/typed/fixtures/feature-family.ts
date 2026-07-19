import { previewBlockText, previewInlineText } from "../fixtures"

export const featureItem = (title: string, description: string) => ({
  title: previewInlineText(title),
  description: previewBlockText(description),
})

export const featureFamilyCmsLike = {
  title: previewInlineText("Product Features"),
  intro: previewInlineText("Everything you need to launch faster and iterate with confidence."),
  features: [
    featureItem("Fast setup", "Get started in minutes with sensible defaults."),
    featureItem("Flexible layouts", "Adapt blocks to match your brand without custom code."),
    featureItem("Built-in analytics", "Track engagement with clear, actionable metrics."),
  ],
}

export const featureFamilySparse = {
  features: [featureItem("Only feature", "Only description.")],
}

export const featureFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  features: [featureItem("A".repeat(500), "A".repeat(500))],
}

export const featureFamilyEmptyFeatures = {
  title: previewInlineText("Features"),
  intro: previewInlineText("Highlights below."),
  features: [] as Array<ReturnType<typeof featureItem>>,
}

export const featureFamilyWithEyebrow = {
  eyebrow: previewInlineText("Why choose us"),
  title: previewInlineText("Security you can trust"),
  intro: previewInlineText("Reliable protection for modern homes and teams."),
  features: [
    featureItem("Real-time alerts", "Stay informed the moment something changes."),
    featureItem("Simple setup", "Install and configure in minutes, not hours."),
  ],
}
