import { TextNode, type EditorConfig, type SerializedTextNode } from "lexical"

/**
 * TextNode subclass that mirrors the `--rt-style` / `--rt-color` / `--rt-font` CSS custom
 * properties (which the editor stores in the inline `style` attribute to keep
 * the wire format compatible with rt → lexical → rt round-tripping) into
 * matching `rt-type-{id}` / `rt-color-{id}` / `rt-font-{id}` CLASSES on the rendered DOM.
 *
 * The shared live-site renderer wraps marked text in
 * `<span class="rt-type-{style}">` and tenant CSS rules target those classes.
 * Without this subclass, the canvas would only emit the
 * inline custom property and CSS rules like `.rt-type-highlight::after`
 * would never match → no visible visual treatment in the editor.
 *
 * Registered via `nodes: [{ replace: TextNode, with, withKlass }]` in
 * `buildNodeConfig.ts`, so every TextNode becomes an RtTextNode at
 * import time.
 */
export class RtTextNode extends TextNode {
  static getType(): string {
    return "rt-text"
  }

  static clone(n: RtTextNode): RtTextNode {
    return new RtTextNode(n.__text, n.__key)
  }

  static importJSON(json: SerializedTextNode): RtTextNode {
    const node = new RtTextNode(json.text)
    node.setFormat(json.format)
    node.setDetail(json.detail)
    node.setMode(json.mode)
    node.setStyle(json.style)
    return node
  }

  // Lexical's exportNodeToJSON enforces `serialized.type === node.getType()`,
  // so we cannot lie about the wire type here. Downstream `lexicalToRt`
  // recognises both "text" and "rt-text" as text nodes.
  exportJSON(): SerializedTextNode {
    return { ...super.exportJSON(), type: "rt-text", version: 1 }
  }

  private applyRtClasses(dom: HTMLElement, style: string): void {
    // Strip any rt-type-*/rt-color-*/rt-font-* class previously applied so updateDOM
    // produces clean state on every transition.
    Array.from(dom.classList)
      .filter((c) => c.startsWith("rt-type-") || c.startsWith("rt-color-") || c.startsWith("rt-font-"))
      .forEach((c) => dom.classList.remove(c))
    const styleMatch = style.match(/--rt-style\s*:\s*([a-z0-9-]+)/)
    const colorMatch = style.match(/--rt-color\s*:\s*([a-z0-9-]+)/)
    const fontMatch = style.match(/--rt-font\s*:\s*([a-z0-9-]+)/)
    if (styleMatch) dom.classList.add(`rt-type-${styleMatch[1]}`)
    if (colorMatch) dom.classList.add(`rt-color-${colorMatch[1]}`)
    if (fontMatch) dom.classList.add(`rt-font-${fontMatch[1]}`)
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    const style = this.getStyle()
    if (style) this.applyRtClasses(dom, style)
    return dom
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prevNode, dom, config)
    if (prevNode.getStyle() !== this.getStyle()) {
      this.applyRtClasses(dom, this.getStyle())
    }
    return updated
  }
}

export const $createRtTextNode = (text: string): RtTextNode => new RtTextNode(text)
