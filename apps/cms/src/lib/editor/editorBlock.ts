import { BlockSchema, MediaRefSchema, type Block } from "@siteinabox/contracts"
import { z } from "zod"

const editorWireIdSchema = z.union([z.string(), z.number()]).optional()

/** Stable wire id used for iframe selection and mobile section identity. */
export type EditorBlockWire = {
  id?: string | number
}

/** Contract-complete block in the editor (save-time Payload validation still authoritative). */
export type PersistedEditorBlock = Block & EditorBlockWire

/**
 * In-progress row: discriminated by `blockType` but may omit contract-required
 * fields until the operator finishes editing.
 */
export type DraftEditorBlock = EditorBlockWire & {
  blockType: string
} & Record<string, unknown>

/** Page-editor block document: complete contract block or in-progress draft. */
export type EditorBlock = PersistedEditorBlock | DraftEditorBlock

const draftEditorBlockSchema = z
  .object({
    blockType: z.string().min(1),
    id: editorWireIdSchema,
  })
  .passthrough()

const persistedEditorBlockSchema = BlockSchema.and(
  z.object({
    id: editorWireIdSchema,
  }),
)

/**
 * Validates editor blocks: full contract blocks via `BlockSchema`, otherwise
 * draft rows with required `blockType` and optional wire `id`. Completeness
 * for publish/save remains enforced by Payload and contracts on submit.
 */
export const EditorBlockSchema: z.ZodType<EditorBlock> = z.union([
  persistedEditorBlockSchema,
  draftEditorBlockSchema,
])

export const editorPageSeoSchema = z
  .object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    ogImage: MediaRefSchema.nullish(),
  })
  .nullish()

export type EditorPageSeo = z.infer<typeof editorPageSeoSchema>

export type EditorPageFormBlocks = EditorBlock[]

export const isPersistedEditorBlock = (block: EditorBlock): block is PersistedEditorBlock =>
  BlockSchema.safeParse(block).success

export const isEditorBlock = (value: unknown): value is EditorBlock =>
  EditorBlockSchema.safeParse(value).success
