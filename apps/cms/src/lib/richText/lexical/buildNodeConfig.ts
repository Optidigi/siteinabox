import { ParagraphNode, TextNode, type Klass, type LexicalNode, type LexicalNodeReplacement } from "@payloadcms/richtext-lexical/lexical"
import { HeadingNode, QuoteNode } from "@payloadcms/richtext-lexical/lexical/rich-text"
import { ListItemNode, ListNode } from "@payloadcms/richtext-lexical/lexical/list"
import { LinkNode } from "@payloadcms/richtext-lexical/lexical/link"
import { ThemedNode } from "./ThemedNode"
import { StyledHeadingNode } from "./StyledHeadingNode"
import { StyledParagraphNode } from "./StyledParagraphNode"
import { RtTextNode } from "./RtTextNode"

// Replace every TextNode with RtTextNode at import time. RtTextNode mirrors
// the `--rt-style` / `--rt-color` inline-style custom properties into
// `rt-type-{id}` / `rt-color-{id}` classes on the rendered DOM so tenant
// CSS rules (which key off classes, not inline custom properties) fire in
// the canvas the same way they do on the live site.
const TEXT_NODE_REPLACEMENT: LexicalNodeReplacement = {
  replace: TextNode,
  with: (node: TextNode) => {
    const next = new RtTextNode(node.__text)
    next.setFormat(node.__format)
    next.setDetail(node.__detail)
    next.setMode(node.getMode())
    next.setStyle(node.__style)
    return next
  },
  withKlass: RtTextNode,
}

export const buildLexicalNodes = (variant: "block" | "inline"): Array<Klass<LexicalNode> | LexicalNodeReplacement> => {
  if (variant === "inline") {
    return [TextNode, RtTextNode, TEXT_NODE_REPLACEMENT, LinkNode]
  }
  return [
    ParagraphNode,
    StyledParagraphNode,
    TextNode,
    RtTextNode,
    TEXT_NODE_REPLACEMENT,
    HeadingNode,
    StyledHeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    LinkNode,
    ThemedNode,
  ]
}

export const buildEditorTheme = () => ({
  paragraph: "rt-p",
  heading: { h2: "rt-h rt-h-2", h3: "rt-h rt-h-3", h4: "rt-h rt-h-4" },
  list: { ul: "rt-ul", ol: "rt-ol", listitem: "rt-li" },
  quote: "rt-quote",
  link: "rt-link",
  text: {
    bold: "rt-b",
    italic: "rt-i",
    underline: "rt-u",
    code: "rt-code",
    strikethrough: "rt-s",
  },
})
