"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection } from "lexical"
import { $patchStyleText } from "@lexical/selection"
import { Palette } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@siteinabox/ui/components/popover"
import type { RtManifest } from "@/lib/richText/manifest"
import { useAnchorRtCanvas } from "@/components/editor/hooks/use-rt-canvas-anchor"
import { useActiveTextStyle } from "@/components/editor/richText/toolbar/use-active-text-style"
import { formatCssColorValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

export interface ColorChipProps {
  manifest: RtManifest
}

interface ResolvedColors {
  tokens: Record<string, string>
  /** The canvas's inherited text colour — used as the "Default" swatch fill. */
  defaultColor: string
}

const useResolvedColors = (manifest: RtManifest): ResolvedColors => {
  const anchor = useAnchorRtCanvas()
  const [resolved, setResolved] = React.useState<ResolvedColors>({ tokens: {}, defaultColor: "" })

  React.useEffect(() => {
    if (!anchor) return
    const tokens: Record<string, string> = {}
    const cs = getComputedStyle(anchor)
    for (const c of manifest.colorTokens ?? []) {
      const v = cs.getPropertyValue(c.cssVar).trim()
      // Prefer the canvas-scoped value; fall back to the admin mirror.
      if (v) tokens[c.id] = v
      else {
        const mirror = cs.getPropertyValue(c.cssVar.replace(/^--color-/, "--rt-tenant-color-")).trim()
        if (mirror) tokens[c.id] = mirror
      }
    }
    setResolved({ tokens, defaultColor: cs.color || "" })
  }, [anchor, manifest])

  return resolved
}

export const ColorChip: React.FC<ColorChipProps> = ({ manifest }) => {
  const t = useTranslations("editor")
  const [editor] = useLexicalComposerContext()
  const { tokens: resolved, defaultColor } = useResolvedColors(manifest)
  const { color: activeColor } = useActiveTextStyle()
  const tokens = manifest.colorTokens ?? []
  if (tokens.length === 0) return null
  const hasActiveColor = activeColor !== null

  const editorColorForId = (id: string): string | null => {
    const token = tokens.find((t) => t.id === id)
    if (!token) return null
    const adminMirror = token.cssVar.replace(/^--color-/, "--rt-tenant-color-")
    return `var(${adminMirror}, var(${token.cssVar}))`
  }

  const apply = (id: string | null) => {
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      $patchStyleText(sel, { "--rt-color": id, color: id ? editorColorForId(id) : null })
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
            hasActiveColor && "bg-accent text-foreground ring-1 ring-foreground",
          )}
          aria-label={t("textColour")}
          aria-pressed={hasActiveColor}
        >
          <Palette className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-56 p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        data-siab-editor-ui
        data-siab-canvas-chrome="rich-text-popover"
      >
        <div className="grid grid-cols-6 gap-1.5 p-1">
          {/* Default colour swatch — rendered first so it lives in-grid with the
              palette tokens. The fill is the canvas's inherited text colour, so
              picking it visually "matches" the colour the text reverts to. */}
          <ColorSwatch
            label={t("defaultColour")}
            active={activeColor === null}
            color={defaultColor || "transparent"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(null)}
          />
          {tokens.map((t) => {
            const isActive = activeColor === t.id
            return (
              <ColorSwatch
                key={t.id}
                label={t.label}
                active={isActive}
                color={resolved[t.id] || "transparent"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => apply(t.id)}
              />
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ColorSwatch({
  label,
  active,
  color,
  onMouseDown,
  onClick,
}: {
  label: string
  active: boolean
  color: string
  onMouseDown: React.MouseEventHandler<HTMLButtonElement>
  onClick: React.MouseEventHandler<HTMLButtonElement>
}) {
  const safeColor = formatCssColorValue(color) ?? "transparent"
  const swatchStyle = useCspStyleRule("color-chip-swatch", `background-color:${safeColor};`)
  return (
    <>
      {swatchStyle.styleElement}
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        title={label}
        onMouseDown={onMouseDown}
        onClick={onClick}
        className={cn(
          swatchStyle.className,
          "size-6 rounded-full ring-1 ring-border hover:ring-2 hover:ring-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active && "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
        )}
      />
    </>
  )
}
