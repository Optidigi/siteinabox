"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { COMMAND_PRIORITY_NORMAL, PASTE_COMMAND, $getSelection, $isRangeSelection } from "lexical"
import {
  $generateNodesFromSerializedNodes,
  $insertGeneratedNodes,
} from "@lexical/clipboard"
import { mapHtmlToRt } from "@/lib/richText/mapper"
import { rtToLexicalJson } from "@/lib/richText/lexical/rtToLexical"
import { matchersForManifest } from "@/lib/richText/themedMatchers"
import { useRtManifest } from "@/components/editor/RtManifestContext"
import { useStatusFeedback } from "@/components/status-feedback"

// API note: @lexical/clipboard (0.41.x) exports $generateNodesFromSerializedNodes,
// which takes Array<BaseSerializedNode> and returns Array<LexicalNode>. We feed it
// j.root.children — the top-level block nodes produced by rtToLexicalJson — then
// use $insertGeneratedNodes to splice them into the current selection.

export const PastePlugin: React.FC<{ variant: "block" | "inline" }> = ({ variant }) => {
  const [editor] = useLexicalComposerContext()
  const manifest = useRtManifest()
  const status = useStatusFeedback()

  React.useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (eventOrClipboard) => {
        const ev = eventOrClipboard as ClipboardEvent
        const files = ev.clipboardData?.files
        if (files && files.length > 0) {
          status.info("Use the Image block from the slash menu to insert images.")
          ev.preventDefault()
          return true
        }
        const html = ev.clipboardData?.getData("text/html")
        if (!html) return false
        ev.preventDefault()
        const root = mapHtmlToRt(html, {
          variant,
          manifest,
          themedMatchers: matchersForManifest(manifest),
        })
        const j = rtToLexicalJson(root)
        editor.update(() => {
          const sel = $getSelection()
          if (!$isRangeSelection(sel)) return
          const nodes = $generateNodesFromSerializedNodes(j.root.children as Parameters<typeof $generateNodesFromSerializedNodes>[0])
          $insertGeneratedNodes(editor, nodes, sel)
        })
        return true
      },
      COMMAND_PRIORITY_NORMAL,
    )
  }, [editor, variant, manifest, status])

  return null
}
