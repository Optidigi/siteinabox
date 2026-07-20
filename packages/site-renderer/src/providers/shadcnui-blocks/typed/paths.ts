import type { RendererElementPath } from "../../../blocks/types"

export const elementPath = (
  blockIndex: number,
  field: string,
  itemIndex?: number,
  subField?: string,
): RendererElementPath => ({ blockIndex, field, itemIndex, subField })
