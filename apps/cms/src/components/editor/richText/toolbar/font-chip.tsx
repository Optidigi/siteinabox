"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection } from "lexical"
import { $patchStyleText } from "@lexical/selection"
import { Type } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@siteinabox/ui/components/popover"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { inspectorFontValue } from "@/lib/theme/inspectorFonts"
import { useActiveTextStyle } from "@/components/editor/richText/toolbar/use-active-text-style"
import { formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

export interface FontChipProps {
  manifest: RtManifest
  theme?: ThemeTokens | null
}

const ACTIVE_CHIP_CLASS = "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"

export const FontChip: React.FC<FontChipProps> = ({ manifest, theme }) => {
  const t = useTranslations("editor")
  const [editor] = useLexicalComposerContext()
  const { font: activeFont } = useActiveTextStyle()
  const tokens = manifest.fontFamilies ?? []
  if (tokens.length === 0) return null
  const hasActiveFont = activeFont !== null

  const apply = (id: string | null, cssVar?: string) => {
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      $patchStyleText(sel, {
        "--rt-font": id,
        "font-family": id && cssVar ? `var(${cssVar})` : null,
      })
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
            hasActiveFont && ACTIVE_CHIP_CLASS,
          )}
          aria-label={t("fontFamily")}
          aria-pressed={hasActiveFont}
        >
          <Type className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-56 p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        data-siab-editor-ui

      >
        <button
          type="button"
          aria-pressed={activeFont === null}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
            activeFont === null && "bg-accent text-accent-foreground",
          )}
        >
          <FontSample font={inspectorFontValue(theme, "--font-text")} />
          <span className="text-muted-foreground">{t("defaultFont")}</span>
        </button>
        <div className="my-1 border-t border-border" />
        {tokens.map((token) => (
          <button
            key={token.id}
            type="button"
            aria-pressed={activeFont === token.id}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(token.id, token.cssVar)}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
              activeFont === token.id && "bg-accent text-accent-foreground",
            )}
          >
            <FontSample font={inspectorFontValue(theme, token.cssVar)} />
            <span className="text-muted-foreground">{token.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function FontSample({ font }: { font?: string }) {
  const fontValue = formatRuntimeCssValue(font)
  const sampleStyle = useCspStyleRule(
    "font-chip-sample",
    fontValue ? `font-family:${fontValue};` : null,
  )
  return (
    <>
      {sampleStyle.styleElement}
      <span className={`${sampleStyle.className} text-foreground`}>Aa</span>
    </>
  )
}
