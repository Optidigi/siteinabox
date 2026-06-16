export type RtMark = "bold" | "italic" | "underline" | "code" | "strikethrough"

export interface RtText {
  t: "text"
  v: string
  marks?: RtMark[]
  style?: string
  color?: string
  font?: string
}

export interface RtLink {
  t: "link"
  href: string
  rel?: "external" | "internal"
  children: RtInline[]
}

export interface RtLineBreak {
  t: "linebreak"
}

export type RtInline = RtText | RtLink | RtLineBreak

export type RtAlign = "left" | "center" | "right" | "justify"

export interface RtParagraph {
  t: "paragraph"
  align?: RtAlign
  style?: string
  children: RtInline[]
}

export interface RtHeading {
  t: "heading"
  level: 2 | 3 | 4
  align?: RtAlign
  style?: string
  children: RtInline[]
}

export interface RtList {
  t: "list"
  ordered: boolean
  items: RtListItem[]
}

export interface RtListItem {
  t: "listItem"
  children: RtBlock[]
}

export interface RtBlockquote {
  t: "blockquote"
  children: RtBlock[]
}

export interface RtDivider {
  t: "divider"
}

export interface RtThemed {
  t: "themed"
  id: string
  props: Record<string, unknown>
  children?: RtBlock[]
}

export type RtBlock =
  | RtParagraph
  | RtHeading
  | RtList
  | RtBlockquote
  | RtDivider
  | RtThemed

export interface RtBlockRoot {
  t: "root"
  variant: "block"
  children: RtBlock[]
}

export interface RtInlineRoot {
  t: "root"
  variant: "inline"
  children: RtInline[]
}

export type RtRoot = RtBlockRoot | RtInlineRoot
export type RtNode = RtRoot | RtBlock | RtInline | RtListItem

export const EMPTY_BLOCK: RtBlockRoot = { t: "root", variant: "block", children: [] }
export const EMPTY_INLINE: RtInlineRoot = { t: "root", variant: "inline", children: [] }

export const isRtRoot = (value: unknown): value is RtRoot =>
  typeof value === "object" &&
  value !== null &&
  (value as { t?: unknown }).t === "root" &&
  ((value as { variant?: unknown }).variant === "block" ||
    (value as { variant?: unknown }).variant === "inline") &&
  Array.isArray((value as { children?: unknown }).children)
