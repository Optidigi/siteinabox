"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $getSelection, $isRangeSelection, $createParagraphNode,
} from "lexical"
import { $setBlocksType } from "@lexical/selection"
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text"
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, $isListNode, ListNode, REMOVE_LIST_COMMAND } from "@lexical/list"
import { $getNearestNodeOfType } from "@lexical/utils"
import { Pilcrow, Heading2, Heading3, Heading4, Quote, List, ListOrdered, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@siteinabox/ui/components/popover"
import type { RtManifest } from "@/lib/richText/manifest"
import { useTranslations } from "next-intl"

type Kind = "paragraph" | "h2" | "h3" | "h4" | "quote" | "ul" | "ol"

const ICONS: Record<Kind, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  paragraph: Pilcrow, h2: Heading2, h3: Heading3, h4: Heading4, quote: Quote, ul: List, ol: ListOrdered,
}
export interface BlockChipProps {
  manifest: RtManifest
}

export const BlockChip: React.FC<BlockChipProps> = ({ manifest }) => {
  const t = useTranslations("editor")
  const [editor] = useLexicalComposerContext()
  const labels: Record<Kind, string> = {
    paragraph: t("paragraph"), h2: t("heading2"), h3: t("heading3"), h4: t("heading4"),
    quote: t("quote"), ul: t("bulletedList"), ol: t("numberedList"),
  }

  const kinds: Kind[] = ["paragraph"]
  for (const l of manifest.blockTypes.heading?.levels ?? []) {
    kinds.push(`h${l}` as Kind)
  }
  if (manifest.blockTypes.bulletList) kinds.push("ul")
  if (manifest.blockTypes.orderedList) kinds.push("ol")
  if (manifest.blockTypes.blockquote) kinds.push("quote")

  const apply = (kind: Kind) => {
    // Lists are toggled via Lexical commands, which spawn their own
    // editor.update transaction — keep them OUT of any wrapping update().
    if (kind === "ul") { editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined); return }
    if (kind === "ol") { editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined); return }

    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return

      // If the caret sits inside a list, $setBlocksType cannot reach the
      // ListNode (it's not a direct root child) and silently no-ops.
      // Unwrap the list first.
      const anchorNode = sel.anchor.getNode()
      const listAncestor = $getNearestNodeOfType(anchorNode, ListNode)
      if (listAncestor && $isListNode(listAncestor)) {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
        // After REMOVE_LIST_COMMAND, items become paragraphs. We need a
        // second update to re-read the now-paragraph selection and apply
        // the requested block type. Use a microtask so the list-removal
        // transaction commits first.
        queueMicrotask(() => {
          editor.update(() => {
            const sel2 = $getSelection()
            if (!$isRangeSelection(sel2)) return
            if (kind === "paragraph") return
            $setBlocksType(sel2, () => {
              if (kind === "quote") return $createQuoteNode()
              return $createHeadingNode(kind)
            })
          })
        })
        return
      }

      $setBlocksType(sel, () => {
        if (kind === "paragraph") return $createParagraphNode()
        if (kind === "quote") return $createQuoteNode()
        return $createHeadingNode(kind)
      })
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t("blockType")}
        >
          <Pilcrow className="size-3.5" aria-hidden />
          <span>{t("block")}</span>
          <ChevronDown className="size-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-48 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        data-siab-editor-ui
        data-siab-canvas-chrome="rich-text-popover"
      >
        {kinds.map((k) => {
          const Icon = ICONS[k]
          return (
            <button
              key={k}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(k)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
            >
              <Icon className="size-4 text-muted-foreground" aria-hidden />
              <span>{labels[k]}</span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
