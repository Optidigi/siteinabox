"use client"
import * as React from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { buildLexicalNodes, buildEditorTheme } from "@/lib/richText/lexical/buildNodeConfig"
import { rtToLexicalJson } from "@/lib/richText/lexical/rtToLexical"
import { lexicalJsonToRt } from "@/lib/richText/lexical/lexicalToRt"
import type { RtRoot } from "@/lib/richText/RtNode"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ThemeTokens } from "@/lib/theme/schema"
import { Toolbar } from "@/components/editor/richText/toolbar/toolbar"
import { LinkPopover } from "@/components/editor/richText/toolbar/link-popover"
import { SlashMenu } from "@/components/editor/richText/toolbar/slash-menu"
import { PastePlugin } from "./PastePlugin"
import { InlineConstraintPlugin } from "./InlineConstraintPlugin"
import { RtClassSyncPlugin } from "./RtClassSyncPlugin"
// Side-effect import: registers ThemedPill into ThemedNode's component
// registry (registerThemedPill at module bottom). Without this, Lexical's
// ThemedNode.decorate() runs before any ThemedPill code executes and renders
// the FallbackPill ("[themed: <id>]"). Importing here guarantees registration
// happens before any LexicalComposer mounts.
import "@/components/editor/richText/toolbar/themed-pill"

export interface LexicalFieldProps {
  value: RtRoot | undefined
  onChange: (next: RtRoot) => void
  manifest: RtManifest
  variant: "block" | "inline"
  placeholder?: string
  className?: string
  /** When true, the font-family chip is enabled in the toolbar(s). Dedicated
   *  RichText blocks opt in while small inline fields stay governed by role
   *  fonts. */
  allowFontFamily?: boolean
  theme?: ThemeTokens | null
}

export const LexicalField: React.FC<LexicalFieldProps> = ({ value, onChange, manifest, variant, placeholder, className, allowFontFamily = false, theme }) => {
  const initialValue: RtRoot = value ?? (variant === "block"
    ? { t: "root", variant: "block", children: [] }
    : { t: "root", variant: "inline", children: [] })

  const editorConfig = React.useMemo(() => ({
    namespace: "rt",
    nodes: buildLexicalNodes(variant),
    theme: buildEditorTheme(),
    editorState: JSON.stringify(rtToLexicalJson(initialValue, manifest)),
    onError: (e: Error) => { throw e },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [variant])
  // Note: initialValue is captured at first mount only. Lexical owns the state thereafter.

  const [linkOpen, setLinkOpen] = React.useState(false)

  const surface = (
    <div className={className ?? "rt-field rounded-md border border-border"}>
      <Toolbar manifest={manifest} variant={variant} allowFontFamily={allowFontFamily} theme={theme} onOpenLink={() => setLinkOpen(true)} />
      <div className="rt-field-body relative">
        <RichTextPlugin
          contentEditable={<ContentEditable className="rt-content min-h-[2.5rem] outline-none px-3 py-2" spellCheck={false} />}
          placeholder={
            <div className="rt-placeholder pointer-events-none text-muted-foreground px-3 py-2">{placeholder ?? ""}</div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
    </div>
  )

  return (
    <LexicalComposer initialConfig={editorConfig}>
      {surface}
      <HistoryPlugin />
      {variant === "block" && <ListPlugin />}
      <LinkPlugin />
      {variant === "block" && <SlashMenu manifest={manifest} />}
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(editorState) => {
          editorState.read(() => {
            const json = editorState.toJSON()
            const rt = lexicalJsonToRt(json as any, variant)
            onChange(rt)
          })
        }}
      />
      <LinkPopover open={linkOpen} onClose={() => setLinkOpen(false)} />
      <PastePlugin variant={variant} />
      <RtClassSyncPlugin />
      {variant === "inline" && <InlineConstraintPlugin />}
    </LexicalComposer>
  )
}
