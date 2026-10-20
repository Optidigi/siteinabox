"use client"
import * as React from "react"
import { useLexicalComposerContext } from "@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext"
import { COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND, INSERT_LINE_BREAK_COMMAND } from "@payloadcms/richtext-lexical/lexical"

/**
 * In inline-variant editors (hero headline, eyebrow, etc.) we don't want
 * Enter to insert a new paragraph — RtInlineRoot has no paragraph node
 * and the live-site renderer would lose the second paragraph anyway.
 *
 * Both plain Enter and Shift+Enter insert a soft line break (LineBreakNode)
 * instead. This keeps the form's dirty-state in sync (the previous
 * "swallow plain Enter" behaviour broke the save flow when Enter was the
 * user's first keystroke — no state change → never dirty → Save button
 * stayed disabled).
 */
export const InlineConstraintPlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext()
  React.useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        event?.preventDefault()
        editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)
        return true
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor])
  return null
}
