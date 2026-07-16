import * as React from "react"
import { SHADCNUI_BLOCK_VARIANTS, type Block, type SiteSettings } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../blocks/types"
import type { MediaResolver } from "../../media"
import { ShadcnUiBannerView } from "./banner-views"
import { ShadcnUiFooterView } from "./footer-views"
import { ShadcnUiNavbarView } from "./navbar-views"
import { ShadcnUiExplicitBlockView } from "./block-views.generated"
import { ShadcnUiLegalContentView } from "./system-views"

export function ShadcnUiBlockView({ block, options, variant }: { block: Block; options: BlockRenderOptions; variant: string }) {
  if (variant === "shadcnui-blocks.legal-content-01") {
    if (block.blockType !== "contentSection") throw new Error(`Unresolved provider block variant "${variant}" for block type "${block.blockType}".`)
    return <ShadcnUiLegalContentView block={block} options={options} />
  }
  const embedsNavigation = SHADCNUI_BLOCK_VARIANTS.find((entry) => entry.id === variant)?.composition.embedsNavigation ?? false
  const headerVariant = options.siteSettings?.chrome?.header?.variant
  return <>{embedsNavigation && options.siteSettings && headerVariant ? <ShadcnUiChromeView area="header" variant={headerVariant} settings={options.siteSettings} mediaResolver={options.mediaResolver} /> : null}<ShadcnUiExplicitBlockView block={block} options={options} variant={variant} /></>
}

export function ShadcnUiChromeView({ area, variant, settings, currentSlug, mediaResolver }: { area: "header" | "footer" | "banner"; variant: string; settings: SiteSettings; currentSlug?: string; mediaResolver?: MediaResolver }) {
  if (area === "banner") return <ShadcnUiBannerView variant={variant} settings={settings} />
  if (area === "header") return <ShadcnUiNavbarView variant={variant} settings={settings} currentSlug={currentSlug} mediaResolver={mediaResolver} />
  return <ShadcnUiFooterView variant={variant} settings={settings} mediaResolver={mediaResolver} />
}
