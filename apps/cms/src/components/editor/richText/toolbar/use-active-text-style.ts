"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext"
import { $getSelection, $isElementNode, $isRangeSelection, $isTextNode, type ElementNode, type TextFormatType } from "@payloadcms/richtext-lexical/lexical"
import { $isLinkNode, LinkNode } from "@payloadcms/richtext-lexical/lexical/link"
import { $getNearestNodeOfType } from "@payloadcms/richtext-lexical/lexical/utils"
import { StyledHeadingNode } from "@/lib/richText/lexical/StyledHeadingNode"
import { StyledParagraphNode } from "@/lib/richText/lexical/StyledParagraphNode"

/**
 * Returns the `--rt-color`, `--rt-font`, and `--rt-style` values currently applied at
 * the active selection — used by ColorChip / FontChip / StyleChip to render the
 * matching popover option with an "active" outline.
 *
 * Subscribes to Lexical's update listener so the indicators re-derive
 * whenever the selection or formatting changes.
 *
 * Returns nulls when no range selection exists, or when the selection
 * spans nodes with conflicting values (the swatch / row simply renders
 * unselected then — no false-positive active state).
 */
export interface ActiveTextStyle {
  color: string | null
  font: string | null
  style: string | null
  marks: Record<"bold" | "italic" | "underline" | "code" | "strikethrough", boolean>
  link: boolean
  alignment: "left" | "center" | "right" | null
}

const RT_STYLE_RE = /--rt-style\s*:\s*([a-z0-9-]+)/
const RT_COLOR_RE = /--rt-color\s*:\s*([a-z0-9-]+)/
const RT_FONT_RE = /--rt-font\s*:\s*([a-z0-9-]+)/

const EMPTY_MARKS: ActiveTextStyle["marks"] = {
  bold: false,
  italic: false,
  underline: false,
  code: false,
  strikethrough: false,
}

const EMPTY_ACTIVE: ActiveTextStyle = {
  color: null,
  font: null,
  style: null,
  marks: EMPTY_MARKS,
  link: false,
  alignment: null,
}

const MARKS = ["bold", "italic", "underline", "code", "strikethrough"] as const

const normalizeAlignment = (format: string | number | null | undefined): ActiveTextStyle["alignment"] => {
  if (format === "center" || format === "right") return format
  if (format === "left" || format === "" || format == null || format === 0) return "left"
  return null
}

export const useActiveTextStyle = (): ActiveTextStyle => {
  const [editor] = useLexicalComposerContext()
  const [active, setActive] = React.useState<ActiveTextStyle>(EMPTY_ACTIVE)

  React.useEffect(() => {
    const read = () => {
      editor.getEditorState().read(() => {
        const sel = $getSelection()
        if (!$isRangeSelection(sel)) { setActive(EMPTY_ACTIVE); return }
        const nodes = sel.getNodes()
        const textNodes = nodes.filter($isTextNode)
        let color: string | null | undefined = undefined
        let font: string | null | undefined = undefined
        let style: string | null | undefined = undefined
        for (const n of textNodes) {
          const css = n.getStyle()
          const c = css.match(RT_COLOR_RE)?.[1] ?? null
          const f = css.match(RT_FONT_RE)?.[1] ?? null
          const s = css.match(RT_STYLE_RE)?.[1] ?? null
          if (color === undefined) color = c
          else if (color !== c) color = null
          if (font === undefined) font = f
          else if (font !== f) font = null
          if (style === undefined) style = s
          else if (style !== s) style = null
        }

        const marks = { ...EMPTY_MARKS }
        for (const mark of MARKS) {
          if (sel.isCollapsed() || textNodes.length === 0) {
            marks[mark] = sel.hasFormat(mark as TextFormatType)
          } else {
            marks[mark] = textNodes.every((node) => node.hasFormat(mark as TextFormatType))
          }
        }

        const link = nodes.some((node) => {
          if ($isLinkNode(node)) return true
          return $getNearestNodeOfType(node, LinkNode) != null
        })

        let alignment: ActiveTextStyle["alignment"] | undefined = undefined
        const blocks = new Set<ElementNode>()
        for (const node of nodes) {
          const block = node.getTopLevelElement()
          if (block && $isElementNode(block)) blocks.add(block)
        }
        if (blocks.size === 0) {
          const block = sel.anchor.getNode().getTopLevelElement()
          if (block && $isElementNode(block)) blocks.add(block)
        }
        for (const block of blocks) {
          const next = normalizeAlignment((block as ElementNode & { getFormatType?: () => string | number }).getFormatType?.())
          if (alignment === undefined) alignment = next
          else if (alignment !== next) alignment = null
        }

        // Block-scoped styles live on their element nodes, not on text-node
        // CSS — surface them so the StyleChip's active state works there too.
        const block = sel.anchor.getNode().getTopLevelElement()
        if (block instanceof StyledHeadingNode) {
          const headingStyle = block.getRtStyle() || null
          style = headingStyle
        } else if (block instanceof StyledParagraphNode) {
          const paragraphStyle = block.getRtStyle() || null
          style = paragraphStyle
        }
        setActive({
          color: color ?? null,
          font: font ?? null,
          style: style ?? null,
          marks,
          link,
          alignment: alignment ?? null,
        })
      })
    }
    read()
    return editor.registerUpdateListener(read)
  }, [editor])

  return active
}
