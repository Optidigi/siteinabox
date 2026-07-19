import { HeadingNode, type SerializedHeadingNode } from "@lexical/rich-text"
import type { EditorConfig, NodeKey, Spread } from "lexical"

export type SerializedStyledHeadingNode = Spread<
  { style: string },
  SerializedHeadingNode
>

/**
 * Heading node that carries an `rt-type-{style}` class in addition to the
 * stock heading-level class chain. Roundtrips via SerializedStyledHeadingNode
 * with type "styled-heading"; the Lexical JSON converter switches between the
 * stock HeadingNode and this subclass based on RtHeading.style presence.
 */
export class StyledHeadingNode extends HeadingNode {
  __style: string

  static getType(): string {
    return "styled-heading"
  }

  static clone(n: StyledHeadingNode): StyledHeadingNode {
    return new StyledHeadingNode(n.getTag(), n.__style, n.__key)
  }

  constructor(tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6", style: string, key?: NodeKey) {
    super(tag)
    this.__style = style
    if (key) {
      // HeadingNode constructor doesn't take key; assign via property.
      (this).__key = key
    }
  }

  getRtStyle(): string {
    return this.__style
  }

  setRtStyle(style: string): this {
    const w = this.getWritable() as this
    ;(w as StyledHeadingNode).__style = style
    return w
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = super.createDOM(config)
    if (this.__style) el.classList.add(`rt-type-${this.__style}`)
    return el
  }

  updateDOM(prev: this, dom: HTMLElement): boolean {
    if (prev.__style !== this.__style) {
      if (prev.__style) dom.classList.remove(`rt-type-${prev.__style}`)
      if (this.__style) dom.classList.add(`rt-type-${this.__style}`)
    }
    return false
  }

  static importJSON(json: SerializedStyledHeadingNode): StyledHeadingNode {
    return new StyledHeadingNode(json.tag, json.style)
  }

  exportJSON(): SerializedStyledHeadingNode {
    return {
      ...super.exportJSON(),
      type: "styled-heading",
      version: 1,
      style: this.__style,
    }
  }
}

export const $createStyledHeadingNode = (tag: "h2" | "h3" | "h4", style: string): StyledHeadingNode =>
  new StyledHeadingNode(tag, style)
