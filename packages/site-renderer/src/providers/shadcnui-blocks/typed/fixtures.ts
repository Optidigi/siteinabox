import type { RtRoot } from "@siteinabox/contracts"

export const previewInlineText = (text: string): RtRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

export const previewInlineTextWithLinebreak = (before: string, after: string): RtRoot => ({
  t: "root",
  variant: "inline",
  children: [
    { t: "text", v: before },
    { t: "linebreak" },
    { t: "text", v: after },
  ],
})

export const previewBlockText = (text: string): RtRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})
