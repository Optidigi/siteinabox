"use client"
import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@siteinabox/ui/components/popover"
import { Input } from "@siteinabox/ui/components/input"
import { Button } from "@siteinabox/ui/components/button"
import { Label } from "@siteinabox/ui/components/label"
import { Plus } from "lucide-react"
import { useCanvasSelection } from "../CanvasSelectionContext"
import { elementPathEq } from "../elementPath"
import type { ElementPath } from "../elementPath"
import { isCustomerPreviewView, isReadOnlyView } from "../canvasView"
import { isSafeHref } from "@/lib/security/safeHref"
import { useTranslations } from "next-intl"

export interface InlineCtaButtonProps {
  value?: { label?: string | null; href?: string | null } | null
  onChange: (next: { label: string; href: string } | null) => void
  className?: string
  style?: React.CSSProperties
  actionAttributes?: Record<string, string>
  /** Defaults to a sensible "Add CTA" empty-state label. */
  emptyLabel?: string
  /** Stable address of this element within the page block. When provided and
   *  the canvas is in sidebar view, clicking selects this path instead of
   *  opening the CTA editor popover. */
  elementPath?: ElementPath
}

export const InlineCtaButton: React.FC<InlineCtaButtonProps> = ({ value, onChange, className, style, actionAttributes, emptyLabel, elementPath }) => {
  const t = useTranslations("editor")
  const tCommon = useTranslations("common")
  const { view, selected, select } = useCanvasSelection()
  const isCustomerPreview = isCustomerPreviewView(view)
  const isReadOnly = isReadOnlyView(view)
  const isSelected = !isCustomerPreview && isReadOnly && elementPath != null && elementPathEq(selected, elementPath)

  const [open, setOpen] = React.useState(false)
  const [label, setLabel] = React.useState(value?.label ?? "")
  const [href, setHref] = React.useState(value?.href ?? "")
  const [error, setError] = React.useState<string | null>(null)

  // Re-sync local state when value changes externally
  React.useEffect(() => {
    setLabel(value?.label ?? "")
    setHref(value?.href ?? "")
  }, [value?.label, value?.href])

  const apply = () => {
    const l = label.trim()
    const h = href.trim()
    if (!l && !h) { onChange(null); setOpen(false); setError(null); return }
    if (!isSafeHref(h)) { setError(t("invalidCtaUrl")); return }
    onChange({ label: l, href: h })
    setError(null)
    setOpen(false)
  }

  const hasValue = Boolean(value?.label && value?.href)
  const emptyText = emptyLabel ?? t("addCta")

  if (isCustomerPreview) {
    return hasValue ? (
      <a href={value!.href!} className={className} style={style} {...actionAttributes}>
        {value!.label}
      </a>
    ) : null
  }

  if (isReadOnly) {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (elementPath != null) select(elementPath)
    }
    return hasValue ? (
      <button
        type="button"
        className={[className, "rt-click-edit cursor-pointer"].filter(Boolean).join(" ")}
        style={style}
        onClick={handleClick}
        data-rt-selected={isSelected ? "true" : undefined}
        data-rt-href={value!.href!}
        {...actionAttributes}
      >
        {value!.label}
      </button>
    ) : (
      <button
        type="button"
        className={[className, "rt-click-edit opacity-70 cursor-pointer"].filter(Boolean).join(" ")}
        style={style}
        onClick={handleClick}
        data-rt-selected={isSelected ? "true" : undefined}
      >
        <Plus className="inline size-3.5 mr-1" />
        {emptyText}
      </button>
    )
  }

  // Canvas view (default): unchanged behaviour — click opens popover editor
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {hasValue ? (
          <a
            href={value!.href!}
            className={[className, "rt-click-edit"].filter(Boolean).join(" ")}
            style={style}
            {...actionAttributes}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
          >
            {value!.label}
          </a>
        ) : (
          <button
            type="button"
            className={[className, "rt-click-edit opacity-70 hover:opacity-100"].filter(Boolean).join(" ")}
            style={style}
            onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          >
            <Plus className="inline size-3.5 mr-1" />
            {emptyText}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 space-y-3"
        align="start"
        data-siab-editor-ui
        data-siab-canvas-chrome="inline-cta-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <Label htmlFor="inline-cta-label">{t("buttonText")}</Label>
          <Input id="inline-cta-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Contact" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inline-cta-href">URL</Label>
          <Input id="inline-cta-href" value={href} onChange={(e) => setHref(e.target.value)} placeholder={t("ctaUrlPlaceholder")} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" onClick={apply} className="flex-1">{hasValue ? tCommon("save") : tCommon("create")}</Button>
          {hasValue && (
            <Button type="button" variant="ghost" onClick={() => { onChange(null); setOpen(false) }}>{t("remove")}</Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
