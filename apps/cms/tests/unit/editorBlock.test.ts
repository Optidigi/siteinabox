import { describe, expect, it } from "vitest"
import { BlockSchema } from "@siteinabox/contracts"
import { EditorBlockSchema, isPersistedEditorBlock } from "@/lib/editor/editorBlock"

describe("EditorBlockSchema", () => {
  it("accepts a contract-complete logoCloud block", () => {
    const block = {
      id: "logo-1",
      blockType: "logoCloud",
      designVariant: "shadcnui-blocks.logo-cloud-01",
      logos: [{
        name: "Example",
        image: { url: "/api/media/file/example.svg", alt: "Example" },
      }],
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
