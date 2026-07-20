import { previewBlockText, previewInlineText } from "../fixtures"

export const featureItem = (title: string, description: string) => ({
  title: previewInlineText(title),
  description: previewBlockText(description),
})

const feature01Items = [
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
]

const feature02Items = [
  featureItem("Identify Opportunities", "Find untapped areas to explore effortlessly."),
  featureItem("Build Authority", "Craft content that resonates and inspires trust."),
  featureItem("Instant Insights", "Get actionable insights instantly at a glance."),
]

const literalPlaceholderImage = (hash: string) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:${hash}`

export const feature07LiteralImages = [
  "85f35",
  "d30fc",
  "07ff9",
  "c1427",
  "1218e",
  "003d6",
  "80189",
  "19eb3",
  "ca3a0",
].map(literalPlaceholderImage)

export const feature15LiteralImages = [
  "003d6",
  "85f35",
  "d30fc",
  "1218e",
  "19eb3",
  "c1427",
].map(literalPlaceholderImage)

const feature05Items = [
  featureItem(
    "Identify Opportunities",
    "Easily uncover untapped areas to explore and expand your reach effortlessly.",
  ),
  featureItem(
    "Build Authority",
    "Create valuable content that resonates, inspires trust, and positions you as an expert.",
  ),
  featureItem(
    "Instant Insights",
    "Gain immediate, actionable insights with a quick glance, enabling fast decision-making.",
  ),
  featureItem(
    "Engage with Your Audience",
    "Boost audience engagement with interactive features like polls, quizzes, and forms.",
  ),
  featureItem(
    "Automate Your Workflow",
    "Streamline your processes by automating repetitive tasks, saving time and reducing effort.",
  ),
  featureItem(
    "Accelerate Growth",
    "Supercharge your growth by implementing strategies that drive results quickly and efficiently.",
  ),
]

const featureAccordionItems = [
  featureItem(
    "Identify Opportunities",
    "Easily uncover untapped areas to explore and expand your reach effortlessly and effectively.",
  ),
  featureItem(
    "Build Authority",
    "Create valuable content that resonates, inspires trust, and positions you as an expert.",
  ),
  featureItem(
    "Instant Insights",
    "Gain immediate, actionable insights with a quick glance, enabling fast decision-making.",
  ),
  featureItem(
    "Engage with Your Audience",
    "Boost audience engagement with interactive features like polls, quizzes, and forms.",
  ),
  featureItem(
    "Automate Your Workflow",
    "Streamline your processes by automating repetitive tasks, saving time and reducing effort.",
  ),
  featureItem(
    "Accelerate Growth",
    "Supercharge your growth by implementing strategies that drive results quickly and efficiently.",
  ),
]

const feature06Items = [
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
]

const feature07Items = [
  featureItem("Identify Opportunities", "Easily uncover untapped areas to explore and expand your reach."),
  featureItem("Build Authority", "Create valuable content that resonates and inspires trust."),
  featureItem("Instant Insights", "Gain immediate, actionable insights with a quick glance."),
  featureItem("Engage with Your Audience", "Boost audience engagement with interactive features."),
  featureItem("Automate Your Workflow", "Streamline your processes by automating repetitive tasks."),
  featureItem("Accelerate Growth", "Supercharge your growth by implementing strategies."),
  featureItem("Build Authority", "Create valuable content that resonates and inspires trust."),
  featureItem("Instant Insights", "Gain immediate, actionable insights with a quick glance."),
  featureItem("Identify Opportunities", "Easily uncover untapped areas to explore and expand your reach."),
]

const featureBlazingFastFullItems = [
  featureItem(
    "Blazing Fast Performance",
    "Optimized for speed with minimal loading times and instant interactions, ensuring a smooth experience across devices.",
  ),
  featureItem(
    "Fully Customizable",
    "Tailor every component to match your brand or workflow — with built-in support for themes, layouts, and configurations.",
  ),
  featureItem(
    "Developer-Friendly",
    "Built with clean, modern code and best practices in mind, making it easy to integrate, extend, and scale.",
  ),
  featureItem(
    "Responsive by Default",
    "Every component is designed to look great on all screen sizes — no extra work needed to make things mobile-friendly.",
  ),
  featureItem(
    "Accessible for Everyone",
    "Built with accessibility best practices in mind to ensure an inclusive experience for all users, regardless of ability.",
  ),
  featureItem(
    "Seamless Integration",
    "Easily connect with your favorite tools, APIs, and services — whether it's authentication, databases, or third-party libraries.",
  ),
]

const featureBlazingFastShortItems = [
  featureItem(
    "Blazing Fast Performance",
    "Optimized for speed with minimal loading times and instant interactions.",
  ),
  featureItem("Fully Customizable", "Tailor every component to match your brand or workflow."),
  featureItem("Developer-Friendly", "Built with clean, modern code and best practices in mind."),
  featureItem("Responsive by Default", "Every component is designed to look great on all screen sizes."),
  featureItem("Accessible for Everyone", "Built with accessibility best practices in mind."),
  featureItem("Seamless Integration", "Easily connect with your favorite tools, APIs, and services."),
]

const feature14Items = [
  featureItem("Real-Time Protection", "Stay alert with instant notifications and smart security monitoring."),
  featureItem("Smart & Simple Setup", "Install easily in minutes with no complex tools or wiring."),
  featureItem("Peace of Mind Anywhere", "Monitor and control your home from anywhere, anytime."),
]

const feature18Items = [
  featureItem("Real-Time Protection", "Stay alert with instant notifications and smart security monitoring."),
  featureItem("Smart & Simple Setup", "Install easily in minutes with no complex tools or wiring."),
  featureItem("Peace of Mind Anywhere", "Monitor and control your home from anywhere, anytime."),
  featureItem("Smart Home Integration", "Easily connect with your favorite smart home devices and services."),
  featureItem("Global Coverage", "Monitor and control your home from anywhere, anytime."),
  featureItem("Secure & Reliable", "Built with the latest security technologies to protect your home."),
]

export const featureFamilyCmsLike = {
  title: previewInlineText("Product Features"),
  intro: previewInlineText("Everything you need to launch faster and iterate with confidence."),
  features: [
    featureItem("Fast setup", "Get started in minutes with sensible defaults."),
    featureItem("Flexible layouts", "Adapt blocks to match your brand without custom code."),
    featureItem("Built-in analytics", "Track engagement with clear, actionable metrics."),
  ],
}

export const feature01Literal = {
  title: previewInlineText("Ready out of the box"),
  intro: previewInlineText("Simple, customizable, and easy to drop into your workflow"),
  features: feature01Items,
}

export const featureFamilyLiteral = feature01Literal

export const feature02Literal = {
  title: previewInlineText("Where ideas take shape"),
  intro: previewInlineText("No complex configs. Just copy, paste, and start building"),
  features: feature02Items,
}

export const feature03Literal = {
  features: [
    {
      title: previewInlineText("Plan Smarter"),
      description: previewBlockText(
        "Design your space with drag-and-drop simplicity—create grids, lists, or galleries in seconds.\nEmbed polls, quizzes, or forms to keep your audience engaged.",
      ),
    },
    {
      title: previewInlineText("Plan Smarter"),
      description: previewBlockText(
        "Design your space with drag-and-drop simplicity—create grids, lists, or galleries in seconds.\nEmbed polls, quizzes, or forms to keep your audience engaged.",
      ),
    },
  ],
}

export const feature04Literal = {
  title: previewInlineText("Build scalable interfaces with minimal effort"),
  features: featureAccordionItems,
}

export const feature05Literal = {
  title: previewInlineText("What makes it different"),
  intro: previewInlineText("Minimal setup, clean structure, and easy customization"),
  features: feature05Items,
}

export const feature06Literal = {
  title: previewInlineText("Less setup, more building"),
  intro: previewInlineText("Simple, customizable, and easy to drop into your workflow"),
  features: feature06Items,
}

export const feature07Literal = {
  title: previewInlineText("Strengthen your strategy"),
  intro: previewInlineText("No complex configs. Just copy, paste, and start building"),
  features: feature07Items,
}

export const feature08Literal = {
  title: previewInlineText("Everything in one place"),
  intro: previewInlineText("Designed for speed, flexibility, and ease of use"),
  features: featureBlazingFastFullItems,
}

export const feature09Literal = {
  title: previewInlineText("Ship with confidence"),
  intro: previewInlineText("Designed for speed, flexibility, and ease of use"),
  features: featureBlazingFastFullItems,
}

export const feature10Literal = {
  title: previewInlineText("All the right tools"),
  intro: previewInlineText("Practical components designed for production"),
  features: featureBlazingFastFullItems,
}

export const feature11Literal = {
  title: previewInlineText("Built to just work"),
  intro: previewInlineText("Designed for speed, flexibility, and ease of use"),
  features: featureBlazingFastFullItems,
}

export const feature12Literal = {
  title: previewInlineText("Designed to scale"),
  intro: previewInlineText("Spend less time configuring and more time creating"),
  features: featureBlazingFastFullItems,
}

export const feature13Literal = {
  title: previewInlineText("Engineered for speed"),
  intro: previewInlineText("Designed for speed, flexibility, and ease of use"),
  features: featureBlazingFastFullItems,
}

export const feature14Literal = {
  eyebrow: previewInlineText("Why Choose Us"),
  title: previewInlineText("We are Leading in Smart Assistants with Nearly 20 Years of Experience"),
  intro: previewInlineText("We are constantly always keep pace with the time."),
  features: feature14Items,
}

export const feature15Literal = {
  title: previewInlineText("Built with intention"),
  intro: previewInlineText("Carefully structured blocks that feel right in projects"),
  features: featureBlazingFastShortItems,
}

export const feature16Literal = {
  title: previewInlineText("Consistency first"),
  intro: previewInlineText("Maintain a clean and consistent UI across your app"),
  features: featureBlazingFastShortItems,
}

export const feature17Literal = {
  title: previewInlineText("Simplify your stack"),
  intro: previewInlineText("Reduce dependencies and keep things easy"),
  features: featureBlazingFastFullItems,
}

export const feature18Literal = {
  eyebrow: previewInlineText("Why Choose Us"),
  title: previewInlineText("Advanced Home Security Solutions Built for Modern Living"),
  intro: previewInlineText("We are constantly always keep pace with the time"),
  features: feature18Items,
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
