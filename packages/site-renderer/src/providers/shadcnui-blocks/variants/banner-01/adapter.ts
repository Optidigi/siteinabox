import type { SiteSettings } from "@siteinabox/contracts"
import { adaptBanner } from "../../runtime/banner"

export const variantId = "shadcnui-blocks.banner-01" as const
export function adaptVariant(settings: SiteSettings) {
  return adaptBanner(settings)
}
