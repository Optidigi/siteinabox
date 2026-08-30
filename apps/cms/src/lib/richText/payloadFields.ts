import type { JSONField } from "payload"

export type RichTextEditorKind = "richTextInline" | "richTextBlock"
type JsonAdmin = NonNullable<JSONField["admin"]>

const jsonAdmin = (editor: RichTextEditorKind, description: string): JsonAdmin =>
  ({ editor, description }) as unknown as JsonAdmin

/** Payload JSON fields for settings-owned structured RtRoot documents. */
export const richInlineField = (name: string, description: string): JSONField => ({
  name,
  type: "json",
  admin: jsonAdmin("richTextInline", description),
})

export const richBlockField = (name: string, description: string): JSONField => ({
  name,
  type: "json",
  admin: jsonAdmin("richTextBlock", description),
})
