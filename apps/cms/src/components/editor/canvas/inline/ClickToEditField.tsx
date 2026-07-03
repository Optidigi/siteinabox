"use client"
import * as React from "react"
import { useCanvasSelection } from "../CanvasSelectionContext"
import { elementPathEq } from "../elementPath"
import type { ElementPath } from "../elementPath"
import { isCustomerPreviewView, isReadOnlyView } from "../canvasView"

/**
 * Generic click→edit wrapper. Renders `children` normally; in canvas view
 * the whole span is clickable and opens the editor in place. In sidebar
 * (read-only) view, clicking selects the element.
 *
 * No pencil affordance — the .rt-click-edit hover outline (globals.css)
 * is the visual cue. Consumers (pills, CTAs, images, icons) get a single
 * consistent interaction: click anywhere on the element to edit.
 *
 * Used by InlineCtaButton, InlineImage, InlineIcon, Hero pills, Testimonials.
 */
export interface ClickToEditFieldProps {
  children: React.ReactNode
  editor: (close: () => void) => React.ReactNode
  ariaLabel: string
  className?: string
  /** Kept for API stability with existing call sites; no visual effect. */
  affordance?: "corner" | "inline"
  /** Stable address of this element within the page block. When provided and
   *  the canvas is in sidebar view, clicking selects this path instead of
   *  opening the inline editor. */
  elementPath?: ElementPath
  /** When true, the field mounts already in edit mode (renders editor()
   *  immediately). Used for freshly-created items that should be typed into
   *  right away. Only honoured in canvas view. */
  autoOpen?: boolean
}

export const ClickToEditField: React.FC<ClickToEditFieldProps> = ({
  children, editor, ariaLabel, className, elementPath, autoOpen,
}) => {
  const { view, selected, select } = useCanvasSelection()
  const isCustomerPreview = isCustomerPreviewView(view)
  const isReadOnly = isReadOnlyView(view)
  const isSelected = !isCustomerPreview && isReadOnly && elementPath != null && elementPathEq(selected, elementPath)

  const [editing, setEditing] = React.useState(autoOpen === true && !isReadOnly)
  const close = React.useCallback(() => setEditing(false), [])

  if (isCustomerPreview) {
    return <>{children}</>
  }

  if (isReadOnly) {
    return (
      <span
        className={["rt-click-edit relative inline-block cursor-pointer", className ?? ""].filter(Boolean).join(" ")}
        data-rt-selected={isSelected ? "true" : undefined}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (elementPath != null) select(elementPath)
        }}
      >
        {children}
      </span>
    )
  }

  // Canvas view: whole-span click enters edit mode. No pencil button — the
  // .rt-click-edit hover outline (globals.css) is the affordance.
  return (
    <span
      className={["rt-click-edit relative inline-block", editing ? undefined : "cursor-pointer", className].filter(Boolean).join(" ")}
      role={editing ? undefined : "button"}
      tabIndex={editing ? undefined : 0}
      aria-label={editing ? undefined : ariaLabel}
      onClick={editing ? undefined : (e) => { e.stopPropagation(); e.preventDefault(); setEditing(true) }}
      onKeyDown={editing ? undefined : (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault(); e.stopPropagation(); setEditing(true)
        }
      }}
    >
      {editing ? editor(close) : children}
    </span>
  )
}
