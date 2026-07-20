import type { RtBlockRoot, RtInlineRoot } from "@/lib/richText/RtNode"

export function rtInline(text: string): RtInlineRoot {
  return { t: "root", variant: "inline", children: [{ t: "text", v: text }] }
}

export function rtBlock(text: string): RtBlockRoot {
  return {
    t: "root",
    variant: "block",
    children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
  }
}
