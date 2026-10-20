import {
  DecoratorNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "@payloadcms/richtext-lexical/lexical"
import * as React from "react"

export type SerializedThemedNode = Spread<
  { id: string; props: Record<string, unknown>; hasChildren: boolean },
  SerializedLexicalNode
>

// Registry pattern (Option C): avoids require() and dynamic import in a synchronous context.
// The editor component (Task E1) calls registerThemedPill on mount with the real component.
let _ThemedPillComponent: React.ComponentType<{ id: string; props: Record<string, unknown>; nodeKey?: string }> | null = null

export const registerThemedPill = (
  Component: React.ComponentType<{ id: string; props: Record<string, unknown>; nodeKey?: string }>,
): void => {
  _ThemedPillComponent = Component
}

const FallbackPill = (props: { id: string; props: Record<string, unknown>; nodeKey?: string }): React.ReactElement =>
  React.createElement("div", { className: "rt-themed-fallback" }, "[themed: ", props.id, "]")

export class ThemedNode extends DecoratorNode<React.ReactNode> {
  __id: string
  __props: Record<string, unknown>
  __hasChildren: boolean

  static getType(): string {
    return "themed"
  }

  static clone(n: ThemedNode): ThemedNode {
    return new ThemedNode(n.__id, n.__props, n.__hasChildren, n.__key)
  }

  constructor(id: string, props: Record<string, unknown>, hasChildren = false, key?: NodeKey) {
    super(key)
    this.__id = id
    this.__props = props
    this.__hasChildren = hasChildren
  }

  // RtThemed is a block node. Lexical's inline default lets normalization or
  // clipboard insertion discard it when it appears directly below the root.
  isInline(): false {
    return false
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement("div")
    el.className = `rt-themed rt-themed-${this.__id}`
    el.setAttribute("data-rt-id", this.__id)
    return el
  }

  updateDOM(): false {
    return false
  }

  decorate(): React.ReactNode {
    const Component = _ThemedPillComponent ?? FallbackPill
    return React.createElement(Component, { id: this.__id, props: this.__props, nodeKey: this.__key })
  }

  getId(): string {
    return this.__id
  }

  getProps(): Record<string, unknown> {
    return this.__props
  }

  setProps(p: Record<string, unknown>): void {
    const w = this.getWritable() as ThemedNode
    w.__props = p
  }

  static importJSON(json: SerializedThemedNode): ThemedNode {
    return new ThemedNode(json.id, json.props, json.hasChildren)
  }

  exportJSON(): SerializedThemedNode {
    return {
      type: "themed",
      version: 1,
      id: this.__id,
      props: this.__props,
      hasChildren: this.__hasChildren,
    }
  }
}

export const $createThemedNode = (
  id: string,
  props: Record<string, unknown>,
  hasChildren = false,
): ThemedNode => new ThemedNode(id, props, hasChildren)

export const $isThemedNode = (n: LexicalNode | null | undefined): n is ThemedNode =>
  n instanceof ThemedNode
