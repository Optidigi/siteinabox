import * as React from "react"
import type { Block, SiteSettings } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../blocks/types"
import { RichTextRenderer } from "../../rich-text"
import NotFound01 from "./variants/not-found-01/not-found"
import NotFound02 from "./variants/not-found-02/not-found"
import NotFound03 from "./variants/not-found-03/not-found"
import NotFound04 from "./variants/not-found-04/not-found"
import NotFound05 from "./variants/not-found-05/not-found"
import NotFound06 from "./variants/not-found-06/not-found"
import NotFound07 from "./variants/not-found-07/not-found"
import NotFound08 from "./variants/not-found-08/not-found"

const notFoundViews = {
  "shadcnui-blocks.not-found-01": NotFound01,
  "shadcnui-blocks.not-found-02": NotFound02,
  "shadcnui-blocks.not-found-03": NotFound03,
  "shadcnui-blocks.not-found-04": NotFound04,
  "shadcnui-blocks.not-found-05": NotFound05,
  "shadcnui-blocks.not-found-06": NotFound06,
  "shadcnui-blocks.not-found-07": NotFound07,
  "shadcnui-blocks.not-found-08": NotFound08,
} as const

export function ShadcnUiNotFoundView({ variant, settings, pathname }: { variant: string; settings: SiteSettings; pathname?: string }) {
  const View = notFoundViews[variant as keyof typeof notFoundViews]
  if (!View) throw new Error(`Unresolved provider system template "${variant}" for notFound.`)
  return <main aria-label={`404 — ${settings.siteName}`} data-pathname={pathname} data-siab-theme-overrides="" data-provider-token-mode="theme" data-provider-variant={variant} data-system-template={variant} data-system-template-kind="not-found"><View /></main>
}
export function ShadcnUiLegalContentView({ block, options }: { block: Extract<Block, { blockType: "contentSection" }>; options: BlockRenderOptions }) {
  const body = options.editSlots?.renderRichText
    ? options.editSlots.renderRichText({ name: "contentSection.body", value: block.body, variant: "block", as: "div", className: "prose max-w-none dark:prose-invert", elementPath: { blockIndex: options.index, field: "body" }, blockMode: "text" })
    : <div className="prose max-w-none dark:prose-invert"><RichTextRenderer value={block.body} /></div>
  return <section className="bg-background py-16 text-foreground sm:py-24" data-provider-token-mode="theme" data-provider-variant="shadcnui-blocks.legal-content-01" data-legal-content-layout="long-form"><article className="mx-auto max-w-3xl px-6">{body}</article></section>
}
