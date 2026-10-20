"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext"
import { $getNodeByKey } from "@payloadcms/richtext-lexical/lexical"
import { RtTextNode } from "@/lib/richText/lexical/RtTextNode"

/**
 * Watches every RtTextNode mutation (create + update) and mirrors the inline
 * `--rt-style` / `--rt-color` / `--rt-font` CSS custom properties to matching
 * `rt-type-{id}` / `rt-color-{id}` / `rt-font-{id}` classes on the rendered DOM.
 *
 * Lexical's reconciler bypasses subclass `updateDOM` for style-only changes
 * on TextNode (fast path) — so the class-sync logic that lives inside
 * RtTextNode.createDOM/updateDOM doesn't always fire. This plugin is the
 * authoritative sync point: registerMutationListener fires for every
 * commit that touches an RtTextNode.
 */
const RT_STYLE_RE = /--rt-style\s*:\s*([a-z0-9-]+)/
const RT_COLOR_RE = /--rt-color\s*:\s*([a-z0-9-]+)/
const RT_FONT_RE = /--rt-font\s*:\s*([a-z0-9-]+)/

const syncClasses = (dom: HTMLElement, style: string): void => {
  Array.from(dom.classList)
    .filter((c) => c.startsWith("rt-type-") || c.startsWith("rt-color-") || c.startsWith("rt-font-"))
    .forEach((c) => dom.classList.remove(c))
  const styleMatch = style.match(RT_STYLE_RE)
  const colorMatch = style.match(RT_COLOR_RE)
  const fontMatch = style.match(RT_FONT_RE)
  if (styleMatch) dom.classList.add(`rt-type-${styleMatch[1]}`)
  if (colorMatch) dom.classList.add(`rt-color-${colorMatch[1]}`)
  if (fontMatch) dom.classList.add(`rt-font-${fontMatch[1]}`)
}

export const RtClassSyncPlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext()
  React.useEffect(() => {
    return editor.registerMutationListener(
      RtTextNode,
      (mutatedNodes) => {
        editor.getEditorState().read(() => {
          for (const [nodeKey, mutation] of mutatedNodes) {
            if (mutation === "destroyed") continue
            const node = $getNodeByKey(nodeKey)
            const dom = editor.getElementByKey(nodeKey)
            if (!node || !dom || !(node instanceof RtTextNode)) continue
            syncClasses(dom, node.getStyle())
          }
        })
      },
    )
  }, [editor])
  return null
}
