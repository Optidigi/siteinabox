import * as React from "react"
import { validateSiteChromeCapabilities, type SiteSettings } from "@siteinabox/contracts"
import { Button, Input } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../media"
import { adaptFooter, FooterBrand, FooterColumns, FooterFlatLinks, FooterSocial, type FooterViewModel } from "./runtime/footer"

const variants = new Set(Array.from({ length: 7 }, (_, index) => `shadcnui-blocks.footer-${String(index + 1).padStart(2, "0")}`))

function Newsletter({ model, variant }: { model: FooterViewModel; variant: string }) {
  const newsletter = model.newsletter
  if (!newsletter) return null
  const id = `provider-newsletter-${variant}`
  return <div className="space-y-4">{newsletter.title ? <h6 className="font-medium">{newsletter.title}</h6> : null}<form action={newsletter.action} className="flex max-w-md gap-2" method={newsletter.method.toLowerCase()}><label className="sr-only" htmlFor={id}>{newsletter.placeholder}</label><Input id={id} name="email" placeholder={newsletter.placeholder} required type="email" /><Button type="submit">{newsletter.submitLabel}</Button></form></div>
}

function Footer({ model, variant }: { model: FooterViewModel; variant: string }) {
  const number = Number(variant.slice(-2))
  const brand = <div className="space-y-4"><FooterBrand model={model} />{model.tagline ? <p className="max-w-sm text-muted-foreground">{model.tagline}</p> : null}</div>
  const bottom = <div className="flex flex-col gap-4 border-t pt-6 text-sm md:flex-row md:items-center md:justify-between"><p className="text-muted-foreground">{model.copyright ?? model.siteName}</p><FooterFlatLinks model={model} /><FooterSocial model={model} /></div>

  if (number === 2 || number === 5) return <div className="mx-auto max-w-(--breakpoint-xl) space-y-10 px-6 py-12"><div className="flex flex-col items-center gap-6 text-center">{brand}<FooterFlatLinks className="flex flex-wrap items-center justify-center gap-6" model={model} /><FooterSocial model={model} /></div>{bottom}</div>
  if (number === 3 || number === 4) return <div className="mx-auto max-w-(--breakpoint-xl) space-y-12 px-6 py-14"><div className="grid gap-10 lg:grid-cols-[1.2fr_2fr_1.2fr]">{brand}<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"><FooterColumns model={model} /></div><Newsletter model={model} variant={variant} /></div>{bottom}</div>
  if (number === 6) return <div className="mx-auto max-w-(--breakpoint-xl) space-y-12 px-6 py-16"><div className="flex flex-col gap-8 border-b pb-10 md:flex-row md:items-end md:justify-between">{brand}<FooterSocial model={model} /></div><div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"><FooterColumns model={model} /></div>{bottom}</div>
  if (number === 7) return <div className="mx-auto max-w-(--breakpoint-xl) space-y-10 px-6 py-12"><div className="grid gap-10 md:grid-cols-[1fr_2fr]">{brand}<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"><FooterColumns model={model} /></div></div>{bottom}</div>
  return <div className="mx-auto max-w-(--breakpoint-xl) space-y-12 px-6 py-14"><div className="grid gap-10 lg:grid-cols-[1fr_2fr]">{brand}<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"><FooterColumns model={model} /></div></div>{bottom}</div>
}

export function ShadcnUiFooterView({ variant, settings, mediaResolver }: { variant: string; settings: SiteSettings; mediaResolver?: MediaResolver }) {
  if (!variants.has(variant)) throw new Error(`Unresolved provider chrome variant "${variant}" for footer.`)
  const effectiveSettings = { ...settings, chrome: { ...settings.chrome, footer: { ...settings.chrome?.footer, variant } } } as SiteSettings
  const issues = validateSiteChromeCapabilities(effectiveSettings).filter((issue) => issue.path === "navFooter" || issue.path.startsWith("chrome.footer"))
  if (issues.length) throw new Error(`Invalid ${variant} settings: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`)
  const model = adaptFooter(effectiveSettings, mediaResolver)
  if (!model) return null
  return <footer className={`border-t bg-background provider-footer-${variant.slice(-2)}`} data-provider-token-mode="theme" data-provider-variant={variant}><Footer model={model} variant={variant} /></footer>
}
