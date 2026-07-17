"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $createParagraphNode, $getSelection, $isParagraphNode, $isRangeSelection } from "lexical"
import { $patchStyleText } from "@lexical/selection"
import { $createHeadingNode, $isHeadingNode } from "@lexical/rich-text"
import { Wand2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@siteinabox/ui/components/popover"
import type { RtManifest, RtTypeStyle } from "@/lib/richText/manifest"
import { $createStyledHeadingNode, StyledHeadingNode } from "@/lib/richText/lexical/StyledHeadingNode"
import { $createStyledParagraphNode, StyledParagraphNode } from "@/lib/richText/lexical/StyledParagraphNode"
import { useActiveTextStyle } from "@/components/editor/richText/toolbar/use-active-text-style"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

export interface StyleChipProps {
  manifest: RtManifest
}

const ACTIVE_CHIP_CLASS = "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"

const useSelectionScope = (): "inline" | "heading" | "paragraph" | null => {
  const [editor] = useLexicalComposerContext()
  const [scope, setScope] = React.useState<"inline" | "heading" | "paragraph" | null>("inline")
  React.useEffect(() => {
    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        const sel = $getSelection()
        if (!$isRangeSelection(sel)) { setScope(null); return }
        const anchorNode = sel.anchor.getNode()
        const block = anchorNode.getTopLevelElement()
        if (!block) { setScope("inline"); return }
        if ($isHeadingNode(block) || block instanceof StyledHeadingNode) {
          setScope("heading")
        } else if ($isParagraphNode(block) || block instanceof StyledParagraphNode) {
          setScope("paragraph")
        } else {
          setScope("inline")
        }
      })
    })
  }, [editor])
  return scope
}

export const StyleChip: React.FC<StyleChipProps> = ({ manifest }) => {
  const t = useTranslations("editor")
  const [editor] = useLexicalComposerContext()
  const scope = useSelectionScope()
  const { style: activeStyle } = useActiveTextStyle()
  const all = manifest.typeStyles ?? []
  if (all.length === 0) return null

  const eligible: RtTypeStyle[] = all.filter((s) => {
    if (s.appliesTo === "inline") return scope !== "heading"
    if (s.appliesTo === "paragraph") return scope === "paragraph"
    if (s.appliesTo === "heading") return scope === "heading"
    return false
  })

  const applyInline = (id: string | null) => {
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      $patchStyleText(sel, { "--rt-style": id })
    })
  }

  const applyParagraph = (id: string | null) => {
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      const block = sel.anchor.getNode().getTopLevelElement()
      if (!block) return
      const isParagraph = $isParagraphNode(block) || block instanceof StyledParagraphNode
      if (!isParagraph) return
      if (id) {
        if (block instanceof StyledParagraphNode) {
          block.setRtStyle(id)
        } else {
          const styled = $createStyledParagraphNode(id)
          for (const child of block.getChildren()) styled.append(child)
          block.replace(styled)
        }
      } else if (block instanceof StyledParagraphNode) {
        const plain = $createParagraphNode()
        for (const child of block.getChildren()) plain.append(child)
        block.replace(plain)
      }
    })
  }

  const clearParagraphOrInline = () => {
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      const block = sel.anchor.getNode().getTopLevelElement()
      if (block instanceof StyledParagraphNode) {
        const plain = $createParagraphNode()
        for (const child of block.getChildren()) plain.append(child)
        block.replace(plain)
        return
      }
      $patchStyleText(sel, { "--rt-style": null })
    })
  }

  const applyHeading = (id: string | null) => {
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      const block = sel.anchor.getNode().getTopLevelElement()
      if (!block) return
      const isHeading = $isHeadingNode(block) || block instanceof StyledHeadingNode
      if (!isHeading) return
      const tag = (block as any).getTag() as "h2" | "h3" | "h4"
      if (id) {
        if (block instanceof StyledHeadingNode) {
          block.setRtStyle(id)
        } else {
          const styled = $createStyledHeadingNode(tag, id)
          for (const child of block.getChildren()) styled.append(child)
          block.replace(styled)
        }
      } else {
        if (block instanceof StyledHeadingNode) {
          const plain = $createHeadingNode(tag)
          for (const child of block.getChildren()) plain.append(child)
          block.replace(plain)
        }
      }
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
            activeStyle !== null && ACTIVE_CHIP_CLASS,
          )}
          aria-label={t("textStyle")}
          aria-pressed={activeStyle !== null}
        >
          <Wand2 className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-64 p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        data-siab-editor-ui

      >
        {eligible.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("noStylesForSelection")}</div>
        )}
        {eligible.map((s) => {
          const sampleClass = s.sampleClass ?? `rt-type-${s.id}`
          const isActive = activeStyle === s.id
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={isActive}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (s.appliesTo === "heading") applyHeading(s.id)
                else if (s.appliesTo === "paragraph") applyParagraph(s.id)
                else applyInline(s.id)
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 hover:bg-accent text-left",
                isActive && ACTIVE_CHIP_CLASS,
              )}
            >
              <span className={sampleClass}>{s.label}</span>
              {s.description && <span className="text-xs text-muted-foreground">{s.description}</span>}
            </button>
          )
        })}
        {(scope === "heading" || eligible.length > 0) && (
          <>
            <div className="border-t border-border my-1" />
            <button
              type="button"
              aria-pressed={activeStyle === null}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => scope === "heading" ? applyHeading(null) : scope === "paragraph" ? clearParagraphOrInline() : applyInline(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left text-muted-foreground",
                activeStyle === null && "bg-accent text-foreground",
              )}
            >
              Clear style
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
