import { previewInlineText } from "../fixtures"
import { faqItem } from "./faq-01"

const faqLiteral = (items: ReadonlyArray<{ readonly q: string; readonly a: string }>) => ({
  title: previewInlineText("Frequently Asked Questions"),
  intro: previewInlineText("Quick answers to common questions about our products and services."),
  items: items.map(({ q, a }) => faqItem(q, a)),
})

const FAQ02_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "You can return unused items in their original packaging within 30 days for a refund or exchange. Contact support for assistance."
  },
  {
    "q": "How do I track my order?",
    "a": "Track your order using the link provided in your confirmation email, or log into your account to view tracking details."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship worldwide. Shipping fees and delivery times vary by location, and customs duties may apply for some countries."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept Visa, MasterCard, American Express, PayPal, Apple Pay, and Google Pay, ensuring secure payment options for all customers."
  },
  {
    "q": "What if I receive a damaged item?",
    "a": "Please contact our support team within 48 hours of delivery with photos of the damaged item. We’ll arrange a replacement or refund."
  }
] as const
export const faq02Literal = faqLiteral(FAQ02_ITEMS)

const FAQ03_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "You can return unused items in their original packaging within 30 days for a refund or exchange. Contact support for assistance."
  },
  {
    "q": "How do I track my order?",
    "a": "Track your order using the link provided in your confirmation email, or log into your account to view tracking details."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship worldwide. Shipping fees and delivery times vary by location, and customs duties may apply for some countries."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept Visa, MasterCard, American Express, PayPal, Apple Pay, and Google Pay, ensuring secure payment options for all customers."
  },
  {
    "q": "What if I receive a damaged item?",
    "a": "Please contact our support team within 48 hours of delivery with photos of the damaged item. We’ll arrange a replacement or refund."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "Yes, you can cancel or change your order within 24 hours of placing it. Contact customer support to make updates."
  },
  {
    "q": "Do you offer discounts for bulk purchases?",
    "a": "Yes, we provide special discounts for bulk orders. Contact our sales team with your requirements for a customized quote."
  },
  {
    "q": "How long does shipping take?",
    "a": "Shipping usually takes 3-7 business days domestically and 7-14 business days internationally, depending on your location and selected shipping method."
  },
  {
    "q": "Are your products eco-friendly?",
    "a": "Many of our products are made with sustainable materials and eco-friendly practices to reduce environmental impact while maintaining quality."
  },
  {
    "q": "How can I contact customer support?",
    "a": "Reach out via email at support@example.com or call us at 1-800-123-4567 for assistance with any inquiries."
  }
] as const
export const faq03Literal = faqLiteral(FAQ03_ITEMS)

const FAQ04_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "You can return unused items in their original packaging within 30 days for a refund or exchange. Contact support for assistance."
  },
  {
    "q": "How do I track my order?",
    "a": "Track your order using the link provided in your confirmation email, or log into your account to view tracking details."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship worldwide. Shipping fees and delivery times vary by location, and customs duties may apply for some countries."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept Visa, MasterCard, American Express, PayPal, Apple Pay, and Google Pay, ensuring secure payment options for all customers."
  },
  {
    "q": "What if I receive a damaged item?",
    "a": "Please contact our support team within 48 hours of delivery with photos of the damaged item. We’ll arrange a replacement or refund."
  },
  {
    "q": "How can I contact customer support?",
    "a": "Reach out via email at support@example.com or call us at 1-800-123-4567 for assistance with any inquiries."
  }
] as const
export const faq04Literal = faqLiteral(FAQ04_ITEMS)

const FAQ05_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "You can return unused items in their original packaging within 30 days for a refund or exchange. Contact support for assistance."
  },
  {
    "q": "How do I track my order?",
    "a": "Track your order using the link provided in your confirmation email, or log into your account to view tracking details."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship worldwide. Shipping fees and delivery times vary by location, and customs duties may apply for some countries."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept Visa, MasterCard, American Express, PayPal, Apple Pay, and Google Pay, ensuring secure payment options for all customers."
  },
  {
    "q": "What if I receive a damaged item?",
    "a": "Please contact our support team within 48 hours of delivery with photos of the damaged item. We’ll arrange a replacement or refund."
  },
  {
    "q": "How can I contact customer support?",
    "a": "Reach out via email at support@example.com or call us at 1-800-123-4567 for assistance with any inquiries."
  }
] as const
export const faq05Literal = faqLiteral(FAQ05_ITEMS)

const FAQ06_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "You can return unused items in their original packaging within 30 days for a refund or exchange. Contact support for assistance."
  },
  {
    "q": "How do I track my order?",
    "a": "Track your order using the link provided in your confirmation email, or log into your account to view tracking details."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship worldwide. Shipping fees and delivery times vary by location, and customs duties may apply for some countries."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept Visa, MasterCard, American Express, PayPal, Apple Pay, and Google Pay, ensuring secure payment options for all customers."
  },
  {
    "q": "What if I receive a damaged item?",
    "a": "Please contact our support team within 48 hours of delivery with photos of the damaged item. We’ll arrange a replacement or refund."
  }
] as const
export const faq06Literal = faqLiteral(FAQ06_ITEMS)

const FAQ07_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "You can return unused items in their original packaging within 30 days for a refund or exchange. Contact support for assistance."
  },
  {
    "q": "How do I track my order?",
    "a": "Track your order using the link provided in your confirmation email, or log into your account to view tracking details."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship worldwide. Shipping fees and delivery times vary by location, and customs duties may apply for some countries."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept Visa, MasterCard, American Express, PayPal, Apple Pay, and Google Pay, ensuring secure payment options for all customers."
  },
  {
    "q": "What if I receive a damaged item?",
    "a": "Please contact our support team within 48 hours of delivery with photos of the damaged item. We’ll arrange a replacement or refund."
  }
] as const
export const faq07Literal = faqLiteral(FAQ07_ITEMS)

const FAQ08_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "We offer a 30-day return policy on all unused products. Please ensure the item is in original packaging when returning."
  },
  {
    "q": "How long does shipping take?",
    "a": "Shipping typically takes 3-7 business days depending on your location."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship to most countries worldwide. Shipping fees and delivery times vary by destination."
  },
  {
    "q": "How can I track my order?",
    "a": "After your order is shipped, you'll receive an email with a tracking link. You can also track your order in your account dashboard."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept all major credit cards, PayPal, UPI, and net banking."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "Yes, you can cancel or modify your order within 2 hours of placing it. After that, the order may already be processed for shipment."
  }
] as const
export const faq08Literal = faqLiteral(FAQ08_ITEMS)

const FAQ09_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "We offer a 30-day return policy on all unused products. Please ensure the item is in original packaging when returning."
  },
  {
    "q": "How long does shipping take?",
    "a": "Shipping typically takes 3-7 business days depending on your location."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship to most countries worldwide. Shipping fees and delivery times vary by destination."
  },
  {
    "q": "How can I track my order?",
    "a": "After your order is shipped, you'll receive an email with a tracking link. You can also track your order in your account dashboard."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept all major credit cards, PayPal, UPI, and net banking."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "Yes, you can cancel or modify your order within 2 hours of placing it. After that, the order may already be processed for shipment."
  }
] as const
export const faq09Literal = faqLiteral(FAQ09_ITEMS)

const FAQ10_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "We offer a 30-day return policy on all unused products. Please ensure the item is in original packaging when returning."
  },
  {
    "q": "How long does shipping take?",
    "a": "Shipping typically takes 3-7 business days depending on your location."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship to most countries worldwide. Shipping fees and delivery times vary by destination."
  },
  {
    "q": "How can I track my order?",
    "a": "After your order is shipped, you'll receive an email with a tracking link. You can also track your order in your account dashboard."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept all major credit cards, PayPal, UPI, and net banking."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "Yes, you can cancel or modify your order within 2 hours of placing it. After that, the order may already be processed for shipment."
  },
  {
    "q": "Is my personal information secure?",
    "a": "Yes, we use industry-standard encryption to ensure your personal and payment information is secure."
  },
  {
    "q": "Do you offer customer support?",
    "a": "Absolutely. Our support team is available 24/7 via email and chat to help with any issues or questions."
  }
] as const
export const faq10Literal = faqLiteral(FAQ10_ITEMS)

const FAQ11_ITEMS = [
  {
    "q": "How long does shipping take?",
    "a": "Shipping typically takes 3-7 business days depending on your location."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "You can cancel or modify your order within 2 hours of placing it. After that, it may be processed for shipment."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we offer international shipping. Delivery times and charges vary depending on the destination."
  },
  {
    "q": "How can I track my order?",
    "a": "Once your order is shipped, a tracking link will be sent via email. You can also view it in your account."
  },
  {
    "q": "What should I do if my order is delayed?",
    "a": "If your order is delayed, please contact our support team and we'll look into it immediately."
  },
  {
    "q": "What is your return policy?",
    "a": "We offer a 30-day return policy on unused items in their original packaging."
  },
  {
    "q": "How do I initiate a return?",
    "a": "Log into your account, go to 'Orders', and select the return option or contact support for help."
  },
  {
    "q": "How long does it take to process a refund?",
    "a": "Refunds are usually processed within 5-7 business days after we receive the returned item."
  },
  {
    "q": "Can I return a used product?",
    "a": "No, we only accept returns for unused products in original condition."
  },
  {
    "q": "Are return shipping charges covered?",
    "a": "Return shipping is free for defective or incorrect items. For other returns, the cost is deducted from the refund."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept credit/debit cards, UPI, PayPal, Apple Pay, and net banking."
  },
  {
    "q": "Is my payment information secure?",
    "a": "Absolutely. We use SSL encryption and secure payment gateways to protect your data."
  },
  {
    "q": "Why was my payment declined?",
    "a": "Payments may be declined due to incorrect info or issues with the card issuer. Try again or contact your bank."
  },
  {
    "q": "Do you offer cash on delivery (COD)?",
    "a": "Currently, we do not offer COD. All payments must be made online."
  },
  {
    "q": "Will I receive an invoice for my purchase?",
    "a": "Yes, an invoice will be emailed to you after successful payment."
  },
  {
    "q": "Do I need an account to place an order?",
    "a": "No, you can check out as a guest. However, having an account gives you access to order tracking and faster checkouts."
  },
  {
    "q": "I forgot my password. What should I do?",
    "a": "Click on 'Forgot password' on the login page and follow the instructions to reset it."
  },
  {
    "q": "How can I contact customer support?",
    "a": "You can reach us via email at support@example.com or through live chat on our website."
  },
  {
    "q": "How do I update my profile information?",
    "a": "Log in to your account and go to 'Profile Settings' to update your personal details."
  },
  {
    "q": "Do you offer 24/7 support?",
    "a": "Yes, our customer support team is available around the clock to help you."
  }
] as const
export const faq11Literal = faqLiteral(FAQ11_ITEMS)

const FAQ12_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "We offer a 30-day return policy on all unused products. Please ensure the item is in original packaging when returning."
  },
  {
    "q": "How long does shipping take?",
    "a": "Shipping typically takes 3-7 business days depending on your location."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship to most countries worldwide. Shipping fees and delivery times vary by destination."
  },
  {
    "q": "How can I track my order?",
    "a": "After your order is shipped, you'll receive an email with a tracking link. You can also track your order in your account dashboard."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept all major credit cards, PayPal, UPI, and net banking."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "Yes, you can cancel or modify your order within 2 hours of placing it. After that, the order may already be processed for shipment."
  },
  {
    "q": "Is my personal information secure?",
    "a": "Yes, we use industry-standard encryption to ensure your personal and payment information is secure."
  },
  {
    "q": "Do you offer customer support?",
    "a": "Absolutely. Our support team is available 24/7 via email and chat to help with any issues or questions."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept all major credit cards, PayPal, UPI, and net banking."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "Yes, you can cancel or modify your order within 2 hours of placing it. After that, the order may already be processed for shipment."
  }
] as const
export const faq12Literal = faqLiteral(FAQ12_ITEMS)

const FAQ13_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "We offer a 30-day return policy on all unused products. Please ensure the item is in original packaging when returning."
  },
  {
    "q": "How long does shipping take?",
    "a": "Shipping typically takes 3-7 business days depending on your location."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship to most countries worldwide. Shipping fees and delivery times vary by destination."
  },
  {
    "q": "How can I track my order?",
    "a": "After your order is shipped, you'll receive an email with a tracking link. You can also track your order in your account dashboard."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept all major credit cards, PayPal, UPI, and net banking."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "Yes, you can cancel or modify your order within 2 hours of placing it. After that, the order may already be processed for shipment."
  },
  {
    "q": "Is my personal information secure?",
    "a": "Yes, we use industry-standard encryption to ensure your personal and payment information is secure."
  },
  {
    "q": "Do you offer customer support?",
    "a": "Absolutely. Our support team is available 24/7 via email and chat to help with any issues or questions."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept all major credit cards, PayPal, UPI, and net banking."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "Yes, you can cancel or modify your order within 2 hours of placing it. After that, the order may already be processed for shipment."
  }
] as const
export const faq13Literal = faqLiteral(FAQ13_ITEMS)

const FAQ14_ITEMS = [
  {
    "q": "What is your return policy?",
    "a": "We offer a 30-day return policy on all unused products. Please ensure the item is in original packaging when returning."
  },
  {
    "q": "How long does shipping take?",
    "a": "Shipping typically takes 3-7 business days depending on your location."
  },
  {
    "q": "Do you ship internationally?",
    "a": "Yes, we ship to most countries worldwide. Shipping fees and delivery times vary by destination."
  },
  {
    "q": "How can I track my order?",
    "a": "After your order is shipped, you'll receive an email with a tracking link. You can also track your order in your account dashboard."
  },
  {
    "q": "What payment methods do you accept?",
    "a": "We accept all major credit cards, PayPal, UPI, and net banking."
  },
  {
    "q": "Can I cancel or change my order?",
    "a": "Yes, you can cancel or modify your order within 2 hours of placing it. After that, the order may already be processed for shipment."
  }
] as const
export const faq14Literal = faqLiteral(FAQ14_ITEMS)

export const faqFamilyCmsLike = {
  title: previewInlineText("Frequently Asked Questions"),
  intro: previewInlineText("Quick answers to common questions about our products and services."),
  items: [
    faqItem("What is your return policy?", "You can return unused items within 30 days."),
    faqItem("How do I track my order?", "Use the link in your confirmation email."),
  ],
}

export const faqFamilySparse = { items: [faqItem("Only question?", "Only answer.")] }

export const faqFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  items: [faqItem("A".repeat(500), "A".repeat(500))],
}

export const faqFamilyEmptyItems = {
  title: previewInlineText("FAQ"),
  items: [] as Array<{ question: ReturnType<typeof previewInlineText>; answer: ReturnType<typeof import("../fixtures").previewBlockText> }>,
}
