import { describe, expect, it } from "vitest"
import { BlockSchema } from "@siteinabox/contracts"
import { EditorBlockSchema, isPersistedEditorBlock } from "@/lib/editor/editorBlock"

describe("EditorBlockSchema", () => {
  it("accepts a contract-complete hero block", () => {
    const block = {
      id: "hero-1",
      blockType: "hero",
      variant: "hero-01",
      heading: "Example",
      body: "A concise introduction.",
      primaryAction: { label: "Contact", href: "/contact" },
    }
    const persisted = BlockSchema.safeParse(block)
    expect(persisted.success, persisted.success ? "" : JSON.stringify(persisted.error.issues)).toBe(true)
    expect(EditorBlockSchema.safeParse(block).success).toBe(true)
    expect(isPersistedEditorBlock(block)).toBe(true)
  })

  it("accepts an in-progress draft with only blockType", () => {
    const block = { blockType: "hero", id: "draft-1" }
    expect(EditorBlockSchema.safeParse(block).success).toBe(true)
    expect(isPersistedEditorBlock(block)).toBe(false)
  })

  it("rejects rows without blockType", () => {
    expect(EditorBlockSchema.safeParse({ id: "x" }).success).toBe(false)
  })
})
