import { previewInlineText } from "../fixtures"
import { faqItem } from "./faq-01"

export const faqFamilyCmsLike = {
  title: previewInlineText("Frequently Asked Questions"),
  intro: previewInlineText("Quick answers to common questions about our products and services."),
  items: [
    faqItem("What is your return policy?", "You can return unused items within 30 days."),
    faqItem("How do I track my order?", "Use the link in your confirmation email."),
  ],
}

export const faqFamilySparse = {
  items: [faqItem("Only question?", "Only answer.")],
}

export const faqFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  items: [faqItem("A".repeat(500), "A".repeat(500))],
}

export const faqFamilyEmptyItems = {
  title: previewInlineText("FAQ"),
  items: [] as Array<{ question: ReturnType<typeof previewInlineText>; answer: ReturnType<typeof import("../fixtures").previewBlockText> }>,
}
