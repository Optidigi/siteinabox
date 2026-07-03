"use client"
import * as React from "react"
import { LexicalField } from "@/components/editor/richText/LexicalField"
import type { RtRoot } from "@/lib/richText/RtNode"
import { RtStaticView } from "./RtStaticView"
import type { RtManifest } from "@/lib/richText/manifest"
import { useCanvasSelection } from "../CanvasSelectionContext"
import { elementPathEq } from "../elementPath"
import type { ElementPath } from "../elementPath"
import { isCustomerPreviewView, isReadOnlyView } from "../canvasView"

/**
 * Rich-text edit slot — the editable element a canvas block renders in place
 * of a piece of rendered text. The wrapper tag carries the caller's site
 * classes (which is what actually drives the visual — the tenant styles by
 * class, not tag) and `rt-slot` (the hover/focus affordance + placeholder
 * positioning, see globals.css). The bare LexicalField renders its
 * ContentEditable directly inside this tag — no interposed wrapper `<div>`.
 *
 * In canvas view the slot renders the same static rich-text DOM as the live
 * site until it is clicked for editing. Keeping Lexical unmounted by default is
 * load-bearing for visual parity: Lexical's editable is a `<div>` and can add
 * block layout inside headings/inline slots, while the static branch can safely
 * use the caller's requested tag (`span`, `h1`, `p`, etc.).
 */
const SAFE_BLOCK_TAGS = new Set<string>([
  "div", "h1", "h2", "h3", "h4", "h5", "h6",
  "section", "article", "figure", "figcaption", "header", "footer",
  "aside", "main", "blockquote", "li", "dd",
])
const INLINE_CONTENT_TAGS = new Set<string>(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li", "dd"])

export interface RtSlotProps {
  value: RtRoot | undefined
  onChange: (next: RtRoot) => void
  manifest: RtManifest
  variant: "block" | "inline"
  /** Preferred wrapper tag — used as-is if it's a valid block container,
  *  otherwise downgraded to `<div>` (see component doc). */
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  placeholder?: string
  /** Stable address of this element within the page block. When provided and
   *  the canvas is in sidebar view, clicking selects this path instead of
   *  opening the inline editor. */
  elementPath?: ElementPath
  /** Forwarded to LexicalField → FloatingToolbar. Enables the font-family
   *  chip for dedicated RichText block editing. Every other slot relies on
   *  role fonts/theme configuration. Defaults to false. */
  allowFontFamily?: boolean
}

export const RtSlot: React.FC<RtSlotProps> = ({
  value, onChange, manifest, variant, as, className, placeholder, elementPath, allowFontFamily = false,
}) => {
  const { view, selected, select } = useCanvasSelection()
  const isCustomerPreview = isCustomerPreviewView(view)
  const isReadOnly = isReadOnlyView(view)
  const isSelected = !isCustomerPreview && isReadOnly && elementPath != null && elementPathEq(selected, elementPath)
  const [editing, setEditing] = React.useState(false)
  const slotRef = React.useRef<HTMLElement | null>(null)

  const requested = as ?? (variant === "inline" ? "span" : "div")
  const editingTag = (SAFE_BLOCK_TAGS.has(requested) ? requested : "div") as React.ElementType
  const staticTag = requested as React.ElementType
  const Tag = (!isReadOnly && editing ? editingTag : staticTag) as React.ElementType
  const blockMode = variant !== "block" ? "normal"
    : requested === "span" ? "text"
    : INLINE_CONTENT_TAGS.has(requested) ? "inline"
    : "normal"
  const hasStaticValue = !!value?.children?.length
  const shouldRenderEmptySlot = !isCustomerPreview && (!!placeholder || elementPath != null || !isReadOnly)

  const handleClick = !isCustomerPreview && isReadOnly && elementPath != null
    ? (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); select(elementPath) }
    : !isReadOnly
      ? (e: React.MouseEvent) => { e.stopPropagation(); setEditing(true) }
      : undefined

  React.useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => {
      slotRef.current?.querySelector<HTMLElement>("[contenteditable='true']")?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [editing])

  if (!editing && !hasStaticValue && !shouldRenderEmptySlot) return null
  if (!editing && variant === "block" && requested === "div" && !className && elementPath == null) {
    return <RtStaticView value={value} manifest={manifest} placeholder={placeholder} blockMode="normal" />
  }

  return (
    <Tag
      ref={slotRef}
      className={[isCustomerPreview ? undefined : "rt-slot", isReadOnly && !isCustomerPreview ? "cursor-pointer" : undefined, className].filter(Boolean).join(" ")}
      data-rt-variant={variant}
      data-rt-selected={isSelected ? "true" : undefined}
      onClick={handleClick}
      onBlurCapture={!isReadOnly && editing
        ? (event: React.FocusEvent<HTMLElement>) => {
          const next = event.relatedTarget as Node | null
          if (next && event.currentTarget.contains(next)) return
          setEditing(false)
        }
        : undefined}
    >
      {isReadOnly || !editing ? (
        hasStaticValue ? (
          <RtStaticView value={value} manifest={manifest} placeholder={placeholder} blockMode={blockMode} />
        ) : placeholder ? (
          <span className="opacity-55" data-rt-empty-placeholder="true">{placeholder}</span>
        ) : null
      ) : (
        <LexicalField
          variant={variant}
          manifest={manifest}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          chrome="bare"
          editable={!isReadOnly}
          allowFontFamily={allowFontFamily}
        />
      )}
    </Tag>
  )
}
