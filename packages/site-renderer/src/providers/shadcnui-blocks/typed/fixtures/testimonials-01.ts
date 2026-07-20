import type { MediaRef } from "@siteinabox/contracts"

const previewImage = (alt: string): MediaRef => ({
  url: `https://cdn.example.test/${alt.toLowerCase().replace(/\s+/g, "-")}.jpg`,
  alt,
})

export const testimonials01Item = (
  author: string,
  role: string,
  quote: string,
  avatar?: MediaRef,
) => ({
  author,
  role,
  quote,
  ...(avatar ? { avatar } : {}),
})

export const testimonials01Literal = {
  title: "What developers are saying",
  intro: "Feedback from developers building real products with our components",
  items: [
    testimonials01Item(
      "John Doe",
      "Software Engineer",
      "This product has completely transformed the way we work. The efficiency and ease of use are unmatched!",
    ),
    testimonials01Item(
      "Sophia Lee",
      "Data Analyst",
      "This tool has saved me hours of work! The analytics and reporting features are incredibly powerful.",
    ),
    testimonials01Item(
      "Michael Johnson",
      "UX Designer",
      "An amazing tool that simplifies complex tasks. Highly recommended for professionals in the industry.",
    ),
    testimonials01Item(
      "Emily Davis",
      "Marketing Specialist",
      "I've seen a significant improvement in our team's productivity since we started using this service.",
    ),
    testimonials01Item(
      "Daniel Martinez",
      "Full-Stack Developer",
      "The best investment we've made! The support team is also super responsive and helpful.",
    ),
    testimonials01Item(
      "Jane Smith",
      "Product Manager",
      "The user experience is top-notch! The interface is clean, intuitive, and easy to navigate.",
    ),
  ],
}

export const testimonials01CmsLike = {
  title: "Trusted voices",
  intro: "Real feedback from teams shipping with us",
  items: [
    testimonials01Item(
      "Liam Martinez",
      "Chief Technology Officer",
      "The platform helped us launch faster without sacrificing quality.",
      previewImage("Liam Martinez"),
    ),
    testimonials01Item(
      "Ava Thompson",
      "Chief Executive Officer",
      "Our customers notice the difference in polish and speed.",
      previewImage("Ava Thompson"),
    ),
  ],
}

export const testimonials01Sparse = {
  items: [
    testimonials01Item("Solo Author", "Founder", "A focused testimonial from a single customer."),
  ],
}

export const testimonials01Long = {
  title: "A".repeat(500),
  intro: "B".repeat(500),
  items: [testimonials01Item("C".repeat(100), "D".repeat(200), "E".repeat(1000))],
}

export const testimonials01EmptyItems = {
  title: "Testimonials",
  items: [] as Array<ReturnType<typeof testimonials01Item>>,
}
