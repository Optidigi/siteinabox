import { previewBlockText, previewInlineText } from "../fixtures"

export const statItem = (value: string, label: string, description?: string) => ({
  value,
  label,
  ...(description ? { description: previewBlockText(description) } : {}),
})

export const stats01Literal = {
  title: previewInlineText("Why Should You Choose Us?"),
  intro: previewInlineText("Because after switching to us..."),
  items: [
    statItem("96%", "of customers say they have a better brand experience"),
    statItem("95%", "of customers say they gather more data, more easily"),
    statItem("87%", "of customers say they reveal deeper insights from data"),
  ],
}

export const stats01Sparse = {
  items: [statItem("42%", "Only stat")],
}

export const stats01Long = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  items: [statItem("9".repeat(50), "C".repeat(500))],
}

export const stats01CmsLike = {
  title: previewInlineText("Why Should You Choose Us?"),
  intro: previewInlineText("Because after switching to us..."),
  items: [
    statItem("96%", "of customers say they have a better brand experience"),
    statItem("95%", "of customers say they gather more data, more easily"),
  ],
}

export const stats01EmptyItems = {
  title: previewInlineText("Stats"),
  items: [] as Array<ReturnType<typeof statItem>>,
}
