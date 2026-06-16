"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { FORMAT_TEXT_COMMAND } from "lexical"
import { Bold, Italic, Underline, Code, Strikethrough } from "lucide-react"
import type { RtManifest } from "@/lib/richText/manifest"
import { useActiveTextStyle } from "@/components/editor/richText/toolbar/use-active-text-style"
import { cn } from "@siteinabox/ui/lib/utils"

type Mark = "bold" | "italic" | "underline" | "code" | "strikethrough"

const ICONS: Record<Mark, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  bold: Bold, italic: Italic, underline: Underline, code: Code, strikethrough: Strikethrough,
}

const LABELS: Record<Mark, string> = {
  bold: "Bold", italic: "Italic", underline: "Underline", code: "Inline code", strikethrough: "Strikethrough",
}

const ACTIVE_CHIP_CLASS = "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"

export interface MarkChipsProps {
  manifest: RtManifest
  /** Visual variant — "floating" uses compact 32px buttons; "persistent" uses 36px ghost. */
  surface: "floating" | "persistent"
}

export const MarkChips: React.FC<MarkChipsProps> = ({ manifest, surface }) => {
  const [editor] = useLexicalComposerContext()
  const { marks } = useActiveTextStyle()
  const enabled: Mark[] = []
  for (const m of ["bold", "italic", "underline", "strikethrough", "code"] as Mark[]) {
    if (manifest.inlineMarks[m]) enabled.push(m)
  }
  if (enabled.length === 0) return null

  const cls = surface === "floating"
    ? "rounded-sm p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground"
    : "rounded-sm p-2 hover:bg-accent text-muted-foreground hover:text-foreground"

  return (
    <>
      {enabled.map((mark) => {
        const Icon = ICONS[mark]
        const isActive = marks[mark]
        return (
          <button
            key={mark}
            type="button"
            className={cn(cls, isActive && ACTIVE_CHIP_CLASS)}
            aria-label={LABELS[mark]}
            aria-pressed={isActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, mark)}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        )
      })}
    </>
  )
}
