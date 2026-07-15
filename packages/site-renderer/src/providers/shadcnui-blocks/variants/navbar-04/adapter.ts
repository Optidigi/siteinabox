import type { SiteSettings } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { adaptNavbar } from "../../runtime/navbar"

export const variantId = "shadcnui-blocks.navbar-04" as const
export function adaptVariant(settings: SiteSettings, currentSlug?: string, mediaResolver?: MediaResolver) {
  return adaptNavbar(settings, currentSlug, mediaResolver)
}
