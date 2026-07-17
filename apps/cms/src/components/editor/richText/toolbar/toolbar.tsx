"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { FORMAT_ELEMENT_COMMAND } from "lexical"
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { MarkChips } from "@/components/editor/richText/toolbar/mark-chips"
import { FontChip } from "@/components/editor/richText/toolbar/font-chip"
import { StyleChip } from "@/components/editor/richText/toolbar/style-chip"
import { LinkChip } from "@/components/editor/richText/toolbar/link-chip"
import { useActiveTextStyle } from "@/components/editor/richText/toolbar/use-active-text-style"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

type Alignment = "left" | "center" | "right"

const ACTIVE_CHIP_CLASS = "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"

export const Toolbar: React.FC<{ manifest: RtManifest; variant: "block" | "inline"; allowFontFamily?: boolean; theme?: ThemeTokens | null; onOpenLink: () => void }> = ({ manifest, variant, allowFontFamily = false, theme, onOpenLink }) => {
  const t = useTranslations("editor")
  const [editor] = useLexicalComposerContext()
  const { alignment } = useActiveTextStyle()

  const alignmentButton = (
    value: Alignment,
    label: string,
    Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>,
  ) => {
    const isActive = alignment === value
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={label}
        aria-pressed={isActive}
        className={cn(isActive && ACTIVE_CHIP_CLASS)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, value)}
      >
        <Icon className="size-4" aria-hidden />
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-1">
      <MarkChips manifest={manifest} surface="persistent" />
      {allowFontFamily && <FontChip manifest={manifest} theme={theme} />}
      <StyleChip manifest={manifest} />
      <LinkChip onOpen={onOpenLink} surface="persistent" />
      {variant === "block" && (
        <>
          <span className="mx-1 h-5 w-px bg-border" />
          {alignmentButton("left", t("alignLeft"), AlignLeft)}
          {alignmentButton("center", t("alignCenter"), AlignCenter)}
          {alignmentButton("right", t("alignRight"), AlignRight)}
        </>
      )}
    </div>
  )
}
