import type { MediaRef } from "@siteinabox/contracts"
import { testimonials01Item } from "./testimonials-01"

const previewImage = (alt: string): MediaRef => ({
  url: `https://cdn.example.test/${alt.toLowerCase().replace(/\s+/g, "-")}.jpg`,
  alt,
})

export const testimonialsFamilyItem = (author: string, role: string, quote: string) =>
  testimonials01Item(author, role, quote, previewImage(author))

export const testimonialsFamilyCmsLike = {
  title: "What our customers say",
  intro: "Stories from teams using our product every day",
  items: [
    testimonialsFamilyItem(
      "Sarah Johnson",
      "Product Designer at Canva",
      "This product completely changed the way I work. The interface is intuitive and the performance is top-notch.",
    ),
    testimonialsFamilyItem(
      "Raj Mehta",
      "Frontend Developer at Zomato",
      "It's rare to find a tool that blends design and usability so well. Highly recommend it to all developers!",
    ),
  ],
}

export const testimonialsFamilySparse = {
  items: [testimonialsFamilyItem("Solo Author", "Founder", "A focused testimonial from a single customer.")],
}

export const testimonialsFamilyLong = {
  title: "A".repeat(500),
  intro: "B".repeat(500),
  items: [testimonialsFamilyItem("C".repeat(100), "D".repeat(200), "E".repeat(1000))],
}

export const testimonialsFamilyEmptyItems = {
  title: "Testimonials",
  items: [] as Array<ReturnType<typeof testimonialsFamilyItem>>,
}

export const testimonials02CmsLike = {
  title: "Trusted by many",
  intro: "See how people are using it in their everyday work",
  items: testimonialsFamilyCmsLike.items,
}

export const testimonials03CmsLike = {
  title: "What our customers say",
  intro: "Discover what our valued customers think about our innovative products",
  items: testimonialsFamilyCmsLike.items,
}

export const testimonials04CmsLike = {
  title: "Success Stories",
  intro: "Real stories from people who use and love our product every day",
  items: testimonialsFamilyCmsLike.items,
}

export const testimonials05CmsLike = {
  title: "Loved by developers",
  intro: "See how developers and teams are achieving more with us",
  items: testimonialsFamilyCmsLike.items,
}

export const testimonials06CmsLike = {
  title: "People love using it",
  intro: "Real feedback from those who've made it part of their workflow",
  items: testimonialsFamilyCmsLike.items,
}

export const testimonials07CmsLike = {
  title: "Testimonials",
  intro: "What our customers say about us",
  items: testimonialsFamilyCmsLike.items,
}

export const testimonials11CmsLike = {
  title: "What others think",
  intro: "Real stories from real users who've seen real results",
  items: testimonialsFamilyCmsLike.items,
}

export const testimonials13CmsLike = testimonials04CmsLike
