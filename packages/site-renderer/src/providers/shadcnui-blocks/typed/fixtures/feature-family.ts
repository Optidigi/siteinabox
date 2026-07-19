import { previewBlockText, previewInlineText } from "../fixtures"

export const featureItem = (title: string, description: string) => ({
  title: previewInlineText(title),
  description: previewBlockText(description),
})

export const feature03Literal = {
  title: previewInlineText("Design and engage: Build smarter spaces and strategies"),
  features: [
    featureItem(
      "Plan Smarter",
      "Design your space with drag-and-drop simplicity—create grids, lists, or galleries in seconds.\nEmbed polls, quizzes, or forms to keep your audience engaged.",
    ),
    featureItem(
      "Plan Smarter",
      "Design your space with drag-and-drop simplicity—create grids, lists, or galleries in seconds.\nEmbed polls, quizzes, or forms to keep your audience engaged.",
    ),
  ],
}

export const featureFamilyCmsLike = {
  title: previewInlineText("Product Features"),
  intro: previewInlineText("Everything you need to launch faster and iterate with confidence."),
  features: [
    featureItem("Fast setup", "Get started in minutes with sensible defaults."),
    featureItem("Flexible layouts", "Adapt blocks to match your brand without custom code."),
    featureItem("Built-in analytics", "Track engagement with clear, actionable metrics."),
  ],
}

export const featureFamilyLiteral = {
  title: previewInlineText("Product Features"),
  intro: previewInlineText("Everything you need to launch faster and iterate with confidence."),
  features: [
    featureItem(
      "Customizable Layouts",
      "Design your space with drag-and-drop simplicity—create grids, lists, or galleries in seconds.",
    ),
    featureItem(
      "Interactive Widgets",
      "Embed polls, quizzes, or forms to keep your audience engaged.",
    ),
    featureItem(
      "AI-Powered Tools",
      "Generate summaries, auto-format content, or translate into multiple languages seamlessly.",
    ),
    featureItem(
      "Media Integrations",
      "Connect with Spotify, Instagram, or your own media library for dynamic visuals and sound.",
    ),
    featureItem(
      "Advanced Analytics",
      "Track engagement, clicks, and user activity with intuitive charts and reports.",
    ),
    featureItem(
      "Seamless Collaboration",
      "Comment, tag, and assign tasks directly within your documents.",
    ),
  ],
}

export const feature06Literal = {
  title: previewInlineText("Product Features"),
  intro: previewInlineText("Everything you need to launch faster and iterate with confidence."),
  features: [
    featureItem(
      "Collect and Enrich Leads Your Way",
      "Take control over how and when to follow up with your leads. Store and reference leads in multiple tables and automatically send them personalized emails.",
    ),
    featureItem(
      "Streamline Your Workflows Easily",
      "Organize tasks, deadlines, and team collaboration in one place. Use customizable boards to manage projects efficiently and automate routine updates.",
    ),
    featureItem(
      "Deliver Seamless Customer Experiences",
      "Track customer queries faster with an integrated ticketing system. Set priorities, automate follow-ups, and enhance satisfaction with personalized responses.",
    ),
    featureItem(
      "Stay Connected with Your Team",
      "Simplify communication with shared boards and real-time updates. Enable transparent goal tracking and instant feedback for better results.",
    ),
  ],
}

export const feature07Literal = {
  title: previewInlineText("Product Features"),
  intro: previewInlineText("Everything you need to launch faster and iterate with confidence."),
  features: [
    featureItem("Identify Opportunities", "Easily uncover untapped areas to explore and expand your reach."),
    featureItem("Build Authority", "Create valuable content that resonates and inspires trust."),
    featureItem("Instant Insights", "Gain immediate, actionable insights with a quick glance."),
    featureItem("Engage with Your Audience", "Boost audience engagement with interactive features."),
    featureItem("Automate Your Workflow", "Streamline your processes by automating repetitive tasks."),
    featureItem("Accelerate Growth", "Supercharge your growth by implementing strategies."),
    featureItem("Build Authority", "Create valuable content that resonates and inspires trust."),
    featureItem("Instant Insights", "Gain immediate, actionable insights with a quick glance."),
    featureItem("Identify Opportunities", "Easily uncover untapped areas to explore and expand your reach."),
  ],
}

export const feature12Literal = {
  eyebrow: previewInlineText("Why choose us"),
  title: previewInlineText("Security you can trust"),
  intro: previewInlineText("Reliable protection for modern homes and teams."),
  features: [
    featureItem("Blazing Fast Performance", "Optimized for speed with minimal loading times and instant interactions, ensuring a smooth experience across devices."),
    featureItem("Fully Customizable", "Tailor every component to match your brand or workflow — with built-in support for themes, layouts, and configurations."),
    featureItem("Developer-Friendly", "Built with clean, modern code and best practices in mind, making it easy to integrate, extend, and scale."),
    featureItem("Responsive by Default", "Every component is designed to look great on all screen sizes — no extra work needed to make things mobile-friendly."),
    featureItem("Accessible for Everyone", "Built with accessibility best practices in mind to ensure an inclusive experience for all users, regardless of ability."),
    featureItem("Seamless Integration", "Easily connect with your favorite tools, APIs, and services — whether it's authentication, databases, or third-party libraries."),
  ],
}

export const feature14Literal = {
  eyebrow: previewInlineText("Why choose us"),
  title: previewInlineText("Security you can trust"),
  intro: previewInlineText("Reliable protection for modern homes and teams."),
  features: [
    featureItem("Real-Time Protection", "Stay alert with instant notifications and smart security monitoring."),
    featureItem("Smart & Simple Setup", "Install easily in minutes with no complex tools or wiring."),
    featureItem("Peace of Mind Anywhere", "Monitor and control your home from anywhere, anytime."),
  ],
}

export const feature18Literal = {
  eyebrow: previewInlineText("Why choose us"),
  title: previewInlineText("Security you can trust"),
  intro: previewInlineText("Reliable protection for modern homes and teams."),
  features: [
    featureItem("Real-Time Protection", "Stay alert with instant notifications and smart security monitoring."),
    featureItem("Smart & Simple Setup", "Install easily in minutes with no complex tools or wiring."),
    featureItem("Peace of Mind Anywhere", "Monitor and control your home from anywhere, anytime."),
    featureItem("Smart Home Integration", "Easily connect with your favorite smart home devices and services."),
    featureItem("Global Coverage", "Monitor and control your home from anywhere, anytime."),
    featureItem("Secure & Reliable", "Built with the latest security technologies to protect your home."),
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
