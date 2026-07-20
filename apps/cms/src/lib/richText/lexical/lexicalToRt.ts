import type {
  RtRoot,
  RtBlock,
  RtInline,
  RtMark,
  RtText,
  RtLink,
  RtParagraph,
  RtHeading,
  RtThemed,
} from "../RtNode"

type LexicalSerializedNode = {
  type?: string
  text?: string
  format?: number | string
  style?: string
  url?: string
  target?: string
  children?: LexicalSerializedNode[]
  tag?: string
  listType?: string
  id?: string
  props?: Record<string, unknown>
  hasChildren?: boolean
}

const BIT_TO_MARK: Array<[number, RtMark]> = [
  [1, "bold"], [1 << 1, "italic"], [1 << 2, "strikethrough"], [1 << 3, "underline"], [1 << 4, "code"],
]

const formatToMarks = (fmt: number): RtMark[] => {
  const out: RtMark[] = []
  for (const [bit, mark] of BIT_TO_MARK) if (fmt & bit) out.push(mark)
  return out
}

const parseStyle = (style: string): { style?: string; color?: string; font?: string } => {
  const out: { style?: string; color?: string; font?: string } = {}
  for (const part of style.split(";")) {
    const colonIdx = part.indexOf(":")
    if (colonIdx === -1) continue
    const k = part.slice(0, colonIdx).trim()
    const v = part.slice(colonIdx + 1).trim()
    if (k === "--rt-style" && v) out.style = v
    if (k === "--rt-color" && v) out.color = v
    if (k === "--rt-font" && v) out.font = v
  }
  return out
}

const inlineFromLexical = (n: LexicalSerializedNode): RtInline | null => {
  // Both stock TextNode ("text") and our RtTextNode replacement ("rt-text")
  // map to RtText on the wire.
  if (n.type === "text" || n.type === "rt-text") {
    const text: RtText = { t: "text", v: n.text ?? "" }
    const marks = formatToMarks(typeof n.format === "number" ? n.format : Number(n.format ?? 0))
    if (marks.length > 0) text.marks = marks
    if (n.style) {
      const { style, color, font } = parseStyle(n.style)
      if (style) text.style = style
      if (color) text.color = color
      if (font) text.font = font
    }
    return text
  }
  if (n.type === "link") {
    const link: RtLink = {
      t: "link",
      href: n.url ?? "",
      children: (n.children ?? []).map(inlineFromLexical).filter(Boolean) as RtInline[],
    }
    if (n.target === "_blank") link.rel = "external"
    return link
  }
  if (n.type === "linebreak") {
    return { t: "linebreak" }
  }
  return null
}

const alignFromFormat = (fmt: unknown): "left" | "center" | "right" | "justify" | undefined => {
  if (fmt === "left" || fmt === "center" || fmt === "right" || fmt === "justify") return fmt
  return undefined
}

const blockFromLexical = (n: LexicalSerializedNode): RtBlock | null => {
  switch (n.type) {
    case "paragraph":
    case "styled-paragraph": {
      const align = alignFromFormat(n.format)
      const node: RtParagraph = {
        t: "paragraph",
        children: (n.children ?? []).map(inlineFromLexical).filter(Boolean) as RtInline[],
      }
      if (align) node.align = align
      if (n.type === "styled-paragraph" && typeof n.style === "string" && n.style) node.style = n.style
      return node
    }
    case "heading":
    case "styled-heading": {
      const lvl = parseInt(String(n.tag).slice(1), 10) as 2 | 3 | 4
      const align = alignFromFormat(n.format)
      const node: RtHeading = {
        t: "heading",
        level: lvl,
        children: (n.children ?? []).map(inlineFromLexical).filter(Boolean) as RtInline[],
      }
      if (align) node.align = align
      if (n.type === "styled-heading" && typeof n.style === "string" && n.style) node.style = n.style
      return node
    }
    case "list":
      return {
        t: "list",
        ordered: n.listType === "number",
        items: (n.children ?? []).map((li) => ({
          t: "listItem" as const,
          children: [{
            t: "paragraph" as const,
            children: (li.children ?? []).map(inlineFromLexical).filter(Boolean) as RtInline[],
          }],
        })),
      }
    case "quote":
      return {
        t: "blockquote",
        children: (n.children ?? []).map(blockFromLexical).filter(Boolean) as RtBlock[],
      }
    case "horizontalrule":
      return { t: "divider" }
    case "themed": {
      const out: RtThemed = { t: "themed", id: String(n.id ?? "themed"), props: n.props ?? {} }
      if (n.hasChildren) out.children = []
      return out
    }
    default:
      return null
  }
}

export const lexicalJsonToRt = (j: { root: LexicalSerializedNode }, variant: "block" | "inline"): RtRoot => {
  if (variant === "inline") {
    const p = j.root.children?.[0]
    if (!p || p.type !== "paragraph") return { t: "root", variant: "inline", children: [] }
    return {
      t: "root",
      variant: "inline",
      children: (p.children ?? []).map(inlineFromLexical).filter(Boolean) as RtInline[],
    }
  }
  const blocks = (j.root.children ?? []).map(blockFromLexical).filter(Boolean) as RtBlock[]
  // Collapse the round-trip artifact: rtToLexicalJson injects a single empty
  // paragraph as Lexical's required minimum ElementNode child for empty roots.
  // Reverse that here so an unmodified empty editor saves back as a genuinely
  // empty RtBlockRoot (round-trip identity with EMPTY_BLOCK).
  if (blocks.length === 1) {
    const only = blocks[0]
    if (only && only.t === "paragraph" && only.children.length === 0) {
      return { t: "root", variant: "block", children: [] }
    }
  }
  return { t: "root", variant: "block", children: blocks }
}
