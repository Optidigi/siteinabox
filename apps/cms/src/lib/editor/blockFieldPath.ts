import type { ElementPath } from "@/components/editor/elementPath"
import { elementPathToName } from "@/components/editor/elementPath"

/** Top-level block field path segments for react-hook-form. */
export type BlockFieldPath = {
  blockIndex: number
  field: string
}

/** Nested array item field path segments for react-hook-form. */
export type BlockArrayItemFieldPath = BlockFieldPath & {
  itemIndex: number
  subField?: string
}

export const blockFieldName = ({ blockIndex, field }: BlockFieldPath): string =>
  `blocks.${blockIndex}.${field}`

export const blockArrayItemFieldName = ({
  blockIndex,
  field,
  itemIndex,
  subField,
}: BlockArrayItemFieldPath): string =>
  elementPathToName({ blockIndex, field, itemIndex, subField })

export const blockFieldPathFromElementPath = (path: ElementPath): BlockFieldPath => ({
  blockIndex: path.blockIndex,
  field: path.field,
})

export const elementPathFieldName = (path: ElementPath): string => elementPathToName(path)
