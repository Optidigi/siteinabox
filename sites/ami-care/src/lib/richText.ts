// Rich text v2 — RtNode types mirroring siab-payload/src/lib/richText/RtNode.ts.
// See siab-payload/docs/runbooks/rt-dom-contract.md for the DOM emission contract
// the RtNodeRenderer enforces. RtNode trees are produced by the CMS editor + paste
// mapper and projected verbatim to disk; this template walks the tree and emits
// DOM with `rt-*` class names. Tenant CSS styles those classes.

export type RtMark = "bold" | "italic" | "underline" | "code" | "strikethrough"

export interface RtText {
  t: "text"
  v: string
  marks?: RtMark[]
  style?: string   // typeStyle id from manifest (rendered as <span class="rt-type-X">)
  color?: string   // colorToken id from manifest (rendered as <span class="rt-color-Y">)
  font?: string    // fontFamily id from manifest (rendered as <span class="rt-font-X">)
}

export interface RtLink {
  t: "link"
  href: string
  rel?: "external" | "internal"
  children: RtInline[]
}

/** Soft line break — renders as `<br>` on site. */
export interface RtLineBreak { t: "linebreak" }

export type RtInline = RtText | RtLink | RtLineBreak

export type RtAlign = "left" | "center" | "right" | "justify"

export interface RtParagraph  { t: "paragraph"; align?: RtAlign; children: RtInline[] }
export interface RtHeading    { t: "heading"; level: 2 | 3 | 4; align?: RtAlign; children: RtInline[] }
export interface RtList       { t: "list"; ordered: boolean; items: RtListItem[] }
export interface RtListItem   { t: "listItem"; children: RtBlock[] }
export interface RtBlockquote { t: "blockquote"; children: RtBlock[] }
export interface RtDivider    { t: "divider" }

export interface RtThemed {
  t: "themed"
  id: string
  props: Record<string, unknown>
  children?: RtBlock[]
}

export type RtBlock =
  | RtParagraph | RtHeading | RtList | RtBlockquote | RtDivider | RtThemed

export interface RtBlockRoot  { t: "root"; variant: "block";  children: RtBlock[] }
export interface RtInlineRoot { t: "root"; variant: "inline"; children: RtInline[] }
export type RtRoot = RtBlockRoot | RtInlineRoot

// Type-guard: tolerates the transition window — production data will always
// be RtRoot post-migration, but legacy snapshots (or tests) may carry the old
// string shape. Returning false on string keeps the renderer safe.
export const isRtRoot = (v: unknown): v is RtRoot =>
  typeof v === "object" &&
  v !== null &&
  (v as any).t === "root" &&
  ((v as any).variant === "block" || (v as any).variant === "inline") &&
  Array.isArray((v as any).children)
