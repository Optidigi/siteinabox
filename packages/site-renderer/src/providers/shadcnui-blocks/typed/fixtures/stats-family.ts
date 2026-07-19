import { previewInlineText } from "../fixtures"
import { statItem } from "./stats-01"

export const statsFamilyCmsLike = {
  title: previewInlineText("Backed by real usage"),
  intro: previewInlineText("Trusted by thousands to build modern UIs faster"),
  items: [
    statItem("70%", "Faster UI development"),
    statItem("5x", "Increase in productivity"),
    statItem("98%", "Customer satisfaction"),
  ],
}

export const statsFamilySparse = {
  items: [statItem("42%", "Only stat")],
}

export const statsFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  items: [statItem("9".repeat(50), "C".repeat(500))],
}

export const statsFamilyEmptyItems = {
  title: previewInlineText("Stats"),
  items: [] as Array<ReturnType<typeof statItem>>,
}

export const stats02CmsLike = {
  title: previewInlineText("The impact we've made so far"),
  intro: previewInlineText(
    "The world's most advanced UI kit for Figma. Meticulously crafted with 100% Auto Layout 5.0, variables, smart variants, and WCAG accessibility.",
  ),
  items: [
    statItem("900+", "Global styles + variables", "Super smart global color, typography and effects styles + variables!"),
    statItem("10,000+", "Components and variants", "We've thought of everything you need so you don't have to."),
    statItem("420+", "Page design examples", "A whopping 420+ ready-to-go desktop and mobile page examples."),
    statItem("2,000+", "Icons and logos", "All the icons you'll need, including country flags and payments."),
  ],
}

export const stats11CmsLike = {
  title: previewInlineText("Reliable by Design"),
  intro: previewInlineText("Trusted by thousands to build modern UIs faster"),
  items: [
    statItem("70%", "Faster UI development"),
    statItem("5x", "Increase in productivity"),
    statItem("98%", "Customer satisfaction"),
  ],
}

export const stats06CmsLike = {
  title: previewInlineText("Numbers that matter"),
  intro: previewInlineText("A quick look at the impact and adoption of our UI components"),
  items: [
    statItem("70%", "Faster UI development"),
    statItem("5x", "Increase in productivity"),
    statItem("98%", "Customer satisfaction"),
    statItem("300%", "Growth in last 6 months"),
    statItem("120K+", "Daily active users"),
  ],
}
