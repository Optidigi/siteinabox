import type { RtRoot } from "@siteinabox/contracts"

export const previewInlineText = (text: string): RtRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

export const previewBlockText = (text: string): RtRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})
