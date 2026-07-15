import type { SiteSettings } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { adaptFooter } from "../../runtime/footer"

export const variantId = "shadcnui-blocks.footer-02" as const
export function adaptVariant(settings: SiteSettings, mediaResolver?: MediaResolver) {
  return adaptFooter(settings, mediaResolver)
}
