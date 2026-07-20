import { previewBlockText, previewInlineText } from "../fixtures"

const faqItem = (question: string, answer: string) => ({
  question: previewInlineText(question),
  answer: previewBlockText(answer),
})

export const faq01Literal = {
  title: previewInlineText("Questions & Answers"),
  items: [
    faqItem(
      "What is your return policy?",
      "You can return unused items in their original packaging within 30 days for a refund or exchange. Contact support for assistance.",
    ),
    faqItem(
      "How do I track my order?",
      "Track your order using the link provided in your confirmation email, or log into your account to view tracking details.",
    ),
    faqItem(
      "Do you ship internationally?",
      "Yes, we ship worldwide. Shipping fees and delivery times vary by location, and customs duties may apply for some countries.",
    ),
    faqItem(
      "What payment methods do you accept?",
      "We accept Visa, MasterCard, American Express, PayPal, Apple Pay, and Google Pay, ensuring secure payment options for all customers.",
    ),
    faqItem(
      "What if I receive a damaged item?",
      "Please contact our support team within 48 hours of delivery with photos of the damaged item. We'll arrange a replacement or refund.",
    ),
  ],
}

export const faq01Sparse = {
  items: [faqItem("Only question?", "Only answer.")],
}

export const faq01Long = {
  title: previewInlineText("A".repeat(500)),
  items: [faqItem("A".repeat(500), "A".repeat(500))],
}

export const faq01CmsLike = {
  title: previewInlineText("Questions & Answers"),
  items: [
    faqItem("What is your return policy?", "You can return unused items within 30 days."),
    faqItem("How do I track my order?", "Use the link in your confirmation email."),
  ],
}

export const faq01EmptyItems = {
  title: previewInlineText("FAQ"),
  items: [] as Array<{ question: ReturnType<typeof previewInlineText>; answer: ReturnType<typeof previewBlockText> }>,
}

export { faqItem }
