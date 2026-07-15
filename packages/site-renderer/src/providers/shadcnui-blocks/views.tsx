import * as React from "react"
import type { Block, SiteSettings } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../blocks/types"
import type { MediaResolver } from "../../media"
import { ShadcnUiBannerView } from "./banner-views"
import { ShadcnUiFooterView } from "./footer-views"
import { ShadcnUiNavbarView } from "./navbar-views"
import { ShadcnUiExplicitBlockView } from "./block-views.generated"

export function ShadcnUiBlockView({ block, options, variant }: { block: Block; options: BlockRenderOptions; variant: string }) {
  const embedsNavigation = variant === "shadcnui-blocks.hero-03" || variant === "shadcnui-blocks.hero-08"
  return <>{embedsNavigation && options.siteSettings ? <ShadcnUiChromeView area="header" variant="shadcnui-blocks.navbar-01" settings={options.siteSettings} mediaResolver={options.mediaResolver} /> : null}<ShadcnUiExplicitBlockView block={block} options={options} variant={variant} /></>
}

export function ShadcnUiChromeView({ area, variant, settings, currentSlug, mediaResolver }: { area: "header" | "footer" | "banner"; variant: string; settings: SiteSettings; currentSlug?: string; mediaResolver?: MediaResolver }) {
  if (area === "banner") return <ShadcnUiBannerView variant={variant} settings={settings} />
  if (area === "header") return <ShadcnUiNavbarView variant={variant} settings={settings} currentSlug={currentSlug} mediaResolver={mediaResolver} />
  return <ShadcnUiFooterView variant={variant} settings={settings} mediaResolver={mediaResolver} />
}
