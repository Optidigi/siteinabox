import { sectionAnalyticsAttrs } from "../../../analytics"
import type { ProviderBlockModel } from "./content"

export const providerBlockAttributes = (model: ProviderBlockModel, variant: string) => ({
  ...model.options.sectionAttributes,
  ...sectionAnalyticsAttrs(model.block.analytics, model.block.blockType, model.options.index),
  "data-block-index": model.options.index,
  "data-provider-block": "shadcnui-blocks",
  "data-provider-token-mode": "theme",
  "data-provider-variant": variant,
  "data-source-variant": variant,
  id: model.block.anchor || undefined,
})
