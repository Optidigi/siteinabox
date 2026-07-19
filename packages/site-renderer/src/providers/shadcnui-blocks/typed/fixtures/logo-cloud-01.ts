import { previewInlineText } from "../fixtures"

const logo = (name: string, overrides: Record<string, unknown> = {}) => ({
  name,
  image: { url: `https://cdn.example.test/${name.toLowerCase()}.svg`, alt: name },
  ...overrides,
})

export const logoCloud01Literal = {
  title: previewInlineText("More than 2.2 million companies worldwide already trust us"),
}

export const logoCloud01Sparse = {
  title: previewInlineText("One partner"),
  logos: [logo("Solo")],
}

export const logoCloud01Long = {
  title: previewInlineText("A".repeat(500)),
  logos: [logo("Acme")],
}

export const logoCloud01CmsLike = {
  title: previewInlineText("Trusted worldwide"),
  logos: [logo("Acme"), logo("Globex")],
}

export const logoCloud01MaxItems = {
  logos: [logo("One"), logo("Two"), logo("Three"), logo("Four"), logo("Five")],
}

export const logoCloud01MissingImage = {
  title: previewInlineText("No artwork yet"),
  logos: [{ name: "Placeholder" }],
}

export { logo as logoCloud01Logo }
