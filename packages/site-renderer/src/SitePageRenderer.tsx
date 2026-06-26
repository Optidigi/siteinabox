import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import { cn } from "@siteinabox/ui/lib/utils"
import { BlockRenderer, type BlockRegistry } from "./blocks"
import { SiteFooter, SiteHeader } from "./chrome"
import type { MediaResolver } from "./media"
import { ThemeStyle, themeMode } from "./theme"

export type SitePageRendererProps = {
  page: Page
  settings: SiteSettings
  theme?: ThemeTokenSpec | null
  registry?: BlockRegistry
  mediaResolver?: MediaResolver
  formAction?: string
  className?: string
  canvasClassName?: string
  nonce?: string
  includeThemeStyle?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
}

export function SitePageRenderer({
  page,
  settings,
  theme,
  registry,
  mediaResolver,
  formAction,
  className,
  canvasClassName,
  nonce,
  includeThemeStyle = true,
  header,
  footer,
}: SitePageRendererProps) {
  return (
    <div className={cn("site-renderer", className)} data-siab-site-renderer>
      {includeThemeStyle && <ThemeStyle theme={theme} nonce={nonce} />}
      <div
        className={cn("rt-canvas w-full", canvasClassName)}
        data-rt-mode={themeMode(theme)}
        data-page-slug={page.slug}
      >
        <div className="site-frame-root">
          {header ?? <SiteHeader settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />}
          {page.blocks.map((block, index) => (
            <BlockRenderer
              key={`${block.blockType}-${index}`}
              block={block}
              index={index}
              registry={registry}
              options={{ mediaResolver, formAction }}
            />
          ))}
          {footer ?? <SiteFooter settings={settings} currentSlug={page.slug} mediaResolver={mediaResolver} />}
        </div>
      </div>
    </div>
  )
}
