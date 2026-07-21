import * as React from "react"
import { validateSiteChromeCapabilities, type SiteSettings } from "@siteinabox/contracts"
import { Button, Input, Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
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
  const brand = <div>{<FooterBrand model={model} />}{model.tagline ? <p className="mt-4 text-muted-foreground">{model.tagline}</p> : null}</div>
  const copyright = <span className="text-muted-foreground">{model.copyright ?? model.siteName}</span>
  const social = <FooterSocial model={model} />
  const bottom = <div className="flex flex-col-reverse items-center justify-between gap-x-2 gap-y-5 px-6 py-8 sm:flex-row xl:px-0">{copyright}{social}</div>

  if (number === 1) return <div className="mx-auto max-w-(--breakpoint-xl)"><div className="grid grid-cols-2 gap-x-8 gap-y-10 px-6 py-12 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:px-0"><FooterColumns model={model} /></div><Separator /><div className="flex flex-col items-center justify-between gap-x-2 gap-y-4 px-6 py-8 sm:flex-row xl:px-0"><FooterBrand model={model} /><div className="flex flex-wrap items-center gap-4">{copyright}<FooterFlatLinks model={model} /></div></div></div>
  if (number === 2 || number === 3) return <div className="mx-auto max-w-(--breakpoint-xl)"><div className="grid grid-cols-2 gap-x-8 gap-y-10 px-6 py-12 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 xl:px-0"><div className="col-span-full xl:col-span-2">{brand}</div><FooterColumns model={model} />{number === 3 ? <div className="col-span-2"><Newsletter model={model} variant={variant} /></div> : null}</div><Separator />{bottom}</div>
  if (number === 4) return <div className="mx-auto max-w-(--breakpoint-xl)"><div className="flex flex-col items-start justify-between gap-x-8 gap-y-10 px-6 py-12 sm:flex-row xl:px-0"><div>{brand}<FooterFlatLinks className="mt-6 flex flex-wrap items-center gap-4" model={model} /></div><div className="w-full max-w-xs"><Newsletter model={model} variant={variant} /></div></div><Separator />{bottom}</div>
  if (number === 5) return <div className="mx-auto max-w-(--breakpoint-xl)"><div className="flex flex-col items-center justify-start py-12">{brand}<FooterFlatLinks className="mt-6 flex flex-wrap items-center gap-4" model={model} /></div><Separator />{bottom}</div>
  if (number === 6) return <div className="flex items-center justify-between bg-background px-6 py-4"><FooterBrand className="flex items-center gap-2" model={model} /><p className="font-medium text-muted-foreground text-sm">{model.copyright ?? model.siteName}</p></div>
  return <div className="mx-auto w-full max-w-screen-2xl divide-y"><div className="flex flex-col items-center justify-between gap-4 px-2 pt-3 pb-5 sm:flex-row"><FooterBrand className="flex items-center gap-2" model={model} /><FooterFlatLinks className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-medium text-sm" model={model} /></div><div className="flex flex-col-reverse items-center justify-between gap-4 px-2 pt-4 pb-2 sm:flex-row"><p className="font-medium text-muted-foreground text-sm">{model.copyright ?? model.siteName}</p>{social}</div></div>
}

export function ShadcnUiFooterView({ variant, settings, mediaResolver }: { variant: string; settings: SiteSettings; mediaResolver?: MediaResolver }) {
  if (!variants.has(variant)) throw new Error(`Unresolved provider chrome variant "${variant}" for footer.`)
  const effectiveSettings = { ...settings, chrome: { ...settings.chrome, footer: { ...settings.chrome?.footer, variant } } } as SiteSettings
  const issues = validateSiteChromeCapabilities(effectiveSettings).filter((issue) => issue.path === "navFooter" || issue.path.startsWith("chrome.footer"))
  if (issues.length) throw new Error(`Invalid ${variant} settings: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`)
  const model = adaptFooter(effectiveSettings, mediaResolver)
  if (!model) return null
  return <footer className={`border-t bg-background provider-footer-${variant.slice(-2)}`} data-site-chrome="footer" data-provider-token-mode="theme" data-provider-variant={variant}><Footer model={model} variant={variant} /></footer>
}
