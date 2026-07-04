"use client"
import * as React from "react"
import { IconPicker, resolveLucideIcon } from "@/components/editor/icon-picker"
import { Image as ImageIcon } from "lucide-react"
import { useCanvasSelection } from "../CanvasSelectionContext"
import { elementPathEq } from "../elementPath"
import type { ElementPath } from "../elementPath"
import { isCustomerPreviewView, isReadOnlyView } from "../canvasView"
import { useTranslations } from "next-intl"

export interface InlineIconProps {
  value?: string | null
  onChange: (next: string | null) => void
  /** Class names on the rendered icon (size, color, etc). */
  className?: string
  /** Class names on the editor trigger wrapper. */
  triggerClassName?: string
  /** Size in pixels for the lucide icon. Defaults to 44 (matches FeatureList). */
  size?: number
  strokeWidth?: number
  /** Stable address of this element within the page block. When provided and
   *  the canvas is in sidebar view, clicking selects this path instead of
   *  opening the icon picker. */
  elementPath?: ElementPath
}

export const InlineIcon: React.FC<InlineIconProps> = ({ value, onChange, className, triggerClassName, size = 44, strokeWidth = 1.5, elementPath }) => {
  const t = useTranslations("editor")
  const { view, selected, select } = useCanvasSelection()
  const isCustomerPreview = isCustomerPreviewView(view)
  const isReadOnly = isReadOnlyView(view)
  const isSelected = !isCustomerPreview && isReadOnly && elementPath != null && elementPathEq(selected, elementPath)
  const Icon = resolveLucideIcon(value)
  const iconName = value ?? ""
  const placeholderClassName = [
    "rt-click-edit flex items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-muted-foreground cursor-pointer hover:bg-muted/50",
    "size-11",
    className,
  ].filter(Boolean).join(" ")

  if (isCustomerPreview) {
    return Icon ? (
      <Icon size={size} strokeWidth={strokeWidth} className={className} aria-label={t("iconLabel", { name: iconName })} />
    ) : null
  }

  if (isReadOnly) {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (elementPath != null) select(elementPath)
    }
    return Icon ? (
      <button
        type="button"
        className={["rt-click-edit cursor-pointer", triggerClassName].filter(Boolean).join(" ")}
        aria-label={t("iconLabel", { name: iconName })}
        onClick={handleClick}
        data-rt-selected={isSelected ? "true" : undefined}
      >
        <Icon size={size} strokeWidth={strokeWidth} className={className} />
      </button>
    ) : (
      <button
        type="button"
        className={placeholderClassName}
        aria-label={t("chooseIcon")}
        onClick={handleClick}
        data-rt-selected={isSelected ? "true" : undefined}
      >
        <ImageIcon className="size-5" />
      </button>
    )
  }

  // Canvas view (default): unchanged behaviour — click opens IconPicker
  const trigger = Icon ? (
    <button type="button" className={["rt-click-edit cursor-pointer", triggerClassName].filter(Boolean).join(" ")} aria-label={t("changeIcon", { name: iconName })}>
      <Icon size={size} strokeWidth={strokeWidth} className={className} />
    </button>
  ) : (
    <button
      type="button"
      className={placeholderClassName}
      aria-label={t("chooseIcon")}
    >
      <ImageIcon className="size-5" />
    </button>
  )
  return <IconPicker value={value} onChange={onChange} trigger={trigger} />
}
