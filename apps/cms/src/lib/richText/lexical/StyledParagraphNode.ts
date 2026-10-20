import { ParagraphNode, type EditorConfig, type NodeKey, type SerializedParagraphNode, type Spread } from "@payloadcms/richtext-lexical/lexical"

export type SerializedStyledParagraphNode = Spread<
  { style: string },
  SerializedParagraphNode
>

/**
 * Paragraph node that carries an `rt-type-{style}` class. This is the
 * paragraph-level counterpart to StyledHeadingNode and keeps
 * `appliesTo:"paragraph"` styles on the block element instead of on text.
 */
export class StyledParagraphNode extends ParagraphNode {
  __style: string

  static getType(): string {
    return "styled-paragraph"
  }

  static clone(n: StyledParagraphNode): StyledParagraphNode {
    return new StyledParagraphNode(n.__style, n.__key)
  }

  constructor(style: string, key?: NodeKey) {
    super(key)
    this.__style = style
  }

  getRtStyle(): string {
    return this.__style
  }

  setRtStyle(style: string): this {
    const w = this.getWritable() as this
    ;(w as StyledParagraphNode).__style = style
    return w
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = super.createDOM(config)
    if (this.__style) el.classList.add(`rt-type-${this.__style}`)
    return el
  }

  updateDOM(prev: this, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prev, dom, config)
    if (prev.__style !== this.__style) {
      if (prev.__style) dom.classList.remove(`rt-type-${prev.__style}`)
      if (this.__style) dom.classList.add(`rt-type-${this.__style}`)
    }
    return updated
  }

  static importJSON(json: SerializedStyledParagraphNode): StyledParagraphNode {
    const node = new StyledParagraphNode(json.style)
    node.setFormat(json.format)
    node.setIndent(json.indent)
    node.setDirection(json.direction)
    return node
  }

  exportJSON(): SerializedStyledParagraphNode {
    return {
      ...super.exportJSON(),
      type: "styled-paragraph",
      version: 1,
      style: this.__style,
    }
  }
}

export const $createStyledParagraphNode = (style: string): StyledParagraphNode =>
  new StyledParagraphNode(style)
