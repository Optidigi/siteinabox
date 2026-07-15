import * as React from "react"
import type { RtRoot, SiteSettings } from "@siteinabox/contracts"
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
  return <main aria-label={`404 — ${settings.siteName}`} data-pathname={pathname} data-siab-theme-overrides="" data-provider-token-mode="reference" data-provider-variant={variant} data-system-template={variant} data-system-template-kind="not-found"><View /></main>
}
export function ShadcnUiLegalContentView({ title, body }: { title: string; body: RtRoot }) {
  return <section className="bg-background py-16 text-foreground sm:py-24" data-provider-token-mode="reference" data-provider-variant="shadcnui-blocks.timeline-01" data-legal-content-layout="long-form"><article className="mx-auto max-w-3xl px-6"><header className="border-b border-border pb-8"><p className="text-sm font-semibold text-primary">Juridisch</p><h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1></header><div className="prose mt-10 max-w-none dark:prose-invert"><RichTextRenderer value={body} /></div></article></section>
}
