import type { RtRoot, RtBlock, RtInline, RtMark } from "../RtNode"
import type { RtManifest } from "../manifest"

const FORMAT_BITS: Record<RtMark, number> = {
  bold: 1, italic: 1 << 1, strikethrough: 1 << 2, underline: 1 << 3, code: 1 << 4,
}

const marksToFormat = (marks?: RtMark[]): number =>
  (marks ?? []).reduce((acc, m) => acc | FORMAT_BITS[m], 0)

const fontFamilyForId = (id: string, manifest?: RtManifest): string => {
  const cssVar = manifest?.fontFamilies?.find((f) => f.id === id)?.cssVar
  return `var(${cssVar ?? `--font-${id}`})`
}

const colorForId = (id: string, manifest?: RtManifest): string => {
  const cssVar = manifest?.colorTokens?.find((c) => c.id === id)?.cssVar ?? `--color-${id}`
  return `var(${cssVar})`
}

const inlineToLexical = (n: RtInline, manifest?: RtManifest): any => {
  if (n.t === "text") {
    const out: any = { type: "text", text: n.v, format: marksToFormat(n.marks), detail: 0, mode: "normal", style: "", version: 1 }
    if (n.style) out.style = `--rt-style:${n.style};`
    if (n.color) out.style = (out.style ?? "") + `--rt-color:${n.color};color:${colorForId(n.color, manifest)};`
    if (n.font) out.style = (out.style ?? "") + `--rt-font:${n.font};font-family:${fontFamilyForId(n.font, manifest)};`
    return out
  }
  if (n.t === "linebreak") {
    return { type: "linebreak", version: 1 }
  }
  return {
    type: "link", url: n.href, target: n.rel === "external" ? "_blank" : null,
    rel: n.rel === "external" ? "noopener noreferrer" : null,
    title: null, version: 1,
    children: n.children.map((c) => inlineToLexical(c, manifest)),
    direction: "ltr", format: "", indent: 0,
  }
}

const blockToLexical = (n: RtBlock, manifest?: RtManifest): any => {
  switch (n.t) {
    case "paragraph":
      if (n.style) {
        return { type: "styled-paragraph", style: n.style, version: 1, direction: "ltr", format: n.align ?? "", indent: 0, children: n.children.map((c) => inlineToLexical(c, manifest)) }
      }
      return { type: "paragraph", version: 1, direction: "ltr", format: n.align ?? "", indent: 0, children: n.children.map((c) => inlineToLexical(c, manifest)) }
    case "heading":
      if (n.style) {
        return { type: "styled-heading", tag: `h${n.level}`, style: n.style, version: 1, direction: "ltr", format: n.align ?? "", indent: 0, children: n.children.map((c) => inlineToLexical(c, manifest)) }
      }
      return { type: "heading", tag: `h${n.level}`, version: 1, direction: "ltr", format: n.align ?? "", indent: 0, children: n.children.map((c) => inlineToLexical(c, manifest)) }
    case "list":
      return {
        type: "list", listType: n.ordered ? "number" : "bullet",
        tag: n.ordered ? "ol" : "ul", start: 1, version: 1,
        direction: "ltr", format: "", indent: 0,
        children: n.items.map((li) => ({
          type: "listitem", value: 1, version: 1, direction: "ltr", format: "", indent: 0,
          children: li.children.flatMap((c) => {
            const out = blockToLexical(c, manifest)
            if (out.type === "paragraph") return out.children
            return [out]
          }),
        })),
      }
    case "blockquote":
      return { type: "quote", version: 1, direction: "ltr", format: "", indent: 0, children: n.children.map((c) => blockToLexical(c, manifest)) }
    case "divider":
      return { type: "horizontalrule", version: 1 }
    case "themed":
      return { type: "themed", version: 1, id: n.id, props: n.props, hasChildren: !!n.children }
  }
}

// Lexical's root MUST contain at least one ElementNode child for the editor
// to initialize. An empty RtRoot (e.g. an unfilled optional field like
// CTA.description) would otherwise produce `children: []`, which throws
// "editor state empty" on mount. Inject a default empty paragraph so the
// editor renders a single empty line that the author can type into.
const emptyParagraphLexical = () => ({
  type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, children: [],
})

export const rtToLexicalJson = (root: RtRoot, manifest?: RtManifest): { root: any } => {
  if (root.variant === "inline") {
    return {
      root: {
        type: "root", version: 1, direction: "ltr", format: "", indent: 0,
        children: [{
          type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0,
          children: root.children.map((c) => inlineToLexical(c, manifest)),
        }],
      },
    }
  }
  const children = root.children.length > 0
    ? root.children.map((c) => blockToLexical(c, manifest))
    : [emptyParagraphLexical()]
  return {
    root: {
      type: "root", version: 1, direction: "ltr", format: "", indent: 0,
      children,
    },
  }
}
